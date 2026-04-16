import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';
import { HttpError } from './httpErrors.js';

const { ANTHROPIC_API_KEY } = process.env;

if (!ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY');
}

export const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export const MODEL = 'claude-sonnet-4-5';


export type GenerateJsonTool = Tool;

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
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemBlock(system),
    tools: [tool],
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
  const res = await anthropic.messages.create({
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
