# Moto-Link

**Voice-first navigation for Kigali moto-taxi drivers.**

Moto-Link lets a passenger speak a destination in natural Kinyarwanda or English — including vernacular descriptions like *"kuri pavé hafi ya Kwa Nyiranuma"* — and instantly gets a turn-by-turn route on a live map. Built for the **Lyftathon Kigali 2026** hackathon.

---

## How it works

1. **Tap** the microphone button and speak your destination.
2. **Whisper** (OpenAI via HuggingFace Inference) transcribes the audio.
3. **Claude Sonnet 4** extracts structured location entities from the transcript and ranks matches against the Kigali landmark database.
4. **OSRM** calculates the driving route; **MapLibre GL** renders it on a live map.
5. The driver taps **Start Trip** — GPS tracking begins and audio guidance fires at key waypoints.
6. On arrival, the session is logged to Supabase and the landmark's confidence score is updated by a PostgreSQL trigger.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, TypeScript (strict) |
| UI | Chakra UI v3, next-themes (dark / light mode) |
| State | Zustand v5 (devtools + persist via IndexedDB / localForage) |
| Auth | Supabase Auth (email + password) |
| STT | OpenAI Whisper Large v3 via HuggingFace Inference Router |
| AI | Claude Sonnet 4.6 (Anthropic API, prompt caching) |
| Backend | Supabase Edge Functions (Deno) |
| Database | Supabase PostgreSQL — landmarks, sessions, routes, refinements |
| Maps | MapLibre GL + react-map-gl v7 (CARTO Dark Matter tiles) |
| Routing | OSRM public API |
| PWA | vite-plugin-pwa (Workbox — offline support, installable) |
| Deploy | Netlify (SPA redirect, service-worker cache headers) |

---

## Features

- Bilingual UI — Kinyarwanda and English, switchable at runtime
- Dark / light mode toggle (persisted per device)
- Full offline support — last landmark results cached to IndexedDB; amber/red offline banner
- Glassmorphism auth modal — login, sign up, profile, sign out
- Live GPS tracking during navigation
- Audio guidance cues at waypoints via Web Speech API
- Session logging with CONFIRMED / REJECTED / ABANDONED outcomes
- Self-learning confidence scores — PostgreSQL trigger updates landmark weights after each trip
- Installable PWA (add to home screen)

---

## Project structure

```
src/
  components/       # AuthModal, ColorModeSwitcher, OfflineBanner
  features/
    map/            # MapView, useGeolocation, useRouteFetcher
    voice/          # VoiceRecordButton, useVoiceRecorder, useNlpPipeline, ResultsStack
  hooks/            # useAuth, useOnlineStatus
  lib/              # Supabase singleton
  store/            # useSessionStore (Zustand)
  theme/            # Chakra system tokens + provider
  types/            # Database types
supabase/
  functions/
    process-audio/  # Edge Function: Whisper STT → Claude entity extraction
    _shared/        # huggingface.ts, anthropic.ts, supabase.ts
  migrations/       # Full schema + neural refinement trigger
```

---

## Local development

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [HuggingFace](https://huggingface.co) API token
- An [Anthropic](https://console.anthropic.com) API key

### 1. Clone and install

```bash
git clone https://github.com/lineboi/moto-link.git
cd moto-link
npm install
```

### 2. Environment variables

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Database

Run the migration in the Supabase SQL editor:

```
supabase/migrations/20260502000001_schema_and_neural_refinement.sql
```

### 4. Edge Function secrets

```bash
npx supabase secrets set HUGGINGFACE_API_TOKEN=hf_...
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### 5. Deploy the Edge Function

```bash
npx supabase functions deploy process-audio
```

### 6. Run the dev server

```bash
npm run dev
```

---

## Deployment

The app is deployed on Netlify at **[https://moto-link-kigali.netlify.app](https://moto-link-kigali.netlify.app)**.

```bash
netlify deploy --prod
```

`netlify.toml` handles the SPA redirect (`/* → /index.html`) and sets `Cache-Control: no-cache` on `sw.js` so service-worker updates propagate immediately.

---

## Database schema (summary)

| Table | Purpose |
|---|---|
| `landmarks` | Kigali locations with coordinates and confidence scores |
| `landmark_aliases` | Vernacular names and phonetic variants per landmark |
| `trips` | Session log (start/end coords, outcome, duration) |
| `route_segments` | Individual steps of each route |
| `landmark_refinements` | Raw vote log driving the confidence trigger |

The `update_landmark_confidence()` trigger fires after each refinement insert:
- **CONFIRMED** → +0.05 (cap 1.0)
- **REJECTED** → −0.10
- **ABANDONED** → −0.02 (floor 0.0)

---

## License

MIT
