import { useEffect, useState, type SVGProps } from 'react'
import { IconButton, Text, VStack } from '@chakra-ui/react'
import {
  useIsRecording,
  useLanguage,
  useSessionStore,
} from '@/store/useSessionStore'
import { useVoiceRecorder } from '@/features/voice/useVoiceRecorder'

// ─── Inline SVG icons (no external icon-library dep) ──────────────
function MicIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="9" y="3" width="6" height="13" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

function StopIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      {...props}
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

// ─── Bilingual labels keyed off the session language ──────────────
const LABELS = {
  rw: {
    idle: 'Kanda uvuge aho ushaka kujya',
    recording: 'Kanda uhagarike kwandika',
    unsupported: 'Mudasobwa ntiyemera ijwi',
    permissionDenied: 'Wabihaye uburenganzira bwanze',
  },
  en: {
    idle: 'Tap to speak your destination',
    recording: 'Tap to stop recording',
    unsupported: 'Voice capture not supported in this browser',
    permissionDenied: 'Microphone permission was denied',
  },
} as const

// ─── mm:ss timer helpers ──────────────────────────────────────────
function formatTimer(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function useRecordingTimer(
  isRecording: boolean,
  startedAt: number | null,
): number {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!isRecording || !startedAt) {
      setElapsedMs(0)
      return
    }
    setElapsedMs(Date.now() - startedAt)
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt)
    }, 200)
    return () => window.clearInterval(id)
  }, [isRecording, startedAt])

  return elapsedMs
}

// ─── Component ────────────────────────────────────────────────────
export function VoiceRecordButton() {
  const { start, stop, isSupported, permissionState } = useVoiceRecorder()
  const isRecording = useIsRecording()
  const language = useLanguage()
  const recordingStartedAt = useSessionStore((s) => s.recordingStartedAt)

  const elapsedMs = useRecordingTimer(isRecording, recordingStartedAt)
  const labels = LABELS[language]

  const isDisabled = !isSupported || permissionState === 'denied'

  const ariaLabel = !isSupported
    ? labels.unsupported
    : permissionState === 'denied'
      ? labels.permissionDenied
      : isRecording
        ? labels.recording
        : labels.idle

  const handleClick = () => {
    if (isDisabled) return
    if (isRecording) {
      stop()
    } else {
      void start()
    }
  }

  // TODO(future): Long-press ≥ 3000 ms triggers a hard force-stop that
  // bypasses MediaRecorder.stop() (which can hang on iOS Safari) and
  // falls back to releaseStream() + manual blob assembly. Wire on
  // pointerdown / pointerup with a setTimeout-tracked threshold.

  return (
    <VStack gap="4" align="center" w="full">
      <IconButton
        aria-label={ariaLabel}
        aria-pressed={isRecording}
        onClick={handleClick}
        disabled={isDisabled}
        boxSize="touchTargetXl"
        minW="touchTargetXl"
        minH="touchTargetXl"
        borderRadius="full"
        bg={
          isDisabled
            ? 'bg.muted'
            : isRecording
              ? 'signal.danger'
              : 'accent.solid'
        }
        color={isDisabled ? 'fg.subtle' : 'accent.contrast'}
        borderWidth="3px"
        borderColor={
          isRecording
            ? 'signal.danger'
            : isDisabled
              ? 'border'
              : 'accent.fg'
        }
        boxShadow={
          isDisabled
            ? 'none'
            : isRecording
              ? '0 0 0 8px rgba(239, 68, 68, 0.22), 0 18px 40px rgba(239, 68, 68, 0.45)'
              : '0 0 0 6px rgba(255, 179, 0, 0.18), 0 18px 40px rgba(255, 179, 0, 0.45)'
        }
        transition="background 140ms ease, transform 120ms ease, box-shadow 200ms ease"
        _hover={{
          bg: isDisabled
            ? 'bg.muted'
            : isRecording
              ? 'signal.danger'
              : 'accent.fg',
          transform: isDisabled ? 'none' : 'scale(1.03)',
        }}
        _active={{ transform: isDisabled ? 'none' : 'scale(0.96)' }}
        _focusVisible={{
          outline: 'none',
          boxShadow:
            '0 0 0 4px rgba(255, 255, 255, 0.85), 0 0 0 8px rgba(255, 179, 0, 0.6)',
        }}
        _disabled={{
          cursor: 'not-allowed',
          opacity: 1,
          boxShadow: 'none',
        }}
        css={
          isRecording
            ? {
                '@keyframes molink-mic-pulse': {
                  '0%, 100%': {
                    transform: 'scale(1)',
                    boxShadow:
                      '0 0 0 8px rgba(239, 68, 68, 0.22), 0 18px 40px rgba(239, 68, 68, 0.45)',
                  },
                  '50%': {
                    transform: 'scale(1.07)',
                    boxShadow:
                      '0 0 0 22px rgba(239, 68, 68, 0), 0 18px 40px rgba(239, 68, 68, 0.55)',
                  },
                },
                animation: 'molink-mic-pulse 1.4s ease-in-out infinite',
              }
            : undefined
        }
      >
        {isRecording ? (
          <StopIcon width="42" height="42" />
        ) : (
          <MicIcon width="46" height="46" />
        )}
      </IconButton>

      {isRecording ? (
        <Text
          fontSize="3xl"
          fontWeight="extrabold"
          fontFamily="mono"
          color="signal.danger"
          letterSpacing="wide"
          lineHeight="shorter"
          aria-live="polite"
          aria-atomic="true"
        >
          {formatTimer(elapsedMs)}
        </Text>
      ) : !isSupported ? (
        <Text fontSize="sm" color="signal.warning" textAlign="center">
          {labels.unsupported}
        </Text>
      ) : permissionState === 'denied' ? (
        <Text fontSize="sm" color="signal.danger" textAlign="center">
          {labels.permissionDenied}
        </Text>
      ) : null}
    </VStack>
  )
}
