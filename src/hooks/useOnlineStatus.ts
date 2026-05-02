import { useEffect, useState } from 'react'

export interface UseOnlineStatusResult {
  isOnline: boolean
}

/**
 * Subscribes to the browser's network status.
 * Seeded from navigator.onLine (synchronous — no flash on mount).
 * Listens to 'online' / 'offline' window events for live updates.
 */
export function useOnlineStatus(): UseOnlineStatusResult {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline }
}
