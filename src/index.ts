/* eslint-disable ts/explicit-function-return-type */
/* eslint-disable no-console */
import type { Fn } from '@hairy/utils'
import { debounce } from '@hairy/utils'
import { mergeCandidate, rememberRecent, stripAsrPrefix } from './utils'

export type AsyncIterableStream<T> = (AsyncIterable<T> & ReadableStream<T>) | AsyncGenerator<T>

export interface Chunk<T> {
  data: T
  id: number
}

export interface Command {
  /** 匹配条件：字符串数组、函数、正则表达式 */
  match: string[] | ((text: string) => boolean) | RegExp
  /** 阶段：delta 增量文本，final 最终文本 */
  stage: 'delta' | 'final'
  /** 是否停止后续处理 */
  stop?: boolean
  /** 是否清空 delta 状态 */
  clear?: boolean
  /** 处理函数 */
  handler?: (text: string) => any
}

export interface VoiceOptions<T> {
  stream: (chunk: Chunk<T>) => AsyncIterableStream<T> | Promise<AsyncIterableStream<T>>

  onDelta?: (delta: string) => void
  onFinal?: (final: string) => void

  onClear?: Fn<void | Promise<void>>

  finalIdleMs?: number
  deltaIdleMs?: number
  debug?: boolean
}

export class Voice<T> {
  listening = false

  // 当前正在处理的音频块
  chunk = null as Chunk<T> | null

  // 是否正在处理音频块
  processing = false

  /** 上一音频 chunk 的 segmentId，用于检测新段 */
  segmentId = undefined as number | undefined

  // 上一次的 stripped
  stripped = ''
  // 当前的快照
  snapshot = ''
  // 已完成段（停顿导致 segmentId 切换时，由 merged 滚入）
  prefix = ''
  // 当前 segmentId 内稳定累积文本
  merged = ''
  // 当前的流式响应
  delta = ''
  // 最终文本
  final = ''

  // 最近输出窗口，用于抑制循环刷屏
  recent = [] as string[]
  // 最近一次输出时间戳
  lastat = 0
  // 是否锁定避免处理
  locked = false

  // 自上次「有音频活动」起满 2s 后 finalize（任意 chunk 到达都会重置）
  doneTimer = null as ReturnType<typeof setTimeout> | null
  lockTimer = null as ReturnType<typeof setTimeout> | null

  private onDelta: (delta: string) => void
  private onFinal: (final: string) => void
  private onClear: () => void | Promise<void>

  options: VoiceOptions<T>

  commands = [] as Command[]

  constructor(options: VoiceOptions<T>) {
    this.onDelta = debounce(
      (delta: string) => {
        this.delta = delta
        this.options.debug && console.log('[voice] Delta: ', delta)
        const command = this.executeCommands(delta, 'delta')
        if (command?.stop)
          return
        this.options.onDelta?.(command?.clear ? '' : delta)
      },
      options.deltaIdleMs || 50,
    )

    this.onFinal = (final: string) => {
      this.final = final
      this.options.debug && console.log('[voice] Final: ', final)

      const command = this.executeCommands(final, 'final')

      if (command?.stop)
        return
      this.options.onFinal?.(command?.clear ? '' : final)
    }

    this.onClear = () => this.options.onClear?.()

    this.options = options
  }

  /**
   * 注册指令
   */
  addCommand(command: Command) {
    this.commands.push(command)
  }

  feed(chunk: Chunk<T>) {
    if (this.locked)
      return
    this.chunk = chunk
    this.process()
  }

  /**
   * 清空状态
   */
  async clear() {
    await this.onClear()
    this.stripped = ''
    this.prefix = ''
    this.merged = ''
    this.segmentId = undefined
    this.snapshot = ''
    this.recent = []
    this.lastat = 0
  }

  /**
   * 锁定处理
   */
  lock(timeout: number = 1000) {
    this.locked = true
    if (!timeout)
      return
    this.lockTimer && clearTimeout(this.lockTimer)
    this.lockTimer = setTimeout(() => void this.unlock(), timeout)
  }

  /**
   * 解锁处理
   */
  async unlock() {
    await this.clear()
    this.locked = false
  }

  /**
   * 完成处理
   */
  async done() {
    this.final = this.snapshot
    this.onFinal(this.snapshot)
    await this.clear()
    this.doneTimer = null
    this.lock()
  }

  /**
   * 当 finalIdleMs 启用时，无新音频 chunk 则 finalize（与「锁」无关，仅静音窗口）
   */
  finalize() {
    this.doneTimer && clearTimeout(this.doneTimer)
    this.doneTimer = setTimeout(() => void this.done(), this.options.finalIdleMs)
  }

  /**
   * 消费流式 ASR 响应
   * @param stream 流式 ASR 响应
   */
  async consume(stream: AsyncIterableStream<T>, segmentId: number) {
    // 1. 段落切换检测，保存前缀、清空累积文本
    if (this.segmentId !== undefined && segmentId !== this.segmentId) {
      this.prefix = `${this.prefix}${this.merged}`.trim()
      this.merged = ''
      this.stripped = ''
      this.recent = []
    }
    this.segmentId = segmentId

    let raw = ''
    for await (const delta of stream) {
      if (this.options.finalIdleMs)
        this.finalize()

      raw += delta
      const candidate = stripAsrPrefix(raw).trim()
      if (!candidate || (this.stripped.startsWith(candidate) && this.stripped !== candidate))
        continue

      // 2. 合并候选文本
      const merged = mergeCandidate(this.merged, candidate)
      const snapshot = `${this.prefix}${merged}`
      const now = Date.now()

      // 3. 过滤逻辑：抑制重复、摆动及高频无意义更新
      if (this.shouldIgnoreUpdate(snapshot, merged, now))
        continue

      // 4. 更新状态
      this.stripped = candidate
      this.merged = merged
      this.snapshot = snapshot
      this.lastat = now
      this.recent = rememberRecent(this.recent, snapshot)

      // 4. 发送增量文本
      this.onDelta(this.snapshot)
    }
  }

  /**
   * 处理音频块
   */
  async process() {
    if (this.processing || !this.chunk)
      return
    this.processing = true
    const { data, id } = this.chunk
    this.chunk = null
    try {
      const stream = await this.options.stream({ data, id })
      await this.consume(stream, id)
    }
    finally {
      this.processing = false
      this.chunk && this.process()
    }
  }

  /**
   * 内部指令执行器
   * @param text 当前文本
   * @param stage 匹配阶段
   */
  executeCommands(text: string, stage: 'delta' | 'final') {
    if (!text)
      return
    for (const command of this.commands) {
      if (command.stage !== stage)
        continue

      let isMatch = false
      if (Array.isArray(command.match)) {
        isMatch = command.match.some(m => text.includes(m))
      }
      else if (typeof command.match === 'function') {
        isMatch = command.match(text)
      }
      else if (command.match instanceof RegExp) {
        isMatch = command.match.test(text)
      }

      if (isMatch) {
        command.handler?.(text)
        // 如果声明了 stop，则停止后续处理
        return command
      }
    }
  }

  /**
   * 内部过滤算法：决定是否将当前 ASR 结果推送到 UI
   */
  shouldIgnoreUpdate(snapshot: string, merged: string, now: number): boolean {
    if (snapshot === this.snapshot || this.recent.includes(snapshot))
      return true

    const timegap = now - this.lastat
    const isEnding = /[，。！？,.!?]$/.test(merged)

    // 如果停顿时间长，或者是句子结尾，强制突破过滤锁
    if (timegap > 1000 || isEnding)
      return false

    const deltaLen = merged.length - this.merged.length

    // 抑制：增长过小且未到句子结尾
    if (deltaLen <= 1)
      return true

    // 节流：短时间内（<220ms）增长不够多则忽略
    if (timegap < 220 && deltaLen < 4)
      return true

    return false
  }
}

export function createVoice<T>(options: VoiceOptions<T>) {
  return new Voice<T>(options)
}
