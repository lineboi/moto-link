import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '@/store/useSessionStore'

/** True if the browser exposes the Geolocation API. */
export function isGeolocationSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.geolocation !== 'undefined'
  )
}

// watchPosition options — high-accuracy for moto routing,
// 3s cache so rapid re-renders don't spam the GPS hardware,
// 10s timeout before the soft-error callback fires.
const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 3_000,
  timeout: 10_000,
}

export interface UseGeolocationResult {
  isSupported: boolean
  isLoading: boolean   // true until the first GPS fix (or a hard error)
  error: string | null // soft errors displayed in the map UI
}

/**
 * Continuously tracks the driver's GPS position via watchPosition.
 * Every successful fix is dispatched to useSessionStore.setCurrentLocation
 * via getState() to avoid triggering component re-renders inside the callback.
 *
 * Error taxonomy:
 *  code 1 (PERMISSION_DENIED)    — hard failure: store setError dispatched,
 *                                  searchState → NO_MATCH so ErrorBanner appears.
 *  code 2 (POSITION_UNAVAILABLE) — soft failure: local error only, watcher kept alive.
 *  code 3 (TIMEOUT)              — soft failure: local error only, watcher retries.
 *
 * Cleanup: clearWatch called on unmount to release the browser's mic-dot equivalent.
 */
export function useGeolocation(): UseGeolocationResult {
  const supported = isGeolocationSupported()

  // isLoading starts true (if supported) — resolved by first fix or hard error
  const [isLoading, setIsLoading] = useState(supported)
  const [error, setLocalError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!supported) {
      setIsLoading(false)
      setLocalError('Geolocation is not available in this browser.')
      return
    }

    // ── Success callback ──────────────────────────────────────────
    const onSuccess: PositionCallback = (position) => {
      const { latitude, longitude, accuracy, heading } = position.coords

      setIsLoading(false)
      setLocalError(null)

      // Dispatch directly via getState() — no React setState inside the callback
      // means no component re-render just from a GPS tick.
      useSessionStore.getState().setCurrentLocation({
        lat: latitude,
        lng: longitude,
        accuracy: accuracy ?? 0,
        heading: heading ?? 0,
      })
    }

    // ── Error callback ────────────────────────────────────────────
    const onError: PositionErrorCallback = (positionError) => {
      setIsLoading(false)

      switch (positionError.code) {
        // 1 — PERMISSION_DENIED: unrecoverable, surface to global store
        case 1: {
          const msg =
            'GPS permission denied. Enable location access in browser settings.'
          setLocalError(msg)
          // setError also transitions searchState → NO_MATCH so ErrorBanner renders
          useSessionStore.getState().setError('LOCATION_DENIED')
          // No point keeping the watcher alive after a denial
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current)
            watchIdRef.current = null
          }
          break
        }

        // 2 — POSITION_UNAVAILABLE: GPS signal lost (tunnel, indoors)
        // Keep watcher alive — it will recover when signal returns.
        case 2: {
          setLocalError('GPS signal unavailable. Move to an open area.')
          break
        }

        // 3 — TIMEOUT: fix took longer than maximumAge + timeout
        // watchPosition queues another attempt automatically.
        case 3: {
          setLocalError('GPS fix timed out. Still trying…')
          break
        }

        default: {
          setLocalError(`Location error (code ${positionError.code}).`)
        }
      }
    }

    // Start continuous tracking
    watchIdRef.current = navigator.geolocation.watchPosition(
      onSuccess,
      onError,
      WATCH_OPTIONS,
    )

    // ── Cleanup: release GPS hardware on unmount ──────────────────
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [supported])

  return { isSupported: supported, isLoading, error }
}
