import { describe, expect, it } from 'vitest'
import {
  calcOverlapSuffixPrefix,
  commonPrefix,
  containsCjk,
  mergeCandidate,
  rememberRecent,
  stripAsrPrefix,
} from '../src/utils'

describe('containsCjk', () => {
  it('returns false for ASCII only', () => {
    expect(containsCjk('hello')).toBe(false)
  })

  it('returns true for CJK characters', () => {
    expect(containsCjk('你好')).toBe(true)
    expect(containsCjk('ひらがな')).toBe(true)
    expect(containsCjk('한글')).toBe(true)
  })
})

describe('stripAsrPrefix', () => {
  it('returns empty for empty input', () => {
    expect(stripAsrPrefix('')).toBe('')
  })

  it('strips language: zh style prefix', () => {
    expect(stripAsrPrefix('language: zh 你好')).toBe('你好')
  })

  it('strips <asr_text> prefix', () => {
    expect(stripAsrPrefix('<asr_text> hello')).toBe('hello')
  })

  it('returns empty when cleaned text is only language keyword', () => {
    expect(stripAsrPrefix('language')).toBe('')
  })

  it('handles language immediately followed by CJK body', () => {
    expect(stripAsrPrefix('language你好世界')).toBe('你好世界')
  })
})

describe('commonPrefix', () => {
  it('finds ASCII common prefix', () => {
    expect(commonPrefix('abcdef', 'abxyz')).toBe('ab')
  })

  it('ignores spaces when CJK is present', () => {
    expect(commonPrefix('a b 你好', 'ab你好')).toBe('ab你好')
  })

  it('returns empty when no overlap', () => {
    expect(commonPrefix('abc', 'xyz')).toBe('')
  })
})

describe('calcOverlapSuffixPrefix', () => {
  it('returns full overlap when suffix equals prefix', () => {
    expect(calcOverlapSuffixPrefix('abc', 'cde')).toBe(1)
  })

  it('returns 0 when no overlap', () => {
    expect(calcOverlapSuffixPrefix('ab', 'cd')).toBe(0)
  })

  it('returns max meaningful overlap', () => {
    expect(calcOverlapSuffixPrefix('foobar', 'obarbaz')).toBe(4)
  })
})

describe('mergeCandidate', () => {
  it('returns current when previous is empty', () => {
    expect(mergeCandidate('', 'hello')).toBe('hello')
  })

  it('returns previous when current is empty', () => {
    expect(mergeCandidate('hello', '')).toBe('hello')
  })

  it('returns longer string when one extends the other', () => {
    expect(mergeCandidate('hel', 'hello')).toBe('hello')
    expect(mergeCandidate('hello', 'hel')).toBe('hello')
  })

  it('merges using overlap', () => {
    expect(mergeCandidate('你好世', '世界')).toBe('你好世界')
  })

  it('returns current when no prefix relationship and no overlap', () => {
    expect(mergeCandidate('abc', 'def')).toBe('def')
  })
})

describe('rememberRecent', () => {
  it('appends and keeps order', () => {
    expect(rememberRecent(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('trims to maxSize from the end', () => {
    const list = Array.from({ length: 25 }, (_, i) => String(i))
    const next = rememberRecent(list, 'x', 24)
    expect(next).toHaveLength(24)
    expect(next.at(-1)).toBe('x')
  })
})
