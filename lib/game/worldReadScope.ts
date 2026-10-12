/**
 * Per-request world read coalescing.
 *
 * Instantiate this class only in one authenticated request/render scope. It must
 * never be stored as a module-level singleton, shared across users, or used to
 * cache a service-role result. Nothing is persisted across HTTP requests.
 *
 * Identical concurrent reads share one Promise. Completed reads are removed,
 * avoiding stale responses after building, assignment or knowledge mutations.
 */
export class WorldReadScope {
  private readonly pending = new Map<string, Promise<unknown>>()

  read<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key)
    if (existing) return existing as Promise<T>

    const task = Promise.resolve().then(load)
    this.pending.set(key, task)

    // Clean up on resolve AND reject, without introducing an unhandled
    // rejection from a discarded finally() promise.
    void task.then(
      () => { if (this.pending.get(key) === task) this.pending.delete(key) },
      () => { if (this.pending.get(key) === task) this.pending.delete(key) },
    )
    return task
  }

  /**
   * Invalidate in-flight reads on mutation. Old callers can still finish,
   * but subsequent callers must start a fresh read.
   */
  invalidate(key?: string): void {
    if (key === undefined) this.pending.clear()
    else this.pending.delete(key)
  }
}

/**
 * Feature switch for future call-site integration. Off by default.
 * Do not enable until the existing world/build loaders have been audited.
 */
export function worldReadCoalescingEnabled(
  raw: string | undefined = process.env.NOXIA_WORLD_READ_COALESCING,
): boolean {
  return raw === '1'
}
