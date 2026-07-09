FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ARG NODE_ENV=production
ARG PORT=3000
ENV NODE_ENV=$NODE_ENV
ENV PORT=$PORT
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ARG NODE_ENV=production
ARG PORT=3000
ENV NODE_ENV=$NODE_ENV
ENV PORT=$PORT
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/external-workflows-snapshot ./external-workflows-snapshot
COPY --from=builder /app/node_modules ./node_modules
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]