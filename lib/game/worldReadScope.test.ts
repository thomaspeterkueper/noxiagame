import { describe, expect, it } from 'vitest'
import { WorldReadScope, worldReadCoalescingEnabled } from './worldReadScope'

describe('WorldReadScope', () => {
  it('coalesces concurrent loads within one scope and key', async () => {
    const scope = new WorldReadScope()
    let calls = 0
    const load = async () => { calls++; await Promise.resolve(); return { version: 1 } }
    const [a, b] = await Promise.all([scope.read('location:mars', load), scope.read('location:mars', load)])
    expect(calls).toBe(1)
    expect(a).toBe(b)
    await scope.read('location:mars', load)
    expect(calls).toBe(2)
  })

  it('does not coalesce across scopes or keys', async () => {
    const a = new WorldReadScope()
    const b = new WorldReadScope()
    let calls = 0
    const load = async () => { calls++; return 42 }
    await Promise.all([a.read('mars', load), a.read('moon', load), b.read('mars', load)])
    expect(calls).toBe(3)
  })

  it('retries after rejection', async () => {
    const scope = new WorldReadScope()
    let calls = 0
    await expect(scope.read('mars', async () => { calls++; throw new Error('offline') })).rejects.toThrow('offline')
    await expect(scope.read('mars', async () => { calls++; return 7 })).resolves.toBe(7)
    expect(calls).toBe(2)
  })

  it('invalidates an in-flight read without deleting its successor', async () => {
    const scope = new WorldReadScope()
    let release!: (value: number) => void
    const old = scope.read('mars', () => new Promise<number>(resolve => { release = resolve }))
    await Promise.resolve()
    scope.invalidate('mars')
    const fresh = scope.read('mars', async () => 2)
    release(1)
    expect(await old).toBe(1)
    expect(await fresh).toBe(2)
  })

  it('keeps feature off unless explicitly enabled', () => {
    expect(worldReadCoalescingEnabled(undefined)).toBe(false)
    expect(worldReadCoalescingEnabled('0')).toBe(false)
    expect(worldReadCoalescingEnabled('1')).toBe(true)
  })
})
