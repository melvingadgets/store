import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MdChatBubbleOutline, MdClose, MdEdit, MdRefresh } from 'react-icons/md'
import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { useAssistant } from '../../context/AssistantContext'
import type { AssistantMessage } from '../../context/AssistantContext'
import type { RootState } from '../../redux/store'
import { streamAssistantMessage } from '../../utils/assistantStream'
import { extractErrorMessage } from '../../utils/axios'
import { assistantBitmojiPreviews, getAssistantBitmojiPreviewUrl } from '../../utils/assistantBitmoji'

const getProductIdFromPath = (pathname: string) => {
  const match = pathname.match(/^\/product\/([^/]+)/)
  return match?.[1] ?? undefined
}

type AssistantPresenceState = 'idle' | 'peeking' | 'thinking' | 'typing'

const USER_TYPING_PAUSE_MS = 850
const SERVER_TIME_STICKER_DELAY_MS = 450

const AssistantChat: React.FC = () => {
  const location = useLocation()
  const { isAuthenticated, user, token } = useSelector((state: RootState) => state.auth)
  const {
    isOpen,
    messages,
    sessionId,
    setOpen,
    toggleOpen,
    pushAssistantMessage,
    pushUserMessage,
    patchMessage,
    appendMessageText,
    setIntent,
    setSessionId,
    resetAssistant,
  } = useAssistant()
  const [inputValue, setInputValue] = useState('')
  const [presenceState, setPresenceState] = useState<AssistantPresenceState>('peeking')
  const [avatarCacheReady, setAvatarCacheReady] = useState(false)
  const [previousAvatarUrl, setPreviousAvatarUrl] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const lastUserIdRef = useRef<string | null>(user?._id ?? null)
  const messagesViewportRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const presenceRunRef = useRef(0)
  const avatarPreloadRef = useRef<Promise<void> | null>(null)
  const userTypingTimeoutRef = useRef<number | null>(null)
  const avatarTransitionTimeoutRef = useRef<number | null>(null)
  const lastAvatarUrlRef = useRef<string | null>(null)
  const presencePhaseTimeoutRef = useRef<number | null>(null)
  const shouldStickToBottomRef = useRef(true)

  const isVisibleRoute = location.pathname === '/' || location.pathname.startsWith('/product')
  const productId = getProductIdFromPath(location.pathname)

  const clearUserTypingTimer = () => {
    if (userTypingTimeoutRef.current) {
      window.clearTimeout(userTypingTimeoutRef.current)
      userTypingTimeoutRef.current = null
    }
  }

  const clearAvatarTransitionTimer = () => {
    if (avatarTransitionTimeoutRef.current) {
      window.clearTimeout(avatarTransitionTimeoutRef.current)
      avatarTransitionTimeoutRef.current = null
    }
  }

  const clearPresencePhaseTimer = () => {
    if (presencePhaseTimeoutRef.current) {
      window.clearTimeout(presencePhaseTimeoutRef.current)
      presencePhaseTimeoutRef.current = null
    }
  }

  const ensureAvatarCacheReady = () => {
    if (avatarPreloadRef.current) {
      return avatarPreloadRef.current
    }

    avatarPreloadRef.current = Promise.all(
      Object.values(assistantBitmojiPreviews).map(
        (src) =>
          new Promise<void>((resolve) => {
            const image = new Image()
            image.onload = () => resolve()
            image.onerror = () => resolve()
            image.src = src
          }),
      ),
    ).then(() => {
      setAvatarCacheReady(true)
    })

    return avatarPreloadRef.current
  }

  const beginPresenceLifecycle = () => {
    clearUserTypingTimer()
    clearPresencePhaseTimer()
    presenceRunRef.current += 1
    setPresenceState('thinking')
    const runId = presenceRunRef.current

    presencePhaseTimeoutRef.current = window.setTimeout(() => {
      if (presenceRunRef.current === runId) {
        setPresenceState('typing')
      }
      presencePhaseTimeoutRef.current = null
    }, SERVER_TIME_STICKER_DELAY_MS)

    return runId
  }

  const completePresenceLifecycle = (runId: number) => {
    clearPresencePhaseTimer()
    if (presenceRunRef.current !== runId) {
      return
    }

    setPresenceState('peeking')
  }

  useEffect(() => {
    const currentUserId = user?._id ?? null

    if (!currentUserId) {
      if (lastUserIdRef.current) {
        resetAssistant()
      }
      lastUserIdRef.current = null
      return
    }

    if (lastUserIdRef.current && lastUserIdRef.current !== currentUserId) {
      resetAssistant()
    }

    lastUserIdRef.current = currentUserId
  }, [resetAssistant, user?._id])

  useEffect(() => () => {
    clearUserTypingTimer()
    clearAvatarTransitionTimer()
    clearPresencePhaseTimer()
  }, [])

  useEffect(() => {
    if (!isVisibleRoute || !isAuthenticated) {
      return
    }

    void ensureAvatarCacheReady()
  }, [isAuthenticated, isVisibleRoute])

  useEffect(() => {
    if (!isOpen || !shouldStickToBottomRef.current) {
      return
    }

    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: isStreaming ? 'auto' : 'smooth',
        block: 'end',
      })
    })
  }, [isOpen, isStreaming, messages])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    shouldStickToBottomRef.current = true

    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'end',
      })
    })
  }, [isOpen])

  const starterQuickReplies = useMemo(() => {
    if (productId) {
      return [
        { label: 'Price for this phone', message: 'What is the price for this phone?' },
        { label: 'Storage options', message: 'What storage options and prices are available for this phone?' },
        { label: 'Stock status', message: 'Is this phone in stock right now?' },
        { label: 'Estimate a swap', message: 'Help me estimate a trade-in for this phone.' },
      ]
    }

    return [
      { label: 'Find a phone', message: 'Help me find a phone.' },
      { label: 'Trade-in help', message: 'How does trade-in work?' },
      { label: 'Product question', message: 'I have a product question.' },
    ]
  }, [productId])

  const hasConversationStarted = messages.length > 1
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user') ?? null

  const assistantAvatarUrl = avatarCacheReady
    ? getAssistantBitmojiPreviewUrl(presenceState)
    : assistantBitmojiPreviews.peeking

  useEffect(() => {
    if (!lastAvatarUrlRef.current) {
      lastAvatarUrlRef.current = assistantAvatarUrl
      return
    }

    if (lastAvatarUrlRef.current === assistantAvatarUrl) {
      return
    }

    setPreviousAvatarUrl(lastAvatarUrlRef.current)
    lastAvatarUrlRef.current = assistantAvatarUrl
    clearAvatarTransitionTimer()
    avatarTransitionTimeoutRef.current = window.setTimeout(() => {
      setPreviousAvatarUrl(null)
      avatarTransitionTimeoutRef.current = null
    }, 180)
  }, [assistantAvatarUrl])

  if (!isVisibleRoute || !isAuthenticated || !user?._id) {
    return null
  }

  const sendMessage = async (rawMessage: string) => {
    const trimmedMessage = rawMessage.trim()
    if (!trimmedMessage || isStreaming || !token) {
      return
    }

    await ensureAvatarCacheReady()
    pushUserMessage(trimmedMessage)
    const streamingMessageId = pushAssistantMessage({
      text: '',
      confidence: 'medium',
      kind: 'general_answer',
      handoff: null,
      isStreaming: true,
    })
    const presenceRunId = beginPresenceLifecycle()
    setIsStreaming(true)

    try {
      await streamAssistantMessage({
        token,
        payload: {
          sessionId: sessionId ?? undefined,
          message: trimmedMessage,
          userContext: {
            route: location.pathname,
            productId,
          },
        },
        onDelta: (text) => {
          appendMessageText(streamingMessageId, text)
          patchMessage(streamingMessageId, {
            isStreaming: true,
          })
        },
        onFinal: (response) => {
          setSessionId(response.sessionId)
          setIntent(response.intent)
          patchMessage(streamingMessageId, {
            text: response.reply,
            confidence: response.confidence,
            kind: response.kind,
            quickReplies: response.quickReplies,
            handoff: response.handoff ?? null,
            isStreaming: false,
          })
        },
      })
      completePresenceLifecycle(presenceRunId)
    } catch (error) {
      completePresenceLifecycle(presenceRunId)
      patchMessage(streamingMessageId, {
        text: extractErrorMessage(error),
        confidence: 'low',
        kind: 'handoff',
        handoff: {
          title: 'Contact admin',
          reason: 'The assistant request failed before it completed.',
          contactLabel: 'Admin',
          contactValue: '+2347086758713',
        },
        isStreaming: false,
      })
    } finally {
      setIsStreaming(false)
    }
  }

  const handleSend = async () => {
    const trimmedValue = inputValue.trim()
    if (!trimmedValue) {
      return
    }

    clearUserTypingTimer()
    setInputValue('')
    setEditingMessageId(null)
    await sendMessage(trimmedValue)
  }

  const handleQuickReply = async (message: string) => {
    setEditingMessageId(null)
    setInputValue('')
    await sendMessage(message)
  }

  const handleEditLastMessage = (message: AssistantMessage) => {
    setEditingMessageId(message.id)
    setInputValue(message.text)
    setOpen(true)
  }

  const handleInputChange = (value: string) => {
    setInputValue(value)

    if (isStreaming) {
      return
    }

    clearUserTypingTimer()

    if (!value.length) {
      setPresenceState('peeking')
      return
    }

    setPresenceState('idle')
    userTypingTimeoutRef.current = window.setTimeout(() => {
      setPresenceState('peeking')
      userTypingTimeoutRef.current = null
    }, USER_TYPING_PAUSE_MS)
  }

  const handleMessagesScroll = () => {
    const viewport = messagesViewportRef.current
    if (!viewport) {
      return
    }

    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    shouldStickToBottomRef.current = distanceFromBottom <= 48
  }

  return (
    <>
      {isOpen ? (
        <button
          type='button'
          aria-label='Close assistant'
          onClick={() => setOpen(false)}
          className='fixed inset-0 z-[58] bg-[rgba(12,23,42,0.28)] backdrop-blur-[2px]'
        />
      ) : null}

      <div className='pointer-events-none fixed inset-x-0 bottom-0 z-[60] md:inset-auto md:bottom-5 md:right-5 md:w-[25rem]'>
        <div className='pointer-events-auto flex justify-center md:justify-end'>
          {isOpen ? (
            <div className='relative grid h-[calc(100dvh-0.5rem)] w-full max-w-[32rem] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-t-[32px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.84)_0%,rgba(241,248,255,0.74)_55%,rgba(233,244,255,0.68)_100%)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3 shadow-[0_28px_70px_rgba(17,33,62,0.22),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-[30px] md:h-[min(44rem,calc(100vh-2.5rem))] md:rounded-[30px] md:p-3'>
              <div className='pointer-events-none absolute inset-0 rounded-t-[32px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(147,197,253,0.18),transparent_34%)] md:rounded-[30px]' />

              <div className='relative z-10 -mx-4 mb-3 rounded-t-[28px] border-b border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(245,250,255,0.78)_75%,rgba(245,250,255,0.1)_100%)] px-4 pb-3 pt-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-[20px] md:mx-0 md:rounded-t-[24px] md:px-0'>
                <div className='mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-300/80 md:hidden' />

                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <p className='ios-overline'>Assistant</p>
                    <p className='ios-card-title mt-1'>Signed-in support</p>
                    <p className='ios-caption mt-1'>Product and swap answers come from backend tools only.</p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <button type='button' onClick={resetAssistant} className='ios-icon-button h-10 w-10' aria-label='Reset chat'>
                      <MdRefresh size={18} />
                    </button>
                    <button type='button' onClick={() => setOpen(false)} className='ios-icon-button h-10 w-10' aria-label='Close chat'>
                      <MdClose size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div
                ref={messagesViewportRef}
                onScroll={handleMessagesScroll}
                className='assistant-messages-viewport relative mt-1 min-h-0 rounded-[24px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.42)_0%,rgba(255,255,255,0.26)_100%)] px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]'
              >
                <div className='assistant-messages-stack gap-3'>
                  {messages.map((message) => {
                    const isEditableLastUserMessage = message.role === 'user' && lastUserMessage?.id === message.id

                    return (
                      <div key={message.id} className={message.role === 'assistant' ? '' : 'ml-auto max-w-[88%]'}>
                        <div
                          className={`rounded-[22px] px-4 py-3 text-[0.95rem] leading-7 ${
                            message.role === 'assistant'
                              ? 'border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.86)_0%,rgba(246,250,255,0.72)_100%)] text-textPrimary shadow-[0_10px_24px_rgba(22,54,92,0.08)] backdrop-blur-[14px]'
                              : 'bg-[linear-gradient(180deg,#1484cd_0%,#0567ab_100%)] text-white shadow-[0_12px_26px_rgba(5,103,171,0.26)]'
                          }`}
                        >
                          {message.text || (message.isStreaming ? 'Thinking...' : '')}
                        </div>

                        {message.role === 'assistant' && message.quickReplies?.length && !message.isStreaming ? (
                          <div className='mt-2 flex flex-wrap gap-2'>
                            {message.quickReplies.map((reply) => (
                              <button
                                key={`${message.id}-${reply.label}`}
                                type='button'
                                onClick={() => void handleQuickReply(reply.message)}
                                className='ios-pill'
                                disabled={isStreaming}
                              >
                                {reply.label}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {message.role === 'assistant' && message.handoff ? (
                          <div className='ios-card-soft mt-2 space-y-1 rounded-[22px]'>
                            <p className='ios-card-title'>{message.handoff.title}</p>
                            <p className='ios-body-muted'>{message.handoff.reason}</p>
                            <p className='ios-body'>
                              {message.handoff.contactLabel}: <span className='font-semibold'>{message.handoff.contactValue}</span>
                            </p>
                          </div>
                        ) : null}

                        {isEditableLastUserMessage ? (
                          <div className='mt-2 flex justify-end'>
                            <button
                              type='button'
                              onClick={() => handleEditLastMessage(message)}
                              className='ios-pill inline-flex items-center gap-1'
                              disabled={isStreaming}
                            >
                              <MdEdit size={14} />
                              Edit and resend
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {!hasConversationStarted ? (
                <div className='mt-3 flex flex-wrap gap-2'>
                  {starterQuickReplies.map((reply) => (
                    <button
                      key={reply.label}
                      type='button'
                      onClick={() => void handleQuickReply(reply.message)}
                      className='ios-pill'
                      disabled={isStreaming}
                    >
                      {reply.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className='relative z-10 -mx-4 mt-3 rounded-b-[28px] border-t border-white/55 bg-[linear-gradient(180deg,rgba(245,250,255,0.08)_0%,rgba(245,250,255,0.82)_22%,rgba(255,255,255,0.94)_100%)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-[20px] md:mx-0 md:rounded-b-[24px] md:px-0 md:pb-0'>
                <div className='assistant-input-presence'>
                  <div className={`assistant-presence-avatar assistant-presence-avatar-${presenceState}`} aria-hidden='true'>
                    <span className='assistant-presence-stage'>
                      {previousAvatarUrl ? (
                        <img src={previousAvatarUrl} alt='' className='assistant-presence-image assistant-presence-image-exiting' />
                      ) : null}
                      <img src={assistantAvatarUrl} alt='' className='assistant-presence-image assistant-presence-image-current' />
                    </span>
                    <span className='assistant-presence-shadow' />
                  </div>
                </div>

                {editingMessageId ? (
                  <div className='mb-2 flex items-center justify-between gap-3 rounded-[18px] bg-white/55 px-3 py-2 text-sm text-slate-600'>
                    <span>Editing your last message. Resend creates a corrected turn.</span>
                    <button type='button' onClick={() => setEditingMessageId(null)} className='ios-pill px-3 py-1'>
                      Cancel
                    </button>
                  </div>
                ) : null}

                <div className='flex items-end gap-2'>
                  <textarea
                    value={inputValue}
                    onChange={(event) => handleInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void handleSend()
                      }
                    }}
                    className='ios-input min-h-[3.1rem] max-h-32 resize-none'
                    placeholder='Ask about products or trade-ins'
                    disabled={isStreaming}
                    rows={1}
                  />
                  <button
                    type='button'
                    onClick={() => void handleSend()}
                    className='ios-primary-button shrink-0'
                    disabled={isStreaming}
                  >
                    {editingMessageId ? 'Resend' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type='button'
              onClick={toggleOpen}
              className='ios-primary-button mb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] flex items-center gap-2 md:mb-0'
            >
              <MdChatBubbleOutline size={18} />
              Ask AI
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default AssistantChat
