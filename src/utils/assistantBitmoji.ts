import idleSticker from '../assets/stickers/idle.png'
import peekingSticker from '../assets/stickers/peeking.png'
import thinkingSticker from '../assets/stickers/thinking.png'
import typingSticker from '../assets/stickers/ServerTakingTime.png'

export type AssistantPresenceState = 'idle' | 'peeking' | 'thinking' | 'typing'

export const assistantBitmojiPreviews: Record<AssistantPresenceState, string> = {
  idle: idleSticker,
  peeking: peekingSticker,
  thinking: thinkingSticker,
  typing: typingSticker,
}

export const getAssistantBitmojiPreviewUrl = (state: AssistantPresenceState) => assistantBitmojiPreviews[state]
