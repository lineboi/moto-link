import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'
import type { ClaudeEntity, LandmarkResult, ResultSource } from './types.ts'

// ─── Clients (module-level singletons) ──────────────────────────
const anthropicClient = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
})

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

// ─── System prompt (static — ideal candidate for prompt caching) ─
// Prompt caching requires ≥2048 tokens on claude-sonnet-4-6.
// This prompt (~650 tokens) won't cache on first deploy; add more
// landmark examples to cross the threshold in production.
const KIGALI_EXPERT_SYSTEM_PROMPT = `You are an expert Kigali Geographic Intelligence System with deep knowledge of Kigali, Rwanda's street network, neighborhood structure, and vernacular naming conventions.

Your task: analyze a spoken destination description (Kinyarwanda, English, or mixed) and resolve it into up to 5 ranked geographic candidates.

## Kigali Districts and Sectors
- Gasabo (N/E): Kimironko, Kacyiru, Remera, Gisozi, Kinyinya, Jabana, Bumbogo, Gasanze
- Kicukiro (S): Gahanga, Niboye, Kagarama, Kigarama, Masaka, Gatenga, Kicukiro center
- Nyarugenge (central/W): Nyamirambo, Gitega, Rwezamenyo, Muhima, Nyakabanda, Biryogo

## Major Landmark Coordinates (WGS84)
Kimironko Market: -1.9356, 30.1071
Kacyiru Government District: -1.9356, 30.0617
Kigali Convention Centre: -1.9541, 30.0930
Nyamirambo neighborhood: -1.9811, 30.0478
Remera commercial: -1.9408, 30.1152
Sonatube / Kigali Heights: -1.9516, 30.0826
Gisozi hill: -1.9178, 30.0619
Kabuga: -1.9031, 30.1544
Kwa Rubangura (Kicukiro): -2.0038, 30.1109
Nyabugogo Bus Terminal: -1.9417, 30.0562
Kicukiro Centre: -1.9999, 30.1052
Kanombe: -1.9652, 30.1395
Kibagabaga Hospital: -1.9265, 30.1038
King Faisal Hospital: -1.9555, 30.0673
BK Arena (Amahoro): -1.9487, 30.1062
Chic Hotel roundabout: -1.9525, 30.0832
Gikondo industrial: -1.9708, 30.0966
Muhanga (Gitarama): -2.0836, 29.7545

## Kinyarwanda Location Vocabulary
- "kuri pavé" / "kuri gari" = on/near the road or paved area
- "hafi ya" = near / close to
- "inyuma ya" = behind
- "imbere ya" = in front of
- "munsi ya" = below / downhill
- "hejuru ya" = above / uphill
- "ku mugoroba" = westward / toward sunset
- "ku mugitondo" = eastward / toward sunrise
- "kwa [name]" = at the place of / landmark associated with person
- "agasogemori" = roundabout / traffic circle
- "gate" = gate, entrance, or junction
- "terrain" = open field or sports ground
- "karahome" = small shop / local store
- "ibarabara" = main road
- "akabande" = small path / alley

## Road Coding System
- KN = Kigali Ngali (main arteries, odd/even numbered)
- KG = Kigali Gasabo district roads
- KK = Kigali Kicukiro district roads
- Format: "KN 4 Av", "KG 7 St", "KK 15 Rd"

## Output Rules
Return ONLY a valid JSON array — no markdown fences, no prose, no explanation.
Each element must have exactly these fields:
{
  "landmark": "string — primary location name",
  "road_sign": "string|null — official road code if identifiable",
  "directional_slang": "string|null — vernacular phrase extracted verbatim",
  "confidence": 0.0-1.0,
  "estimated_lat": -1.84 to -2.10,
  "estimated_lng": 29.95 to 30.25
}
Confidence guide: 0.85+ = clear match, 0.5-0.84 = probable, below 0.5 = speculative.
Order by confidence descending. Return 1–5 items. Never return an empty array.
If completely unrecognizable, return one item near Kigali CBD (lat -1.9441, lng 30.0619) with confidence 0.1.`

// ─── DB enrichment: swap AI estimates for verified coordinates ────
type VerifiedRow = {
  id: string
  target_lat: number
  target_lng: number
  confidence_score: number
}

async function enrichWithDb(entities: ClaudeEntity[]): Promise<LandmarkResult[]> {
  const enriched = await Promise.all(
    entities.slice(0, 5).map(async (entity, i): Promise<LandmarkResult> => {
      const base: LandmarkResult = {
        rank: i + 1,
        landmark: entity.landmark,
        road_sign: entity.road_sign,
        directional_slang: entity.directional_slang,
        confidence: Math.max(0, Math.min(1, entity.confidence)),
        lat: entity.estimated_lat,
        lng: entity.estimated_lng,
        source: 'ai_estimate',
        landmark_id: null,
      }

      if (entity.landmark.trim().length < 3) return base

      try {
        const { data } = await supabaseClient
          .from('vernacular_landmarks')
          .select('id, target_lat, target_lng, confidence_score')
          .textSearch('raw_phrase', entity.landmark, {
            config: 'simple',
            type: 'plain',
          })
          .eq('is_qa_flagged', false)
          .order('confidence_score', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (data) {
          const row = data as VerifiedRow
          return {
            ...base,
            lat: row.target_lat,
            lng: row.target_lng,
            confidence: Math.max(base.confidence, row.confidence_score),
            source: 'db_verified' as ResultSource,
            landmark_id: row.id,
          }
        }
      } catch (err) {
        console.warn(`[anthropic] db enrichment skipped for "${entity.landmark}":`, err)
      }

      return base
    }),
  )

  // DB-verified rows first, then sort by confidence
  enriched.sort((a, b) => {
    if (a.source === 'db_verified' && b.source !== 'db_verified') return -1
    if (b.source === 'db_verified' && a.source !== 'db_verified') return 1
    return b.confidence - a.confidence
  })

  return enriched.map((r, i) => ({ ...r, rank: i + 1 }))
}

// ─── JSON parse helpers ──────────────────────────────────────────
function stripMarkdownFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function parseClaudeEntities(text: string): ClaudeEntity[] {
  const cleaned = stripMarkdownFences(text)
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Claude returned non-JSON: ${cleaned.slice(0, 200)}`)
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Claude returned an empty or non-array JSON response')
  }

  return (parsed as Record<string, unknown>[]).map((item) => ({
    landmark: typeof item.landmark === 'string' ? item.landmark : 'Unknown',
    road_sign: typeof item.road_sign === 'string' ? item.road_sign : null,
    directional_slang:
      typeof item.directional_slang === 'string' ? item.directional_slang : null,
    confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
    estimated_lat: typeof item.estimated_lat === 'number' ? item.estimated_lat : -1.9441,
    estimated_lng: typeof item.estimated_lng === 'number' ? item.estimated_lng : 30.0619,
  }))
}

// ─── Public API ──────────────────────────────────────────────────
/**
 * Extract up to 5 Kigali landmark candidates from a vernacular transcript
 * using Claude Sonnet 4.6 with prompt caching on the system block.
 * DB-enriches results against vernacular_landmarks before returning.
 */
export async function extractEntities(
  transcript: string,
  language: string,
): Promise<LandmarkResult[]> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    throw new Error('[anthropic] ANTHROPIC_API_KEY secret is not set on this Edge Function.')
  }

  const response = await anthropicClient.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: KIGALI_EXPERT_SYSTEM_PROMPT,
        // Prompt caching: system block marked ephemeral.
        // Cache activates once the block crosses 2048 tokens (Sonnet 4.6 minimum).
        // deno-lint-ignore no-explicit-any
        cache_control: { type: 'ephemeral' } as any,
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Language: ${language}\nTranscript: "${transcript}"`,
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('[anthropic] Claude returned no text content')
  }

  console.log(
    `[anthropic] usage — input: ${response.usage.input_tokens}, output: ${response.usage.output_tokens}` +
    `, cache_read: ${(response.usage as Record<string, number>).cache_read_input_tokens ?? 0}`,
  )

  const entities = parseClaudeEntities(textBlock.text)
  return enrichWithDb(entities)
}
