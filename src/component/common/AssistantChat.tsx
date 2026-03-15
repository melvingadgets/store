import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MdChatBubbleOutline, MdClose, MdRefresh } from 'react-icons/md'
import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { useAssistant } from '../../context/AssistantContext'
import { useSendAssistantMessageMutation } from '../../redux/shopApi'
import type { RootState } from '../../redux/store'
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
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth)
  const {
    isOpen,
    messages,
    sessionId,
    setOpen,
    toggleOpen,
    pushAssistantMessage,
    pushUserMessage,
    setIntent,
    setSessionId,
    resetAssistant,
  } = useAssistant()
  const [sendAssistantMessage, { isLoading }] = useSendAssistantMessageMutation()
  const [inputValue, setInputValue] = useState('')
  const [presenceState, setPresenceState] = useState<AssistantPresenceState>('peeking')
  const [avatarCacheReady, setAvatarCacheReady] = useState(false)
  const [previousAvatarUrl, setPreviousAvatarUrl] = useState<string | null>(null)
  const lastUserIdRef = useRef<string | null>(user?._id ?? null)
  const messagesViewportRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const presenceRunRef = useRef(0)
  const presenceStartedAtRef = useRef(0)
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
    presenceStartedAtRef.current = Date.now()
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
    if (!isOpen) {
      return
    }

    if (!shouldStickToBottomRef.current) {
      return
    }

    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
    })
  }, [isLoading, isOpen, messages])

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

  const quickReplies = useMemo(() => {
    if (productId) {
      return [
        'What storage options and prices are available for this phone?',
        'Can you explain this product briefly?',
        'How do I estimate my trade-in for this phone?',
      ]
    }

    return [
      'Help me find a phone',
      'How does trade-in work?',
      'I have a product question',
    ]
  }, [productId])

  const hasConversationStarted = messages.length > 1

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
    if (!trimmedMessage || isLoading) {
      return
    }

    await ensureAvatarCacheReady()
    pushUserMessage(trimmedMessage)
    const presenceRunId = beginPresenceLifecycle()

    try {
      const response = await sendAssistantMessage({
        sessionId: sessionId ?? undefined,
        message: trimmedMessage,
        userContext: {
          route: location.pathname,
          productId,
        },
      }).unwrap()

      await completePresenceLifecycle(presenceRunId)
      setSessionId(response.sessionId)
      setIntent(response.intent)
      pushAssistantMessage(response.reply)
    } catch (error) {
      await completePresenceLifecycle(presenceRunId)
      pushAssistantMessage(extractErrorMessage(error))
    }
  }

  const handleSend = async () => {
    const trimmedValue = inputValue.trim()
    if (!trimmedValue) {
      return
    }

    clearUserTypingTimer()
    setInputValue('')
    await sendMessage(trimmedValue)
  }

  const handleQuickReply = async (message: string) => {
    await sendMessage(message)
  }

  const handleInputChange = (value: string) => {
    setInputValue(value)

    if (isLoading) {
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
    <div
      className={`pointer-events-none fixed z-[60] ${
        isOpen
          ? 'left-1/2 top-1/2 w-[calc(100%-1.5rem)] max-w-[24rem] -translate-x-1/2 -translate-y-1/2'
          : 'bottom-24 left-1/2 w-[calc(100%-1.5rem)] max-w-[24rem] -translate-x-1/2'
      }`}
    >
      <div className={`pointer-events-auto flex ${isOpen ? 'w-full justify-end' : 'justify-end'}`}>
        {isOpen ? (
          <div className='w-full rounded-[30px] border border-white/70 bg-white/82 p-3 shadow-[0_24px_50px_rgba(17,33,62,0.2)] backdrop-blur-[28px]'>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <p className='ios-overline'>Assistant</p>
                <p className='ios-card-title mt-1'>Signed-in support</p>
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

            <div
              ref={messagesViewportRef}
              onScroll={handleMessagesScroll}
              className='assistant-messages-viewport mt-3 pr-1'
            >
              <div className='assistant-messages-stack'>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-[22px] px-4 py-3 text-[0.94rem] leading-6 ${
                      message.role === 'assistant'
                        ? 'bg-white/72 text-textPrimary'
                        : 'ml-auto max-w-[85%] bg-primary text-white'
                    }`}
                  >
                    {message.text}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {!hasConversationStarted ? (
              <div className='mt-3 flex flex-wrap gap-2'>
                {quickReplies.map((reply) => (
                  <button
                    key={reply}
                    type='button'
                    onClick={() => void handleQuickReply(reply)}
                    className='ios-pill'
                    disabled={isLoading}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            ) : null}

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

            <div className='flex items-center gap-2'>
              <input
                value={inputValue}
                onChange={(event) => handleInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleSend()
                  }
                }}
                className='ios-input'
                placeholder='Ask about products or trade-ins'
                disabled={isLoading}
              />
              <button type='button' onClick={() => void handleSend()} className='ios-primary-button shrink-0' disabled={isLoading}>
                Send
              </button>
            </div>
          </div>
        ) : (
          <button type='button' onClick={toggleOpen} className='ios-primary-button flex items-center gap-2'>
            <MdChatBubbleOutline size={18} />
            Ask AI
          </button>
        )}
      </div>
    </div>
  )
}

export default AssistantChat
