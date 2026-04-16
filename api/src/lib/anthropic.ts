import Anthropic from '@anthropic-ai/sdk';
import { HttpError } from './httpErrors.js';

export const MODEL = 'claude-sonnet-4-6';

export interface GenerateJsonTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [k: string]: unknown;
  };
}

// Lazy singleton so the API can boot without ANTHROPIC_API_KEY set — only
// AI endpoints fail (with a clear 503) until the key is configured.
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new HttpError(503, 'AI features are disabled: ANTHROPIC_API_KEY is not configured');
  }
  client = new Anthropic({ apiKey: key, timeout: 300_000 });
  return client;
}

// System prompt marked with ephemeral cache_control so callers that reuse the
// same system block within 5 min pay cached input prices. Good for field-
// generation where the campaign snapshot is stable across many calls.
function systemBlock(system: string) {
  return [
    {
      type: 'text' as const,
      text: system,
      cache_control: { type: 'ephemeral' as const },
    },
  ];
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
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemBlock(system),
    // Our GenerateJsonTool is structurally compatible with the SDK's Tool type;
    // the SDK's types pull in a huge union we don't need to pay the cost of.
    tools: [tool] as unknown as Anthropic.Messages.MessageCreateParams['tools'],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: user }],
  });

  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use' || block.name !== tool.name) {
    throw new HttpError(502, 'model did not return tool_use');
  }
  return block.input as T;
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
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemBlock(system),
    messages: [{ role: 'user', content: user }],
  });

  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();
  if (!text) throw new HttpError(502, 'model returned empty text');
  return text;
}
