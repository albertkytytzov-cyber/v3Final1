import "./env";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  MVP_MODULES,
  PLATFORM_NAME,
  TRAINING_ROLES,
} from "@training-platform/shared";
import { registerAdaptationRoutes } from "./api/adaptation.routes";
import { registerAnalyticsRoutes } from "./api/analytics/analytics.routes";
import { registerAuthRoutes } from "./api/auth.routes";
import { registerCoachDiaryRoutes } from "./api/coach-diary.routes";
import { registerCompetitionRoutes } from "./api/competition/competition.routes";
import { createApiGuards } from "./api/guards";
import { registerPlanningRoutes } from "./api/planning/planning.routes";
import { registerReadinessRoutes } from "./api/readiness.routes";
import { registerExecutionRoutes } from "./api/execution.routes";
import { describeDatabaseTarget } from "./db";
import { ensureSchema } from "./schema";

const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? 4000);
const nodeEnv = process.env.NODE_ENV ?? "development";
const sessionCookieName =
  process.env.SESSION_COOKIE_NAME ?? "training_platform_session";
const sessionSecret = process.env.SESSION_SECRET ?? "change-me-in-production";
const sessionCookieSecure = process.env.SESSION_COOKIE_SECURE === "true";
const mobileCorsOrigins = [
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
];
const allowedCorsOrigins = resolveAllowedCorsOrigins();

validateRuntimeConfig();

const app = Fastify({
  logger: true,
});
const guards = createApiGuards({
  sessionCookieName,
  sessionSecret,
  sessionCookieSecure,
  httpError,
});

function httpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

app.get("/api/v1/health", async () => {
  return {
    status: "ok",
    service: "api",
    name: PLATFORM_NAME,
    timestamp: new Date().toISOString(),
  };
});

app.get("/api/v1/modules", async () => {
  return {
    modules: MVP_MODULES,
    roles: TRAINING_ROLES,
  };
});

registerAuthRoutes(app, {
  guards,
  httpError,
  sessionCookieName,
  sessionSecret,
});

registerReadinessRoutes(app, {
  guards,
  httpError,
});

registerAdaptationRoutes(app, {
  guards,
  httpError,
});

registerExecutionRoutes(app, {
  guards,
  httpError,
});

registerCoachDiaryRoutes(app, {
  guards,
  httpError,
});

registerCompetitionRoutes(app, {
  guards,
  httpError,
});

registerPlanningRoutes(app, {
  guards,
  httpError,
});

registerAnalyticsRoutes(app, {
  guards,
  httpError,
});

async function bootstrap() {
  await app.register(cors, {
    origin: nodeEnv === "production" ? allowedCorsOrigins : true,
    credentials: true,
  });
  await app.register(cookie);
  try {
    await ensureSchema();
  } catch (error) {
    app.log.error(
      {
        err: error,
        databaseTarget: describeDatabaseTarget(),
      },
      "Failed to connect to PostgreSQL during bootstrap. Start PostgreSQL or update DATABASE_URL in the repo root .env file.",
    );
    throw error;
  }
  await app.listen({ host, port });
}

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});

function resolveAllowedCorsOrigins() {
  const configured = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const publicHost = (process.env.PUBLIC_HOST ?? "").trim();

  if (!publicHost || publicHost === "change-me.example.com") {
    return Array.from(new Set([...configured, ...mobileCorsOrigins]));
  }

  const hostOrigin = publicHost.startsWith("http://") || publicHost.startsWith("https://")
    ? publicHost
    : `https://${publicHost}`;

  return Array.from(new Set([...configured, hostOrigin, ...mobileCorsOrigins]));
}

function validateRuntimeConfig() {
  if (nodeEnv !== "production") {
    return;
  }

  if (
    !process.env.SESSION_SECRET ||
    sessionSecret === "change-me-in-production" ||
    sessionSecret === "change-me" ||
    sessionSecret.length < 32
  ) {
    throw new Error("SESSION_SECRET must be set to a strong non-default value in production.");
  }

  if (!sessionCookieSecure) {
    throw new Error("SESSION_COOKIE_SECURE=true is required in production.");
  }

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("postgres:postgres@")) {
    throw new Error("DATABASE_URL must be set and must not use the default postgres password in production.");
  }

  if (process.env.SEED_DEMO_DATA === "true") {
    throw new Error("SEED_DEMO_DATA must not be enabled in production.");
  }

  if (allowedCorsOrigins.length === 0) {
    throw new Error("PUBLIC_HOST or CORS_ORIGINS must be configured for production CORS.");
  }
}




