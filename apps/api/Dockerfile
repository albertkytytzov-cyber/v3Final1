FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm install --ignore-scripts

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

RUN npm run build --workspace @training-platform/shared
RUN npm run build --workspace @training-platform/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000 4010 4011
CMD ["node", "apps/api/dist/index.js"]
