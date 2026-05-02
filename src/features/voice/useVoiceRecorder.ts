import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionStore } from '@/store/useSessionStore'

export type MicPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied'

const MIME_PREFERENCES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const

const WHISPER_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  channelCount: 1,
  sampleRate: 16000,
}

export function isVoiceCaptureSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

export function pickSupportedMimeType(): string | null {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return null
  }
  for (const candidate of MIME_PREFERENCES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate
    }
  }
  return null
}

function safeVibrate(pattern: VibratePattern): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Vibration is best-effort; ignore unsupported environments.
  }
}

function releaseStream(stream: MediaStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

interface UseVoiceRecorderResult {
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
  isSupported: boolean
  permissionState: MicPermissionState
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeRef = useRef<string | null>(null)
  const startedAtRef = useRef<number>(0)
  const cancelledRef = useRef<boolean>(false)

  const [permissionState, setPermissionState] =
    useState<MicPermissionState>('unknown')

  const isSupported = isVoiceCaptureSupported()

  // ─── Permission tracking (Permissions API) ──────────────────────
  useEffect(() => {
    if (!isSupported || !navigator.permissions?.query) return

    let permissionStatus: PermissionStatus | null = null
    let cancelled = false

    const handleChange = () => {
      if (permissionStatus && !cancelled) {
        setPermissionState(permissionStatus.state as MicPermissionState)
      }
    }

    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        if (cancelled) return
        permissionStatus = status
        setPermissionState(status.state as MicPermissionState)
        status.addEventListener('change', handleChange)
      })
      .catch(() => {
        // Some browsers (Firefox <pre-modern, Safari <16.4) reject 'microphone'.
        // Leave permissionState as 'unknown' and rely on getUserMedia outcome.
      })

    return () => {
      cancelled = true
      permissionStatus?.removeEventListener('change', handleChange)
    }
  }, [isSupported])

  // ─── Internal cleanup helper ────────────────────────────────────
  const teardown = useCallback(() => {
    releaseStream(streamRef.current)
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
    mimeRef.current = null
    startedAtRef.current = 0
    cancelledRef.current = false
  }, [])

  // ─── start ──────────────────────────────────────────────────────
  const start = useCallback(async (): Promise<void> => {
    const session = useSessionStore.getState()

    if (!isSupported) {
      session.setError('voice_capture_unsupported')
      return
    }
    if (recorderRef.current && session.isRecording) {
      // Already recording — ignore double-tap.
      return
    }

    const chosenMime = pickSupportedMimeType()

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: WHISPER_AUDIO_CONSTRAINTS,
      })
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setPermissionState('denied')
        session.setError('permission_denied')
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        session.setError('no_microphone')
      } else {
        session.setError(
          err instanceof Error ? err.message : 'microphone_error',
        )
      }
      return
    }

    setPermissionState('granted')

    let recorder: MediaRecorder
    try {
      recorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream)
    } catch (err) {
      releaseStream(stream)
      session.setError(
        err instanceof Error ? err.message : 'recorder_init_failed',
      )
      return
    }

    streamRef.current = stream
    recorderRef.current = recorder
    chunksRef.current = []
    mimeRef.current = chosenMime ?? recorder.mimeType ?? 'audio/webm'
    cancelledRef.current = false

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    recorder.onerror = (event: Event) => {
      const recorderError = (event as unknown as { error?: Error }).error
      session.setError(recorderError?.message ?? 'recorder_runtime_error')
      teardown()
    }

    recorder.onstop = () => {
      const wasCancelled = cancelledRef.current
      const finalMime = mimeRef.current ?? recorder.mimeType ?? 'audio/webm'
      const durationMs = startedAtRef.current
        ? Math.max(0, Math.round(performance.now() - startedAtRef.current))
        : 0

      if (wasCancelled || chunksRef.current.length === 0) {
        teardown()
        return
      }

      const blob = new Blob(chunksRef.current, { type: finalMime })
      teardown()

      useSessionStore.getState().stopRecording({
        blob,
        mimeType: finalMime,
        durationMs,
      })
    }

    startedAtRef.current = performance.now()
    session.startRecording()
    safeVibrate(50)

    // 100ms timeslice → ondataavailable fires regularly so chunks stay small
    // and any abrupt page nav still salvages most of the audio.
    recorder.start(100)
  }, [isSupported, teardown])

  // ─── stop ───────────────────────────────────────────────────────
  const stop = useCallback((): void => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    cancelledRef.current = false
    safeVibrate([30, 50, 30])

    try {
      recorder.stop()
    } catch (err) {
      useSessionStore
        .getState()
        .setError(err instanceof Error ? err.message : 'recorder_stop_failed')
      teardown()
    }
  }, [teardown])

  // ─── cancel ─────────────────────────────────────────────────────
  const cancel = useCallback((): void => {
    const recorder = recorderRef.current
    cancelledRef.current = true

    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        // Recorder already torn down — fall through to manual cleanup.
      }
    } else {
      teardown()
    }

    useSessionStore.getState().cancelRecording()
  }, [teardown])

  // ─── Unmount safety: never leave the mic indicator hanging ──────
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current
      cancelledRef.current = true
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          // ignore — fall through to teardown
        }
      }
      releaseStream(streamRef.current)
      streamRef.current = null
      recorderRef.current = null
      chunksRef.current = []
    }
  }, [])

  return { start, stop, cancel, isSupported, permissionState }
}
