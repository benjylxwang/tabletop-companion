import {
  generateJson as anthropicJson,
  generateText as anthropicText,
  type GenerateJsonTool,
} from './anthropic.js';
import {
  generateJson as deepinfraJson,
  generateText as deepinfraText,
  generateImage,
  generateImageLargeFormat,
} from './deepinfra.js';

export type { GenerateJsonTool };
export { generateImage, generateImageLargeFormat };

type Provider = 'anthropic' | 'deepinfra';

export async function generateJson<T>(params: {
  system: string;
  user: string;
  tool: GenerateJsonTool;
  maxTokens?: number;
  provider?: Provider;
}): Promise<T> {
  const { provider = 'anthropic', ...rest } = params;
  return provider === 'deepinfra' ? deepinfraJson<T>(rest) : anthropicJson<T>(rest);
}

export async function generateText(params: {
  system: string;
  user: string;
  maxTokens?: number;
  provider?: Provider;
}): Promise<string> {
  const { provider = 'anthropic', ...rest } = params;
  return provider === 'deepinfra' ? deepinfraText(rest) : anthropicText(rest);
}
