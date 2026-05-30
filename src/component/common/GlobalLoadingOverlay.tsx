import { useEffect, useRef, useState } from "react"
import BounceLoader from "react-spinners/BounceLoader"
import loaderImage from "../../assets/images/loader/IMG_1938 (1).png"
import { useFrontEndFrozen } from "../../lib/frontEndFreeze"
import { useGlobalLoadingCount } from "../../lib/globalLoading"

type GlobalLoadingOverlayProps = {
  minDurationMs?: number
}

const GlobalLoadingOverlay = ({ minDurationMs = 150 }: GlobalLoadingOverlayProps) => {
  const pendingCount = useGlobalLoadingCount()
  const frontEndFrozen = useFrontEndFrozen()
  const loading = pendingCount > 0
  const [visible, setVisible] = useState(false)
  const startedAtRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (loading) {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }

      if (!visible) {
        startedAtRef.current = Date.now()
        setVisible(true)
      }
      return
    }

    if (!visible) {
      return
    }

    const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : 0
    const remaining = Math.max(minDurationMs - elapsed, 0)

    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false)
      hideTimerRef.current = null
      startedAtRef.current = null
    }, remaining)

    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }
  }, [loading, minDurationMs, visible])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current)
      }
    }
  }, [])

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[80] flex items-center justify-center transition-opacity duration-300 ${
        visible && !frontEndFrozen ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="rounded-full border border-white/60 bg-white/85 p-3 shadow-[0_24px_56px_rgba(17,33,62,0.16)] backdrop-blur-md">
        <div className="relative h-10 w-10 loader-grow-size">
          <BounceLoader color="#0b74bc" size={40} speedMultiplier={0.75} aria-label="Loading spinner" />
          <img
            src={loaderImage}
            alt="Loader"
            className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover"
          />
        </div>
      </div>
    </div>
  )
}

export default GlobalLoadingOverlay
