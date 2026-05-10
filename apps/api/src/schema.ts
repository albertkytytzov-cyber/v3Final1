import { pool } from "./db";
import { hashPassword } from "./security";

async function ensureColumn(tableName: string, columnName: string, sqlType: string) {
  const existing = await pool.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
    `,
    [tableName, columnName],
  );

  if (existing.rowCount === 0) {
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlType}`);
  }
}

async function ensureUuidDefault(tableName: string) {
  await pool.query(
    `ALTER TABLE ${tableName} ALTER COLUMN id SET DEFAULT gen_random_uuid()`,
  );
}

async function backfillPlanHierarchy() {
  await pool.query(`
    INSERT INTO plan_days (plan_template_id, label, notes, display_order)
    SELECT plan_templates.id, 'Day 1', '', 0
    FROM plan_templates
    WHERE NOT EXISTS (
      SELECT 1
      FROM plan_days
      WHERE plan_days.plan_template_id = plan_templates.id
    )
  `);

  await pool.query(`
    INSERT INTO plan_sessions (plan_day_id, name, notes, display_order)
    SELECT plan_days.id, 'Primary session', '', 0
    FROM plan_days
    WHERE NOT EXISTS (
      SELECT 1
      FROM plan_sessions
      WHERE plan_sessions.plan_day_id = plan_days.id
    )
  `);

  await pool.query(`
    UPDATE plan_blocks
    SET plan_session_id = plan_session_lookup.session_id
    FROM (
      SELECT DISTINCT ON (plan_days.plan_template_id)
        plan_days.plan_template_id,
        plan_sessions.id AS session_id
      FROM plan_days
      JOIN plan_sessions ON plan_sessions.plan_day_id = plan_days.id
      ORDER BY plan_days.plan_template_id, plan_days.display_order ASC, plan_sessions.display_order ASC
    ) AS plan_session_lookup
    WHERE plan_blocks.plan_template_id = plan_session_lookup.plan_template_id
      AND plan_blocks.plan_session_id IS NULL
  `);

  await pool.query(`
    INSERT INTO block_exercises (
      plan_block_id,
      name,
      target_sets,
      target_reps,
      target_weight_kg,
      target_duration_minutes,
      target_rpe,
      notes,
      display_order
    )
    SELECT
      plan_blocks.id,
      plan_blocks.name,
      plan_blocks.target_sets,
      plan_blocks.target_reps,
      NULL,
      plan_blocks.target_duration_minutes,
      plan_blocks.target_rpe,
      COALESCE(plan_blocks.notes, ''),
      0
    FROM plan_blocks
    WHERE NOT EXISTS (
      SELECT 1
      FROM block_exercises
      WHERE block_exercises.plan_block_id = plan_blocks.id
    )
  `);
}

async function backfillAssignedBlockExercises() {
  await pool.query(`
    INSERT INTO assigned_block_exercises (
      assigned_block_id,
      source_block_exercise_id,
      name,
      target_sets,
      target_reps,
      target_weight_kg,
      target_duration_minutes,
      target_rpe,
      notes,
      display_order
    )
    SELECT
      assigned_day_blocks.id,
      block_exercises.id,
      COALESCE(block_exercises.name, assigned_day_blocks.name),
      COALESCE(block_exercises.target_sets, assigned_day_blocks.target_sets),
      COALESCE(block_exercises.target_reps, assigned_day_blocks.target_reps),
      block_exercises.target_weight_kg,
      COALESCE(block_exercises.target_duration_minutes, assigned_day_blocks.target_duration_minutes),
      COALESCE(block_exercises.target_rpe, assigned_day_blocks.target_rpe),
      COALESCE(block_exercises.notes, assigned_day_blocks.notes, ''),
      COALESCE(block_exercises.display_order, 0)
    FROM assigned_day_blocks
    LEFT JOIN block_exercises
      ON block_exercises.plan_block_id = assigned_day_blocks.template_block_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM assigned_block_exercises
      WHERE assigned_block_exercises.assigned_block_id = assigned_day_blocks.id
    )
  `);
}

export async function ensureSchema() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('coach', 'athlete', 'admin')),
      full_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS athletes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

    CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_readiness_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
      client_request_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (athlete_id, entry_date)
    );

    CREATE TABLE IF NOT EXISTS readiness_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      readiness_entry_id UUID NOT NULL UNIQUE REFERENCES daily_readiness_entries(id) ON DELETE CASCADE,
      score NUMERIC(5, 2) NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('green', 'yellow', 'red')),
      explanation JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS readiness_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      readiness_score_id UUID NOT NULL UNIQUE REFERENCES readiness_scores(id) ON DELETE CASCADE,
      action_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      adapted_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS plan_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      coach_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sport_type TEXT NOT NULL DEFAULT '',
      phase_focus TEXT CHECK (phase_focus IN ('base', 'strength', 'specific', 'taper', 'competition', 'recovery')),
      competition_priority_focus TEXT CHECK (competition_priority_focus IN ('A', 'B', 'C')),
      template_goal TEXT NOT NULL DEFAULT '',
      microcycle_type TEXT NOT NULL DEFAULT '',
      competition_specific BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS plan_days (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_template_id UUID NOT NULL REFERENCES plan_templates(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS plan_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_day_id UUID NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      execution_mode TEXT NOT NULL DEFAULT 'whole_session',
      device_link_mode TEXT NOT NULL DEFAULT 'session',
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS plan_blocks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_template_id UUID NOT NULL REFERENCES plan_templates(id) ON DELETE CASCADE,
      plan_session_id UUID REFERENCES plan_sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      row_kind TEXT NOT NULL DEFAULT 'exercise',
      block_type TEXT NOT NULL,
      block_priority INTEGER NOT NULL,
      is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
      remove_priority_yellow INTEGER NOT NULL DEFAULT 5,
      remove_priority_red INTEGER NOT NULL DEFAULT 5,
      reduction_percent_yellow INTEGER NOT NULL DEFAULT 0,
      reduction_percent_red INTEGER NOT NULL DEFAULT 0,
      replacement_block_id UUID REFERENCES plan_blocks(id) ON DELETE SET NULL,
      target_duration_minutes NUMERIC(6, 2),
      target_rpe NUMERIC(4, 1),
      target_sets INTEGER,
      target_reps INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS block_exercises (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_block_id UUID NOT NULL REFERENCES plan_blocks(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      target_sets INTEGER,
      target_reps INTEGER,
      target_weight_kg NUMERIC(8, 2),
      target_duration_minutes NUMERIC(6, 2),
      target_rpe NUMERIC(4, 1),
      notes TEXT NOT NULL DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS assigned_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      coach_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      template_id UUID NOT NULL REFERENCES plan_templates(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      planned_phase TEXT CHECK (planned_phase IN ('base', 'strength', 'specific', 'taper', 'competition', 'recovery')),
      competition_context_snapshot JSONB NOT NULL DEFAULT 'null'::jsonb,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS assigned_plan_days (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assigned_plan_id UUID NOT NULL REFERENCES assigned_plans(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      day_date DATE NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS assigned_day_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assigned_day_id UUID NOT NULL REFERENCES assigned_plan_days(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      execution_mode TEXT NOT NULL DEFAULT 'whole_session',
      device_link_mode TEXT NOT NULL DEFAULT 'session',
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS assigned_day_blocks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assigned_session_id UUID NOT NULL REFERENCES assigned_day_sessions(id) ON DELETE CASCADE,
      template_block_id UUID REFERENCES plan_blocks(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      row_kind TEXT NOT NULL DEFAULT 'exercise',
      block_type TEXT NOT NULL,
      block_priority INTEGER NOT NULL,
      is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
      remove_priority_yellow INTEGER NOT NULL DEFAULT 5,
      remove_priority_red INTEGER NOT NULL DEFAULT 5,
      reduction_percent_yellow INTEGER NOT NULL DEFAULT 0,
      reduction_percent_red INTEGER NOT NULL DEFAULT 0,
      replacement_block_id UUID REFERENCES assigned_day_blocks(id) ON DELETE SET NULL,
      target_duration_minutes NUMERIC(6, 2),
      target_rpe NUMERIC(4, 1),
      target_sets INTEGER,
      target_reps INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS assigned_block_exercises (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assigned_block_id UUID NOT NULL REFERENCES assigned_day_blocks(id) ON DELETE CASCADE,
      source_block_exercise_id UUID REFERENCES block_exercises(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      target_sets INTEGER,
      target_reps INTEGER,
      target_weight_kg NUMERIC(8, 2),
      target_duration_minutes NUMERIC(6, 2),
      target_rpe NUMERIC(4, 1),
      notes TEXT NOT NULL DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exercise_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      assigned_plan_id UUID NOT NULL REFERENCES assigned_plans(id) ON DELETE CASCADE,
      assigned_block_id UUID NOT NULL REFERENCES assigned_day_blocks(id) ON DELETE CASCADE,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      sets_completed INTEGER,
      reps_completed INTEGER,
      weight_kg NUMERIC(8, 2),
      duration_minutes NUMERIC(6, 2),
      rpe NUMERIC(4, 1),
      notes TEXT NOT NULL DEFAULT '',
      client_request_id TEXT,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (athlete_id, assigned_block_id)
    );

    CREATE TABLE IF NOT EXISTS exercise_result_exercises (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      execution_result_id UUID NOT NULL REFERENCES exercise_results(id) ON DELETE CASCADE,
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      assigned_plan_id UUID NOT NULL REFERENCES assigned_plans(id) ON DELETE CASCADE,
      assigned_block_id UUID NOT NULL REFERENCES assigned_day_blocks(id) ON DELETE CASCADE,
      assigned_exercise_id UUID NOT NULL REFERENCES assigned_block_exercises(id) ON DELETE CASCADE,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      sets_completed INTEGER,
      reps_completed INTEGER,
      weight_kg NUMERIC(8, 2),
      duration_minutes NUMERIC(6, 2),
      rpe NUMERIC(4, 1),
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (execution_result_id, assigned_exercise_id)
    );

    CREATE TABLE IF NOT EXISTS coach_diary_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      coach_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_plan_id UUID NOT NULL REFERENCES assigned_plans(id) ON DELETE CASCADE,
      entry_date DATE NOT NULL,
      scope TEXT NOT NULL DEFAULT 'day' CHECK (scope IN ('day', 'tasks')),
      notes TEXT NOT NULL DEFAULT '',
      assigned_block_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
      assigned_exercise_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
      client_request_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS coach_ai_day_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      coach_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entry_date DATE NOT NULL,
      source TEXT NOT NULL DEFAULT 'server-rules' CHECK (source IN ('server-rules', 'model')),
      observation TEXT NOT NULL DEFAULT '',
      risk_notes TEXT[] NOT NULL DEFAULT '{}'::text[],
      tomorrow_actions TEXT[] NOT NULL DEFAULT '{}'::text[],
      day_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS device_health_daily_summaries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('huawei-health', 'health-connect')),
      entry_date DATE NOT NULL,
      source_device TEXT,
      sleep_start_time TIMESTAMPTZ,
      sleep_end_time TIMESTAMPTZ,
      sleep_duration_minutes NUMERIC(7, 2),
      deep_sleep_minutes NUMERIC(7, 2),
      light_sleep_minutes NUMERIC(7, 2),
      rem_sleep_minutes NUMERIC(7, 2),
      awake_minutes NUMERIC(7, 2),
      sleep_score NUMERIC(5, 2),
      resting_hr NUMERIC(5, 1),
      average_hr NUMERIC(5, 1),
      min_hr NUMERIC(5, 1),
      max_hr NUMERIC(5, 1),
      hrv_rmssd_ms NUMERIC(7, 2),
      workout_count INTEGER NOT NULL DEFAULT 0,
      workout_duration_minutes NUMERIC(7, 2),
      workout_distance_meters NUMERIC(10, 2),
      workout_active_calories NUMERIC(8, 2),
      workout_average_hr NUMERIC(5, 1),
      workout_max_hr NUMERIC(5, 1),
      raw_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (athlete_id, provider, entry_date)
    );

    CREATE TABLE IF NOT EXISTS device_workouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('huawei-health', 'health-connect')),
      entry_date DATE NOT NULL,
      source_device TEXT,
      source_workout_id TEXT NOT NULL,
      workout_type TEXT NOT NULL DEFAULT '',
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ NOT NULL,
      duration_minutes NUMERIC(7, 2),
      distance_meters NUMERIC(10, 2),
      active_calories NUMERIC(8, 2),
      average_hr NUMERIC(5, 1),
      max_hr NUMERIC(5, 1),
      min_hr NUMERIC(5, 1),
      raw_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (athlete_id, provider, source_workout_id)
    );

    CREATE TABLE IF NOT EXISTS device_workout_samples (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_workout_id UUID NOT NULL REFERENCES device_workouts(id) ON DELETE CASCADE,
      sample_time TIMESTAMPTZ NOT NULL,
      heart_rate_bpm NUMERIC(5, 1),
      distance_meters NUMERIC(10, 2),
      speed_meters_per_second NUMERIC(8, 3),
      pace_seconds_per_km NUMERIC(8, 2),
      oxygen_saturation_percent NUMERIC(5, 2),
      raw_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (device_workout_id, sample_time)
    );

    CREATE TABLE IF NOT EXISTS training_plan_device_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      assigned_plan_id UUID NOT NULL REFERENCES assigned_plans(id) ON DELETE CASCADE,
      assigned_block_id UUID NOT NULL REFERENCES assigned_day_blocks(id) ON DELETE CASCADE,
      assigned_exercise_id UUID REFERENCES assigned_block_exercises(id) ON DELETE SET NULL,
      device_workout_id UUID NOT NULL REFERENCES device_workouts(id) ON DELETE CASCADE,
      linked_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (athlete_id, assigned_block_id, device_workout_id)
    );

    CREATE TABLE IF NOT EXISTS olympic_cycles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      target_event TEXT,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      olympic_cycle_id UUID REFERENCES olympic_cycles(id) ON DELETE SET NULL,
      year INTEGER NOT NULL,
      name TEXT NOT NULL,
      goal TEXT NOT NULL DEFAULT '',
      strategy_type TEXT NOT NULL CHECK (strategy_type IN ('single_peak', 'double_peak', 'multi_peak')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS competitions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      federation TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      level TEXT NOT NULL CHECK (level IN ('local', 'national', 'continental', 'world', 'olympics')),
      age_group TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS competition_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
      competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
      priority TEXT NOT NULL CHECK (priority IN ('A', 'B', 'C')),
      plan_type TEXT NOT NULL CHECK (plan_type IN ('main', 'secondary', 'qualifying', 'control')),
      peak_required BOOLEAN NOT NULL DEFAULT FALSE,
      taper_days INTEGER NOT NULL DEFAULT 7,
      weight_cut_required BOOLEAN NOT NULL DEFAULT FALSE,
      target_weight NUMERIC(6, 2),
      current_weight NUMERIC(6, 2),
      expected_matches INTEGER,
      competition_format TEXT NOT NULL DEFAULT '',
      prep_start_date DATE NOT NULL,
      prep_end_date DATE NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS competition_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      competition_plan_id UUID NOT NULL UNIQUE REFERENCES competition_plans(id) ON DELETE CASCADE,
      final_place INTEGER,
      matches_count INTEGER,
      weight_at_weigh_in NUMERIC(6, 2),
      weight_after NUMERIC(6, 2),
      performance_notes TEXT NOT NULL DEFAULT '',
      coach_notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mesocycles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
      competition_plan_id UUID REFERENCES competition_plans(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      phase TEXT NOT NULL CHECK (phase IN ('base', 'strength', 'specific', 'taper', 'competition', 'recovery')),
      goal TEXT NOT NULL DEFAULT '',
      progression_type TEXT NOT NULL CHECK (progression_type IN ('linear', 'wave', 'taper', 'recovery')),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      weeks_count INTEGER NOT NULL DEFAULT 4,
      notes TEXT NOT NULL DEFAULT '',
      week_plan_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS weight_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      readiness_entry_id UUID UNIQUE REFERENCES daily_readiness_entries(id) ON DELETE CASCADE,
      log_date DATE NOT NULL,
      weight_kg NUMERIC(6, 2) NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'readiness',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS training_load_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      assigned_plan_id UUID REFERENCES assigned_plans(id) ON DELETE CASCADE,
      assigned_block_id UUID REFERENCES assigned_day_blocks(id) ON DELETE CASCADE,
      log_date DATE NOT NULL,
      planned_load NUMERIC(8, 2) NOT NULL DEFAULT 0,
      actual_load NUMERIC(8, 2) NOT NULL DEFAULT 0,
      planned_duration_minutes NUMERIC(6, 2),
      actual_duration_minutes NUMERIC(6, 2),
      planned_rpe NUMERIC(4, 1),
      actual_rpe NUMERIC(4, 1),
      planned_sets INTEGER,
      actual_sets INTEGER,
      planned_reps INTEGER,
      actual_reps INTEGER,
      completion_status TEXT NOT NULL DEFAULT 'not_started',
      source_type TEXT NOT NULL DEFAULT 'execution',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (athlete_id, assigned_block_id, log_date)
    );

    CREATE TABLE IF NOT EXISTS analytics_action_decisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      coach_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      suggestion_id TEXT NOT NULL,
      suggestion_title TEXT NOT NULL DEFAULT '',
      suggestion_level TEXT NOT NULL CHECK (suggestion_level IN ('info', 'warning', 'critical')),
      source_code TEXT NOT NULL,
      week_start_date DATE NOT NULL,
      week_label TEXT NOT NULL DEFAULT '',
      decision_status TEXT NOT NULL CHECK (decision_status IN ('applied', 'not_applied')),
      outcome_status TEXT NOT NULL DEFAULT 'pending' CHECK (outcome_status IN ('pending', 'positive', 'neutral', 'negative')),
      planner_bridge_json JSONB NOT NULL DEFAULT 'null'::jsonb,
      baseline_snapshot_json JSONB NOT NULL DEFAULT 'null'::jsonb,
      decision_notes TEXT NOT NULL DEFAULT '',
      outcome_notes TEXT NOT NULL DEFAULT '',
      client_request_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (athlete_id, suggestion_id, week_start_date)
    );
  `);

  await ensureColumn("users", "password_hash", "TEXT");
  await ensureColumn("users", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureUuidDefault("users");
  await ensureUuidDefault("athletes");
  await ensureColumn("athletes", "photo_url", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("athletes", "birth_date", "DATE");
  await ensureColumn("athletes", "height_cm", "NUMERIC(5, 2)");
  await ensureColumn("athletes", "sport", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("athletes", "discipline", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("athletes", "weight_class", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("athletes", "dominant_side", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("athletes", "wrestling_experience_years", "NUMERIC(4, 1)");
  await ensureColumn("athletes", "strength_squat_kg", "NUMERIC(6, 2)");
  await ensureColumn("athletes", "strength_bench_press_kg", "NUMERIC(6, 2)");
  await ensureColumn("athletes", "strength_deadlift_kg", "NUMERIC(6, 2)");
  await ensureColumn("athletes", "strength_pull_ups_max", "INTEGER");
  await ensureColumn("athletes", "strength_grip_left_kg", "NUMERIC(6, 2)");
  await ensureColumn("athletes", "strength_grip_right_kg", "NUMERIC(6, 2)");
  await ensureColumn("athletes", "strength_notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("athletes", "strengths", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("athletes", "weaknesses", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("athletes", "injuries_or_restrictions", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("athletes", "preparation_goal", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("athletes", "profile_notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("athletes", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureUuidDefault("daily_readiness_entries");
  await ensureUuidDefault("readiness_scores");
  await ensureUuidDefault("readiness_actions");
  await ensureUuidDefault("user_sessions");
  await ensureUuidDefault("plan_templates");
  await ensureUuidDefault("plan_days");
  await ensureUuidDefault("plan_sessions");
  await ensureUuidDefault("plan_blocks");
  await ensureUuidDefault("block_exercises");
  await ensureUuidDefault("assigned_plans");
  await ensureUuidDefault("assigned_plan_days");
  await ensureUuidDefault("assigned_day_sessions");
  await ensureUuidDefault("assigned_day_blocks");
  await ensureUuidDefault("assigned_block_exercises");
  await ensureUuidDefault("exercise_results");
  await ensureUuidDefault("exercise_result_exercises");
  await ensureUuidDefault("coach_diary_entries");
  await ensureUuidDefault("olympic_cycles");
  await ensureUuidDefault("seasons");
  await ensureUuidDefault("competitions");
  await ensureUuidDefault("competition_plans");
  await ensureUuidDefault("competition_results");
  await ensureUuidDefault("mesocycles");
  await ensureUuidDefault("weight_logs");
  await ensureUuidDefault("training_load_logs");
  await ensureUuidDefault("analytics_action_decisions");
  await ensureColumn("daily_readiness_entries", "client_request_id", "TEXT");
  await ensureColumn("readiness_actions", "action_summary", "JSONB NOT NULL DEFAULT '{}'::jsonb");
  await ensureColumn("readiness_actions", "adapted_plan_json", "JSONB NOT NULL DEFAULT '{}'::jsonb");
  await ensureColumn("readiness_actions", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("readiness_actions", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn(
    "exercise_results",
    "assigned_plan_id",
    "UUID REFERENCES assigned_plans(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "exercise_results",
    "assigned_block_id",
    "UUID REFERENCES assigned_day_blocks(id) ON DELETE CASCADE",
  );
  await ensureColumn("exercise_results", "completed", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumn("exercise_results", "sets_completed", "INTEGER");
  await ensureColumn("exercise_results", "reps_completed", "INTEGER");
  await ensureColumn("exercise_results", "weight_kg", "NUMERIC(8, 2)");
  await ensureColumn("exercise_results", "duration_minutes", "NUMERIC(6, 2)");
  await ensureColumn("exercise_results", "rpe", "NUMERIC(4, 1)");
  await ensureColumn("exercise_results", "notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("exercise_results", "client_request_id", "TEXT");
  await ensureColumn("exercise_results", "completed_at", "TIMESTAMPTZ");
  await ensureColumn("exercise_results", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("exercise_results", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'exercise_results' AND column_name = 'training_date'
      ) THEN
        ALTER TABLE exercise_results ALTER COLUMN training_date SET DEFAULT CURRENT_DATE;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'exercise_results' AND column_name = 'payload'
      ) THEN
        ALTER TABLE exercise_results ALTER COLUMN payload SET DEFAULT '{}'::jsonb;
      END IF;
    END $$;
  `);
  await ensureColumn(
    "exercise_result_exercises",
    "execution_result_id",
    "UUID REFERENCES exercise_results(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "exercise_result_exercises",
    "athlete_id",
    "UUID REFERENCES athletes(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "exercise_result_exercises",
    "assigned_plan_id",
    "UUID REFERENCES assigned_plans(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "exercise_result_exercises",
    "assigned_block_id",
    "UUID REFERENCES assigned_day_blocks(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "exercise_result_exercises",
    "assigned_exercise_id",
    "UUID REFERENCES assigned_block_exercises(id) ON DELETE CASCADE",
  );
  await ensureColumn("exercise_result_exercises", "completed", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumn("exercise_result_exercises", "sets_completed", "INTEGER");
  await ensureColumn("exercise_result_exercises", "reps_completed", "INTEGER");
  await ensureColumn("exercise_result_exercises", "weight_kg", "NUMERIC(8, 2)");
  await ensureColumn("exercise_result_exercises", "duration_minutes", "NUMERIC(6, 2)");
  await ensureColumn("exercise_result_exercises", "rpe", "NUMERIC(4, 1)");
  await ensureColumn("exercise_result_exercises", "notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("exercise_result_exercises", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("exercise_result_exercises", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn(
    "coach_diary_entries",
    "athlete_id",
    "UUID REFERENCES athletes(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "coach_diary_entries",
    "coach_user_id",
    "UUID REFERENCES users(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "coach_diary_entries",
    "assigned_plan_id",
    "UUID REFERENCES assigned_plans(id) ON DELETE CASCADE",
  );
  await ensureColumn("coach_diary_entries", "entry_date", "DATE");
  await ensureColumn(
    "coach_diary_entries",
    "scope",
    "TEXT NOT NULL DEFAULT 'day' CHECK (scope IN ('day', 'tasks'))",
  );
  await ensureColumn("coach_diary_entries", "notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("coach_diary_entries", "assigned_block_ids", "UUID[] NOT NULL DEFAULT '{}'::uuid[]");
  await ensureColumn("coach_diary_entries", "assigned_exercise_ids", "UUID[] NOT NULL DEFAULT '{}'::uuid[]");
  await ensureColumn("coach_diary_entries", "client_request_id", "TEXT");
  await ensureColumn("coach_diary_entries", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("coach_diary_entries", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn(
    "coach_ai_day_reviews",
    "athlete_id",
    "UUID REFERENCES athletes(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "coach_ai_day_reviews",
    "coach_user_id",
    "UUID REFERENCES users(id) ON DELETE CASCADE",
  );
  await ensureColumn("coach_ai_day_reviews", "entry_date", "DATE");
  await ensureColumn(
    "coach_ai_day_reviews",
    "source",
    "TEXT NOT NULL DEFAULT 'server-rules' CHECK (source IN ('server-rules', 'model'))",
  );
  await ensureColumn("coach_ai_day_reviews", "observation", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("coach_ai_day_reviews", "risk_notes", "TEXT[] NOT NULL DEFAULT '{}'::text[]");
  await ensureColumn("coach_ai_day_reviews", "tomorrow_actions", "TEXT[] NOT NULL DEFAULT '{}'::text[]");
  await ensureColumn("coach_ai_day_reviews", "day_payload_json", "JSONB NOT NULL DEFAULT '{}'::jsonb");
  await ensureColumn("coach_ai_day_reviews", "generated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("coach_ai_day_reviews", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureUuidDefault("device_health_daily_summaries");
  await ensureColumn(
    "device_health_daily_summaries",
    "athlete_id",
    "UUID REFERENCES athletes(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "device_health_daily_summaries",
    "provider",
    "TEXT NOT NULL DEFAULT 'huawei-health' CHECK (provider IN ('huawei-health', 'health-connect'))",
  );
  await pool.query(`
    ALTER TABLE device_health_daily_summaries
      DROP CONSTRAINT IF EXISTS device_health_daily_summaries_provider_check;
    ALTER TABLE device_health_daily_summaries
      ADD CONSTRAINT device_health_daily_summaries_provider_check
      CHECK (provider IN ('huawei-health', 'health-connect'));
  `);
  await ensureColumn("device_health_daily_summaries", "entry_date", "DATE");
  await ensureColumn("device_health_daily_summaries", "source_device", "TEXT");
  await ensureColumn("device_health_daily_summaries", "sleep_start_time", "TIMESTAMPTZ");
  await ensureColumn("device_health_daily_summaries", "sleep_end_time", "TIMESTAMPTZ");
  await ensureColumn("device_health_daily_summaries", "sleep_duration_minutes", "NUMERIC(7, 2)");
  await ensureColumn("device_health_daily_summaries", "deep_sleep_minutes", "NUMERIC(7, 2)");
  await ensureColumn("device_health_daily_summaries", "light_sleep_minutes", "NUMERIC(7, 2)");
  await ensureColumn("device_health_daily_summaries", "rem_sleep_minutes", "NUMERIC(7, 2)");
  await ensureColumn("device_health_daily_summaries", "awake_minutes", "NUMERIC(7, 2)");
  await ensureColumn("device_health_daily_summaries", "sleep_score", "NUMERIC(5, 2)");
  await ensureColumn("device_health_daily_summaries", "resting_hr", "NUMERIC(5, 1)");
  await ensureColumn("device_health_daily_summaries", "average_hr", "NUMERIC(5, 1)");
  await ensureColumn("device_health_daily_summaries", "min_hr", "NUMERIC(5, 1)");
  await ensureColumn("device_health_daily_summaries", "max_hr", "NUMERIC(5, 1)");
  await ensureColumn("device_health_daily_summaries", "hrv_rmssd_ms", "NUMERIC(7, 2)");
  await ensureColumn("device_health_daily_summaries", "workout_count", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(
    "device_health_daily_summaries",
    "workout_duration_minutes",
    "NUMERIC(7, 2)",
  );
  await ensureColumn(
    "device_health_daily_summaries",
    "workout_distance_meters",
    "NUMERIC(10, 2)",
  );
  await ensureColumn(
    "device_health_daily_summaries",
    "workout_active_calories",
    "NUMERIC(8, 2)",
  );
  await ensureColumn("device_health_daily_summaries", "workout_average_hr", "NUMERIC(5, 1)");
  await ensureColumn("device_health_daily_summaries", "workout_max_hr", "NUMERIC(5, 1)");
  await ensureColumn(
    "device_health_daily_summaries",
    "raw_payload_json",
    "JSONB NOT NULL DEFAULT '{}'::jsonb",
  );
  await ensureColumn("device_health_daily_summaries", "synced_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("device_health_daily_summaries", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("device_health_daily_summaries", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureUuidDefault("device_workouts");
  await ensureUuidDefault("device_workout_samples");
  await ensureUuidDefault("training_plan_device_links");
  await ensureColumn(
    "device_workouts",
    "athlete_id",
    "UUID REFERENCES athletes(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "device_workouts",
    "provider",
    "TEXT NOT NULL DEFAULT 'health-connect' CHECK (provider IN ('huawei-health', 'health-connect'))",
  );
  await pool.query(`
    ALTER TABLE device_workouts
      DROP CONSTRAINT IF EXISTS device_workouts_provider_check;
    ALTER TABLE device_workouts
      ADD CONSTRAINT device_workouts_provider_check
      CHECK (provider IN ('huawei-health', 'health-connect'));
  `);
  await ensureColumn("device_workouts", "entry_date", "DATE");
  await ensureColumn("device_workouts", "source_device", "TEXT");
  await ensureColumn("device_workouts", "source_workout_id", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("device_workouts", "workout_type", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("device_workouts", "start_time", "TIMESTAMPTZ");
  await ensureColumn("device_workouts", "end_time", "TIMESTAMPTZ");
  await ensureColumn("device_workouts", "duration_minutes", "NUMERIC(7, 2)");
  await ensureColumn("device_workouts", "distance_meters", "NUMERIC(10, 2)");
  await ensureColumn("device_workouts", "active_calories", "NUMERIC(8, 2)");
  await ensureColumn("device_workouts", "average_hr", "NUMERIC(5, 1)");
  await ensureColumn("device_workouts", "max_hr", "NUMERIC(5, 1)");
  await ensureColumn("device_workouts", "min_hr", "NUMERIC(5, 1)");
  await ensureColumn("device_workouts", "raw_payload_json", "JSONB NOT NULL DEFAULT '{}'::jsonb");
  await ensureColumn("device_workouts", "synced_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("device_workouts", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("device_workouts", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn(
    "device_workout_samples",
    "device_workout_id",
    "UUID REFERENCES device_workouts(id) ON DELETE CASCADE",
  );
  await ensureColumn("device_workout_samples", "sample_time", "TIMESTAMPTZ");
  await ensureColumn("device_workout_samples", "heart_rate_bpm", "NUMERIC(5, 1)");
  await ensureColumn("device_workout_samples", "distance_meters", "NUMERIC(10, 2)");
  await ensureColumn("device_workout_samples", "speed_meters_per_second", "NUMERIC(8, 3)");
  await ensureColumn("device_workout_samples", "pace_seconds_per_km", "NUMERIC(8, 2)");
  await ensureColumn("device_workout_samples", "oxygen_saturation_percent", "NUMERIC(5, 2)");
  await ensureColumn("device_workout_samples", "raw_payload_json", "JSONB NOT NULL DEFAULT '{}'::jsonb");
  await ensureColumn("device_workout_samples", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn(
    "training_plan_device_links",
    "athlete_id",
    "UUID REFERENCES athletes(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "training_plan_device_links",
    "assigned_plan_id",
    "UUID REFERENCES assigned_plans(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "training_plan_device_links",
    "assigned_block_id",
    "UUID REFERENCES assigned_day_blocks(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "training_plan_device_links",
    "assigned_exercise_id",
    "UUID REFERENCES assigned_block_exercises(id) ON DELETE SET NULL",
  );
  await ensureColumn(
    "training_plan_device_links",
    "device_workout_id",
    "UUID REFERENCES device_workouts(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "training_plan_device_links",
    "linked_by_user_id",
    "UUID REFERENCES users(id) ON DELETE CASCADE",
  );
  await ensureColumn("training_plan_device_links", "linked_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("training_plan_device_links", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn(
    "training_load_logs",
    "athlete_id",
    "UUID REFERENCES athletes(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "training_load_logs",
    "assigned_plan_id",
    "UUID REFERENCES assigned_plans(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "training_load_logs",
    "assigned_block_id",
    "UUID REFERENCES assigned_day_blocks(id) ON DELETE CASCADE",
  );
  await ensureColumn("training_load_logs", "log_date", "DATE");
  await ensureColumn("training_load_logs", "planned_load", "NUMERIC(8, 2) NOT NULL DEFAULT 0");
  await ensureColumn("training_load_logs", "actual_load", "NUMERIC(8, 2) NOT NULL DEFAULT 0");
  await ensureColumn("training_load_logs", "planned_duration_minutes", "NUMERIC(6, 2)");
  await ensureColumn("training_load_logs", "actual_duration_minutes", "NUMERIC(6, 2)");
  await ensureColumn("training_load_logs", "planned_rpe", "NUMERIC(4, 1)");
  await ensureColumn("training_load_logs", "actual_rpe", "NUMERIC(4, 1)");
  await ensureColumn("training_load_logs", "planned_sets", "INTEGER");
  await ensureColumn("training_load_logs", "actual_sets", "INTEGER");
  await ensureColumn("training_load_logs", "planned_reps", "INTEGER");
  await ensureColumn("training_load_logs", "actual_reps", "INTEGER");
  await ensureColumn("training_load_logs", "completion_status", "TEXT NOT NULL DEFAULT 'not_started'");
  await ensureColumn("training_load_logs", "source_type", "TEXT NOT NULL DEFAULT 'execution'");
  await ensureColumn("training_load_logs", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("training_load_logs", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn(
    "analytics_action_decisions",
    "athlete_id",
    "UUID REFERENCES athletes(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "analytics_action_decisions",
    "coach_user_id",
    "UUID REFERENCES users(id) ON DELETE CASCADE",
  );
  await ensureColumn("analytics_action_decisions", "suggestion_id", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("analytics_action_decisions", "suggestion_title", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(
    "analytics_action_decisions",
    "suggestion_level",
    "TEXT NOT NULL DEFAULT 'info' CHECK (suggestion_level IN ('info', 'warning', 'critical'))",
  );
  await ensureColumn("analytics_action_decisions", "source_code", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("analytics_action_decisions", "week_start_date", "DATE");
  await ensureColumn("analytics_action_decisions", "week_label", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(
    "analytics_action_decisions",
    "decision_status",
    "TEXT NOT NULL DEFAULT 'not_applied' CHECK (decision_status IN ('applied', 'not_applied'))",
  );
  await ensureColumn(
    "analytics_action_decisions",
    "outcome_status",
    "TEXT NOT NULL DEFAULT 'pending' CHECK (outcome_status IN ('pending', 'positive', 'neutral', 'negative'))",
  );
  await ensureColumn("analytics_action_decisions", "planner_bridge_json", "JSONB NOT NULL DEFAULT 'null'::jsonb");
  await ensureColumn("analytics_action_decisions", "baseline_snapshot_json", "JSONB NOT NULL DEFAULT 'null'::jsonb");
  await ensureColumn("analytics_action_decisions", "decision_notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("analytics_action_decisions", "outcome_notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("analytics_action_decisions", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("analytics_action_decisions", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("analytics_action_decisions", "client_request_id", "TEXT");
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_readiness_entries_athlete_client_request
      ON daily_readiness_entries (athlete_id, client_request_id)
      WHERE client_request_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_results_athlete_client_request
      ON exercise_results (athlete_id, client_request_id)
      WHERE client_request_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_action_decisions_athlete_client_request
      ON analytics_action_decisions (athlete_id, client_request_id)
      WHERE client_request_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_diary_entries_athlete_client_request
      ON coach_diary_entries (athlete_id, client_request_id)
      WHERE client_request_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_device_health_daily_provider_date
      ON device_health_daily_summaries (athlete_id, provider, entry_date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_device_workouts_athlete_provider_source
      ON device_workouts (athlete_id, provider, source_workout_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_device_workout_samples_workout_time_unique
      ON device_workout_samples (device_workout_id, sample_time);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_training_plan_device_links_block_workout
      ON training_plan_device_links (athlete_id, assigned_block_id, device_workout_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_results_athlete_assigned_block
      ON exercise_results (athlete_id, assigned_block_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_result_exercises_result_assigned
      ON exercise_result_exercises (execution_result_id, assigned_exercise_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_training_load_logs_athlete_block_date
      ON training_load_logs (athlete_id, assigned_block_id, log_date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_action_decisions_athlete_suggestion_week
      ON analytics_action_decisions (athlete_id, suggestion_id, week_start_date);
  `);
  await ensureColumn(
    "plan_days",
    "notes",
    "TEXT NOT NULL DEFAULT ''",
  );
  await ensureColumn(
    "plan_sessions",
    "notes",
    "TEXT NOT NULL DEFAULT ''",
  );
  await ensureColumn(
    "plan_sessions",
    "execution_mode",
    "TEXT NOT NULL DEFAULT 'whole_session'",
  );
  await ensureColumn(
    "plan_sessions",
    "device_link_mode",
    "TEXT NOT NULL DEFAULT 'session'",
  );
  await ensureColumn(
    "plan_blocks",
    "plan_session_id",
    "UUID REFERENCES plan_sessions(id) ON DELETE CASCADE",
  );
  await ensureColumn(
    "plan_blocks",
    "replacement_block_id",
    "UUID REFERENCES plan_blocks(id) ON DELETE SET NULL",
  );
  await ensureColumn("plan_blocks", "target_duration_minutes", "NUMERIC(6, 2)");
  await ensureColumn("plan_blocks", "target_rpe", "NUMERIC(4, 1)");
  await ensureColumn("plan_blocks", "target_sets", "INTEGER");
  await ensureColumn("plan_blocks", "target_reps", "INTEGER");
  await ensureColumn("plan_blocks", "row_kind", "TEXT NOT NULL DEFAULT 'exercise'");
  await ensureColumn(
    "assigned_day_blocks",
    "template_block_id",
    "UUID REFERENCES plan_blocks(id) ON DELETE SET NULL",
  );
  await ensureColumn(
    "assigned_day_blocks",
    "replacement_block_id",
    "UUID REFERENCES assigned_day_blocks(id) ON DELETE SET NULL",
  );
  await ensureColumn("assigned_day_blocks", "target_duration_minutes", "NUMERIC(6, 2)");
  await ensureColumn("assigned_day_blocks", "target_rpe", "NUMERIC(4, 1)");
  await ensureColumn("assigned_day_blocks", "target_sets", "INTEGER");
  await ensureColumn("assigned_day_blocks", "target_reps", "INTEGER");
  await ensureColumn(
    "assigned_day_sessions",
    "execution_mode",
    "TEXT NOT NULL DEFAULT 'whole_session'",
  );
  await ensureColumn(
    "assigned_day_sessions",
    "device_link_mode",
    "TEXT NOT NULL DEFAULT 'session'",
  );
  await ensureColumn("assigned_day_blocks", "row_kind", "TEXT NOT NULL DEFAULT 'exercise'");
  await ensureColumn(
    "block_exercises",
    "target_weight_kg",
    "NUMERIC(8, 2)",
  );
  await ensureColumn(
    "assigned_block_exercises",
    "target_weight_kg",
    "NUMERIC(8, 2)",
  );
  await ensureColumn("plan_templates", "description", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("plan_templates", "sport_type", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(
    "plan_templates",
    "phase_focus",
    "TEXT CHECK (phase_focus IN ('base', 'strength', 'specific', 'taper', 'competition', 'recovery'))",
  );
  await ensureColumn(
    "plan_templates",
    "competition_priority_focus",
    "TEXT CHECK (competition_priority_focus IN ('A', 'B', 'C'))",
  );
  await ensureColumn("plan_templates", "template_goal", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("plan_templates", "microcycle_type", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("plan_templates", "competition_specific", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumn(
    "assigned_plans",
    "planned_phase",
    "TEXT CHECK (planned_phase IN ('base', 'strength', 'specific', 'taper', 'competition', 'recovery'))",
  );
  await ensureColumn(
    "assigned_plans",
    "competition_context_snapshot",
    "JSONB NOT NULL DEFAULT 'null'::jsonb",
  );
  await ensureColumn("olympic_cycles", "target_event", "TEXT");
  await ensureColumn("olympic_cycles", "description", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("olympic_cycles", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("seasons", "goal", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(
    "seasons",
    "strategy_type",
    "TEXT NOT NULL DEFAULT 'single_peak' CHECK (strategy_type IN ('single_peak', 'double_peak', 'multi_peak'))",
  );
  await ensureColumn("seasons", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("competitions", "federation", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("competitions", "location", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(
    "competitions",
    "level",
    "TEXT NOT NULL DEFAULT 'local' CHECK (level IN ('local', 'national', 'continental', 'world', 'olympics'))",
  );
  await ensureColumn("competitions", "age_group", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("competitions", "description", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("competitions", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn(
    "competition_plans",
    "priority",
    "TEXT NOT NULL DEFAULT 'C' CHECK (priority IN ('A', 'B', 'C'))",
  );
  await ensureColumn(
    "competition_plans",
    "plan_type",
    "TEXT NOT NULL DEFAULT 'secondary' CHECK (plan_type IN ('main', 'secondary', 'qualifying', 'control'))",
  );
  await ensureColumn("competition_plans", "peak_required", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumn("competition_plans", "taper_days", "INTEGER NOT NULL DEFAULT 7");
  await ensureColumn(
    "competition_plans",
    "weight_cut_required",
    "BOOLEAN NOT NULL DEFAULT FALSE",
  );
  await ensureColumn("competition_plans", "target_weight", "NUMERIC(6, 2)");
  await ensureColumn("competition_plans", "current_weight", "NUMERIC(6, 2)");
  await ensureColumn("competition_plans", "expected_matches", "INTEGER");
  await ensureColumn("competition_plans", "competition_format", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("competition_plans", "notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("competition_plans", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("competition_results", "final_place", "INTEGER");
  await ensureColumn("competition_results", "matches_count", "INTEGER");
  await ensureColumn("competition_results", "weight_at_weigh_in", "NUMERIC(6, 2)");
  await ensureColumn("competition_results", "weight_after", "NUMERIC(6, 2)");
  await ensureColumn("competition_results", "performance_notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("competition_results", "coach_notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("competition_results", "created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("mesocycles", "goal", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(
    "mesocycles",
    "phase",
    "TEXT NOT NULL DEFAULT 'base' CHECK (phase IN ('base', 'strength', 'specific', 'taper', 'competition', 'recovery'))",
  );
  await ensureColumn(
    "mesocycles",
    "progression_type",
    "TEXT NOT NULL DEFAULT 'linear' CHECK (progression_type IN ('linear', 'wave', 'taper', 'recovery'))",
  );
  await ensureColumn("mesocycles", "weeks_count", "INTEGER NOT NULL DEFAULT 4");
  await ensureColumn("mesocycles", "notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("mesocycles", "week_plan_json", "JSONB NOT NULL DEFAULT '[]'::jsonb");
  await ensureColumn("mesocycles", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn("weight_logs", "source_type", "TEXT NOT NULL DEFAULT 'readiness'");
  await ensureColumn("weight_logs", "notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("weight_logs", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");
  await ensureColumn(
    "training_load_logs",
    "planned_load",
    "NUMERIC(8, 2) NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    "training_load_logs",
    "actual_load",
    "NUMERIC(8, 2) NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    "training_load_logs",
    "planned_duration_minutes",
    "NUMERIC(6, 2)",
  );
  await ensureColumn(
    "training_load_logs",
    "actual_duration_minutes",
    "NUMERIC(6, 2)",
  );
  await ensureColumn(
    "training_load_logs",
    "planned_rpe",
    "NUMERIC(4, 1)",
  );
  await ensureColumn(
    "training_load_logs",
    "actual_rpe",
    "NUMERIC(4, 1)",
  );
  await ensureColumn("training_load_logs", "planned_sets", "INTEGER");
  await ensureColumn("training_load_logs", "actual_sets", "INTEGER");
  await ensureColumn("training_load_logs", "planned_reps", "INTEGER");
  await ensureColumn("training_load_logs", "actual_reps", "INTEGER");
  await ensureColumn(
    "training_load_logs",
    "completion_status",
    "TEXT NOT NULL DEFAULT 'not_started'",
  );
  await ensureColumn(
    "training_load_logs",
    "source_type",
    "TEXT NOT NULL DEFAULT 'execution'",
  );
  await ensureColumn(
    "training_load_logs",
    "updated_at",
    "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
  );
  await ensureColumn("analytics_action_decisions", "suggestion_title", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(
    "analytics_action_decisions",
    "suggestion_level",
    "TEXT NOT NULL DEFAULT 'info' CHECK (suggestion_level IN ('info', 'warning', 'critical'))",
  );
  await ensureColumn("analytics_action_decisions", "source_code", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("analytics_action_decisions", "week_label", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(
    "analytics_action_decisions",
    "outcome_status",
    "TEXT NOT NULL DEFAULT 'pending' CHECK (outcome_status IN ('pending', 'positive', 'neutral', 'negative'))",
  );
  await ensureColumn(
    "analytics_action_decisions",
    "planner_bridge_json",
    "JSONB NOT NULL DEFAULT 'null'::jsonb",
  );
  await ensureColumn(
    "analytics_action_decisions",
    "baseline_snapshot_json",
    "JSONB NOT NULL DEFAULT 'null'::jsonb",
  );
  await ensureColumn("analytics_action_decisions", "decision_notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("analytics_action_decisions", "outcome_notes", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("analytics_action_decisions", "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()");

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_competition_plans_athlete_prep
      ON competition_plans (athlete_id, prep_start_date, prep_end_date);
    CREATE INDEX IF NOT EXISTS idx_competitions_start_date
      ON competitions (start_date);
    CREATE INDEX IF NOT EXISTS idx_seasons_athlete_year
      ON seasons (athlete_id, year);
    CREATE INDEX IF NOT EXISTS idx_plan_days_template_order
      ON plan_days (plan_template_id, display_order);
    CREATE INDEX IF NOT EXISTS idx_plan_sessions_day_order
      ON plan_sessions (plan_day_id, display_order);
    CREATE INDEX IF NOT EXISTS idx_plan_blocks_session_order
      ON plan_blocks (plan_session_id, display_order);
    CREATE INDEX IF NOT EXISTS idx_block_exercises_block_order
      ON block_exercises (plan_block_id, display_order);
    CREATE INDEX IF NOT EXISTS idx_assigned_block_exercises_block_order
      ON assigned_block_exercises (assigned_block_id, display_order);
    CREATE INDEX IF NOT EXISTS idx_exercise_result_exercises_execution
      ON exercise_result_exercises (execution_result_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mesocycles_athlete_start
      ON mesocycles (athlete_id, start_date);
    CREATE INDEX IF NOT EXISTS idx_weight_logs_athlete_date
      ON weight_logs (athlete_id, log_date DESC);
    CREATE INDEX IF NOT EXISTS idx_training_load_logs_athlete_date
      ON training_load_logs (athlete_id, log_date DESC);
    CREATE INDEX IF NOT EXISTS idx_training_load_logs_athlete_plan
      ON training_load_logs (athlete_id, assigned_plan_id, log_date DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_action_decisions_athlete_updated
      ON analytics_action_decisions (athlete_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_action_decisions_athlete_week
      ON analytics_action_decisions (athlete_id, week_start_date DESC);
    CREATE INDEX IF NOT EXISTS idx_coach_diary_entries_athlete_date
      ON coach_diary_entries (athlete_id, entry_date DESC, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_coach_diary_entries_coach_updated
      ON coach_diary_entries (coach_user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_coach_ai_day_reviews_athlete_date
      ON coach_ai_day_reviews (athlete_id, entry_date DESC, generated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_coach_ai_day_reviews_coach_generated
      ON coach_ai_day_reviews (coach_user_id, generated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_device_health_daily_athlete_date
      ON device_health_daily_summaries (athlete_id, entry_date DESC);
    CREATE INDEX IF NOT EXISTS idx_device_workouts_athlete_date
      ON device_workouts (athlete_id, entry_date DESC, start_time DESC);
    CREATE INDEX IF NOT EXISTS idx_device_workout_samples_workout_time
      ON device_workout_samples (device_workout_id, sample_time);
    CREATE INDEX IF NOT EXISTS idx_training_plan_device_links_block
      ON training_plan_device_links (athlete_id, assigned_block_id);
    CREATE INDEX IF NOT EXISTS idx_training_plan_device_links_workout
      ON training_plan_device_links (device_workout_id);
  `);

  await backfillPlanHierarchy();
  await backfillAssignedBlockExercises();

  if (process.env.SEED_DEMO_DATA === "true") {
    await seedDemoUsers();
    await seedDemoPlanTemplate();
  }

  await backfillPlanHierarchy();
  await backfillAssignedBlockExercises();
}

async function seedDemoUsers() {
  const existing = await pool.query("SELECT COUNT(*)::int AS count FROM users");

  if (existing.rows[0].count > 0) {
    return;
  }

  // Demo-only credentials used only when SEED_DEMO_DATA=true; never use these in production.
  const demoUsers = [
    {
      email: "coach@example.com",
      fullName: "Demo Coach",
      role: "coach" as const,
      password: "Coach123!",
      createAthlete: false,
      baselineRestingHr: null,
      baselineWeightKg: null,
    },
    {
      email: "athlete@example.com",
      fullName: "Demo Athlete",
      role: "athlete" as const,
      password: "Athlete123!",
      createAthlete: true,
      baselineRestingHr: 52,
      baselineWeightKg: 78.4,
    },
    {
      email: "admin@example.com",
      fullName: "System Admin",
      role: "admin" as const,
      password: "Admin123!",
      createAthlete: false,
      baselineRestingHr: null,
      baselineWeightKg: null,
    },
  ];

  const created: Record<string, string> = {};

  for (const user of demoUsers) {
    const inserted = await pool.query<{ id: string }>(
      `
        INSERT INTO users (email, password_hash, role, full_name)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [user.email, hashPassword(user.password), user.role, user.fullName],
    );

    created[user.email] = inserted.rows[0].id;

    if (user.createAthlete) {
      await pool.query(
        `
          INSERT INTO athletes (user_id, baseline_resting_hr, baseline_weight_kg, notes)
          VALUES ($1, $2, $3, $4)
        `,
        [inserted.rows[0].id, user.baselineRestingHr, user.baselineWeightKg, "Seeded athlete profile"],
      );
    }
  }

  const athlete = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM athletes
      WHERE user_id = $1
    `,
    [created["athlete@example.com"]],
  );

  if (athlete.rowCount) {
    await pool.query(
      `
        INSERT INTO coach_athletes (coach_user_id, athlete_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [created["coach@example.com"], athlete.rows[0].id],
    );
  }
}

async function seedDemoPlanTemplate() {
  const coach = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = 'coach@example.com'`,
  );

  if (!coach.rowCount) {
    return;
  }

  const templates = [
    {
      name: "Weekly speed-strength day",
      description: "Baseline template for a primary speed-strength loading day.",
      sportType: "Track and field",
      phaseFocus: "strength",
      competitionPriorityFocus: null,
      templateGoal: "Primary speed-strength loading day",
      microcycleType: "load",
      competitionSpecific: false,
      blocks: [
        ["Sprint mechanics", "technical", 5, true, 5, 5, 0, 0, 18, 4, 4, 3, "Drills and coordination stay in all statuses.", 0],
        ["Main acceleration set", "speed", 5, true, 3, 5, 20, 60, 28, 8, 6, 2, "Reduce sprint volume when readiness drops.", 1],
        ["Gym strength block", "strength", 4, false, 4, 5, 30, 70, 35, 8, 4, 5, "Secondary strength work that can be removed first.", 2],
      ],
    },
    {
      name: "Base aerobic support day",
      description: "Lower-intensity base phase day for aerobic support and movement quality.",
      sportType: "Track and field",
      phaseFocus: "base",
      competitionPriorityFocus: null,
      templateGoal: "Aerobic support and movement base",
      microcycleType: "support",
      competitionSpecific: false,
      blocks: [
        ["Movement prep", "mobility", 4, true, 5, 5, 0, 0, 16, 3, 2, 8, "Open the session with low-load mobility.", 0],
        ["Extensive tempo run", "conditioning", 4, true, 4, 5, 20, 50, 30, 6, 6, 200, "Base phase aerobic support.", 1],
        ["Recovery circuit", "recovery", 3, false, 4, 5, 20, 40, 20, 3, 3, 6, "Finish with light circuit and breathing.", 2],
      ],
    },
    {
      name: "Specific speed-technical day",
      description: "Specific phase day focused on event rhythm and quality speed exposure.",
      sportType: "Track and field",
      phaseFocus: "specific",
      competitionPriorityFocus: "A",
      templateGoal: "Specific speed and technical sharpness",
      microcycleType: "specific",
      competitionSpecific: true,
      blocks: [
        ["Event rhythm drills", "technical", 5, true, 5, 5, 0, 0, 20, 4, 5, 2, "Technical quality is protected close to competition.", 0],
        ["Specific speed reps", "speed", 5, true, 4, 5, 15, 50, 24, 8, 4, 2, "Keep quality, reduce total volume when needed.", 1],
        ["Activation lifts", "activation", 4, false, 4, 5, 20, 50, 14, 5, 3, 3, "Short neural activation without excessive fatigue.", 2],
      ],
    },
    {
      name: "Taper activation day",
      description: "Taper phase session to maintain sharpness with minimal fatigue.",
      sportType: "Track and field",
      phaseFocus: "taper",
      competitionPriorityFocus: "A",
      templateGoal: "Maintain readiness and activation",
      microcycleType: "activation",
      competitionSpecific: true,
      blocks: [
        ["Warm-up mobility", "mobility", 5, true, 5, 5, 0, 0, 12, 2, 2, 6, "Easy mobility and breathing.", 0],
        ["Starts and reactions", "activation", 5, true, 5, 5, 10, 30, 12, 5, 4, 1, "Short high-quality activation work.", 1],
        ["Technical rehearsal", "technical", 5, true, 5, 5, 0, 20, 16, 4, 3, 2, "Keep timing and event feel.", 2],
      ],
    },
    {
      name: "Recovery regeneration day",
      description: "Recovery phase day with regeneration, mobility, and low-stress restoration.",
      sportType: "Track and field",
      phaseFocus: "recovery",
      competitionPriorityFocus: null,
      templateGoal: "Restore freshness and mobility",
      microcycleType: "recovery",
      competitionSpecific: false,
      blocks: [
        ["Breathing reset", "recovery", 5, true, 5, 5, 0, 0, 10, 2, 2, 5, "Reset and down-regulate.", 0],
        ["Mobility flow", "mobility", 5, true, 5, 5, 0, 0, 20, 3, 3, 8, "Low-load full-body mobility.", 1],
        ["Easy activation", "activation", 3, false, 4, 5, 10, 30, 10, 3, 2, 4, "Optional light activation if athlete feels flat.", 2],
      ],
    },
  ] as const;

  for (const templateSeed of templates) {
    const existingTemplate = await pool.query<{ id: string }>(
      `
        SELECT id
        FROM plan_templates
        WHERE coach_user_id = $1 AND name = $2
        LIMIT 1
      `,
      [coach.rows[0].id, templateSeed.name],
    );

    let templateId = existingTemplate.rows[0]?.id;

    if (!templateId) {
      const inserted = await pool.query<{ id: string }>(
        `
          INSERT INTO plan_templates (
            coach_user_id,
            name,
            description,
            sport_type,
            phase_focus,
            competition_priority_focus,
            template_goal,
            microcycle_type,
            competition_specific
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `,
        [
          coach.rows[0].id,
          templateSeed.name,
          templateSeed.description,
          templateSeed.sportType,
          templateSeed.phaseFocus,
          templateSeed.competitionPriorityFocus,
          templateSeed.templateGoal,
          templateSeed.microcycleType,
          templateSeed.competitionSpecific,
        ],
      );

      templateId = inserted.rows[0].id;
    }

    const blockCount = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM plan_blocks WHERE plan_template_id = $1`,
      [templateId],
    );

    if (blockCount.rows[0].count > 0) {
      continue;
    }

    for (const block of templateSeed.blocks) {
      await pool.query(
        `
          INSERT INTO plan_blocks (
            plan_template_id,
            name,
            block_type,
            block_priority,
            is_mandatory,
            remove_priority_yellow,
            remove_priority_red,
            reduction_percent_yellow,
            reduction_percent_red,
            target_duration_minutes,
            target_rpe,
            target_sets,
            target_reps,
            notes,
            display_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `,
        [templateId, ...block],
      );
    }
  }
}
