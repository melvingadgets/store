import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import {
  getMelvinBridgeToken,
  getMelvinBridgeUser,
  isEmbeddedInMelvin,
  onMelvinAuthChange,
  postToMelvin,
  startMelvinAuthBridge,
} from '../../lib/melvinBridge'
import { bridgeSessionEstablished, logoutSuccess } from '../../features/auth/authSlice'

export const MelvinBridge = () => {
  const dispatch = useDispatch()

  useEffect(() => {
    if (!isEmbeddedInMelvin) return

    document.documentElement.classList.add('melvin-embed')
    startMelvinAuthBridge()
    postToMelvin('melvin:hello')

    // Two frames after the first commit the page has painted, so the OS can drop its splash.
    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => postToMelvin('melvin:ready'))
    })

    const unsubscribe = onMelvinAuthChange(() => {
      const token = getMelvinBridgeToken()
      const user = getMelvinBridgeUser()
      if (token && user) {
        dispatch(
          bridgeSessionEstablished({
            user: {
              _id: user._id,
              userName: user.fullName,
              email: user.email ?? '',
              // The bridge already carries the canonical platform spelling (AGENTS §4.4);
              // the mapping this replaced was the last place a role changed casing.
              role: user.role,
              verify: true,
            },
          }),
        )
      } else {
        dispatch(logoutSuccess())
      }
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
      unsubscribe()
    }
  }, [dispatch])

  return null
}
