import type { AssistantMessageRequest, AssistantMessageResponse } from '../types/domain'

type StreamEvent =
  | { type: 'status'; value: string }
  | { type: 'delta'; text: string }
  | { type: 'final'; data: AssistantMessageResponse }
  | { type: 'error'; message: string }

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:2222/api/v1'

export const streamAssistantMessage = async ({
  token,
  payload,
  onDelta,
  onFinal,
}: {
  token: string
  payload: AssistantMessageRequest
  onDelta: (text: string) => void
  onFinal: (data: AssistantMessageResponse) => void
}) => {
  const response = await fetch(`${API_BASE_URL}/assistant/message/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok || !response.body) {
    throw new Error('Assistant stream failed')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      const event = JSON.parse(trimmed) as StreamEvent

      if (event.type === 'delta') {
        onDelta(event.text)
      }

      if (event.type === 'final') {
        onFinal(event.data)
      }

      if (event.type === 'error') {
        throw new Error(event.message)
      }
    }

    if (done) {
      break
    }
  }
}
