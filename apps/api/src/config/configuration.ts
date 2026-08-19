export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string[];
  jwt: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  execution: {
    maxConcurrency: number;
    timeoutMs: number;
  };
  mentor: {
    ollamaUrl: string;
    ollamaModel: string;
    cloudProvider: string | null;
    cloudApiKey: string | null;
    cloudModel: string;
  };
}

/** Refresh cookie name — shared by the auth service and the refresh strategy. */
export const REFRESH_COOKIE = 'simulyn_refresh';

function int(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: int(process.env.PORT, 3001),
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-too',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  execution: {
    maxConcurrency: int(process.env.EXEC_MAX_CONCURRENCY, 20),
    timeoutMs: int(process.env.EXEC_TIMEOUT_MS, 8000),
  },
  mentor: {
    ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434/api/chat',
    ollamaModel: process.env.OLLAMA_MODEL ?? 'phi3',
    cloudProvider: process.env.CLOUD_LLM_PROVIDER ?? null,
    cloudApiKey: process.env.CLOUD_LLM_API_KEY ?? null,
    cloudModel: process.env.CLOUD_LLM_MODEL ?? 'claude-sonnet-5',
  },
});
