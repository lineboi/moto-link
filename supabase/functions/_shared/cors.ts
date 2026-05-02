/**
 * CORS headers required for every browser-invoked Edge Function.
 * Supabase functions-js sets Authorization + apikey automatically;
 * content-type is needed for FormData / JSON bodies from the client.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

/** Return a pre-flight OK response. Call at the top of every Edge Function. */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  return null
}
