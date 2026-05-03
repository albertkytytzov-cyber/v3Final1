CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('coach', 'athlete', 'admin')),
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS athletes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL DEFAULT '',
  birth_date DATE,
  height_cm NUMERIC(5, 2),
  sport TEXT NOT NULL DEFAULT '',
  discipline TEXT NOT NULL DEFAULT '',
  weight_class TEXT NOT NULL DEFAULT '',
  dominant_side TEXT NOT NULL DEFAULT '',
  baseline_resting_hr INTEGER,
  baseline_weight_kg NUMERIC(6, 2),
  wrestling_experience_years NUMERIC(4, 1),
  strength_squat_kg NUMERIC(6, 2),
  strength_bench_press_kg NUMERIC(6, 2),
  strength_deadlift_kg NUMERIC(6, 2),
  strength_pull_ups_max INTEGER,
  strength_grip_left_kg NUMERIC(6, 2),
  strength_grip_right_kg NUMERIC(6, 2),
  strength_notes TEXT NOT NULL DEFAULT '',
  strengths TEXT NOT NULL DEFAULT '',
  weaknesses TEXT NOT NULL DEFAULT '',
  injuries_or_restrictions TEXT NOT NULL DEFAULT '',
  preparation_goal TEXT NOT NULL DEFAULT '',
  profile_notes TEXT NOT NULL DEFAULT '',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coach_athletes (
  coach_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (coach_user_id, athlete_id)
);

CREATE TABLE IF NOT EXISTS plan_templates (
  id UUID PRIMARY KEY,
  coach_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sport_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_readiness_entries (
  id UUID PRIMARY KEY,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  sleep_hours NUMERIC(4, 2),
  sleep_quality INTEGER,
  general_feeling INTEGER,
  fatigue_level INTEGER,
  muscle_soreness INTEGER,
  motivation_level INTEGER,
  resting_hr INTEGER,
  body_weight NUMERIC(6, 2),
  pain_level INTEGER,
  illness_flag BOOLEAN NOT NULL DEFAULT FALSE,
  fever_flag BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (athlete_id, entry_date)
);

CREATE TABLE IF NOT EXISTS readiness_scores (
  id UUID PRIMARY KEY,
  readiness_entry_id UUID NOT NULL UNIQUE REFERENCES daily_readiness_entries(id) ON DELETE CASCADE,
  score NUMERIC(5, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('green', 'yellow', 'red')),
  explanation JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS readiness_actions (
  id UUID PRIMARY KEY,
  readiness_score_id UUID NOT NULL UNIQUE REFERENCES readiness_scores(id) ON DELETE CASCADE,
  action_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  adapted_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercise_results (
  id UUID PRIMARY KEY,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  training_date DATE NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_name TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
