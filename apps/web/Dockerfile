FROM node:22-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL=/api/v1
ARG NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=false
ARG NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=false

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=$NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI
ENV NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=$NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT

COPY package.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm install --ignore-scripts

COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

RUN npm run build --workspace @training-platform/shared
RUN npm run build --workspace @training-platform/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_PUBLIC_API_BASE_URL=/api/v1
ENV NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=false
ENV NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=false

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
