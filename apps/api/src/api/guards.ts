import type { FastifyReply } from "fastify";
import { getAthleteAccessFailure } from "../services/access.service";
import {
  getUserBySessionToken,
  type AuthSessionUser,
} from "../services/auth.service";

export type HttpErrorFactory = (
  statusCode: number,
  message: string,
) => Error & { statusCode: number };

type SessionRequest = {
  cookies: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
};

interface GuardDependencies {
  sessionCookieName: string;
  sessionSecret: string;
  sessionCookieSecure: boolean;
  httpError: HttpErrorFactory;
}

export interface ApiGuards {
  requireUser(request: SessionRequest): Promise<AuthSessionUser>;
  getSessionToken(request: SessionRequest): string | undefined;
  assertAthleteAccess(user: AuthSessionUser, athleteId: string): Promise<void>;
  setSessionCookie(
    reply: Pick<FastifyReply, "setCookie">,
    token: string,
  ): void;
  clearSessionCookie(reply: Pick<FastifyReply, "clearCookie">): void;
}

export function createApiGuards(dependencies: GuardDependencies): ApiGuards {
  function getSessionToken(request: SessionRequest) {
    const authorization = request.headers?.authorization;
    const authorizationValue = Array.isArray(authorization)
      ? authorization[0]
      : authorization;

    if (typeof authorizationValue === "string") {
      const [scheme, token] = authorizationValue.split(/\s+/, 2);

      if (scheme?.toLowerCase() === "bearer" && token) {
        return token;
      }
    }

    return request.cookies[dependencies.sessionCookieName];
  }

  return {
    async requireUser(request) {
      const token = getSessionToken(request);

      if (!token) {
        throw dependencies.httpError(401, "Auth session is required");
      }

      const user = await getUserBySessionToken(token, dependencies.sessionSecret);

      if (!user) {
        throw dependencies.httpError(401, "Session expired or invalid");
      }

      return user;
    },
    getSessionToken,
    async assertAthleteAccess(user, athleteId) {
      const failure = await getAthleteAccessFailure(user, athleteId);

      if (failure) {
        throw dependencies.httpError(failure.statusCode, failure.message);
      }
    },
    setSessionCookie(reply, token) {
      reply.setCookie(dependencies.sessionCookieName, token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: dependencies.sessionCookieSecure,
        maxAge: 60 * 60 * 24 * 30,
      });
    },
    clearSessionCookie(reply) {
      reply.clearCookie(dependencies.sessionCookieName, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: dependencies.sessionCookieSecure,
      });
    },
  };
}
