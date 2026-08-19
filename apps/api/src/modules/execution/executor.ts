import { Logger } from '@nestjs/common';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Semaphore } from './semaphore';

export type LangKey = 'python' | 'javascript' | 'cpp' | 'java';

export interface ExecOptions {
  /** Wall-clock limit for a single run. */
  timeoutMs?: number;
  /** stdout/stderr are truncated past this many bytes. */
  maxOutputBytes?: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  executionMs: number;
}

export interface RunOutcome extends ExecResult {
  compileError: string | null;
}

/** A compiled (or written-out) program that can be run repeatedly. */
export interface PreparedProgram {
  compileError: string | null;
  run(stdin: string, options?: ExecOptions): Promise<ExecResult>;
  dispose(): Promise<void>;
}

export const DEFAULT_TIMEOUT_MS = 8_000;
export const DEFAULT_COMPILE_TIMEOUT_MS = 20_000;
export const DEFAULT_MAX_OUTPUT = 64 * 1024;
export const MAX_CODE_LENGTH = 100_000;

const isWindows = process.platform === 'win32';

/**
 * Runs untrusted student code as a child process.
 *
 * NOTE: there is no kernel-level sandbox here — isolation comes from running
 * the API inside its own container (Phase 6). Guards in place: a concurrency
 * semaphore, wall-clock timeouts, output truncation and a code-length cap.
 */
export class Executor {
  private readonly logger = new Logger(Executor.name);
  private readonly semaphore: Semaphore;
  private readonly toolchain = new Map<string, string | null>();

  constructor(maxConcurrency = 20) {
    this.semaphore = new Semaphore(maxConcurrency);
  }

  get concurrency() {
    return {
      capacity: this.semaphore.capacity,
      free: this.semaphore.free,
      queued: this.semaphore.queued,
    };
  }

  // ── toolchain discovery ────────────────────────────────────────────

  /** Resolves an executable once and caches the answer (null when missing). */
  private resolveBinary(candidates: string[], envOverride?: string): string | null {
    const key = candidates.join('|') + (envOverride ?? '');
    if (this.toolchain.has(key)) return this.toolchain.get(key) ?? null;

    const override = envOverride ? process.env[envOverride] : undefined;
    const list = override ? [override, ...candidates] : candidates;

    let found: string | null = null;
    for (const bin of list) {
      try {
        const probe = spawnSync(bin, ['--version'], { timeout: 5_000, windowsHide: true });
        if (!probe.error) {
          found = bin;
          break;
        }
      } catch {
        // keep probing
      }
    }

    this.toolchain.set(key, found);
    if (!found) this.logger.warn(`No runtime found for: ${candidates.join(', ')}`);
    return found;
  }

  private binaryFor(lang: LangKey): { bin: string | null; label: string } {
    switch (lang) {
      case 'python':
        return {
          bin: this.resolveBinary(isWindows ? ['python', 'python3', 'py'] : ['python3', 'python'], 'PYTHON_BIN'),
          label: 'Python 3',
        };
      case 'javascript':
        return { bin: process.execPath, label: 'Node.js' };
      case 'cpp':
        return { bin: this.resolveBinary(['g++', 'clang++'], 'CXX_BIN'), label: 'g++' };
      case 'java':
        return { bin: this.resolveBinary(['javac'], 'JAVAC_BIN'), label: 'JDK (javac)' };
    }
  }

  /** Which languages this host can actually execute. */
  availability(): Record<LangKey, boolean> {
    return {
      python: this.binaryFor('python').bin !== null,
      javascript: true,
      cpp: this.binaryFor('cpp').bin !== null,
      java: this.binaryFor('java').bin !== null && this.resolveBinary(['java'], 'JAVA_BIN') !== null,
    };
  }

  // ── process plumbing ───────────────────────────────────────────────

  private spawnOnce(
    command: string,
    args: string[],
    options: { cwd: string; stdin?: string; timeoutMs: number; maxOutputBytes: number },
  ): Promise<ExecResult> {
    return new Promise<ExecResult>((resolve) => {
      const startedAt = Date.now();
      const child = spawn(command, args, {
        cwd: options.cwd,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let timedOut = false;
      let settled = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, options.timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes <= options.maxOutputBytes) stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes <= options.maxOutputBytes) stderr += chunk.toString('utf8');
      });

      const finish = (exitCode: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (stdoutBytes > options.maxOutputBytes) stdout += '\n…output truncated…';
        if (stderrBytes > options.maxOutputBytes) stderr += '\n…output truncated…';
        resolve({
          stdout,
          stderr,
          exitCode,
          timedOut,
          executionMs: Date.now() - startedAt,
        });
      };

      child.on('error', (err) => {
        stderr += `\n${err.message}`;
        finish(null);
      });
      child.on('close', (code) => finish(code));

      if (options.stdin !== undefined) {
        child.stdin.on('error', () => {
          /* the child may exit before reading stdin */
        });
        child.stdin.end(options.stdin);
      } else {
        child.stdin.end();
      }
    });
  }

  // ── preparation ────────────────────────────────────────────────────

  /**
   * Writes (and for cpp/java compiles) a program once so it can be run against
   * many test cases. Always call dispose().
   */
  async prepare(lang: LangKey, program: string, options: ExecOptions = {}): Promise<PreparedProgram> {
    if (program.length > MAX_CODE_LENGTH) {
      return this.failedProgram(`Program exceeds the ${MAX_CODE_LENGTH} character limit`);
    }

    const { bin, label } = this.binaryFor(lang);
    if (!bin) {
      return this.failedProgram(
        `${label} is not installed on this server, so ${lang} submissions cannot be executed.`,
      );
    }

    const dir = await mkdtemp(join(tmpdir(), 'simulyn-'));
    const dispose = async () => {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    };

    const compileTimeout = options.timeoutMs
      ? Math.max(options.timeoutMs, DEFAULT_COMPILE_TIMEOUT_MS)
      : DEFAULT_COMPILE_TIMEOUT_MS;
    const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT;

    try {
      switch (lang) {
        case 'python': {
          const file = join(dir, 'main.py');
          await writeFile(file, program, 'utf8');
          return {
            compileError: null,
            run: (stdin, o) => this.guardedRun(bin, ['-I', file], dir, stdin, o),
            dispose,
          };
        }

        case 'javascript': {
          const file = join(dir, 'main.js');
          await writeFile(file, program, 'utf8');
          return {
            compileError: null,
            run: (stdin, o) => this.guardedRun(bin, [file], dir, stdin, o),
            dispose,
          };
        }

        case 'cpp': {
          const src = join(dir, 'main.cpp');
          const out = join(dir, isWindows ? 'main.exe' : 'main');
          await writeFile(src, program, 'utf8');

          const compile = await this.semaphore.run(() =>
            this.spawnOnce(bin, ['-std=c++17', '-O2', '-w', '-o', out, src], {
              cwd: dir,
              timeoutMs: compileTimeout,
              maxOutputBytes,
            }),
          );

          if (compile.timedOut) {
            return { compileError: 'Compilation timed out', run: this.noRun, dispose };
          }
          if (compile.exitCode !== 0) {
            return {
              compileError: compile.stderr.trim() || 'Compilation failed',
              run: this.noRun,
              dispose,
            };
          }
          return {
            compileError: null,
            run: (stdin, o) => this.guardedRun(out, [], dir, stdin, o),
            dispose,
          };
        }

        case 'java': {
          const src = join(dir, 'Main.java');
          await writeFile(src, program, 'utf8');

          const compile = await this.semaphore.run(() =>
            this.spawnOnce(bin, ['-nowarn', '-d', dir, src], {
              cwd: dir,
              timeoutMs: compileTimeout,
              maxOutputBytes,
            }),
          );

          if (compile.timedOut) {
            return { compileError: 'Compilation timed out', run: this.noRun, dispose };
          }
          if (compile.exitCode !== 0) {
            return {
              compileError: compile.stderr.trim() || 'Compilation failed',
              run: this.noRun,
              dispose,
            };
          }

          const javaBin = this.resolveBinary(['java'], 'JAVA_BIN');
          if (!javaBin) {
            return { compileError: 'The java runtime is not installed on this server', run: this.noRun, dispose };
          }

          const mainClass = detectJavaMainClass(program) ?? 'Main';
          return {
            compileError: null,
            run: (stdin, o) => this.guardedRun(javaBin, ['-cp', dir, mainClass], dir, stdin, o),
            dispose,
          };
        }
      }
    } catch (error) {
      await dispose();
      return this.failedProgram(error instanceof Error ? error.message : 'Failed to prepare the program');
    }
  }

  private guardedRun(
    command: string,
    args: string[],
    cwd: string,
    stdin: string,
    options: ExecOptions = {},
  ): Promise<ExecResult> {
    return this.semaphore.run(() =>
      this.spawnOnce(command, args, {
        cwd,
        stdin,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxOutputBytes: options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT,
      }),
    );
  }

  private readonly noRun = (): Promise<ExecResult> =>
    Promise.resolve({ stdout: '', stderr: '', exitCode: null, timedOut: false, executionMs: 0 });

  private failedProgram(compileError: string): PreparedProgram {
    return {
      compileError,
      run: this.noRun,
      dispose: () => Promise.resolve(),
    };
  }

  // ── one-shot execution (POST /execute/run) ─────────────────────────

  async execute(
    lang: LangKey,
    code: string,
    stdin = '',
    options: ExecOptions = {},
  ): Promise<RunOutcome> {
    const prepared = await this.prepare(lang, code, options);
    try {
      if (prepared.compileError) {
        return {
          stdout: '',
          stderr: '',
          exitCode: null,
          timedOut: false,
          executionMs: 0,
          compileError: prepared.compileError,
        };
      }
      const result = await prepared.run(stdin, options);
      return { ...result, compileError: null };
    } finally {
      await prepared.dispose();
    }
  }
}

/**
 * Finds the class declaring `main`, so free-form Java snippets (Run mode) work
 * even when the class is not called Main.
 */
export function detectJavaMainClass(source: string): string | null {
  const mainIndex = source.search(/static\s+(public\s+)?void\s+main\s*\(/);
  if (mainIndex === -1) return null;

  const before = source.slice(0, mainIndex);
  const declarations = [...before.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)];
  const last = declarations.at(-1);
  return last ? last[1] : null;
}

/**
 * Java requires the public class to match the file name, and every import to
 * sit at the top of the file. Both are relaxed here so student code compiles
 * inside our generated Main.java.
 */
export function normaliseJavaSource(source: string): { imports: string[]; body: string } {
  const imports: string[] = [];
  const body = source
    .replace(/^\s*import\s+[^;]+;\s*$/gm, (line) => {
      imports.push(line.trim());
      return '';
    })
    .replace(/\bpublic\s+(?=(final\s+|abstract\s+)?class\s)/g, '');

  return { imports: [...new Set(imports)], body };
}
