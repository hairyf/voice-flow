import type { Chunk } from 'voice-flow-x'
import { createVoice } from 'voice-flow-x'
import { create } from 'zustand'
import { useShallow } from 'zustand/shallow'
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
    recognition: null as SpeechRecognition | null,
    segmentId: 0,
    voice: createVoice<string>({
      async* stream(chunk: Chunk<string>) { yield chunk.data },
      onDelta: (delta: string) => set({ text: delta }),
      onFinal: (final: string) => set({ text: final }),
      deltaIdleMs: 50,
      finalIdleMs: 2000,
      debug: false,
    }),
  }

  function start() {
    get().stop()

    const recognition = context.recognition = new window.SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => set({ status: 'recording' })
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) {
          context.segmentId++
          context.voice.feed({ data: transcript, id: context.segmentId })
          // 收到 Final 时，清空当前的临时文本
          interimText = ''
        }
        else {
          interimText += transcript
        }
      }
      set({ interimText })
    }

    recognition.onend = () => {
      context.recognition = null
      set({ status: 'idle', interimText: '' })
    }
    recognition.onerror = () => {
      get().stop()
      set({ status: 'idle', interimText: '' })
    }
    recognition.start()
  }

  function stop() {
    if (context.recognition) {
      try {
        context.recognition.stop()
      }
      catch {
        // 捕获可能已经处于停止状态的 DOMException
      }
      context.recognition = null
    }
    set({ status: 'idle', interimText: '' })
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
      <p className="subtitle">Web Speech API (Zustand Local Closure)</p>

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

          {/* 已固化的文本 */}
          {text && <span className="final-text">{text}</span>}

          {/* 实时演进中的临时文本 */}
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
