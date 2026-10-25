// Decides whether the token Melvin OS hands over should be used with this app's backend.
//
// The OS signs people in through the auth service and passes the app that token. A backend only
// understands it once it runs the unified-login code; an older one answers 401. Instead of
// trusting a setting, the app learns from the backend:
//   - a 401 is treated as ordinary expiry once: ask the OS for a fresh token;
//   - if that fresh token is refused too, this backend doesn't take Melvin OS tokens, so the app
//     goes back to its own login and stops sending it;
//   - any other answer proves the backend recognised the token, so later 401s are just expiry.
// Kept free of DOM and bundler imports so it can be tested with plain `node --test`.

export type UnauthorizedAction = 'refresh' | 'rejected' | 'ignore'

export interface BridgeGate {
  /** The token to send, or null before sign-in and after the backend has refused it. */
  token(): string | null
  /** The token the OS most recently sent; null on sign-out (which also forgets what was learned). */
  setToken(token: string | null): void
  /** A request that carried `usedToken` got an answer other than 401. */
  accepted(usedToken: string): void
  /** A request that carried `usedToken` got a 401. Says what the caller should do about it. */
  unauthorized(usedToken: string): UnauthorizedAction
}

export const createBridgeGate = (): BridgeGate => {
  let current: string | null = null
  let proven = false
  let rejected = false
  // The token that was current when a refresh was last requested.
  let refreshAskedFor: string | null = null

  return {
    token: () => (rejected ? null : current),

    setToken: (token) => {
      current = token
      if (token === null) {
        proven = false
        rejected = false
        refreshAskedFor = null
      }
    },

    accepted: (usedToken) => {
      if (usedToken !== current) return
      proven = true
      refreshAskedFor = null
    },

    unauthorized: (usedToken) => {
      // A late answer for a token that has already been replaced says nothing about the new one.
      if (rejected || usedToken !== current) return 'ignore'
      // Already asked for a fresh token; the OS just hasn't answered yet (parallel requests).
      if (refreshAskedFor === usedToken) return 'ignore'
      if (proven || refreshAskedFor === null) {
        refreshAskedFor = usedToken
        return 'refresh'
      }
      // A refreshed token was refused as well.
      rejected = true
      return 'rejected'
    },
  }
}
