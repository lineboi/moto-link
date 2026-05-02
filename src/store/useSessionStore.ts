import { create, type StateCreator } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Language } from '@/types/database'

export type SearchState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'RESULTS_FOUND'
  | 'NO_MATCH'
  | 'RETRYING'

export interface SessionState {
  // ─── Recording ────────────────────────────────────────────────
  isRecording: boolean
  audioBlob: Blob | null
  audioMimeType: string | null
  audioDurationMs: number
  recordingStartedAt: number | null

  // ─── NLP pipeline ─────────────────────────────────────────────
  transcript: string | null
  previousTranscript: string | null
  confidenceScore: number | null

  // ─── Session machine ──────────────────────────────────────────
  searchState: SearchState
  language: Language
  error: string | null

  // ─── Actions ──────────────────────────────────────────────────
  startRecording: () => void
  stopRecording: (payload: {
    blob: Blob
    mimeType: string
    durationMs: number
  }) => void
  cancelRecording: () => void
  setTranscript: (transcript: string) => void
  setConfidenceScore: (score: number) => void
  setLanguage: (language: Language) => void
  setSearchState: (state: SearchState) => void
  setError: (message: string | null) => void
  reset: () => void
}

const initialState = {
  isRecording: false,
  audioBlob: null,
  audioMimeType: null,
  audioDurationMs: 0,
  recordingStartedAt: null,
  transcript: null,
  previousTranscript: null,
  confidenceScore: null,
  searchState: 'IDLE' as SearchState,
  language: 'rw' as Language,
  error: null,
}

const sessionStore: StateCreator<
  SessionState,
  [['zustand/devtools', never]],
  []
> = (set) => ({
  ...initialState,

  startRecording: () =>
    set(
      (s) => ({
        isRecording: true,
        recordingStartedAt: Date.now(),
        audioBlob: null,
        audioMimeType: null,
        audioDurationMs: 0,
        previousTranscript: s.transcript,
        transcript: null,
        confidenceScore: null,
        searchState: 'LISTENING',
        error: null,
      }),
      false,
      'session/startRecording',
    ),

  stopRecording: ({ blob, mimeType, durationMs }) =>
    set(
      {
        isRecording: false,
        audioBlob: blob,
        audioMimeType: mimeType,
        audioDurationMs: durationMs,
        recordingStartedAt: null,
        searchState: 'PROCESSING',
      },
      false,
      'session/stopRecording',
    ),

  cancelRecording: () =>
    set(
      {
        isRecording: false,
        audioBlob: null,
        audioMimeType: null,
        audioDurationMs: 0,
        recordingStartedAt: null,
        searchState: 'IDLE',
      },
      false,
      'session/cancelRecording',
    ),

  setTranscript: (transcript) =>
    set({ transcript }, false, 'session/setTranscript'),

  setConfidenceScore: (confidenceScore) =>
    set({ confidenceScore }, false, 'session/setConfidenceScore'),

  setLanguage: (language) => set({ language }, false, 'session/setLanguage'),

  setSearchState: (searchState) =>
    set({ searchState }, false, 'session/setSearchState'),

  setError: (error) =>
    set(
      { error, searchState: error ? 'NO_MATCH' : 'IDLE' },
      false,
      'session/setError',
    ),

  reset: () => set({ ...initialState }, false, 'session/reset'),
})

export const useSessionStore = create<SessionState>()(
  devtools(sessionStore, {
    name: 'moto-link/session',
    enabled: import.meta.env.DEV,
  }),
)

// ─── Selector hooks (avoid full-store re-renders) ──────────────
export const useIsRecording = () => useSessionStore((s) => s.isRecording)
export const useAudioBlob = () => useSessionStore((s) => s.audioBlob)
export const useAudioMeta = () =>
  useSessionStore((s) => ({
    mimeType: s.audioMimeType,
    durationMs: s.audioDurationMs,
    sizeBytes: s.audioBlob?.size ?? 0,
  }))
export const useTranscript = () => useSessionStore((s) => s.transcript)
export const useConfidenceScore = () =>
  useSessionStore((s) => s.confidenceScore)
export const useSearchState = () => useSessionStore((s) => s.searchState)
export const useLanguage = () => useSessionStore((s) => s.language)
export const useSessionError = () => useSessionStore((s) => s.error)
