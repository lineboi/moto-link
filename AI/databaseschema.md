# 🗄️ MOTO-LINK: Database Schema & Neural Refinement

## 1. Supabase Architecture Strategy
We are utilizing Supabase's PostgreSQL database to build a crowdsourced, self-healing geographic dictionary. Instead of just static coordinates, we store vernacular phrases, confidence scores, and automated QA flags.

All operations should be executed via the Supabase JS Client, leveraging Row Level Security (RLS) to ensure drivers can only write telemetry data anonymously.

For the hackathon MVP, we are not training a live model. Instead, we are building the data-collection architecture that *proves* our system gets smarter over time

---

## 2. Table Definitions

### A. `vernacular_landmarks` (Self-Evolving Slang Mapping)
This table acts as our dynamic dictionary. It maps informal speech to strict GPS coordinates.
```sql
CREATE TABLE vernacular_landmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_phrase TEXT NOT NULL,              -- e.g., "Kwa Nyiranuma"
    language VARCHAR(10) NOT NULL,         -- 'rw' or 'en'
    target_lat DOUBLE PRECISION NOT NULL,
    target_lng DOUBLE PRECISION NOT NULL,
    confidence_score FLOAT DEFAULT 0.5,    -- Ranges from 0.0 to 1.0 (Neural Refinement)
    successful_routes INT DEFAULT 0,       -- Number of times drivers confirmed arrival
    is_qa_flagged BOOLEAN DEFAULT FALSE,   -- Pulled from navigation pool if true
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast text searching and bounding box queries
CREATE INDEX idx_phrase_search ON vernacular_landmarks USING GIN (to_tsvector('simple', raw_phrase));
```

### B. `navigation_sessions` (Trip Telemetry & Reinforcement)
Records every attempted route. This data feeds the Neural Refinement Engine.
```sql
-- Update to TABLE B: navigation_sessions
CREATE TABLE navigation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landmark_id UUID REFERENCES vernacular_landmarks(id),
    driver_id UUID,                        
    start_lat DOUBLE PRECISION,
    start_lng DOUBLE PRECISION,
    actual_arrival_lat DOUBLE PRECISION,
    actual_arrival_lng DOUBLE PRECISION,
    status VARCHAR(20) NOT NULL,           -- 'CONFIRMED', 'REJECTED', 'ABANDONED', 'PIVOTED'
    search_attempts INT DEFAULT 1,         -- Tracks if they needed the Recursive Loop
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### C. `qa_flag_logs` (Automated QA System)
Tracks when the system fails to provide the right destination.
```sql
CREATE TABLE qa_flag_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES navigation_sessions(id),
    landmark_id UUID REFERENCES vernacular_landmarks(id),
    error_type VARCHAR(50),                -- 'SYSTEM_MISCLASSIFICATION', 'USER_MISPRONUNCIATION'
    user_audio_transcript TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 3. Neural Refinement Logic (Supabase Triggers / RPC)

To achieve **Feature 8 (Neural Refinement Engine)**, we use a PostgreSQL trigger function. When a `navigation_sessions` row is inserted with a status of 'CONFIRMED', the database automatically recalculates the confidence score of that specific slang.

```sql
-- Pseudo-code for the self-healing trigger
CREATE OR REPLACE FUNCTION update_landmark_confidence() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'CONFIRMED' THEN
        UPDATE vernacular_landmarks
        SET successful_routes = successful_routes + 1,
            confidence_score = LEAST(confidence_score + 0.05, 1.0), -- Increment confidence max 1.0
            last_updated = NOW()
        WHERE id = NEW.landmark_id;
    ELSIF NEW.status = 'REJECTED' THEN
        UPDATE vernacular_landmarks
        SET confidence_score = GREATEST(confidence_score - 0.1, 0.0) -- Decrement confidence
        WHERE id = NEW.landmark_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refine_confidence
AFTER INSERT ON navigation_sessions
FOR EACH ROW EXECUTE FUNCTION update_landmark_confidence();
```



```sql
-- Table: reinforcement_dataset
-- Purpose: Captures the user's raw speech and maps it to successful coordinates to prove the self-learning concept.
CREATE TABLE reinforcement_dataset (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_transcript TEXT NOT NULL,          -- The output from Mbaza Whisper
    extracted_landmark TEXT,               -- The JSON output from Claude API
    target_lat DOUBLE PRECISION,           -- The actual GPS coordinate reached
    target_lng DOUBLE PRECISION,
    is_accurate BOOLEAN NOT NULL,          -- True if user confirmed arrival, False if flagged
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: known_osm_landmarks
-- Purpose: While we use a local JSON file for the hackathon MVP, this table represents where those local JSON coordinates would eventually live.
CREATE TABLE known_osm_landmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    formal_name TEXT,                      -- e.g., "Kimironko Market"
    road_sign TEXT,                        -- e.g., "KG 11 Ave"
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION
);