import type { Chunk } from 'voice-flow-x'
import { createVoice } from 'voice-flow-x'
import { create } from 'zustand'
import { useShallow } from 'zustand/shallow'
import { postQwenASRChatCompletions } from './apis'
import { blobToBase64, streamASRResponse } from './utils'
import './App.css'

// ==========================================
// 1. 类型定义
// ==========================================
interface VoiceStore {
  text: string
  interimText: string
  status: 'idle' | 'recording'

  start: () => void
  stop: () => void
  clear: () => void
  destroy: () => void
}

// ==========================================
// 2. Zustand 状态中心
// ==========================================
export const useVoice = create<VoiceStore>((set, get) => {
  const context = {
    mediaRecorder: null as MediaRecorder | null,
    mediaStream: null as MediaStream | null,
    segmentId: 0,
    voice: createVoice<Blob>({
      async* stream(chunk: Chunk<Blob>) {
        const base64 = await blobToBase64(chunk.data)
        const response = await postQwenASRChatCompletions({
          stream: true,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'audio_url', audio_url: { url: base64 } },
              ],
            },
          ],
        })
        return streamASRResponse(response)
      },
      onDelta: (delta: string) => set({ text: delta }),
      onFinal: (final: string) => set({ text: final }),
      deltaIdleMs: 50,
      finalIdleMs: 2000,
      debug: false,
    }),
  }

  async function start() {
    get().stop()

    try {
      const mediaStream = context.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = context.mediaRecorder = new MediaRecorder(mediaStream, {
        audioBitsPerSecond: 16000,
      })
      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          context.segmentId++
          context.voice.feed({ data: e.data, id: context.segmentId })
        }
      }
      mediaRecorder.onstart = () => set({ status: 'recording' })
      mediaRecorder.onstop = () => {
        context.mediaStream?.getTracks().forEach(t => t.stop())
        context.mediaStream = null
        context.mediaRecorder = null
        set({ status: 'idle', interimText: '' })
      }
      mediaRecorder.onerror = () => {
        get().stop()
        set({ status: 'idle', interimText: '' })
      }

      mediaRecorder.start(1000)
      set({ status: 'recording' })
    }
    catch {
      set({ status: 'idle' })
    }
  }

  function stop() {
    if (context.mediaRecorder && context.mediaRecorder.state !== 'inactive') {
      context.mediaRecorder.stop()
    }
    else {
      context.mediaStream?.getTracks().forEach(t => t.stop())
      context.mediaStream = null
      context.mediaRecorder = null
      set({ status: 'idle', interimText: '' })
    }
  }

  function clear() {
    context.voice.clear()
    set({ text: '', interimText: '' })
  }

  function destroy() {
    get().stop()
    context.voice.clear()
    set({ text: '', interimText: '', status: 'idle' })
  }

  return { text: '', interimText: '', status: 'idle', start, stop, clear, destroy }
})

// ==========================================
// 3. 高性能 UI 组件
// ==========================================
function App() {
  const { text, interimText, status } = useVoice(
    useShallow(s => ({ text: s.text, interimText: s.interimText, status: s.status })),
  )
  const { start, stop } = useVoice(
    useShallow(s => ({ start: s.start, stop: s.stop })),
  )

  const isRecording = status === 'recording'
  const hasContent = text || interimText

  return (
    <section id="voice-demo">
      <h1>Voice Flow Demo</h1>
      <p className="subtitle">Qwen3 ASR API (MediaRecorder + SSE)</p>

      <div className="controls">
        <button
          type="button"
          className={`btn ${isRecording ? 'btn-stop' : 'btn-start'}`}
          onClick={isRecording ? stop : start}
        >
          {isRecording ? '⏹ Stop' : '🎙 Start'}
        </button>
      </div>

      <div className="status">
        <span className={`dot ${isRecording ? 'dot-active' : ''}`} />
        {isRecording ? 'Listening...' : 'Idle'}
      </div>

      <div className="output">
        <p className="output-label">Recognized Text</p>
        <div className="output-text" style={{ whiteSpace: 'pre-wrap' }}>
          {!hasContent && <span className="placeholder">Waiting for speech input...</span>}

          {text && <span className="final-text">{text}</span>}

          {interimText && (
            <span className="interim">
              {' '}
              {interimText}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

export default App
