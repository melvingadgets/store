import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { setFrontEndFrozen } from '../lib/frontEndFreeze'
import type {
  AssistantConfidence,
  AssistantHandoffPayload,
  AssistantIntent,
  AssistantQuickReply,
  AssistantResponseKind,
  SwapConditionSelections,
} from '../types/domain'

export interface AssistantMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
  confidence?: AssistantConfidence
  kind?: AssistantResponseKind
  quickReplies?: AssistantQuickReply[]
  handoff?: AssistantHandoffPayload | null
  isStreaming?: boolean
}

export interface AssistantTradeInDraft extends Partial<SwapConditionSelections> {
  model?: string
  storage?: string
}

interface AssistantContextValue {
  isOpen: boolean
  intent: AssistantIntent | null
  messages: AssistantMessage[]
  tradeInDraft: AssistantTradeInDraft
  sessionId: string | null
  setOpen: (value: boolean) => void
  toggleOpen: () => void
  pushAssistantMessage: (message: Omit<AssistantMessage, 'id' | 'role'> & { text: string }) => string
  pushUserMessage: (text: string) => string
  patchMessage: (messageId: string, patch: Partial<Omit<AssistantMessage, 'id' | 'role'>>) => void
  appendMessageText: (messageId: string, text: string) => void
  setIntent: (intent: AssistantIntent | null) => void
  setSessionId: (sessionId: string | null) => void
  mergeTradeInDraft: (draft: Partial<AssistantTradeInDraft>) => void
  resetAssistant: () => void
}

const STORAGE_KEY = 'mel-store-assistant'

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const createWelcomeMessage = (): AssistantMessage => ({
  id: createId(),
  role: 'assistant',
  text: 'Hi. I can help with trade-ins and product questions.',
  confidence: 'high',
  kind: 'general_answer',
  handoff: null,
})

const AssistantContext = createContext<AssistantContextValue | null>(null)

export const AssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [intent, setIntent] = useState<AssistantIntent | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([createWelcomeMessage()])
  const [tradeInDraft, setTradeInDraft] = useState<AssistantTradeInDraft>({})
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    const savedState = window.sessionStorage.getItem(STORAGE_KEY)
    if (!savedState) {
      return
    }

    try {
      const parsedState = JSON.parse(savedState) as {
        isOpen?: boolean
        intent?: AssistantIntent | null
        messages?: AssistantMessage[]
        tradeInDraft?: AssistantTradeInDraft
        sessionId?: string | null
      }

      setIsOpen(Boolean(parsedState.isOpen))
      setIntent(parsedState.intent ?? null)
      setMessages(parsedState.messages?.length ? parsedState.messages : [createWelcomeMessage()])
      setTradeInDraft(parsedState.tradeInDraft ?? {})
      setSessionId(typeof parsedState.sessionId === 'string' && parsedState.sessionId.trim() ? parsedState.sessionId : null)
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        isOpen,
        intent,
        messages,
        tradeInDraft,
        sessionId,
      }),
    )
  }, [intent, isOpen, messages, sessionId, tradeInDraft])

  useEffect(() => {
    setFrontEndFrozen(isOpen)

    const previousBodyOverflow = document.body.style.overflow

    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = previousBodyOverflow
    }

    return () => {
      setFrontEndFrozen(false)
      document.body.style.overflow = previousBodyOverflow
    }
  }, [isOpen])

  const value = useMemo<AssistantContextValue>(() => ({
    isOpen,
    intent,
    messages,
    tradeInDraft,
    sessionId,
    setOpen: setIsOpen,
    toggleOpen: () => setIsOpen((current) => !current),
    pushAssistantMessage: (message) => {
      const id = createId()
      setMessages((current) => [...current, { id, role: 'assistant', handoff: null, ...message }])
      return id
    },
    pushUserMessage: (text: string) => {
      const id = createId()
      setMessages((current) => [...current, { id, role: 'user', text }])
      return id
    },
    patchMessage: (messageId, patch) =>
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? { ...message, ...patch } : message)),
      ),
    appendMessageText: (messageId, text) =>
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? { ...message, text: `${message.text}${text}` } : message)),
      ),
    setIntent,
    setSessionId,
    mergeTradeInDraft: (draft) => setTradeInDraft((current) => ({ ...current, ...draft })),
    resetAssistant: () => {
      setIntent(null)
      setSessionId(null)
      setTradeInDraft({})
      setMessages([createWelcomeMessage()])
      setIsOpen(true)
    },
  }), [intent, isOpen, messages, sessionId, tradeInDraft])

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  )
}

export const useAssistant = () => {
  const context = useContext(AssistantContext)
  if (!context) {
    throw new Error('useAssistant must be used within AssistantProvider')
  }

  return context
}
