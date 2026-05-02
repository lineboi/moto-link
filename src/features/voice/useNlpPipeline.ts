import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  useAudioBlob,
  useSearchState,
  useSessionStore,
  type LandmarkResult,
} from '@/store/useSessionStore'

interface ProcessAudioResponse {
  transcript: string
  language_detected: 'rw' | 'en'
  results: LandmarkResult[]
}

// 75s to accommodate HuggingFace free-tier Whisper cold-start (~60s worst case)
const PIPELINE_TIMEOUT_MS = 75_000

export function useNlpPipeline(): void {
  const audioBlob = useAudioBlob()
  const searchState = useSearchState()

  useEffect(() => {
    if (searchState !== 'PROCESSING' || !audioBlob) return

    const store = useSessionStore.getState()
    const { audioMimeType, language } = store

    let cancelled = false
    const controller = new AbortController()

    // Hard 30-second deadline — aborts the fetch if still pending
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) controller.abort()
    }, PIPELINE_TIMEOUT_MS)

    const run = async () => {
      const formData = new FormData()
      formData.append('audio', audioBlob, `recording.${audioMimeType?.split('/')[1] ?? 'webm'}`)
      formData.append('language', language)
      formData.append('mime_type', audioMimeType ?? 'audio/webm;codecs=opus')

      let data: ProcessAudioResponse | null = null
      let invokeError: unknown = null

      try {
        const result = await supabase.functions.invoke<ProcessAudioResponse>(
          'process-audio',
          {
            body: formData,
            signal: controller.signal,
          },
        )
        data = result.data
        invokeError = result.error
      } catch (err) {
        invokeError = err
      }

      if (cancelled) return
      clearTimeout(timeoutId)

      const freshStore = useSessionStore.getState()

      // Timeout path: AbortError from the controller
      if (
        invokeError instanceof Error &&
        (invokeError.name === 'AbortError' || invokeError.message.includes('aborted'))
      ) {
        freshStore.setError('NLP pipeline timed out. Please try again.')
        return
      }

      // Supabase FunctionsHttpError — non-2xx from the Edge Function.
      // The SDK's generic .message is "Edge Function returned a non-2xx status code".
      // Read the actual JSON body from the Response context to get our custom
      // {error, message, retryable} payload and surface a meaningful error.
      if (invokeError) {
        let msg = 'NLP pipeline returned an error.'
        try {
          // FunctionsHttpError exposes the raw Response on .context
          const ctx = (invokeError as Record<string, unknown>).context
          if (ctx && typeof (ctx as Response).json === 'function') {
            const body = await (ctx as Response).json() as Record<string, unknown>
            if (typeof body.message === 'string') msg = body.message
            else if (typeof body.error === 'string') msg = body.error
          } else if (invokeError instanceof Error && invokeError.message &&
            !invokeError.message.includes('non-2xx')) {
            msg = invokeError.message
          }
        } catch {
          // ignore parse failure — fall back to generic message
        }
        freshStore.setError(msg)
        return
      }

      // Empty or malformed response body
      if (!data || !Array.isArray(data.results)) {
        freshStore.setError('Received an unexpected response from the pipeline.')
        return
      }

      // Happy path — dispatch results into the store
      if (data.transcript) freshStore.setTranscript(data.transcript)
      freshStore.setLandmarkResults(data.results)

      if (data.results.length > 0) {
        freshStore.setConfidenceScore(data.results[0].confidence)
        freshStore.setSearchState('RESULTS_FOUND')
      } else {
        freshStore.setSearchState('NO_MATCH')
      }
    }

    void run()

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      controller.abort()
    }
  // Re-run only when these change: audioBlob switching to a new Blob signals a new recording
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob, searchState])
}
