import type { UserRole } from "@training-platform/shared";

type SelfRegistrationRole = Extract<UserRole, "coach" | "athlete">;

export interface RegisterBody {
  email: string;
  password: string;
  fullName: string;
  role: SelfRegistrationRole;
}

export interface LoginBody {
  email: string;
  password: string;
}

function parseSelfRegistrationRole(role: unknown): SelfRegistrationRole | null {
  if (role === "coach" || role === "athlete") {
    return role;
  }

  return null;
}

export function parseRegisterBody(body: unknown): RegisterBody {
  const payload = (body ?? {}) as {
    email?: unknown;
    password?: unknown;
    fullName?: unknown;
    role?: unknown;
  };
  const role = parseSelfRegistrationRole(payload.role);

  if (
    typeof payload.email !== "string" ||
    typeof payload.password !== "string" ||
    typeof payload.fullName !== "string" ||
    !role
  ) {
    throw new Error("email, password, fullName and coach/athlete role are required");
  }

  if (payload.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  return {
    email: payload.email,
    password: payload.password,
    fullName: payload.fullName,
    role,
  };
}

export function parseLoginBody(body: unknown): LoginBody {
  const payload = (body ?? {}) as {
    email?: unknown;
    password?: unknown;
  };

  if (typeof payload.email !== "string" || typeof payload.password !== "string") {
    throw new Error("email and password are required");
  }

  return {
    email: payload.email,
    password: payload.password,
  };
}
