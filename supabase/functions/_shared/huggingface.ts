const HF_WHISPER_URL =
  'https://api-inference.huggingface.co/models/mbazaNLP/Whisper-Small-Kinyarwanda'

/** Minimum wait between cold-start retries, in ms. */
const MIN_RETRY_WAIT_MS = 2_000
/** Maximum wait we will ever block on a cold-start, in ms. */
const MAX_RETRY_WAIT_MS = 30_000
/** Hard timeout for a single HF fetch, in ms. */
const FETCH_TIMEOUT_MS = 60_000

// ─── Error class ────────────────────────────────────────────────
export class HuggingFaceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'HuggingFaceError'
  }
}

// ─── Internal shape of the HF Inference API response ────────────
interface HfSuccessResponse {
  text: string
}

interface HfLoadingResponse {
  error: string
  estimated_time: number
}

// ─── Helper: single fetch attempt with timeout ───────────────────
async function fetchWhisper(
  audioBytes: Uint8Array,
  mimeType: string,
  token: string,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    return await fetch(HF_WHISPER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mimeType,
        'Accept': 'application/json',
      },
      body: audioBytes,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new HuggingFaceError(
        'HF_TIMEOUT',
        `Whisper API did not respond within ${FETCH_TIMEOUT_MS / 1000}s.`,
        true,
      )
    }
    throw new HuggingFaceError(
      'HF_NETWORK_ERROR',
      err instanceof Error ? err.message : 'Network error reaching Hugging Face.',
      true,
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─── Helper: parse and validate the HF response body ─────────────
async function parseResponse(res: Response): Promise<HfSuccessResponse | HfLoadingResponse> {
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new HuggingFaceError(
      'HF_INVALID_RESPONSE',
      `Unexpected non-JSON response from Hugging Face (HTTP ${res.status}).`,
      false,
    )
  }
  return body as HfSuccessResponse | HfLoadingResponse
}

// ─── Helper: raise typed errors for non-2xx status codes ─────────
function throwForStatus(status: number, body: HfSuccessResponse | HfLoadingResponse): void {
  if (status === 401 || status === 403) {
    throw new HuggingFaceError(
      'HF_AUTH_ERROR',
      'Invalid or missing HUGGINGFACE_API_TOKEN. Check your Supabase secrets.',
      false,
    )
  }
  if (status === 429) {
    throw new HuggingFaceError(
      'HF_RATE_LIMIT',
      'Hugging Face rate limit reached. Try again in a few seconds.',
      true,
    )
  }
  if (status === 400) {
    throw new HuggingFaceError(
      'HF_INVALID_AUDIO',
      'Hugging Face rejected the audio file. Check the MIME type and encoding.',
      false,
    )
  }
}

// ─── Public API ──────────────────────────────────────────────────
/**
 * Transcribe a Kinyarwanda (or bilingual) audio clip using the
 * mbazaNLP/Whisper-Small-Kinyarwanda model on the HF Inference API.
 *
 * Handles the model cold-start 503 by waiting `estimated_time` ms
 * (bounded to MAX_RETRY_WAIT_MS) and retrying exactly once.
 *
 * @throws {HuggingFaceError} with a machine-readable `code` field.
 */
export async function transcribeAudio(
  audioBytes: Uint8Array,
  mimeType: string,
): Promise<string> {
  const token = Deno.env.get('HUGGINGFACE_API_TOKEN')
  if (!token) {
    throw new HuggingFaceError(
      'HF_AUTH_ERROR',
      'HUGGINGFACE_API_TOKEN secret is not set on this Edge Function.',
      false,
    )
  }

  // ── First attempt ──────────────────────────────────────────────
  const firstRes = await fetchWhisper(audioBytes, mimeType, token)

  if (firstRes.status === 503) {
    const firstBody = await parseResponse(firstRes) as HfLoadingResponse
    const estimatedMs = typeof firstBody.estimated_time === 'number'
      ? firstBody.estimated_time * 1_000
      : MIN_RETRY_WAIT_MS
    const waitMs = Math.min(Math.max(estimatedMs, MIN_RETRY_WAIT_MS), MAX_RETRY_WAIT_MS)

    console.log(
      `[huggingface] model loading — waiting ${waitMs}ms then retrying once`,
    )
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs))

    // ── Single retry ───────────────────────────────────────────
    const retryRes = await fetchWhisper(audioBytes, mimeType, token)

    if (retryRes.status === 503) {
      throw new HuggingFaceError(
        'HF_MODEL_LOADING',
        'Whisper model is still loading after retry. Please try again in ~30 seconds.',
        true,
      )
    }

    throwForStatus(retryRes.status, await parseResponse(retryRes))
    const retryBody = (await parseResponse(retryRes)) as HfSuccessResponse
    return validateTranscript(retryBody.text)
  }

  // ── Non-503 error on first attempt ─────────────────────────────
  if (!firstRes.ok) {
    const errBody = await parseResponse(firstRes)
    throwForStatus(firstRes.status, errBody)
    throw new HuggingFaceError(
      'HF_UNKNOWN_ERROR',
      `Hugging Face returned HTTP ${firstRes.status}.`,
      false,
    )
  }

  // ── Success on first attempt ───────────────────────────────────
  const successBody = (await parseResponse(firstRes)) as HfSuccessResponse
  return validateTranscript(successBody.text)
}

// ─── Validate the transcript is non-empty ─────────────────────────
function validateTranscript(text: unknown): string {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new HuggingFaceError(
      'HF_EMPTY_TRANSCRIPT',
      'Whisper returned an empty transcript. The audio may be too short, silent, or corrupted.',
      false,
    )
  }
  return text.trim()
}
