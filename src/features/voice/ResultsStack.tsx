import { Box, Badge, HStack, Heading, Stack, Text, VStack } from '@chakra-ui/react'
import {
  useLandmarkResults,
  useLanguage,
  useSessionStore,
  type LandmarkResult,
} from '@/store/useSessionStore'

// ─── Bilingual labels ─────────────────────────────────────────────
const LABELS = {
  rw: {
    dbVerified: 'Bimenywe',
    aiEstimate: 'Icyiringiro',
    confidence: 'Kwizera',
    roadSign: "Izina ry'ibarabara",
    noResults: 'Nta bisubizo bibonetse',
    selectHint: 'Kanda ho kugira ngo uhitemo',
  },
  en: {
    dbVerified: 'DB Verified',
    aiEstimate: 'AI Estimate',
    confidence: 'Confidence',
    roadSign: 'Road sign',
    noResults: 'No results found',
    selectHint: 'Tap to navigate here',
  },
} as const

// ─── Confidence bar ───────────────────────────────────────────────
function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  const barColor =
    pct >= 75 ? 'signal.success' : pct >= 45 ? 'accent.solid' : 'signal.warning'

  return (
    <HStack gap="3" w="full" align="center">
      <Box flex="1" bg="bg.muted" borderRadius="full" h="2" overflow="hidden">
        <Box
          bg={barColor}
          h="full"
          borderRadius="full"
          w={`${pct}%`}
          transition="width 500ms ease"
        />
      </Box>
      <Text
        fontSize="sm"
        fontWeight="bold"
        color={barColor}
        minW="3rem"
        textAlign="right"
        fontFamily="mono"
      >
        {pct}%
      </Text>
    </HStack>
  )
}

// ─── Source badge ─────────────────────────────────────────────────
function SourceBadge({
  source,
  language,
}: {
  source: LandmarkResult['source']
  language: keyof typeof LABELS
}) {
  const labels = LABELS[language]
  const isVerified = source === 'db_verified'

  return (
    <Badge
      colorPalette={isVerified ? 'green' : 'yellow'}
      size="sm"
      px="2"
      py="0.5"
      borderRadius="full"
      fontWeight="bold"
      fontSize="2xs"
      letterSpacing="wide"
      textTransform="uppercase"
    >
      {isVerified ? `✓ ${labels.dbVerified}` : `~ ${labels.aiEstimate}`}
    </Badge>
  )
}

// ─── Single result card ───────────────────────────────────────────
function ResultCard({
  result,
  language,
}: {
  result: LandmarkResult
  language: keyof typeof LABELS
}) {
  const labels = LABELS[language]

  const handleSelect = () => {
    const store = useSessionStore.getState()
    store.setSelectedLandmark(result)
    store.setDestinationLocation({ lat: result.lat, lng: result.lng })
    store.setSearchState('NAVIGATING')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSelect()
    }
  }

  return (
    <Box
      as="article"
      w="full"
      bg="bg.panel"
      borderWidth="1px"
      borderColor={result.source === 'db_verified' ? 'signal.success' : 'border'}
      borderRadius="xl"
      p="5"
      minH="touchTargetLg"
      role="button"
      tabIndex={0}
      cursor="pointer"
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      _hover={{ bg: 'bg.muted', borderColor: 'accent.solid', transform: 'scale(1.01)' }}
      _active={{ transform: 'scale(0.98)' }}
      _focusVisible={{ outline: 'none', boxShadow: '0 0 0 3px rgba(255,179,0,0.6)' }}
      transition="all 150ms ease"
      aria-label={`${result.rank}. ${result.landmark}, ${Math.round(result.confidence * 100)}% confidence. ${labels.selectHint}.`}
    >
      <Stack gap="3">
        {/* Header row: rank + landmark name + source badge */}
        <HStack justify="space-between" align="flex-start" wrap="wrap" gap="2">
          <HStack gap="3" align="center" flex="1" minW="0">
            <Box
              w="8"
              h="8"
              borderRadius="full"
              bg="accent.solid"
              color="accent.contrast"
              display="flex"
              alignItems="center"
              justifyContent="center"
              fontWeight="extrabold"
              fontSize="sm"
              flexShrink={0}
            >
              {result.rank}
            </Box>
            <Heading
              as="h3"
              size="lg"
              fontWeight="extrabold"
              color="fg"
              lineHeight="shorter"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {result.landmark}
            </Heading>
          </HStack>
          <SourceBadge source={result.source} language={language} />
        </HStack>

        {/* Road sign + directional slang */}
        {(result.road_sign || result.directional_slang) && (
          <HStack gap="4" wrap="wrap">
            {result.road_sign && (
              <HStack gap="1.5">
                <Text
                  fontSize="xs"
                  color="fg.subtle"
                  fontWeight="bold"
                  letterSpacing="wide"
                  textTransform="uppercase"
                >
                  {labels.roadSign}
                </Text>
                <Text
                  fontSize="sm"
                  color="fg.muted"
                  fontFamily="mono"
                  bg="bg.muted"
                  px="2"
                  py="0.5"
                  borderRadius="md"
                >
                  {result.road_sign}
                </Text>
              </HStack>
            )}
            {result.directional_slang && (
              <Text fontSize="sm" color="fg.muted" fontStyle="italic">
                "{result.directional_slang}"
              </Text>
            )}
          </HStack>
        )}

        {/* Confidence bar */}
        <Stack gap="1">
          <Text
            fontSize="xs"
            color="fg.subtle"
            fontWeight="bold"
            letterSpacing="wide"
            textTransform="uppercase"
          >
            {labels.confidence}
          </Text>
          <ConfidenceBar value={result.confidence} />
        </Stack>

        {/* Navigate CTA hint */}
        <Text
          fontSize="xs"
          color="accent.fg"
          fontWeight="bold"
          letterSpacing="wide"
          textAlign="right"
          textTransform="uppercase"
        >
          {labels.selectHint} →
        </Text>
      </Stack>
    </Box>
  )
}

// ─── Results stack (public component) ────────────────────────────
export function ResultsStack() {
  const results = useLandmarkResults()
  const language = useLanguage()
  const labels = LABELS[language]

  if (results.length === 0) {
    return (
      <Box w="full" maxW="md" textAlign="center" py="6">
        <Text color="fg.muted">{labels.noResults}</Text>
      </Box>
    )
  }

  return (
    <VStack
      as="section"
      gap="3"
      w="full"
      maxW="md"
      align="stretch"
      aria-label={language === 'rw' ? 'Ibisubizo' : 'Results'}
    >
      {results.map((result) => (
        <ResultCard key={result.rank} result={result} language={language} />
      ))}
    </VStack>
  )
}
