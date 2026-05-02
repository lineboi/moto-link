import { useEffect, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  useLanguage,
  useRouteMeta,
  useSelectedLandmark,
  useTripStartedAt,
  useTripStatus,
  useSessionStore,
} from '@/store/useSessionStore'

// ─── Bilingual driver copy ────────────────────────────────────────
const DRIVER_COPY = {
  rw: {
    startTrip: 'Tangira urugendo',
    pause: 'Hagarika gato',
    endTrip: 'Hagarika',
    resume: 'Komeza',
    paused: 'HAGARITSWE',
    distance: 'Inzira',
    eta: 'Iminota',
    elapsed: 'Igihe',
    km: 'km',
    min: 'min',
  },
  en: {
    startTrip: 'Start Trip',
    pause: 'Pause',
    endTrip: 'End Trip',
    resume: 'Resume',
    paused: 'PAUSED',
    distance: 'Distance',
    eta: 'ETA',
    elapsed: 'Elapsed',
    km: 'km',
    min: 'min',
  },
} as const

// ─── Elapsed time helpers ────────────────────────────────────────
function formatElapsed(sec: number): string {
  const mm = String(Math.floor(sec / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function useElapsedSeconds(
  active: boolean,
  startedAt: number | null,
): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active || !startedAt) {
      setElapsed(0)
      return
    }
    // Seed immediately so no 1-second stutter on mount
    setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1_000)
    return () => window.clearInterval(id)
  }, [active, startedAt])

  return elapsed
}

// ─── Shared chip for distance / ETA / elapsed ─────────────────────
function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <Box
      bg="rgba(255,179,0,0.12)"
      borderWidth="1px"
      borderColor="rgba(255,179,0,0.30)"
      borderRadius="lg"
      px="4"
      py="2"
      textAlign="center"
      minW="90px"
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

// ─── Panel container ─────────────────────────────────────────────
function PanelContainer({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </Box>
  )
}

// ─── IDLE state ───────────────────────────────────────────────────
function IdlePanel() {
  const language = useLanguage()
  const routeMeta = useRouteMeta()
  const selectedLandmark = useSelectedLandmark()
  const startTrip = useSessionStore((s) => s.startTrip)
  const t = DRIVER_COPY[language]

  return (
    <PanelContainer>
      <Stack gap="4">
        {/* Landmark name */}
        {selectedLandmark && (
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
        )}

        {/* Distance + ETA chips */}
        {routeMeta && (
          <HStack gap="3" wrap="wrap">
            <InfoChip
              label={t.distance}
              value={`${routeMeta.distanceKm.toFixed(1)} ${t.km}`}
            />
            <InfoChip
              label={t.eta}
              value={`~${Math.ceil(routeMeta.durationMin)} ${t.min}`}
            />
          </HStack>
        )}

        {/* Primary CTA: Start Trip */}
        <Button
          onClick={startTrip}
          w="full"
          minH="touchTargetXl"
          bg="#22C55E"
          color="white"
          fontWeight="extrabold"
          fontSize="xl"
          letterSpacing="wide"
          borderRadius="xl"
          _hover={{ bg: '#16A34A' }}
          _active={{ transform: 'scale(0.98)' }}
          transition="background 120ms ease, transform 100ms ease"
        >
          {t.startTrip}
        </Button>
      </Stack>
    </PanelContainer>
  )
}

// ─── STARTED state ────────────────────────────────────────────────
function StartedPanel() {
  const language = useLanguage()
  const selectedLandmark = useSelectedLandmark()
  const tripStartedAt = useTripStartedAt()
  const pauseTrip = useSessionStore((s) => s.pauseTrip)
  const endTrip = useSessionStore((s) => s.endTrip)
  const elapsedSec = useElapsedSeconds(true, tripStartedAt)
  const t = DRIVER_COPY[language]

  return (
    <PanelContainer>
      <Stack gap="4">
        {/* Compact header: landmark + elapsed ticker */}
        <HStack justify="space-between" align="center" wrap="wrap" gap="3">
          {selectedLandmark && (
            <Text
              color="white"
              fontWeight="bold"
              fontSize="lg"
              flex="1"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {selectedLandmark.landmark}
            </Text>
          )}
          <InfoChip
            label={t.elapsed}
            value={formatElapsed(elapsedSec)}
          />
        </HStack>

        {/* Action buttons: Pause (amber) + End Trip (red) */}
        <HStack gap="3">
          <Button
            onClick={pauseTrip}
            flex="1"
            minH="touchTargetLg"
            bg="#FFB300"
            color="#030A1A"
            fontWeight="extrabold"
            fontSize="lg"
            borderRadius="xl"
            _hover={{ bg: '#FFA000' }}
            _active={{ transform: 'scale(0.98)' }}
            transition="background 120ms ease, transform 100ms ease"
          >
            {t.pause}
          </Button>
          <Button
            onClick={endTrip}
            flex="1"
            minH="touchTargetLg"
            bg="#EF4444"
            color="white"
            fontWeight="extrabold"
            fontSize="lg"
            borderRadius="xl"
            _hover={{ bg: '#DC2626' }}
            _active={{ transform: 'scale(0.98)' }}
            transition="background 120ms ease, transform 100ms ease"
          >
            {t.endTrip}
          </Button>
        </HStack>
      </Stack>
    </PanelContainer>
  )
}

// ─── PAUSED state ─────────────────────────────────────────────────
function PausedPanel() {
  const language = useLanguage()
  const resumeTrip = useSessionStore((s) => s.resumeTrip)
  const endTrip = useSessionStore((s) => s.endTrip)
  const t = DRIVER_COPY[language]

  return (
    <PanelContainer>
      <VStack gap="4" align="stretch">
        {/* Pulsing PAUSED badge */}
        <HStack justify="center">
          <Badge
            px="5"
            py="2"
            borderRadius="full"
            fontWeight="extrabold"
            fontSize="md"
            letterSpacing="widest"
            color="#030A1A"
            bg="#FFB300"
            css={{
              '@keyframes pulse-paused': {
                '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                '50%': { opacity: 0.65, transform: 'scale(0.97)' },
              },
              animation: 'pulse-paused 1.5s ease-in-out infinite',
            }}
          >
            {t.paused}
          </Badge>
        </HStack>

        {/* Resume — full-width primary action */}
        <Button
          onClick={resumeTrip}
          w="full"
          minH="touchTargetXl"
          bg="#22C55E"
          color="white"
          fontWeight="extrabold"
          fontSize="xl"
          letterSpacing="wide"
          borderRadius="xl"
          _hover={{ bg: '#16A34A' }}
          _active={{ transform: 'scale(0.98)' }}
          transition="background 120ms ease, transform 100ms ease"
        >
          {t.resume}
        </Button>

        {/* End Trip — secondary, below */}
        <Button
          onClick={endTrip}
          w="full"
          minH="touchTargetLg"
          variant="outline"
          borderColor="#EF4444"
          borderWidth="2px"
          color="#EF4444"
          fontWeight="extrabold"
          fontSize="lg"
          borderRadius="xl"
          bg="transparent"
          _hover={{ bg: 'rgba(239,68,68,0.1)' }}
          _active={{ transform: 'scale(0.98)' }}
          transition="background 120ms ease, transform 100ms ease"
        >
          {t.endTrip}
        </Button>
      </VStack>
    </PanelContainer>
  )
}

// ─── Public component ────────────────────────────────────────────
export function SessionManagerOverlay() {
  const tripStatus = useTripStatus()

  switch (tripStatus) {
    case 'IDLE':
      return <IdlePanel />
    case 'STARTED':
      return <StartedPanel />
    case 'PAUSED':
      return <PausedPanel />
  }
}
