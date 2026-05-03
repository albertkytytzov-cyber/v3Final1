import { pool } from "../db";
import type { AuthSessionUser } from "./auth.service";

export interface AccessFailure {
  statusCode: number;
  message: string;
}

export async function getAthleteAccessFailure(
  user: AuthSessionUser,
  athleteId: string,
): Promise<AccessFailure | null> {
  if (user.role === "admin") {
    return null;
  }

  if (user.role === "athlete") {
    if (user.athlete_id !== athleteId) {
      return {
        statusCode: 403,
        message: "Athlete can only access their own competition context",
      };
    }

    return null;
  }

  const result = await pool.query(
    `
      SELECT 1
      FROM coach_athletes
      WHERE athlete_id = $1 AND coach_user_id = $2
    `,
    [athleteId, user.id],
  );

  if (!result.rowCount) {
    return {
      statusCode: 404,
      message: "Athlete is not assigned to this coach",
    };
  }

  return null;
}
