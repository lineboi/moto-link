import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

let _client: SupabaseClient<Database> | null = null

function getClient(): SupabaseClient<Database> {
  if (_client) return _client
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '[moto-link] Missing Supabase env vars. Copy .env.example → .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
  _client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 2 },
    },
    global: {
      headers: { 'x-application-name': 'moto-link' },
    },
  })
  return _client
}

export const supabase: SupabaseClient<Database> = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_target, prop, receiver) {
      const client = getClient()
      const value = Reflect.get(client, prop, receiver)
      return typeof value === 'function' ? value.bind(client) : value
    },
  },
)

export type { Database } from '@/types/database'
