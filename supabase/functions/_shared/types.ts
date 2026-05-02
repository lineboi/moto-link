/** Languages supported by the bilingual NLP pipeline. */
export type Language = 'rw' | 'en'

/** Where the result coordinates came from. */
export type ResultSource = 'db_verified' | 'ai_estimate'

/**
 * A single ranked landmark candidate returned by the pipeline.
 * DB-verified rows have real GPS coordinates from vernacular_landmarks.
 * AI-estimated rows have coordinates inferred by Claude from training data.
 */
export interface LandmarkResult {
  rank: number
  landmark: string
  road_sign: string | null
  directional_slang: string | null
  confidence: number          // 0.0 – 1.0
  lat: number
  lng: number
  source: ResultSource
  landmark_id: string | null  // UUID from vernacular_landmarks (db_verified only)
}

/**
 * Parsed entity bundle returned by Claude before DB enrichment.
 * Used internally by the Edge Function — not sent to the client.
 */
export interface ClaudeEntity {
  landmark: string
  road_sign: string | null
  directional_slang: string | null
  confidence: number
  estimated_lat: number
  estimated_lng: number
}

/** Body POSTed by the frontend as multipart/form-data. */
export interface ProcessAudioRequest {
  audio: File | Blob       // field name: "audio"
  language: Language       // field name: "language"
  mime_type: string        // field name: "mime_type"  e.g. "audio/webm;codecs=opus"
}

/** Successful pipeline response. */
export interface ProcessAudioResponse {
  transcript: string
  language_detected: Language
  results: LandmarkResult[]
}

/** Error payload — returned with a non-200 status. */
export interface ProcessAudioError {
  error: string            // machine-readable key  e.g. "HF_MODEL_LOADING"
  message: string          // human-readable detail
  retryable: boolean
}
