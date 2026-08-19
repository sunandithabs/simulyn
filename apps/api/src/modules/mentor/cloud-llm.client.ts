import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { LlmReply } from './ollama.client';

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_TOKENS = 700;

/**
 * Optional cloud fallback, used when Ollama is unreachable.
 * Enabled by setting CLOUD_LLM_PROVIDER (anthropic | openai) and CLOUD_LLM_API_KEY.
 */
@Injectable()
export class CloudLlmClient {
  private readonly logger = new Logger(CloudLlmClient.name);

  constructor(private readonly config: ConfigService) {}

  get provider(): string | null {
    return this.config.get<string>('mentor.cloudProvider')?.toLowerCase() ?? null;
  }

  private get apiKey(): string | null {
    return this.config.get<string>('mentor.cloudApiKey') ?? null;
  }

  private get model(): string {
    return this.config.get<string>('mentor.cloudModel') ?? 'claude-sonnet-5';
  }

  get enabled(): boolean {
    return Boolean(this.provider && this.apiKey);
  }

  async chat(system: string, prompt: string): Promise<LlmReply> {
    const startedAt = Date.now();
    const provider = this.provider;
    const apiKey = this.apiKey;

    if (!provider || !apiKey) {
      return {
        ok: false,
        text: null,
        provider: 'cloud',
        latencyMs: 0,
        error: 'No cloud LLM configured',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const text =
        provider === 'anthropic'
          ? await this.callAnthropic(system, prompt, apiKey, controller.signal)
          : provider === 'openai'
            ? await this.callOpenAi(system, prompt, apiKey, controller.signal)
            : null;

      if (text === null) {
        return {
          ok: false,
          text: null,
          provider: `${provider}:${this.model}`,
          latencyMs: Date.now() - startedAt,
          error: `Unsupported or failing cloud provider "${provider}"`,
        };
      }

      return {
        ok: true,
        text: text.trim(),
        provider: `${provider}:${this.model}`,
        latencyMs: Date.now() - startedAt,
        error: null,
      };
    } catch (error) {
      const message =
        (error as Error).name === 'AbortError' ? 'Cloud LLM timed out' : (error as Error).message;
      this.logger.warn(`Cloud LLM call failed: ${message}`);
      return {
        ok: false,
        text: null,
        provider: `${provider}:${this.model}`,
        latencyMs: Date.now() - startedAt,
        error: message,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async callAnthropic(
    system: string,
    prompt: string,
    apiKey: string,
    signal: AbortSignal,
  ): Promise<string | null> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      this.logger.warn(`Anthropic responded ${response.status}`);
      return null;
    }

    const body = (await response.json()) as { content?: { type: string; text?: string }[] };
    return body.content?.find((c) => c.type === 'text')?.text ?? null;
  }

  private async callOpenAi(
    system: string,
    prompt: string,
    apiKey: string,
    signal: AbortSignal,
  ): Promise<string | null> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      this.logger.warn(`OpenAI responded ${response.status}`);
      return null;
    }

    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content ?? null;
  }
}
