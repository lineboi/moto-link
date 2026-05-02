import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { HuggingFaceError, transcribeAudio } from '../_shared/huggingface.ts'
import { extractEntities } from '../_shared/anthropic.ts'
import type {
  Language,
  ProcessAudioError,
  ProcessAudioResponse,
} from '../_shared/types.ts'

// EdgeRuntime.waitUntil is injected by the Supabase Edge Runtime
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

// Service-role client for the fire-and-forget reinforcement insert
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

// ─── Helpers ────────────────────────────────────────────────────
function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorResponse(
  error: string,
  message: string,
  retryable: boolean,
  status = 500,
): Response {
  const body: ProcessAudioError = { error, message, retryable }
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ─── Entry point ────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  // 1. CORS preflight
  const preflight = handleCors(req)
  if (preflight) return preflight

  // 2. Method guard
  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Only POST is accepted.', false, 405)
  }

  // 3. Parse FormData
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return errorResponse(
      'INVALID_BODY',
      'Request body must be multipart/form-data.',
      false,
      400,
    )
  }

  const audioField = formData.get('audio')
  const language = ((formData.get('language') ?? 'rw') as string) as Language
  const mimeType = (formData.get('mime_type') as string | null)
    ?? 'audio/webm;codecs=opus'

  if (!audioField || !(audioField instanceof File || audioField instanceof Blob)) {
    return errorResponse(
      'MISSING_AUDIO',
      'FormData must contain an "audio" file field.',
      false,
      400,
    )
  }

  // 4. Convert Blob → Uint8Array
  let audioBytes: Uint8Array
  try {
    const buffer = await audioField.arrayBuffer()
    audioBytes = new Uint8Array(buffer)
  } catch {
    return errorResponse(
      'AUDIO_READ_ERROR',
      'Failed to read audio data from the uploaded file.',
      false,
      400,
    )
  }

  console.log(
    `[process-audio] ${audioBytes.byteLength} bytes | mime: ${mimeType} | lang: ${language}`,
  )

  // 5. Stage 1 — Transcribe via Hugging Face Whisper
  let transcript: string
  try {
    transcript = await transcribeAudio(audioBytes, mimeType)
  } catch (err) {
    if (err instanceof HuggingFaceError) {
      const statusMap: Record<string, number> = {
        HF_AUTH_ERROR: 503,
        HF_MODEL_LOADING: 503,
        HF_RATE_LIMIT: 429,
        HF_INVALID_AUDIO: 400,
        HF_EMPTY_TRANSCRIPT: 422,
        HF_TIMEOUT: 504,
        HF_NETWORK_ERROR: 502,
        HF_INVALID_RESPONSE: 502,
        HF_UNKNOWN_ERROR: 502,
      }
      return errorResponse(err.code, err.message, err.retryable, statusMap[err.code] ?? 500)
    }
    return errorResponse('INTERNAL_ERROR', 'Transcription failed unexpectedly.', false, 500)
  }

  console.log(`[process-audio] transcript: "${transcript}"`)

  // 6. Stage 2 — Claude entity extraction + DB enrichment
  let results: ProcessAudioResponse['results']
  try {
    results = await extractEntities(transcript, language)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Entity extraction failed.'
    return errorResponse('EXTRACTION_ERROR', msg, false, 500)
  }

  console.log(`[process-audio] ${results.length} results, top: "${results[0]?.landmark}"`)

  // 7. Fire-and-forget: save to reinforcement_dataset for RL training
  // EdgeRuntime.waitUntil keeps the promise alive after the response is sent
  const topResult = results[0]
  EdgeRuntime.waitUntil(
    supabase
      .from('reinforcement_dataset')
      .insert({
        raw_transcript: transcript,
        extracted_landmark: topResult ? JSON.stringify(topResult) : null,
        target_lat: topResult?.lat ?? null,
        target_lng: topResult?.lng ?? null,
        is_accurate: false, // updated to true when driver confirms arrival
      })
      .then(({ error }) => {
        if (error) console.error('[process-audio] reinforcement insert:', error.message)
      })
      .catch((e) => console.error('[process-audio] reinforcement insert catch:', e)),
  )

  // 8. Return the full pipeline response
  const response: ProcessAudioResponse = {
    transcript,
    language_detected: language,
    results,
  }

  return json(response)
})
