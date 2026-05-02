import { create, type StateCreator } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Language } from '@/types/database'

// ─── Pipeline types (mirrors Edge Function response shape) ────────
export type ResultSource = 'db_verified' | 'ai_estimate'

export interface LandmarkResult {
  rank: number
  landmark: string
  road_sign: string | null
  directional_slang: string | null
  confidence: number
  lat: number
  lng: number
  source: ResultSource
  landmark_id: string | null
}

// ─── Navigation / map types ───────────────────────────────────────
export interface GeoPosition {
  lat: number
  lng: number
  accuracy: number
  heading: number
}

export interface DestinationPosition {
  lat: number
  lng: number
}

export interface RouteMeta {
  distanceKm: number
  durationMin: number
}

// Minimal inline GeoJSON LineString Feature — avoids needing @types/geojson
export interface RouteGeoJson {
  type: 'Feature'
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  properties: Record<string, unknown>
}

// ─── SearchState machine ──────────────────────────────────────────
export type SearchState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'RESULTS_FOUND'
  | 'NO_MATCH'
  | 'RETRYING'
  | 'NAVIGATING'

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
  landmarkResults: LandmarkResult[]

  // ─── Navigation & map ─────────────────────────────────────────
  selectedLandmark: LandmarkResult | null
  currentLocation: GeoPosition | null
  destinationLocation: DestinationPosition | null
  routeGeoJson: RouteGeoJson | null
  routeMeta: RouteMeta | null

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
  setLandmarkResults: (results: LandmarkResult[]) => void
  setSelectedLandmark: (landmark: LandmarkResult | null) => void
  setCurrentLocation: (location: GeoPosition) => void
  setDestinationLocation: (location: DestinationPosition) => void
  setRouteGeoJson: (route: RouteGeoJson | null) => void
  setRouteMeta: (meta: RouteMeta | null) => void
  clearRoute: () => void
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
  landmarkResults: [] as LandmarkResult[],
  selectedLandmark: null,
  currentLocation: null,
  destinationLocation: null,
  routeGeoJson: null,
  routeMeta: null,
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
        landmarkResults: [],
        selectedLandmark: null,
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

  setLandmarkResults: (landmarkResults) =>
    set({ landmarkResults }, false, 'session/setLandmarkResults'),

  setSelectedLandmark: (selectedLandmark) =>
    set({ selectedLandmark }, false, 'session/setSelectedLandmark'),

  setCurrentLocation: (currentLocation) =>
    set({ currentLocation }, false, 'session/setCurrentLocation'),

  setDestinationLocation: (destinationLocation) =>
    set({ destinationLocation }, false, 'session/setDestinationLocation'),

  setRouteGeoJson: (routeGeoJson) =>
    set({ routeGeoJson }, false, 'session/setRouteGeoJson'),

  setRouteMeta: (routeMeta) =>
    set({ routeMeta }, false, 'session/setRouteMeta'),

  clearRoute: () =>
    set(
      {
        selectedLandmark: null,
        destinationLocation: null,
        routeGeoJson: null,
        routeMeta: null,
        searchState: 'RESULTS_FOUND',
      },
      false,
      'session/clearRoute',
    ),

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
export const useLandmarkResults = () =>
  useSessionStore((s) => s.landmarkResults)
export const useSelectedLandmark = () =>
  useSessionStore((s) => s.selectedLandmark)
export const useCurrentLocation = () =>
  useSessionStore((s) => s.currentLocation)
export const useDestinationLocation = () =>
  useSessionStore((s) => s.destinationLocation)
export const useRouteGeoJson = () =>
  useSessionStore((s) => s.routeGeoJson)
export const useRouteMeta = () =>
  useSessionStore((s) => s.routeMeta)
export const useSearchState = () => useSessionStore((s) => s.searchState)
export const useLanguage = () => useSessionStore((s) => s.language)
export const useSessionError = () => useSessionStore((s) => s.error)
