CREATE TABLE IF NOT EXISTS endpoints(
    id              TEXT PRIMARY KEY,
    url             TEXT NOT NULL,
    signing_secret  TEXT NOT NULL,
    creates_at      TIMESTAMPTZ DEFAULT NOW(),
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS events(
    id              TEXT PRIMARY KEY,
    endpoint_id     TEXT NOT NULL REFERENCES endpoints(id),
    type            TEXT NOT NULL,
    payload         JSONB NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_attempts(
    id              BIGSERIAL PRIMARY KEY,
    event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    status          TEXT NOT NULL, -- 'pending', 'succeded', 'failed', 'exhausted'
    response_code   INTEGER,
    latency_ms      INTEGER,
    error           TEXT,
    attempt_number  INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);