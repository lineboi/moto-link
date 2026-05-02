import {
  Box,
  Button,
  Container,
  Flex,
  HStack,
  Heading,
  Spinner,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ConnectionStatusBadge } from '@/components/ConnectionStatusBadge'
import { VoiceRecordButton } from '@/features/voice/VoiceRecordButton'
import { ResultsStack } from '@/features/voice/ResultsStack'
import { useNlpPipeline } from '@/features/voice/useNlpPipeline'
import { isVoiceCaptureSupported } from '@/features/voice/useVoiceRecorder'
import { MapView } from '@/features/map/MapView'
import { OfflineBanner } from '@/components/OfflineBanner'
import {
  useLanguage,
  useSearchState,
  useSessionError,
  useSessionStore,
  useTranscript,
} from '@/store/useSessionStore'
import type { SearchState } from '@/store/useSessionStore'
import type { Language } from '@/types/database'

// ─── Bilingual copy ─────────────────────────────────────────────
const COPY = {
  rw: {
    tagline: 'Lyftathon Kigali 2026',
    prompt: 'Vuga aho ushaka kujya',
    subprompt: 'Kanda kuri buto utangire kuvuga',
    languageLabel: 'Hitamo ururimi',
    languages: { rw: 'Kinyarwanda', en: 'Icyongereza' },
    processing: 'Ndatunganya…',
    processingDesc: 'Whisper + Claude birimo gukora',
    transcriptLabel: 'Ubutumwa bwumvikanywe',
    retryBtn: 'Ongera ugerageze',
    unsupportedTitle: 'Mudasobwa ntiyemera ijwi',
    unsupportedDesc:
      'Fungura uru rubuga kuri Chrome cyangwa Safari nshya kuri telefoni yawe igendanwa.',
  },
  en: {
    tagline: 'Lyftathon Kigali 2026',
    prompt: 'Speak your destination',
    subprompt: 'Tap the button to start recording',
    languageLabel: 'Choose language',
    languages: { rw: 'Kinyarwanda', en: 'English' },
    processing: 'Processing…',
    processingDesc: 'Whisper + Claude at work',
    transcriptLabel: 'Heard',
    retryBtn: 'Try again',
    unsupportedTitle: 'Voice capture not supported',
    unsupportedDesc:
      'Please open Moto-Link in a recent Chrome, Firefox, or Safari on a mobile device.',
  },
} as const

const STATUS_TEXT: Record<SearchState, Record<Language, string>> = {
  IDLE: { rw: 'Tegereje', en: 'Ready' },
  LISTENING: { rw: 'Ndumva…', en: 'Listening…' },
  PROCESSING: { rw: 'Ndategura…', en: 'Processing…' },
  RESULTS_FOUND: { rw: 'Hari aho nahabonye!', en: 'Match found!' },
  NO_MATCH: { rw: 'Sinabashije gusobanura', en: "Couldn't understand that" },
  RETRYING: { rw: 'Ndongeye kugerageza', en: 'Trying again' },
  NAVIGATING: { rw: 'Urugendo rurimo…', en: 'Navigating…' },
}

const STATUS_TONE: Record<SearchState, string> = {
  IDLE: 'fg.muted',
  LISTENING: 'accent.fg',
  PROCESSING: 'accent.fg',
  RESULTS_FOUND: 'signal.success',
  NO_MATCH: 'signal.warning',
  RETRYING: 'signal.warning',
  NAVIGATING: 'signal.success',
}

// ─── Sub-components ─────────────────────────────────────────────
function LanguageToggle() {
  const language = useLanguage()
  const setLanguage = useSessionStore((s) => s.setLanguage)
  const t = COPY[language]
  const options: Array<{ value: Language; label: string }> = [
    { value: 'rw', label: t.languages.rw },
    { value: 'en', label: t.languages.en },
  ]

  return (
    <Stack gap="2" align="center">
      <Text
        fontSize="xs"
        color="fg.muted"
        letterSpacing="wide"
        textTransform="uppercase"
        fontWeight="bold"
      >
        {t.languageLabel}
      </Text>
      <HStack
        role="group"
        aria-label={t.languageLabel}
        bg="bg.subtle"
        borderWidth="1px"
        borderColor="border"
        borderRadius="full"
        p="1"
        gap="1"
      >
        {options.map((opt) => {
          const active = language === opt.value
          return (
            <Button
              key={opt.value}
              onClick={() => setLanguage(opt.value)}
              aria-pressed={active}
              minH="touchTarget"
              px="6"
              borderRadius="full"
              fontWeight="bold"
              fontSize="md"
              bg={active ? 'accent.solid' : 'transparent'}
              color={active ? 'accent.contrast' : 'fg'}
              _hover={{ bg: active ? 'accent.fg' : 'bg.muted' }}
              _active={{ transform: 'scale(0.97)' }}
              transition="background 120ms ease, transform 100ms ease"
            >
              {opt.label}
            </Button>
          )
        })}
      </HStack>
    </Stack>
  )
}

function StatusReadout() {
  const searchState = useSearchState()
  const language = useLanguage()
  return (
    <Text
      fontSize="lg"
      fontWeight="bold"
      color={STATUS_TONE[searchState]}
      letterSpacing="wide"
      textTransform="uppercase"
      aria-live="polite"
    >
      {STATUS_TEXT[searchState][language]}
    </Text>
  )
}

function ProcessingOverlay() {
  const language = useLanguage()
  const t = COPY[language]
  return (
    <VStack gap="4" py="4">
      <Spinner
        size="xl"
        color="accent.solid"
        css={{ '--spinner-track-color': 'colors.bg.muted' }}
      />
      <Stack gap="1" align="center" textAlign="center">
        <Text fontSize="xl" fontWeight="bold" color="accent.fg">
          {t.processing}
        </Text>
        <Text fontSize="sm" color="fg.muted">
          {t.processingDesc}
        </Text>
      </Stack>
    </VStack>
  )
}

function TranscriptBadge() {
  const transcript = useTranscript()
  const language = useLanguage()
  const t = COPY[language]
  if (!transcript) return null
  return (
    <Box
      w="full"
      maxW="md"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      borderRadius="lg"
      px="5"
      py="3"
      textAlign="center"
    >
      <Text fontSize="xs" color="fg.subtle" fontWeight="bold" letterSpacing="wide" textTransform="uppercase" mb="1">
        {t.transcriptLabel}
      </Text>
      <Text fontSize="lg" color="fg" fontStyle="italic">
        "{transcript}"
      </Text>
    </Box>
  )
}

function ErrorBanner() {
  const error = useSessionError()
  const language = useLanguage()
  const reset = useSessionStore((s) => s.reset)
  const t = COPY[language]
  if (!error) return null
  return (
    <Box
      w="full"
      maxW="md"
      bg="bg.panel"
      borderWidth="2px"
      borderColor="signal.danger"
      borderRadius="lg"
      p="5"
      textAlign="center"
    >
      <Text fontSize="sm" color="signal.danger" mb="4">{error}</Text>
      <Button
        size="lg"
        bg="accent.solid"
        color="accent.contrast"
        fontWeight="bold"
        _hover={{ bg: 'accent.fg' }}
        onClick={reset}
        minH="touchTarget"
        w="full"
      >
        {t.retryBtn}
      </Button>
    </Box>
  )
}

function UnsupportedAlert() {
  const language = useLanguage()
  const t = COPY[language]
  return (
    <Box
      role="alert"
      w="full"
      maxW="md"
      bg="bg.panel"
      borderWidth="2px"
      borderColor="signal.danger"
      borderRadius="lg"
      p="6"
    >
      <HStack gap="4" align="flex-start">
        <Box color="signal.danger" flexShrink={0} mt="1">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="13" />
            <circle cx="12" cy="16.5" r="0.6" fill="currentColor" />
          </svg>
        </Box>
        <Stack gap="2" textAlign="left">
          <Heading as="h2" size="md" color="fg">{t.unsupportedTitle}</Heading>
          <Text color="fg.muted">{t.unsupportedDesc}</Text>
        </Stack>
      </HStack>
    </Box>
  )
}

// ─── Main App ───────────────────────────────────────────────────
function App() {
  // Mount NLP pipeline — watches store, fires when searchState → 'PROCESSING'
  useNlpPipeline()

  const searchState = useSearchState()

  const language = useLanguage()
  const t = COPY[language]
  const supported = isVoiceCaptureSupported()

  const isProcessing = searchState === 'PROCESSING'
  const hasResults = searchState === 'RESULTS_FOUND'

  // Full-screen map during navigation — MapView mounts useGeolocation +
  // useRouteFetcher internally so GPS and OSRM only run while navigating.
  // OfflineBanner sits above it so the driver always sees network status.
  if (searchState === 'NAVIGATING') {
    return (
      <>
        <OfflineBanner />
        <MapView />
      </>
    )
  }

  return (
    <>
      {/* OfflineBanner is fixed-position and overlays all content */}
      <OfflineBanner />
      <Flex direction="column" minH="100vh" bg="bg" color="fg">
      {/* ── Top bar ───────────────────────────────────────────── */}
      <Flex
        as="header"
        px={{ base: '4', md: '8' }}
        py="4"
        align="center"
        justify="space-between"
        gap="4"
        wrap="wrap"
        borderBottomWidth="1px"
        borderColor="border"
        bg="bg.subtle"
      >
        <Stack gap="0">
          <Text fontSize="2xs" color="accent.fg" fontWeight="bold" letterSpacing="wide" textTransform="uppercase">
            {t.tagline}
          </Text>
          <Heading as="h1" size="xl" letterSpacing="tight" lineHeight="shorter">
            Moto-Link
          </Heading>
        </Stack>
        <ConnectionStatusBadge />
      </Flex>

      {/* ── Main content ──────────────────────────────────────── */}
      <Flex
        as="main"
        flex="1"
        align={hasResults ? 'flex-start' : 'center'}
        justify="center"
        px="6"
        py={{ base: '8', md: '12' }}
        overflowY="auto"
      >
        <Container maxW="lg">
          <VStack gap="8" align="center" textAlign="center" w="full">
            <LanguageToggle />

            {!supported ? (
              <UnsupportedAlert />
            ) : (
              <>
                {/* Hero prompt — hidden while results are showing */}
                {!hasResults && !isProcessing && (
                  <Stack gap="3" align="center">
                    <Heading as="h2" size="3xl" fontWeight="extrabold" color="fg" lineHeight="shorter">
                      {t.prompt}
                    </Heading>
                    <Text fontSize="lg" color="fg.muted">
                      {t.subprompt}
                    </Text>
                  </Stack>
                )}

                {/* Voice button — always visible */}
                <Box transform={hasResults ? 'scale(0.75)' : 'scale(1)'} transition="transform 300ms ease">
                  <VoiceRecordButton />
                </Box>

                {/* Processing spinner */}
                {isProcessing && <ProcessingOverlay />}

                {/* Status readout */}
                {!isProcessing && <StatusReadout />}

                {/* Error banner */}
                <ErrorBanner />

                {/* Transcript badge + results */}
                {hasResults && (
                  <>
                    <TranscriptBadge />
                    <ResultsStack />
                  </>
                )}
              </>
            )}
          </VStack>
        </Container>
      </Flex>
    </Flex>
    </>
  )
}

export default App
