import { useEffect, useRef } from 'react'
import {
  useTripStatus,
  useSessionStore,
  type TripStatus,
} from '@/store/useSessionStore'

// ─── Browser capability guards ────────────────────────────────────
/** True if the browser supports the Web Speech Synthesis API. */
export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  )
}

function isVibrationSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  )
}

// ─── Haptic helpers ───────────────────────────────────────────────
function safeVibrate(pattern: VibratePattern): void {
  if (!isVibrationSupported()) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // vibrate is best-effort — ignore on restricted environments
  }
}

// ─── Speech helper ────────────────────────────────────────────────
/**
 * Speak a single utterance. Always cancels any in-progress speech first
 * so rapid status changes never produce overlapping announcements.
 */
function speak(text: string, lang: string): void {
  if (!isSpeechSupported()) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.9    // slightly slower — legible at highway speed
    utterance.pitch = 1.1   // slightly raised — cuts through wind noise
    utterance.volume = 1.0  // maximum — driver may have earphones or speakerphone
    window.speechSynthesis.speak(utterance)
  } catch {
    // speechSynthesis can throw if called outside a user-gesture context in
    // some browsers; swallow silently — the haptic pattern still fires.
  }
}

// ─── Language tag lookup ──────────────────────────────────────────
const LANG_TAG: Record<string, string> = {
  rw: 'rw-RW',
  en: 'en-US',
}

// ─── Transition announcement table ───────────────────────────────
type TransitionKey = `${TripStatus}->${TripStatus}`

const ANNOUNCEMENTS: Partial<Record<TransitionKey, Record<string, string>>> = {
  'IDLE->STARTED': {
    en: 'Navigating to {landmark}',
    rw: 'Turimo kujya {landmark}',
  },
  'STARTED->PAUSED': {
    en: 'Trip paused',
    rw: 'Urugendo ruhagaritswe',
  },
  'PAUSED->STARTED': {
    en: 'Resuming',
    rw: 'Tukomeza',
  },
}

const HAPTIC_PATTERNS: Partial<Record<TransitionKey, VibratePattern>> = {
  // Strong double-pulse — "go" signal
  'IDLE->STARTED': [100, 50, 100, 50, 100],
  // Slow double — "hold"
  'STARTED->PAUSED': [200, 100, 200],
  // Rapid triple — "go again"
  'PAUSED->STARTED': [50, 50, 50, 50, 50],
}

// ─── Hook ─────────────────────────────────────────────────────────
/**
 * Watches tripStatus transitions and fires the appropriate bilingual
 * speech announcement + haptic pattern.
 *
 * Speech: window.speechSynthesis — SpeechSynthesisUtterance with
 *   rate 0.9 / pitch 1.1 / volume 1.0, lang set from the session language.
 *
 * Haptics: navigator.vibrate — pattern varies per transition.
 *
 * Both APIs are guarded for browser support and wrapped in try/catch
 * so the hook never crashes on unsupported environments (iOS Safari
 * has no vibration; some browsers block speech without a user gesture).
 *
 * Uses useRef to compare previous vs. current tripStatus so only genuine
 * transitions fire — not every render with the same status value.
 * Language and selectedLandmark are read via getState() inside the effect
 * so the hook's dependency array stays tight ([tripStatus]).
 */
export function useAudioGuide(): void {
  const tripStatus = useTripStatus()
  // Initialise prev ref to the current status at mount time so the
  // first effect run (which always sees prev === current) is a no-op.
  const prevStatusRef = useRef<TripStatus>(tripStatus)

  // ── Transition detection ──────────────────────────────────────
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = tripStatus

    // No actual change — skip (covers initial mount render)
    if (prev === tripStatus) return

    const key: TransitionKey = `${prev}->${tripStatus}`
    const { language, selectedLandmark } = useSessionStore.getState()

    // ── Haptics (fire immediately — no browser permission required) ──
    const pattern = HAPTIC_PATTERNS[key]
    if (pattern) safeVibrate(pattern)

    // ── Speech ────────────────────────────────────────────────────
    const textTemplate = ANNOUNCEMENTS[key]?.[language]
    if (textTemplate) {
      const landmarkName = selectedLandmark?.landmark ?? ''
      const text = textTemplate.replace('{landmark}', landmarkName)
      speak(text, LANG_TAG[language] ?? 'en-US')
    }
  }, [tripStatus])

  // ── Unmount cleanup: cancel any pending speech ────────────────
  // Runs once when MapView unmounts so speech never bleeds past navigation.
  useEffect(() => {
    return () => {
      if (isSpeechSupported()) {
        try {
          window.speechSynthesis.cancel()
        } catch {
          // ignore
        }
      }
    }
  }, [])
}
