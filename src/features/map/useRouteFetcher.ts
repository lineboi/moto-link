import { useEffect, useRef } from 'react'
import {
  useCurrentLocation,
  useDestinationLocation,
  useSearchState,
  useSessionStore,
  type DestinationPosition,
  type GeoPosition,
  type RouteGeoJson,
} from '@/store/useSessionStore'

// ─── OSRM response shape ──────────────────────────────────────────
interface OsrmGeometry {
  type: 'LineString'
  coordinates: [number, number][]
}

interface OsrmRoute {
  distance: number   // metres
  duration: number   // seconds
  geometry: OsrmGeometry
}

interface OsrmResponse {
  code: string        // "Ok" on success
  routes?: OsrmRoute[]
  message?: string
}

// ─── Constants ───────────────────────────────────────────────────
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

/** Delay before the first route fetch for a new destination (fast UX). */
const INITIAL_DEBOUNCE_MS = 500

/** Delay for subsequent GPS-update re-fetches (prevents OSRM spam). */
const UPDATE_DEBOUNCE_MS = 3_000

// ─── URL builder (OSRM expects lng,lat — not lat,lng) ─────────────
function buildOsrmUrl(
  from: GeoPosition,
  to: DestinationPosition,
): string {
  const start = `${from.lng},${from.lat}`
  const end = `${to.lng},${to.lat}`
  return (
    `${OSRM_BASE}/${start};${end}` +
    '?overview=full&geometries=geojson&steps=false'
  )
}

// ─── Hook ─────────────────────────────────────────────────────────
/**
 * Watches currentLocation + destinationLocation.
 * When both are set and searchState === 'NAVIGATING', fetches the
 * OSRM driving route with:
 *  – 500 ms debounce on the initial fetch (fast first render)
 *  – 3 s debounce on GPS-update re-fetches (rate-limits OSRM)
 *  – AbortController per request (cancels stale requests on location change)
 *
 * Dispatches setRouteGeoJson + setRouteMeta on success.
 * On failure: updates store error WITHOUT clearing the existing polyline
 * so the map does not flash to empty during a temporary network blip.
 */
export function useRouteFetcher(): void {
  const currentLocation = useCurrentLocation()
  const destinationLocation = useDestinationLocation()
  const searchState = useSearchState()

  // Track whether a route has already been fetched for the current destination.
  // Used to choose between the fast initial debounce and the slower GPS-update debounce.
  const hasRouteRef = useRef(false)

  // Track the last destination so we can detect a new selection (reset hasRouteRef).
  const prevDestRef = useRef<DestinationPosition | null>(null)

  useEffect(() => {
    if (
      searchState !== 'NAVIGATING' ||
      !currentLocation ||
      !destinationLocation
    ) {
      return
    }

    // New destination selected → reset to fast-initial path
    const isNewDestination =
      destinationLocation.lat !== prevDestRef.current?.lat ||
      destinationLocation.lng !== prevDestRef.current?.lng
    if (isNewDestination) {
      hasRouteRef.current = false
      prevDestRef.current = destinationLocation
    }

    const delay = hasRouteRef.current ? UPDATE_DEBOUNCE_MS : INITIAL_DEBOUNCE_MS
    const controller = new AbortController()

    const timerId = window.setTimeout(async () => {
      const url = buildOsrmUrl(currentLocation, destinationLocation)

      if (import.meta.env.DEV) {
        console.log('[useRouteFetcher] fetching route…', url)
      }

      try {
        const res = await fetch(url, { signal: controller.signal })

        if (controller.signal.aborted) return

        if (!res.ok) {
          throw new Error(`OSRM responded with HTTP ${res.status}`)
        }

        const data: OsrmResponse = await res.json() as OsrmResponse

        // OSRM returns code "Ok" on success; anything else means no route found
        if (data.code !== 'Ok' || !data.routes?.[0]) {
          if (import.meta.env.DEV) {
            console.warn('[useRouteFetcher] no route —', data.code, data.message)
          }
          // Update error WITHOUT changing searchState so the map stays visible.
          // We deliberately use setState instead of setError() which would
          // transition searchState → NO_MATCH and unmount the map.
          useSessionStore.setState({ error: 'ROUTE_NOT_FOUND' })
          return
        }

        const route = data.routes[0]

        const routeGeoJson: RouteGeoJson = {
          type: 'Feature',
          geometry: route.geometry,
          properties: {},
        }

        const distanceKm = route.distance / 1_000
        const durationMin = route.duration / 60

        if (import.meta.env.DEV) {
          console.log(
            `[useRouteFetcher] route OK — ${distanceKm.toFixed(1)} km,`,
            `${Math.round(durationMin)} min,`,
            `${route.geometry.coordinates.length} points`,
          )
        }

        hasRouteRef.current = true
        const store = useSessionStore.getState()
        store.setRouteGeoJson(routeGeoJson)
        store.setRouteMeta({ distanceKm, durationMin })
        // Clear any stale route error from a previous failed attempt
        useSessionStore.setState({ error: null })

      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was cancelled by cleanup — not a real error
          return
        }
        if (import.meta.env.DEV) {
          console.error('[useRouteFetcher] fetch error:', err)
        }
        // Same pattern: set error without changing searchState
        useSessionStore.setState({ error: 'ROUTE_NOT_FOUND' })
      }
    }, delay)

    // ── Cleanup: cancel pending debounce + abort in-flight request ──
    return () => {
      clearTimeout(timerId)
      controller.abort()
    }
  // Re-run when either location changes or navigation state changes.
  // currentLocation changes on every GPS tick — the debounce handles throttling.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation, destinationLocation, searchState])
}
