/* eslint-disable ts/explicit-function-return-type */
// --- 工具函数优化 ---

/** 判断是否包含中日韩字符 */
export function containsCjk(text: string): boolean {
  // 使用更现代的正则方式，覆盖常见 CJK 范围
  return /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text)
}

/** 移除 ASR 特定前缀 (如 <asr_text>, language: zh 等) */
export function stripAsrPrefix(text: string): string {
  if (!text)
    return ''

  // 简化正则：匹配 <asr_text> 或 language 开头的标记及其后缀内容
  const ASR_PREFIX_RE = /^\s*(?:<asr_text>\s*)*language\s*[:=]?\s*[\w-]*\s*|^\s*<asr_text>\s*/i

  let cleaned = text
  for (let i = 0; i < 4; i++) {
    const next = cleaned.replace(ASR_PREFIX_RE, '')
    if (next === cleaned)
      break
    cleaned = next
  }

  cleaned = cleaned.trim()
  if (cleaned.toLowerCase() === 'language')
    return ''

  // 处理 "language" 后面紧跟正文的情况
  if (cleaned.toLowerCase().startsWith('language')) {
    const rest = cleaned.slice(8).replace(/^[ \t:=_-]+/, '')
    if (rest && (containsCjk(rest[0]) || rest.toLowerCase().startsWith('<asr_text>'))) {
      return rest.trim()
    }
  }
  return cleaned
}

export function commonPrefix(a: string, b: string): string {
  const hasCjk = containsCjk(a) || containsCjk(b)
  const normalize = (s: string) => hasCjk ? s.replace(/ /g, '') : s
  const s1 = normalize(a)
  const s2 = normalize(b)

  let i = 0
  while (i < s1.length && i < s2.length && s1[i] === s2[i]) i++
  return s1.slice(0, i)
}

export function calcOverlapSuffixPrefix(left: string, right: string): number {
  const max = Math.min(left.length, right.length)
  for (let size = max; size > 0; size--) {
    if (left.slice(-size) === right.slice(0, size))
      return size
  }
  return 0
}

export function mergeCandidate(previous: string, current: string): string {
  if (!previous)
    return current
  if (!current)
    return previous
  if (current.startsWith(previous))
    return current
  if (previous.startsWith(current))
    return previous

  const overlap = calcOverlapSuffixPrefix(previous, current)
  return overlap > 0 ? `${previous}${current.slice(overlap)}` : current
}

export function rememberRecent(list: string[], value: string, maxSize = 24): string[] {
  const next = [...list, value]
  return next.length > maxSize ? next.slice(next.length - maxSize) : next
}
