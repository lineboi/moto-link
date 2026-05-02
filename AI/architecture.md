# 🏗️ MOTO-LINK: Senior System Architecture

## 1. High-Level Tech Stack
- **Frontend Layer:** React 18 (Vite), TypeScript.
- **UI Framework:** **Chakra UI v3 (Strict Mandate)**. Custom dark-mode theme for high-contrast, "glove-friendly" interfaces.
- **State Management:** Zustand (optimized for rapid state mutations like real-time GPS coordinates and offline syncing).
- **Backend & Database:** Supabase (PostgreSQL, Edge Functions, Row Level Security).
- **Mapping Engine:** `react-map-gl` (MapLibre GL JS) + OpenStreetMap (OSM) vector tiles.
- **Routing:** Open Source Routing Machine (OSRM) for turn-by-turn navigation.
- **Offline Core:** Vite PWA Plugin (Service Workers) + `localForage` (IndexedDB) for caching.

---

## 2. Core Modules & Data Flow

### A. Hybrid Vernacular NLP Engine
1. **Input Layer:** `Web Speech API` captures bilingual audio (Kinyarwanda/English) via a massive, glove-safe Chakra UI `<IconButton>`.
2. **Translation & Parsing:** Audio text is sent to a Supabase Edge Function. An LLM parses the unstructured slang into structured geospatial keywords.
3. **Probability Stack:** The system queries OSM and our custom `vernacular_landmarks` DB. It returns a **Top-5 Probability Stack**. 
4. **UI Presentation:** The primary result is shown with visual verification (place images fetched via API or static cache). If rejected, the user can swipe to secondary matches or trigger a "Re-scan" voice command.

### B. Multi-Modal Address Fusion (Bulletproof Accuracy)
1. **Data Reconciliation:** The parsing layer uniquely reconciles Kigali’s formal street-naming convention with its informal landmark culture.
2. **Logic Flow:** The system recognizes and prioritizes formal road markers (e.g., "KK 09 Av" or "KG 123 St") while simultaneously parsing the vernacular landmark descriptions.
3. **Cadastral Anchoring:** This cross-referencing ensures 100% accuracy by anchoring the informal, crowdsourced landmarks to the city's official cadastral grid via OpenStreetMap before returning the final coordinate stack to the driver.

### C. Audio-First Guidance & Breadcrumbs
1. **Turn-by-Turn:** Once a destination is locked, OSRM generates the route.
2. **Haptic & Voice:** The browser's `SpeechSynthesis` API provides audio cues ("Turn left in 200m"). `navigator.vibrate()` provides haptic feedback for upcoming turns (glove-safe).
3. **Breadcrumb Engine:** We track the driver's exact path using `navigator.geolocation.watchPosition()`. If the driver gets lost in a complex neighborhood, the "Back-Nav" feature reverses this exact coordinate array, rendering a distinct escape route on the map, inherently respecting the one-way streets they just navigated.

### D. Offline-First Edge-Cache
1. **Trigger:** User taps "Confirm Destination".
2. **Action:** A background Web Worker instantly intercepts the OSRM route geometry (GeoJSON) and the Top-5 location data, saving it to **IndexedDB**.
3. **Execution:** If `navigator.onLine` becomes `false`, the React components seamlessly read from IndexedDB. The map continues to render the polyline, and GPS tracking remains active offline.

### E. AI Self-Evolving & QA Loop
- **The Core Engine:** The frontend acts as a data-collection node for our Neural Refinement Engine. Every trip generates telemetry.
- **Success:** If a driver arrives and confirms, the slang used is reinforced in the Supabase database, increasing its trust score.
- **Failure & QA:** If rejected, the frontend prompts a quick feedback loop. The discrepancy is sent to the backend to categorize as a user error (mispronunciation) or system error, subsequently flagging the keyword if necessary.


## 3. The Operational Flow: From Voice to Journey End

### 1. Voice Input & Recognition
- **Action:** User taps a massive Chakra UI `<IconButton>`. The browser's `MediaRecorder API` captures audio (WAV/WEBM).
- **The AI:** The audio Blob is sent to `mbazaNLP/Whisper-Small-Kinyarwanda` via Hugging Face for bilingual transcription.

### 2. Data Routing (The Traffic Controller)
- The raw Kinyarwanda text is sent to a Next.js API Route (`/api/nlp-parse`). This keeps our Claude API keys hidden from the client and orchestrates the backend logic.

### 3. The "Brain" (Intent Analysis)
- **The AI:** The API Route sends the text to the **Claude API** with a strict system prompt: *"You are a Kigali Geographic Expert. Extract entities: Landmark, Road_Sign, Directional_Slang. Return strictly JSON."*
- **Example:** "Kuri pavé hafi ya Kwa Nyiranuma" -> `{"landmark": "Kwa Nyiranuma", "directional_slang": "kuri pavé"}`.

### 4. Transformation to Direct Routes
- The Next.js API cross-references the extracted JSON against a **Local JSON dataset** of Kigali OSM coordinates.
- It returns a Top-5 Probability Stack. Chakra UI renders these as visual cards.

### 5. Map Integration & Routing
- Once the driver confirms the destination card, **Leaflet.js Routing Machine** generates a GeoJSON polyline.
- **Offline Cache:** The route geometry is saved to `localStorage` or IndexedDB so navigation continues if the 4G network drops.

### 6. Journey End & Quality Assurance (The RL Hook)
- **Arrival:** Upon GPS proximity arrival, the UI prompts: "Was this accurate?"
- **The "Training" Hook:** If accurate, the Prompt Text + Confirmed GPS is saved to Supabase. This acts as our Reinforcement Learning (RL) dataset for future model fine-tuning. If inaccurate, the keyword is flagged as "Unfavorable".


### 7. Recursive Voice Search & Input Layer
- **Action:** User taps the Chakra UI `<IconButton>`. 
- **State Management:** The UI strictly follows the `SearchState` machine (`'IDLE' | 'LISTENING' | 'RESULTS_FOUND' | 'NO_MATCH' | 'RETRYING'`).
- **The "Try Again" Loop:** If the Top-5 stack fails (Triggering `'NO_MATCH'`), a high-contrast Chakra UI Modal prompts for a refinement. The browser re-captures audio, and the Next.js API receives *both* the new transcript and the failed transcript. 
- **Contextual AI:** Claude uses the previous failure to narrow the search radius, treating the new audio as a modifier (e.g., "Not near the market, it's next to the red building").

### 8. Dynamic Session Control (Mid-Ride Management)
Real-time urban travel requires extreme flexibility. Moto-Link utilizes a persistent "Session Manager" overlay via Chakra UI, governed by Zustand state.
- **Pause / Wait:** A "Hold" button suspends the OSRM turn-by-turn guidance and ETA calculations without destroying the route polyline.
- **Cancel / Opt-Out:** An "End Journey" button instantly halts `geolocation.watchPosition`, clears the map, logs the session as `ABANDONED` in Supabase, and returns the driver to the idle state.
- **Mid-Ride Pivot:** A "Change Destination" voice trigger recalculates the Leaflet polyline from the immediate GPS coordinate to the new target without requiring a full app reload.