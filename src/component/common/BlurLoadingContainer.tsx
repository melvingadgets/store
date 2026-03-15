import { useEffect, useRef, useState, type ReactNode } from "react"

type BlurLoadingContainerProps = {
  loading: boolean
  children: ReactNode
  minDurationMs?: number
}

const BlurLoadingContainer = ({
  loading,
  children,
  minDurationMs = 150,
}: BlurLoadingContainerProps) => {
  const [visible, setVisible] = useState(false)
  const startedAtRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (loading) {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }

      startedAtRef.current = Date.now()
      setVisible(true)
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
    <div className="relative min-h-full">
      <div className={`transition-all duration-300 ${visible ? "scale-[0.998] blur-[2px]" : "blur-0"}`}>
        {children}
      </div>
    </div>
  )
}

export default BlurLoadingContainer
