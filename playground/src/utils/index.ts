/**
 * 1. 核心解析转换器
 * 将原始的 Uint8Array 块转换为解析后的字符串片段
 */
class SSETransformer implements Transformer<string, string> {
  private buffer = ''

  transform(chunk: string, controller: TransformStreamDefaultController<string>) {
    this.buffer += chunk
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''

    for (const line of lines) {
      const content = this.parseLine(line)
      if (content)
        controller.enqueue(content)
    }
  }

  flush(controller: TransformStreamDefaultController<string>) {
    // 处理最后剩余的数据
    const content = this.parseLine(this.buffer)
    if (content)
      controller.enqueue(content)
  }

  private parseLine(line: string): string {
    const s = line.trim()
    if (!s.startsWith('data:') || s.includes('[DONE]'))
      return ''
    try {
      const data = JSON.parse(s.slice(5))
      return data.choices?.[0]?.delta?.content ?? ''
    }
    catch {
      return ''
    }
  }
}

/**
 * 2. 优化后的主函数
 * 逻辑呈现为线性的“管道连接”
 */
export async function* streamASRResponse(response: Response): AsyncGenerator<string> {
  if (!response.ok || !response.body)
    return

  // 构建管道：原始流 -> 文本解码 -> ASR 逻辑解析
  const stream = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TransformStream(new SSETransformer()))

  const reader = stream.getReader()

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done)
        break
      yield value
    }
  }
  finally {
    reader.releaseLock()
  }
}
