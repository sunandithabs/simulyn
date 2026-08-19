/**
 * Counting semaphore.
 *
 * Every code execution acquires a slot before spawning a process, so a burst of
 * submissions (a whole class hitting Submit at once) queues instead of forking
 * hundreds of compilers.
 */
export class Semaphore {
  private available: number;
  private readonly waiters: (() => void)[] = [];

  constructor(private readonly max: number = 20) {
    if (max < 1) throw new Error('Semaphore capacity must be at least 1');
    this.available = max;
  }

  get capacity(): number {
    return this.max;
  }

  /** Slots currently free. */
  get free(): number {
    return this.available;
  }

  /** Callers parked waiting for a slot. */
  get queued(): number {
    return this.waiters.length;
  }

  /** Resolves once a slot is free. Always pair with release() in a finally. */
  acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  /** Frees a slot, handing it straight to the next waiter if there is one. */
  release(): void {
    const next = this.waiters.shift();
    if (next) {
      // The slot passes directly to the waiter — `available` stays at 0.
      next();
      return;
    }
    if (this.available < this.max) this.available += 1;
  }

  /** Runs `fn` while holding a slot. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
