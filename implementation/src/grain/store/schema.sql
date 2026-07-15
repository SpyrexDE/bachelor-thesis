CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    brief_id TEXT NOT NULL,
    topology TEXT NOT NULL,
    rep INTEGER NOT NULL,
    seed INTEGER NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,            -- queued | running | done | failed
    error TEXT,
    job_id TEXT,
    rounds INTEGER,                  -- fine only: revision rounds executed
    stop_reason TEXT,                -- fine only: accepted | converged | cap
    wall_clock_s REAL,
    created_at TEXT NOT NULL,
    finished_at TEXT
);

CREATE TABLE IF NOT EXISTS calls (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    role TEXT NOT NULL,              -- orchestrator | producer | critic | image
    agent TEXT NOT NULL,             -- e.g. producer:instagram
    purpose TEXT NOT NULL,           -- coordination | production (concept/03, tax)
    round INTEGER NOT NULL,
    seed INTEGER NOT NULL,
    tokens_in INTEGER NOT NULL,
    tokens_out INTEGER NOT NULL,
    duration_s REAL NOT NULL,
    started_s REAL NOT NULL,         -- scheduled start, relative to run start
    ended_s REAL NOT NULL,
    parents TEXT NOT NULL,           -- json list of call idx this one waited for
    prompt TEXT,                     -- the exact prompt this call received (drill-down)
    output TEXT,                     -- the raw model output (chat: fenced JSON; image: null)
    PRIMARY KEY (run_id, idx)
);

CREATE TABLE IF NOT EXISTS artifacts (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    round INTEGER NOT NULL,
    is_final INTEGER NOT NULL,
    image_path TEXT NOT NULL,        -- relative to the data dir
    PRIMARY KEY (run_id, platform, round)
);

CREATE TABLE IF NOT EXISTS metrics (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,            -- tax | viescore | coherence | spec | latency | proxy
    scope TEXT NOT NULL,             -- 'set', a platform id, or 'round:N'
    value REAL NOT NULL,
    detail TEXT NOT NULL,            -- json: sub-scores, rationales, checks
    PRIMARY KEY (run_id, metric, scope)
);

CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    params TEXT NOT NULL,
    status TEXT NOT NULL,            -- queued | running | done | failed
    progress TEXT NOT NULL,          -- json {done, total, current}
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Review: materialised sets, the A/B pair plan, rater sessions, and their answers.
-- Kinds and counts follow concept/03 (human A/B, rubric rating).

CREATE TABLE IF NOT EXISTS review_plan (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    seed INTEGER NOT NULL,
    params TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_sets (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,              -- real | scramble | anchor_incoherent | anchor_strong
    brief_id TEXT NOT NULL,          -- brief shown to the rater
    run_id TEXT,                     -- real sets only
    composition TEXT NOT NULL,       -- json {platform: {run_id, round}}
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ab_pairs (
    id TEXT PRIMARY KEY,
    brief_id TEXT NOT NULL,
    kind TEXT NOT NULL,              -- between | within
    step TEXT,                       -- between: 'monolithic-independent' etc.
    rep INTEGER,                     -- between: the shared rep
    set_a TEXT NOT NULL REFERENCES review_sets(id),
    set_b TEXT NOT NULL REFERENCES review_sets(id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    pilot INTEGER NOT NULL DEFAULT 0, -- pilot/dry-run sessions never feed results
    tasks TEXT NOT NULL,             -- json {ab: [{pair, flip}], rubric: [set ids]}
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ab_votes (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    pair_id TEXT NOT NULL REFERENCES ab_pairs(id) ON DELETE CASCADE,
    chosen_set TEXT NOT NULL,
    seconds REAL,
    voted_at TEXT NOT NULL,
    PRIMARY KEY (session_id, pair_id)
);

CREATE TABLE IF NOT EXISTS rubric_ratings (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    set_id TEXT NOT NULL REFERENCES review_sets(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    message INTEGER NOT NULL,        -- pillar sub-scores 0..5: concept/03, rubric rating
    brand INTEGER NOT NULL,
    tone INTEGER NOT NULL,
    rated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, set_id)
);
