import type { AuthUser, UserRole } from "@training-platform/shared";
import { pool } from "../db";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "../security";

export interface AuthSessionUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  password_hash: string;
  athlete_id: string | null;
  photo_url: string | null;
  birth_date: string | null;
  height_cm: string | null;
  sport: string | null;
  discipline: string | null;
  weight_class: string | null;
  dominant_side: string | null;
  baseline_resting_hr: number | null;
  baseline_weight_kg: string | null;
  profile_notes: string | null;
}

export interface RegisterUserInput {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  sessionSecret: string;
}

export interface LoginUserInput {
  email: string;
  password: string;
  sessionSecret: string;
}

export interface AuthSessionResult {
  user: AuthUser;
  sessionToken: string;
}

export class AuthServiceError extends Error {
  constructor(
    public readonly code: "user_exists" | "invalid_credentials",
    message: string,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

export function toAuthUser(user: Pick<
  AuthSessionUser,
  | "id"
  | "email"
  | "full_name"
  | "role"
  | "athlete_id"
  | "photo_url"
  | "birth_date"
  | "height_cm"
  | "sport"
  | "discipline"
  | "weight_class"
  | "dominant_side"
  | "baseline_resting_hr"
  | "baseline_weight_kg"
  | "profile_notes"
>): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    athleteId: user.athlete_id,
    photoUrl: user.photo_url ?? "",
    birthDate: user.birth_date ?? null,
    heightCm: user.height_cm !== null ? Number(user.height_cm) : null,
    sport: user.sport ?? "",
    discipline: user.discipline ?? "",
    weightClass: user.weight_class ?? "",
    dominantSide: user.dominant_side ?? "",
    baselineRestingHr: user.baseline_resting_hr,
    baselineWeightKg: user.baseline_weight_kg !== null ? Number(user.baseline_weight_kg) : null,
    profileNotes: user.profile_notes ?? "",
  };
}

export async function findUserByEmail(email: string): Promise<AuthSessionUser | null> {
  const result = await pool.query<AuthSessionUser>(
    `
      SELECT
        users.id,
        users.email,
        users.full_name,
        users.role,
        users.password_hash,
        athletes.id AS athlete_id,
        athletes.photo_url,
        athletes.birth_date::text,
        athletes.height_cm::text,
        athletes.sport,
        athletes.discipline,
        athletes.weight_class,
        athletes.dominant_side,
        athletes.baseline_resting_hr,
        athletes.baseline_weight_kg::text,
        athletes.profile_notes
      FROM users
      LEFT JOIN athletes ON athletes.user_id = users.id
      WHERE users.email = $1
    `,
    [email.toLowerCase()],
  );

  return result.rows[0] ?? null;
}

export async function getUserBySessionToken(
  token: string,
  sessionSecret: string,
): Promise<AuthSessionUser | null> {
  const result = await pool.query<AuthSessionUser>(
    `
      SELECT
        users.id,
        users.email,
        users.full_name,
        users.role,
        users.password_hash,
        athletes.id AS athlete_id,
        athletes.photo_url,
        athletes.birth_date::text,
        athletes.height_cm::text,
        athletes.sport,
        athletes.discipline,
        athletes.weight_class,
        athletes.dominant_side,
        athletes.baseline_resting_hr,
        athletes.baseline_weight_kg::text,
        athletes.profile_notes
      FROM user_sessions
      JOIN users ON users.id = user_sessions.user_id
      LEFT JOIN athletes ON athletes.user_id = users.id
      WHERE user_sessions.token_hash = $1
        AND user_sessions.expires_at > NOW()
    `,
    [hashSessionToken(token, sessionSecret)],
  );

  return result.rows[0] ?? null;
}

export async function registerUser(input: RegisterUserInput): Promise<AuthSessionResult> {
  const existing = await findUserByEmail(input.email);

  if (existing) {
    throw new AuthServiceError("user_exists", "User already exists");
  }

  const createdUser = await pool.query<{ id: string }>(
    `
      INSERT INTO users (email, password_hash, role, full_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [
      input.email.toLowerCase(),
      hashPassword(input.password),
      input.role,
      input.fullName,
    ],
  );

  let athleteId: string | null = null;

  if (input.role === "athlete") {
    const athlete = await pool.query<{ id: string }>(
      `
        INSERT INTO athletes (user_id, baseline_resting_hr, baseline_weight_kg, notes)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [createdUser.rows[0].id, 55, 75, "Created during self-service registration"],
    );

    athleteId = athlete.rows[0].id;
  }

  const sessionToken = createSessionToken();

  await pool.query(
    `
      INSERT INTO user_sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '30 days')
    `,
    [createdUser.rows[0].id, hashSessionToken(sessionToken, input.sessionSecret)],
  );

  return {
    sessionToken,
    user: {
      id: createdUser.rows[0].id,
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      role: input.role,
      athleteId,
      photoUrl: "",
      birthDate: null,
      heightCm: null,
      sport: "",
      discipline: "",
      weightClass: "",
      dominantSide: "",
      baselineRestingHr: input.role === "athlete" ? 55 : null,
      baselineWeightKg: input.role === "athlete" ? 75 : null,
      profileNotes: "",
    },
  };
}

export async function loginUser(input: LoginUserInput): Promise<AuthSessionResult> {
  const user = await findUserByEmail(input.email);

  if (!user || !verifyPassword(input.password, user.password_hash)) {
    throw new AuthServiceError("invalid_credentials", "Invalid credentials");
  }

  const sessionToken = createSessionToken();

  await pool.query(
    `
      INSERT INTO user_sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '30 days')
    `,
    [user.id, hashSessionToken(sessionToken, input.sessionSecret)],
  );

  return {
    sessionToken,
    user: toAuthUser(user),
  };
}

export async function logoutUser(token: string, sessionSecret: string): Promise<void> {
  await pool.query(`DELETE FROM user_sessions WHERE token_hash = $1`, [
    hashSessionToken(token, sessionSecret),
  ]);
}
