import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LlmReply {
  ok: boolean;
  text: string | null;
  provider: string;
  latencyMs: number;
  error: string | null;
}

const REQUEST_TIMEOUT_MS = 45_000;

/** Talks to a local Ollama server. Failures are reported, never thrown. */
@Injectable()
export class OllamaClient {
  private readonly logger = new Logger(OllamaClient.name);

  constructor(private readonly config: ConfigService) {}

  get url(): string {
    return this.config.get<string>('mentor.ollamaUrl') ?? 'http://localhost:11434/api/chat';
  }

  get model(): string {
    return this.config.get<string>('mentor.ollamaModel') ?? 'phi3';
  }

  async chat(system: string, prompt: string): Promise<LlmReply> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        return {
          ok: false,
          text: null,
          provider: `ollama:${this.model}`,
          latencyMs: Date.now() - startedAt,
          error: `Ollama responded ${response.status}`,
        };
      }

      const body = (await response.json()) as {
        message?: { content?: string };
        response?: string;
      };
      const text = body.message?.content ?? body.response ?? null;

      if (!text) {
        return {
          ok: false,
          text: null,
          provider: `ollama:${this.model}`,
          latencyMs: Date.now() - startedAt,
          error: 'Ollama returned an empty response',
        };
      }

      return {
        ok: true,
        text: text.trim(),
        provider: `ollama:${this.model}`,
        latencyMs: Date.now() - startedAt,
        error: null,
      };
    } catch (error) {
      const message =
        (error as Error).name === 'AbortError'
          ? 'Ollama timed out'
          : `Could not reach Ollama at ${this.url}`;
      this.logger.warn(`${message} (${(error as Error).message})`);
      return {
        ok: false,
        text: null,
        provider: `ollama:${this.model}`,
        latencyMs: Date.now() - startedAt,
        error: message,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
