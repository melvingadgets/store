import { useSyncExternalStore } from "react"

type Listener = () => void

let pendingCount = 0
const listeners = new Set<Listener>()

const notify = () => {
  listeners.forEach((listener) => listener())
}

export const beginGlobalLoad = () => {
  pendingCount += 1
  notify()

  let done = false
  return () => {
    if (done) {
      return
    }

    done = true
    pendingCount = Math.max(0, pendingCount - 1)
    notify()
  }
}

const subscribe = (listener: Listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => pendingCount

export const useGlobalLoadingCount = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
