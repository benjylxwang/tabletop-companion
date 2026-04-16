import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { supabaseService } from './supabaseService.js';
import { UPLOADS_BUCKET } from './uploadsBucket.js';
import { HttpError } from './httpErrors.js';
import type { GenerateJsonTool } from './anthropic.js';

const DEEPINFRA_BASE_URL = 'https://api.deepinfra.com/v1/openai';
const SIGN_TTL = 3600;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (client) return client;
  const key = process.env.DEEPINFRA_API_KEY;
  if (!key) throw new HttpError(503, 'AI features are disabled: DEEPINFRA_API_KEY is not configured');
  client = new OpenAI({ apiKey: key, baseURL: DEEPINFRA_BASE_URL, timeout: 120_000 });
  return client;
}

function textModel(): string {
  return process.env.DEEPINFRA_TEXT_MODEL ?? 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
}

function imageModel(): string {
  return process.env.DEEPINFRA_IMAGE_MODEL ?? 'black-forest-labs/FLUX-1-schnell';
}

export async function generateJson<T>({
  system,
  user,
  tool,
  maxTokens = 16_000,
}: {
  system: string;
  user: string;
  tool: GenerateJsonTool;
  maxTokens?: number;
}): Promise<T> {
  const res = await getClient().chat.completions.create({
    model: textModel(),
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema as Record<string, unknown>,
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: tool.name } },
  });

  const toolCall = res.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || !('function' in toolCall)) {
    throw new HttpError(502, 'model did not return tool call');
  }
  return JSON.parse(toolCall.function.arguments) as T;
}

export async function generateText({
  system,
  user,
  maxTokens = 1024,
}: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: textModel(),
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const text = res.choices[0]?.message?.content?.trim() ?? '';
  if (!text) throw new HttpError(502, 'model returned empty text');
  return text;
}

async function storeAndSign(
  buf: Buffer,
  contentType: string,
  userId: string,
): Promise<{ path: string; url: string; expires_at: string }> {
  const ext = contentType === 'image/jpeg' ? 'jpg' : 'png';
  const path = `${userId}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabaseService.storage
    .from(UPLOADS_BUCKET)
    .upload(path, buf, { contentType, upsert: false });
  if (uploadError) throw new HttpError(500, 'failed to store generated image');

  const { data: signData, error: signError } = await supabaseService.storage
    .from(UPLOADS_BUCKET)
    .createSignedUrl(path, SIGN_TTL);
  if (signError || !signData) throw new HttpError(500, 'failed to sign image URL');

  return {
    path,
    url: signData.signedUrl,
    expires_at: new Date(Date.now() + SIGN_TTL * 1000).toISOString(),
  };
}

export async function generateImage({
  prompt,
  userId,
}: {
  prompt: string;
  userId: string;
}): Promise<{ path: string; url: string; expires_at: string }> {
  const res = await getClient().images.generate({
    model: imageModel(),
    prompt,
    n: 1,
    size: '1024x1024',
    response_format: 'b64_json',
  });

  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new HttpError(502, 'image generation returned no data');

  return storeAndSign(Buffer.from(b64, 'base64'), 'image/png', userId);
}

// Uses DeepInfra's native inference API which supports custom high resolutions.
export async function generateImageLargeFormat({
  prompt,
  userId,
  width = 2048,
  height = 1024,
}: {
  prompt: string;
  userId: string;
  width?: number;
  height?: number;
}): Promise<{ path: string; url: string; expires_at: string }> {
  const key = process.env.DEEPINFRA_API_KEY;
  if (!key) throw new HttpError(503, 'AI features are disabled: DEEPINFRA_API_KEY is not configured');

  const model = imageModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  let resp: Response;
  try {
    resp = await fetch(`https://api.deepinfra.com/v1/inference/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, width, height, num_inference_steps: 4 }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new HttpError(502, `image generation failed: ${resp.status} ${text.slice(0, 120)}`);
  }

  const data = (await resp.json()) as { images?: string[] };
  const dataUri = data.images?.[0];
  if (!dataUri) throw new HttpError(502, 'image generation returned no data');

  // DeepInfra returns data URIs: "data:image/jpeg;base64,..."
  const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUri);
  if (!match) throw new HttpError(502, 'unexpected image format from generation API');

  const contentType = match[1] as string;
  const buf = Buffer.from(match[2] as string, 'base64');
  return storeAndSign(buf, contentType, userId);
}
