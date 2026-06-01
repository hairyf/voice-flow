export interface PostQwenASRBody {
  stream?: boolean
  extra_body?: any
  messages: any[]
}

const BASE_URL = '<YOUR_MODEL_URL>'
const MODEL = 'Qwen/Qwen3-ASR-1.7B'

export function postQwenASRChatCompletions(body: PostQwenASRBody) {
  const API_KEY = ''

  return fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify({ model: MODEL, ...body }),
  })
}
