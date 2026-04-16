import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVoice, Voice } from '../src/index'

async function* toStream<T>(chunks: T[]) {
  for (const c of chunks)
    yield c
}

describe('createVoice', () => {
  it('returns a Voice instance', () => {
    const v = createVoice({
      stream: async () => toStream([]),
    })
    expect(v).toBeInstanceOf(Voice)
  })
})

describe('voice.executeCommands', () => {
  it('returns undefined for empty text', () => {
    const v = new Voice({ stream: async () => toStream([]) })
    expect(v.executeCommands('', 'delta')).toBeUndefined()
  })

  it('matches string array via includes', () => {
    const calls: string[] = []
    const v = new Voice({ stream: async () => toStream([]) })
    v.addCommand({
      match: ['stop'],
      stage: 'delta',
      handler: (t: string) => calls.push(t),
    })
    const cmd = v.executeCommands('please stop now', 'delta')
    expect(cmd).toBeDefined()
    expect(calls).toEqual(['please stop now'])
  })

  it('respects stage filter', () => {
    const v = new Voice({ stream: async () => toStream([]) })
    v.addCommand({ match: ['x'], stage: 'final', handler: () => {} })
    expect(v.executeCommands('x', 'delta')).toBeUndefined()
  })

  it('matches function predicate', () => {
    const v = new Voice({ stream: async () => toStream([]) })
    v.addCommand({
      match: t => t.startsWith('!'),
      stage: 'delta',
      stop: true,
    })
    const cmd = v.executeCommands('!cmd', 'delta')
    expect(cmd?.stop).toBe(true)
  })

  it('matches RegExp', () => {
    const v = new Voice({ stream: async () => toStream([]) })
    v.addCommand({
      match: /^#/,
      stage: 'delta',
    })
    expect(v.executeCommands('#tag', 'delta')).toBeDefined()
    expect(v.executeCommands('nope', 'delta')).toBeUndefined()
  })
})

describe('voice.shouldIgnoreUpdate', () => {
  it('ignores when snapshot unchanged', () => {
    const v = new Voice<string>({ stream: async () => toStream([]) })
    v.snapshot = 'same'
    expect(v.shouldIgnoreUpdate('same', 'x', Date.now())).toBe(true)
  })

  it('ignores when snapshot is in recent window', () => {
    const v = new Voice<string>({ stream: async () => toStream([]) })
    v.recent = ['seen']
    expect(v.shouldIgnoreUpdate('seen', 'a', Date.now())).toBe(true)
  })

  it('does not ignore when idle gap is large', () => {
    const v = new Voice<string>({ stream: async () => toStream([]) })
    v.snapshot = 'old'
    v.lastat = 1000
    const now = 2500
    expect(v.shouldIgnoreUpdate('new snap', 'new', now)).toBe(false)
  })

  it('does not ignore sentence endings in merged text', () => {
    const v = new Voice<string>({ stream: async () => toStream([]) })
    v.snapshot = ''
    v.merged = ''
    v.lastat = Date.now()
    expect(v.shouldIgnoreUpdate('你好。', '你好。', v.lastat + 10)).toBe(false)
  })

  it('ignores tiny growth when not ending and shortly after', () => {
    const v = new Voice<string>({ stream: async () => toStream([]) })
    v.snapshot = 'prefix'
    v.merged = 'pre'
    const t0 = 10_000
    v.lastat = t0
    expect(v.shouldIgnoreUpdate('prefixx', 'prefix', t0 + 50)).toBe(true)
  })
})

describe('voice.consume', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('merges stream chunks and invokes onDelta after debounce idle', async () => {
    const deltas: string[] = []
    const v = new Voice<string>({
      stream: async () => toStream([]),
      onDelta: d => deltas.push(d),
      deltaIdleMs: 50,
    })

    // 单块输出避免 shouldIgnoreUpdate 对「每步仅 +1 字」的节流过滤
    const stream = toStream<string>(['你好'])
    await v.consume(stream, 1)
    await vi.advanceTimersByTimeAsync(60)

    expect(deltas.length).toBeGreaterThan(0)
    expect(deltas.at(-1)).toContain('你好')
  })

  it('rolls prefix when segmentId changes', async () => {
    const v = new Voice<string>({
      stream: async () => toStream([]),
      deltaIdleMs: 50,
    })

    await v.consume(toStream(['第一段']), 1)
    await vi.advanceTimersByTimeAsync(60)
    const afterFirst = `${v.prefix}${v.merged}`.trim()

    // 跨段间隔需 >1000ms（与 shouldIgnoreUpdate 中 timegap 判断一致），否则新段首包可能被节流
    vi.setSystemTime(new Date('2026-01-01T00:00:01.100Z'))

    await v.consume(toStream(['第二段']), 2)
    await vi.advanceTimersByTimeAsync(60)

    expect(v.segmentId).toBe(2)
    expect(v.prefix).toContain(afterFirst)
    expect(v.merged).toContain('第二段')
  })
})

describe('voice.lock / unlock / clear', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('feed is ignored while locked', () => {
    const v = new Voice<string>({
      stream: async () => toStream([]),
    })
    v.lock(0)
    v.feed({ data: 'x', id: 1 })
    expect(v.chunk).toBeNull()
  })
})
