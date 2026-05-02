// MapLibre CSS must load before the map renders — required for controls & container styling
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, type SVGProps } from 'react'
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from 'react-map-gl/maplibre'
import { Box, Spinner, Text, VStack } from '@chakra-ui/react'
import { useGeolocation } from '@/features/map/useGeolocation'
import { useRouteFetcher } from '@/features/map/useRouteFetcher'
import { useAudioGuide } from '@/features/map/useAudioGuide'
import { SessionManagerOverlay } from '@/features/map/SessionManagerOverlay'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  useCurrentLocation,
  useDestinationLocation,
  useLanguage,
  useRouteGeoJson,
  useTripStatus,
  useSessionStore,
  type GeoPosition,
  type TripStatus,
} from '@/store/useSessionStore'

// ─── Dark tile style ─────────────────────────────────────────────
// CARTO Dark Matter vector tiles — free for dev/demo, no API key required.
// Swap to Stadia Maps "alidade_smooth_dark" + API key for production.
const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

// ─── Kigali default camera ─────────────────────────────────────────
const KIGALI_CENTER = { longitude: 30.0619, latitude: -1.9441, zoom: 13 }

// ─── Static layer specs (defined outside component to prevent re-render) ──
const ROUTE_HALO_LAYER = {
  id: 'route-halo',
  type: 'line' as const,
  paint: {
    'line-color': '#FFFFFF',
    'line-width': 9,
    'line-opacity': 0.22,
  },
  layout: {
    'line-cap': 'round' as const,
    'line-join': 'round' as const,
  },
}

const ROUTE_LINE_LAYER = {
  id: 'route-line',
  type: 'line' as const,
  paint: {
    'line-color': '#FFB300', // accent.solid — neon amber
    'line-width': 5,
    'line-opacity': 1,
  },
  layout: {
    'line-cap': 'round' as const,
    'line-join': 'round' as const,
  },
}

// ─── Inline SVG icons ────────────────────────────────────────────
function DestinationPin(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="36"
      height="46"
      viewBox="0 0 36 46"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M18 0C8.06 0 0 8.06 0 18C0 30.6 18 46 18 46C18 46 36 30.6 36 18C36 8.06 27.94 0 18 0Z"
        fill="#FFB300"
      />
      <circle cx="18" cy="18" r="8" fill="#030A1A" />
    </svg>
  )
}

// ─── GPS overlay copy ─────────────────────────────────────────────
const GPS_COPY = {
  rw: { acquiringGps: 'Turategereza GPS…', gpsError: 'Ikibazo cya GPS' },
  en: { acquiringGps: 'Acquiring GPS…', gpsError: 'GPS error' },
} as const

// ─── Trip start data captured before endTrip clears the store ────
interface TripStartData {
  startLoc: GeoPosition
  landmarkId: string | null
}

// ─── MapView ──────────────────────────────────────────────────────
export function MapView() {
  // ── Active hooks: only run while the map is mounted ─────────────
  const { isLoading: gpsLoading, error: gpsError } = useGeolocation()
  useRouteFetcher()
  useAudioGuide()

  const mapRef = useRef<MapRef>(null)
  const currentLocation = useCurrentLocation()
  const destinationLocation = useDestinationLocation()
  const routeGeoJson = useRouteGeoJson()
  const tripStatus = useTripStatus()
  const language = useLanguage()
  const t = GPS_COPY[language]

  // ── Trip lifecycle tracking refs ─────────────────────────────────
  // Captures the start coords + landmark ID at the moment the trip
  // begins, before endTrip() can clear selectedLandmark from the store.
  const tripStartDataRef = useRef<TripStartData | null>(null)
  const prevTripStatusRef = useRef<TripStatus>(tripStatus)

  // ── Trip transition effect ────────────────────────────────────────
  useEffect(() => {
    const prev = prevTripStatusRef.current
    prevTripStatusRef.current = tripStatus

    if (prev === tripStatus) return

    // Capture start data at the exact moment the trip begins (IDLE → STARTED)
    if (prev === 'IDLE' && tripStatus === 'STARTED') {
      const { currentLocation: loc, selectedLandmark } =
        useSessionStore.getState()
      if (loc) {
        tripStartDataRef.current = {
          startLoc: loc,
          landmarkId: selectedLandmark?.landmark_id ?? null,
        }
      }
      return
    }

    // Fire-and-forget Supabase session log when trip ends (STARTED/PAUSED → IDLE)
    // Note: endTrip() has already cleared selectedLandmark from the store,
    // so we use the data captured above.
    if (prev !== 'IDLE' && tripStatus === 'IDLE') {
      const startData = tripStartDataRef.current
      if (!startData) return

      const { currentLocation: endLoc } = useSessionStore.getState()
      tripStartDataRef.current = null

      void (async () => {
        try {
          if (!isSupabaseConfigured()) return
          await supabase.from('navigation_sessions').insert({
            landmark_id: startData.landmarkId,
            start_lat: startData.startLoc.lat,
            start_lng: startData.startLoc.lng,
            actual_arrival_lat: endLoc?.lat ?? null,
            actual_arrival_lng: endLoc?.lng ?? null,
            // 'ABANDONED' until Feature 6 adds arrival-proximity detection;
            // the DB trigger updates landmark confidence_score on CONFIRMED inserts.
            status: 'ABANDONED',
            search_attempts: 1,
          })
        } catch {
          // Background telemetry — never block or alert the driver
        }
      })()
    }
  }, [tripStatus])

  // ── Fly to fit both markers when the first route arrives ─────────
  useEffect(() => {
    if (!routeGeoJson || !currentLocation || !destinationLocation) return
    const map = mapRef.current
    if (!map) return

    const lngs = [currentLocation.lng, destinationLocation.lng]
    const lats = [currentLocation.lat, destinationLocation.lat]
    const PAD = 0.008

    map.fitBounds(
      [
        [Math.min(...lngs) - PAD, Math.min(...lats) - PAD],
        [Math.max(...lngs) + PAD, Math.max(...lats) + PAD],
      ],
      { padding: 80, duration: 1_200, maxZoom: 17 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeGeoJson])

  const initialLat = currentLocation?.lat ?? KIGALI_CENTER.latitude
  const initialLng = currentLocation?.lng ?? KIGALI_CENTER.longitude

  return (
    <Box w="100vw" h="100dvh" position="relative" overflow="hidden" bg="#0d0d0d">
      {/* ── MapLibre map ──────────────────────────────────────── */}
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={{
          longitude: initialLng,
          latitude: initialLat,
          zoom: KIGALI_CENTER.zoom,
        }}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        reuseMaps
      >
        {/* ── OSRM route polyline ──────────────────────────── */}
        {routeGeoJson && (
          <Source id="route-source" type="geojson" data={routeGeoJson}>
            {/* White halo renders first (below) */}
            <Layer {...ROUTE_HALO_LAYER} />
            {/* Amber line renders on top */}
            <Layer {...ROUTE_LINE_LAYER} />
          </Source>
        )}

        {/* ── Driver location — pulsing blue dot ───────────── */}
        {currentLocation && (
          <Marker
            longitude={currentLocation.lng}
            latitude={currentLocation.lat}
            anchor="center"
          >
            <Box
              w="18px"
              h="18px"
              borderRadius="full"
              bg="#3B82F6"
              borderWidth="3px"
              borderColor="white"
              flexShrink={0}
              css={{
                '@keyframes pulse-gps': {
                  '0%': { boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.8)' },
                  '70%': { boxShadow: '0 0 0 18px rgba(59, 130, 246, 0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(59, 130, 246, 0)' },
                },
                animation: 'pulse-gps 2s ease-out infinite',
              }}
            />
          </Marker>
        )}

        {/* ── Destination — amber teardrop pin ─────────────── */}
        {destinationLocation && (
          <Marker
            longitude={destinationLocation.lng}
            latitude={destinationLocation.lat}
            anchor="bottom"
          >
            <DestinationPin />
          </Marker>
        )}

        {/* ── Map controls ─────────────────────────────────── */}
        <NavigationControl position="top-right" showCompass={false} />
      </Map>

      {/* ── GPS acquiring overlay (before first fix) ─────────────── */}
      {gpsLoading && !currentLocation && (
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="rgba(3, 10, 26, 0.72)"
          backdropFilter="blur(4px)"
          zIndex={10}
        >
          <VStack gap="4">
            <Spinner size="xl" color="#FFB300" />
            <Text
              color="white"
              fontWeight="bold"
              fontSize="lg"
              bg="rgba(0,0,0,0.5)"
              px="5"
              py="2"
              borderRadius="full"
            >
              {t.acquiringGps}
            </Text>
          </VStack>
        </Box>
      )}

      {/* ── GPS soft-error banner ─────────────────────────────────── */}
      {gpsError && currentLocation && (
        <Box
          position="absolute"
          top="4"
          left="4"
          right="4"
          bg="rgba(250, 204, 21, 0.15)"
          borderWidth="1px"
          borderColor="#FACC15"
          borderRadius="lg"
          px="4"
          py="2"
          zIndex={10}
        >
          <Text fontSize="sm" color="#FACC15" fontWeight="bold">
            {t.gpsError}: {gpsError}
          </Text>
        </Box>
      )}

      {/* ── Session manager (Start / Pause / End Trip) ────────────── */}
      <SessionManagerOverlay />
    </Box>
  )
}
