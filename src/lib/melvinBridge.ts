export type MelvinOutboundType = 'melvin:hello' | 'melvin:ready' | 'melvin:token-expired'

type MelvinInboundType = 'melvin:auth' | 'melvin:logout'

export interface MelvinBridgeUser {
  _id: string
  email: string | null
  fullName: string
  role: 'User' | 'Admin' | 'SuperAdmin'
}

const EMBED_SESSION_KEY = 'melvin_embed'

const MELVIN_OS_ORIGINS = String(import.meta.env.VITE_MELVIN_OS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

// Decided once at startup: client-side redirects drop ?embed=melvin, and the
// session flag keeps embedded mode across full reloads inside the frame.
const detectEmbedded = (): boolean => {
  if (window.parent === window) return false

  if (new URLSearchParams(window.location.search).get('embed') === 'melvin') {
    try {
      sessionStorage.setItem(EMBED_SESSION_KEY, '1')
    } catch {
      // Storage can be blocked in third-party frames; this load is still embedded.
    }
    return true
  }

  try {
    return sessionStorage.getItem(EMBED_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export const isEmbeddedInMelvin = detectEmbedded()

export const postToMelvin = (type: MelvinOutboundType) => {
  if (!isEmbeddedInMelvin) return

  // A non-matching targetOrigin is silently dropped, so only Melvin OS hosts receive it.
  for (const origin of MELVIN_OS_ORIGINS) {
    window.parent.postMessage({ type, version: 1 }, origin)
  }
}

export const notifyMelvinTokenExpired = () => postToMelvin('melvin:token-expired')

// ── Token hand-off (INTEGRATION-PLAN §12.3) ─────────────────────────────────
// The OS answers "melvin:hello" with "melvin:auth" carrying the session. The token
// is kept in memory only (never redux-persist / localStorage) so it can't outlive
// the frame; the axios resolver reads it for Authorization headers.
let bridgeToken: string | null = null
let bridgeUser: MelvinBridgeUser | null = null
let bridgeStarted = false

const listeners = new Set<() => void>()

const emitAuthChange = (): void => {
  for (const listener of listeners) listener()
}

export const getMelvinBridgeToken = (): string | null => bridgeToken
export const getMelvinBridgeUser = (): MelvinBridgeUser | null => bridgeUser

export const onMelvinAuthChange = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const startMelvinAuthBridge = (): void => {
  if (!isEmbeddedInMelvin || bridgeStarted) return
  bridgeStarted = true

  window.addEventListener('message', (event: MessageEvent) => {
    if (!MELVIN_OS_ORIGINS.includes(event.origin)) return
    if (event.source !== window.parent) return

    const data = event.data as { type?: MelvinInboundType; token?: unknown; user?: unknown } | null
    if (!data || typeof data !== 'object') return

    if (data.type === 'melvin:auth') {
      bridgeToken = typeof data.token === 'string' ? data.token : null
      bridgeUser = (data.user as MelvinBridgeUser | null) ?? null
      emitAuthChange()
    } else if (data.type === 'melvin:logout') {
      bridgeToken = null
      bridgeUser = null
      emitAuthChange()
    }
  })
}
