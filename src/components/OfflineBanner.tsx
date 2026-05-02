import { Box, Text } from '@chakra-ui/react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useLandmarkResults, useLanguage } from '@/store/useSessionStore'

// ─── Bilingual offline copy ───────────────────────────────────────
const OFFLINE_COPY = {
  rw: {
    cached: 'Mutagatifu — Koresha inzira zachazwe',
    noCached: 'Bagenzi — Nta résultats yabitswe. Subira kuri interineti.',
  },
  en: {
    cached: 'Offline — Using cached results',
    noCached: 'Offline — No cached results. Connect to search.',
  },
} as const

/**
 * Fixed top banner that appears when the network is lost.
 * Amber variant: driver can still navigate using IndexedDB-cached results.
 * Red variant: no cached results, driver must reconnect to search.
 * Returns null when the device is online — zero render cost.
 */
export function OfflineBanner() {
  const { isOnline } = useOnlineStatus()
  const landmarkResults = useLandmarkResults()
  const language = useLanguage()

  if (isOnline) return null

  const hasCached = landmarkResults.length > 0
  const t = OFFLINE_COPY[language]

  return (
    <Box
      position="fixed"
      top="0"
      left="0"
      right="0"
      zIndex={2000}
      bg={hasCached ? 'rgba(255, 179, 0, 0.18)' : 'rgba(239, 68, 68, 0.18)'}
      backdropFilter="blur(8px)"
      borderBottomWidth="2px"
      borderColor={hasCached ? '#FFB300' : '#EF4444'}
      px="4"
      py="2"
      textAlign="center"
    >
      <Text
        fontSize="sm"
        fontWeight="bold"
        color={hasCached ? '#FFB300' : '#EF4444'}
        letterSpacing="wide"
      >
        {hasCached ? t.cached : t.noCached}
      </Text>
    </Box>
  )
}
