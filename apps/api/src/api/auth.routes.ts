import type { FastifyInstance } from "fastify";
import {
  AuthServiceError,
  loginUser,
  logoutUser,
  registerUser,
  toAuthUser,
} from "../services/auth.service";
import type { ApiGuards, HttpErrorFactory } from "./guards";
import { parseLoginBody, parseRegisterBody } from "./auth.schemas";

interface AuthRouteDependencies {
  guards: ApiGuards;
  httpError: HttpErrorFactory;
  sessionCookieName: string;
  sessionSecret: string;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  dependencies: AuthRouteDependencies,
) {
  app.post("/api/v1/auth/register", async (request, reply) => {
    let body;
    try {
      body = parseRegisterBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    try {
      const result = await registerUser({
        ...body,
        sessionSecret: dependencies.sessionSecret,
      });

      dependencies.guards.setSessionCookie(reply, result.sessionToken);

      return {
        user: result.user,
      };
    } catch (error) {
      if (error instanceof AuthServiceError && error.code === "user_exists") {
        throw dependencies.httpError(409, error.message);
      }

      throw error;
    }
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    let body;
    try {
      body = parseLoginBody(request.body);
    } catch (error) {
      throw dependencies.httpError(400, (error as Error).message);
    }

    try {
      const result = await loginUser({
        ...body,
        sessionSecret: dependencies.sessionSecret,
      });

      dependencies.guards.setSessionCookie(reply, result.sessionToken);

      return {
        user: result.user,
      };
    } catch (error) {
      if (error instanceof AuthServiceError && error.code === "invalid_credentials") {
        throw dependencies.httpError(401, error.message);
      }

      throw error;
    }
  });

  app.get("/api/v1/auth/me", async (request) => {
    const user = await dependencies.guards.requireUser(request);

    return {
      user: toAuthUser(user),
    };
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const token = request.cookies[dependencies.sessionCookieName];

    if (token) {
      await logoutUser(token, dependencies.sessionSecret);
    }

    dependencies.guards.clearSessionCookie(reply);

    return {
      ok: true,
    };
  });
}
