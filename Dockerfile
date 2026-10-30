FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates curl unzip && rm -rf /var/lib/apt/lists/*
RUN npm install -g bun
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile && npm rebuild better-sqlite3
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    DATABASE_URL=/data/medihacker.db \
    PATIENT_DATA_DIR=/app/tests/fixtures/patients \
    CASES_FILE=/app/tests/fixtures/cases/situations.md
COPY --from=build /app /app
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
