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
import {
  Box,
  Button,
  HStack,
  Heading,
  Spinner,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useGeolocation } from '@/features/map/useGeolocation'
import { useRouteFetcher } from '@/features/map/useRouteFetcher'
import {
  useCurrentLocation,
  useDestinationLocation,
  useLanguage,
  useRouteMeta,
  useRouteGeoJson,
  useSelectedLandmark,
  useSessionStore,
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
      {/* teardrop body */}
      <path
        d="M18 0C8.06 0 0 8.06 0 18C0 30.6 18 46 18 46C18 46 36 30.6 36 18C36 8.06 27.94 0 18 0Z"
        fill="#FFB300"
      />
      {/* inner dark dot */}
      <circle cx="18" cy="18" r="8" fill="#030A1A" />
    </svg>
  )
}

// ─── Bilingual copy ───────────────────────────────────────────────
const MAP_COPY = {
  rw: {
    acquiringGps: 'Turategereza GPS…',
    gpsError: 'Ikibazo cya GPS',
    distance: 'Inzira',
    eta: 'Iminota',
    cancel: 'Reka urugendo',
    km: 'km',
    min: 'min',
  },
  en: {
    acquiringGps: 'Acquiring GPS…',
    gpsError: 'GPS error',
    distance: 'Distance',
    eta: 'ETA',
    cancel: 'Cancel Route',
    km: 'km',
    min: 'min',
  },
} as const

// ─── MapView ──────────────────────────────────────────────────────
export function MapView() {
  // Mount GPS + route hooks — they only run while this component is mounted
  const { isLoading: gpsLoading, error: gpsError } = useGeolocation()
  useRouteFetcher()

  const mapRef = useRef<MapRef>(null)
  const currentLocation = useCurrentLocation()
  const destinationLocation = useDestinationLocation()
  const routeGeoJson = useRouteGeoJson()
  const routeMeta = useRouteMeta()
  const selectedLandmark = useSelectedLandmark()
  const language = useLanguage()
  const clearRoute = useSessionStore((s) => s.clearRoute)
  const t = MAP_COPY[language]

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
  // Only re-fit when route changes (not on every GPS tick)
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
                  '0%': {
                    boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.8)',
                  },
                  '70%': {
                    boxShadow: '0 0 0 18px rgba(59, 130, 246, 0)',
                  },
                  '100%': {
                    boxShadow: '0 0 0 0 rgba(59, 130, 246, 0)',
                  },
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

      {/* ── Route info panel ─────────────────────────────────────── */}
      <Box
        position="absolute"
        bottom="0"
        left="0"
        right="0"
        bg="rgba(11, 30, 58, 0.94)"
        backdropFilter="blur(12px)"
        borderTopWidth="1px"
        borderColor="rgba(255,179,0,0.25)"
        px="6"
        pt="5"
        pb="8"
        zIndex={10}
      >
        {selectedLandmark && (
          <Stack gap="4">
            {/* Landmark name */}
            <Heading
              as="h2"
              size="xl"
              fontWeight="extrabold"
              color="white"
              lineHeight="shorter"
              css={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
              }}
            >
              {selectedLandmark.landmark}
            </Heading>

            {/* Distance + ETA chips */}
            {routeMeta ? (
              <HStack gap="4" wrap="wrap">
                <MetaChip
                  label={t.distance}
                  value={`${routeMeta.distanceKm.toFixed(1)} ${t.km}`}
                />
                <MetaChip
                  label={t.eta}
                  value={`~${Math.ceil(routeMeta.durationMin)} ${t.min}`}
                />
              </HStack>
            ) : (
              <HStack gap="2" align="center">
                <Spinner size="sm" color="#FFB300" />
                <Text color="rgba(255,255,255,0.6)" fontSize="sm">
                  Calculating route…
                </Text>
              </HStack>
            )}

            {/* Cancel / Back button */}
            <Button
              size="lg"
              w="full"
              minH="touchTargetXl"
              bg="#EF4444"
              color="white"
              fontWeight="extrabold"
              fontSize="lg"
              letterSpacing="wide"
              _hover={{ bg: '#DC2626' }}
              _active={{ transform: 'scale(0.98)' }}
              onClick={clearRoute}
              aria-label={t.cancel}
            >
              {t.cancel}
            </Button>
          </Stack>
        )}
      </Box>
    </Box>
  )
}

// ─── Route info chip ──────────────────────────────────────────────
function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <Box
      bg="rgba(255,179,0,0.12)"
      borderWidth="1px"
      borderColor="rgba(255,179,0,0.35)"
      borderRadius="lg"
      px="4"
      py="2"
      textAlign="center"
      minW="100px"
    >
      <Text
        fontSize="2xs"
        color="rgba(255,179,0,0.7)"
        fontWeight="bold"
        letterSpacing="wide"
        textTransform="uppercase"
        mb="0.5"
      >
        {label}
      </Text>
      <Text fontSize="xl" color="white" fontWeight="extrabold" lineHeight="shorter">
        {value}
      </Text>
    </Box>
  )
}
