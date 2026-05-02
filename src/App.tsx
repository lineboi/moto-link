import {
  Box,
  Button,
  Container,
  Flex,
  HStack,
  Heading,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ConnectionStatusBadge } from '@/components/ConnectionStatusBadge'
import { VoiceRecordButton } from '@/features/voice/VoiceRecordButton'
import { isVoiceCaptureSupported } from '@/features/voice/useVoiceRecorder'
import {
  useAudioBlob,
  useAudioMeta,
  useLanguage,
  useSearchState,
  useSessionStore,
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
    capturedTitle: 'Amajwi yafashwe',
    capturedMime: 'Ubwoko',
    capturedDuration: 'Igihe',
    capturedSize: 'Ubunini',
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
    capturedTitle: 'Captured Audio',
    capturedMime: 'MIME',
    capturedDuration: 'Duration',
    capturedSize: 'Size',
    unsupportedTitle: 'Voice capture not supported',
    unsupportedDesc:
      'Please open Moto-Link in a recent Chrome, Firefox, or Safari on a mobile device.',
  },
} as const

const STATUS_TEXT: Record<SearchState, Record<Language, string>> = {
  IDLE: { rw: 'Tegereje', en: 'Ready' },
  LISTENING: { rw: 'Ndumva…', en: 'Listening…' },
  PROCESSING: { rw: 'Ndategura amagambo…', en: 'Processing your voice…' },
  RESULTS_FOUND: { rw: 'Hari aho nahabonye!', en: 'Match found!' },
  NO_MATCH: { rw: 'Sinabashije gusobanura', en: "Couldn't understand that" },
  RETRYING: { rw: 'Ndongeye kugerageza', en: 'Trying again' },
}

const STATUS_TONE: Record<SearchState, string> = {
  IDLE: 'fg.muted',
  LISTENING: 'accent.fg',
  PROCESSING: 'accent.fg',
  RESULTS_FOUND: 'signal.success',
  NO_MATCH: 'signal.warning',
  RETRYING: 'signal.warning',
}

// ─── Helpers ────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  if (!ms) return '0.0 s'
  return `${(ms / 1000).toFixed(1)} s`
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB'
  return `${(bytes / 1024).toFixed(1)} KB`
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
              _hover={{
                bg: active ? 'accent.fg' : 'bg.muted',
              }}
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

function CapturedAudioPanel() {
  const audioBlob = useAudioBlob()
  const meta = useAudioMeta()
  const language = useLanguage()
  const t = COPY[language]
  if (!audioBlob) return null

  return (
    <Box
      w="full"
      maxW="md"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      borderRadius="lg"
      p="5"
      textAlign="left"
    >
      <Text
        fontSize="xs"
        color="accent.fg"
        fontWeight="bold"
        letterSpacing="wide"
        textTransform="uppercase"
        mb="3"
      >
        {t.capturedTitle}
      </Text>
      <SimpleGrid columns={3} gap="4">
        <MetaCell label={t.capturedMime} value={meta.mimeType ?? '—'} mono />
        <MetaCell label={t.capturedDuration} value={formatDuration(meta.durationMs)} />
        <MetaCell label={t.capturedSize} value={formatBytes(meta.sizeBytes)} />
      </SimpleGrid>
    </Box>
  )
}

function MetaCell({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <Stack gap="1">
      <Text
        fontSize="2xs"
        color="fg.subtle"
        letterSpacing="wide"
        textTransform="uppercase"
        fontWeight="bold"
      >
        {label}
      </Text>
      <Text
        fontSize="sm"
        color="fg"
        fontFamily={mono ? 'mono' : undefined}
        wordBreak="break-all"
      >
        {value}
      </Text>
    </Stack>
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
          <svg
            viewBox="0 0 24 24"
            width="32"
            height="32"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="13" />
            <circle cx="12" cy="16.5" r="0.6" fill="currentColor" />
          </svg>
        </Box>
        <Stack gap="2" textAlign="left">
          <Heading as="h2" size="md" color="fg">
            {t.unsupportedTitle}
          </Heading>
          <Text color="fg.muted">{t.unsupportedDesc}</Text>
        </Stack>
      </HStack>
    </Box>
  )
}

// ─── Main App ───────────────────────────────────────────────────
function App() {
  const language = useLanguage()
  const t = COPY[language]
  const supported = isVoiceCaptureSupported()

  return (
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
          <Text
            fontSize="2xs"
            color="accent.fg"
            fontWeight="bold"
            letterSpacing="wide"
            textTransform="uppercase"
          >
            {t.tagline}
          </Text>
          <Heading as="h1" size="xl" letterSpacing="tight" lineHeight="shorter">
            Moto-Link
          </Heading>
        </Stack>
        <ConnectionStatusBadge />
      </Flex>

      {/* ── Main hero ─────────────────────────────────────────── */}
      <Flex
        as="main"
        flex="1"
        align="center"
        justify="center"
        px="6"
        py={{ base: '8', md: '12' }}
      >
        <Container maxW="lg">
          <VStack gap="10" align="center" textAlign="center" w="full">
            <LanguageToggle />

            {!supported ? (
              <UnsupportedAlert />
            ) : (
              <>
                <Stack gap="3" align="center">
                  <Heading
                    as="h2"
                    size="3xl"
                    fontWeight="extrabold"
                    color="fg"
                    lineHeight="shorter"
                  >
                    {t.prompt}
                  </Heading>
                  <Text fontSize="lg" color="fg.muted">
                    {t.subprompt}
                  </Text>
                </Stack>

                <VoiceRecordButton />

                <StatusReadout />

                <CapturedAudioPanel />
              </>
            )}
          </VStack>
        </Container>
      </Flex>
    </Flex>
  )
}

export default App
