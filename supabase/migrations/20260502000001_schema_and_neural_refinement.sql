-- =============================================================================
-- MOTO-LINK · Lyftathon Kigali 2026
-- Migration: Full Schema Bootstrap + Neural Refinement Trigger
-- =============================================================================
-- Run against your linked Supabase project with:
--   npx supabase db push
--
-- This migration is idempotent (safe to re-run):
--   CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--   CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS before CREATE TRIGGER,
--   DROP POLICY IF EXISTS before CREATE POLICY.
-- =============================================================================


-- =============================================================================
-- SECTION A: TABLE SCHEMA, INDEXES & ROW LEVEL SECURITY
-- =============================================================================


-- ---------------------------------------------------------------------------
-- A1. vernacular_landmarks
-- ---------------------------------------------------------------------------
-- The self-evolving slang dictionary. Maps informal Kinyarwanda speech to
-- precise GPS coordinates. confidence_score is updated automatically by the
-- Neural Refinement trigger below.
CREATE TABLE IF NOT EXISTS vernacular_landmarks (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_phrase        TEXT         NOT NULL,
    language          VARCHAR(10)  NOT NULL CHECK (language IN ('rw', 'en')),
    target_lat        DOUBLE PRECISION NOT NULL,
    target_lng        DOUBLE PRECISION NOT NULL,
    confidence_score  FLOAT        DEFAULT 0.5 CHECK (confidence_score BETWEEN 0 AND 1),
    successful_routes INT          DEFAULT 0,
    is_qa_flagged     BOOLEAN      DEFAULT FALSE,
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    last_updated      TIMESTAMPTZ  DEFAULT NOW()
);

-- GIN index for fast bilingual full-text landmark searches
-- Used by the Edge Function's DB-enrichment step (Supabase .textSearch())
CREATE INDEX IF NOT EXISTS idx_phrase_search
    ON vernacular_landmarks
    USING GIN (to_tsvector('simple', raw_phrase));


-- ---------------------------------------------------------------------------
-- A2. navigation_sessions
-- ---------------------------------------------------------------------------
-- Records every attempted route. Feeds the Neural Refinement engine.
-- status CONFIRMED fires the DB trigger that boosts confidence_score.
CREATE TABLE IF NOT EXISTS navigation_sessions (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    landmark_id         UUID         REFERENCES vernacular_landmarks(id),
    driver_id           UUID,
    start_lat           DOUBLE PRECISION,
    start_lng           DOUBLE PRECISION,
    actual_arrival_lat  DOUBLE PRECISION,
    actual_arrival_lng  DOUBLE PRECISION,
    status              VARCHAR(20)  NOT NULL
                            CHECK (status IN ('CONFIRMED', 'REJECTED', 'ABANDONED', 'PIVOTED')),
    search_attempts     INT          DEFAULT 1,
    completed_at        TIMESTAMPTZ  DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- A3. qa_flag_logs
-- ---------------------------------------------------------------------------
-- Tracks when the system fails to provide the correct destination.
CREATE TABLE IF NOT EXISTS qa_flag_logs (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id            UUID         REFERENCES navigation_sessions(id),
    landmark_id           UUID         REFERENCES vernacular_landmarks(id),
    error_type            VARCHAR(50)
                              CHECK (error_type IN ('SYSTEM_MISCLASSIFICATION', 'USER_MISPRONUNCIATION')),
    user_audio_transcript TEXT,
    resolved              BOOLEAN      DEFAULT FALSE,
    logged_at             TIMESTAMPTZ  DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- A4. reinforcement_dataset
-- ---------------------------------------------------------------------------
-- Captures raw transcripts → confirmed coordinates for future fine-tuning.
-- Inserted fire-and-forget by the process-audio Edge Function on every trip.
CREATE TABLE IF NOT EXISTS reinforcement_dataset (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_transcript      TEXT         NOT NULL,
    extracted_landmark  TEXT,
    target_lat          DOUBLE PRECISION,
    target_lng          DOUBLE PRECISION,
    is_accurate         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ  DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- A5. known_osm_landmarks
-- ---------------------------------------------------------------------------
-- Static reference table for well-known Kigali landmarks.
-- The Edge Function cross-references this during DB enrichment.
CREATE TABLE IF NOT EXISTS known_osm_landmarks (
    id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    formal_name  TEXT,
    road_sign    TEXT,
    lat          DOUBLE PRECISION,
    lng          DOUBLE PRECISION
);


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Enable RLS on all tables so anonymous drivers can only perform
-- the minimum operations needed for the app to function.

ALTER TABLE vernacular_landmarks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_flag_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reinforcement_dataset    ENABLE ROW LEVEL SECURITY;
ALTER TABLE known_osm_landmarks      ENABLE ROW LEVEL SECURITY;

-- Drivers (anon role) can read non-flagged landmarks to power the search
DROP POLICY IF EXISTS "anon_select_landmarks" ON vernacular_landmarks;
CREATE POLICY "anon_select_landmarks"
    ON vernacular_landmarks
    FOR SELECT
    TO anon
    USING (is_qa_flagged = FALSE);

-- Drivers can log their trips (anonymous telemetry — no PII required)
DROP POLICY IF EXISTS "anon_insert_sessions" ON navigation_sessions;
CREATE POLICY "anon_insert_sessions"
    ON navigation_sessions
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- The process-audio Edge Function (service role) can insert reinforcement rows
DROP POLICY IF EXISTS "anon_insert_reinforcement" ON reinforcement_dataset;
CREATE POLICY "anon_insert_reinforcement"
    ON reinforcement_dataset
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Drivers can read known OSM landmarks for reference
DROP POLICY IF EXISTS "anon_select_osm" ON known_osm_landmarks;
CREATE POLICY "anon_select_osm"
    ON known_osm_landmarks
    FOR SELECT
    TO anon
    USING (true);


-- =============================================================================
-- SECTION B: NEURAL REFINEMENT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_landmark_confidence()
RETURNS TRIGGER AS $$
BEGIN
    -- Guard: skip rows where the landmark was not matched in our database
    IF NEW.landmark_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'CONFIRMED' THEN
        UPDATE vernacular_landmarks
        SET
            successful_routes = successful_routes + 1,
            confidence_score  = LEAST(confidence_score + 0.05, 1.0),
            last_updated      = NOW()
        WHERE id = NEW.landmark_id;

    ELSIF NEW.status = 'REJECTED' THEN
        UPDATE vernacular_landmarks
        SET
            confidence_score = GREATEST(confidence_score - 0.10, 0.0),
            last_updated     = NOW()
        WHERE id = NEW.landmark_id;

    ELSIF NEW.status = 'ABANDONED' THEN
        UPDATE vernacular_landmarks
        SET
            confidence_score = GREATEST(confidence_score - 0.02, 0.0),
            last_updated     = NOW()
        WHERE id = NEW.landmark_id;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Drop and recreate so the migration is idempotent
DROP TRIGGER IF EXISTS trigger_refine_confidence ON navigation_sessions;

CREATE TRIGGER trigger_refine_confidence
    AFTER INSERT ON navigation_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_landmark_confidence();