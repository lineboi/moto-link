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

const PIPELINE_TIMEOUT_MS = 30_000

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

      // Supabase FunctionsHttpError — non-2xx from the Edge Function
      if (invokeError) {
        const msg =
          invokeError instanceof Error
            ? invokeError.message
            : 'NLP pipeline returned an error.'
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
