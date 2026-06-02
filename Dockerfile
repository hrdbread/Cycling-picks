# Use the official Playwright image so Chromium + all its runtime libs come
# pre-installed. Pin to the matching playwright version we use in package.json.
FROM mcr.microsoft.com/playwright:v1.59.1-noble AS base
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

FROM base AS deps
# Native deps for better-sqlite3.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund --include=dev

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/db ./db
COPY --from=build /app/lib ./lib
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.js ./next.config.js
COPY --from=build /app/tsconfig.json ./tsconfig.json
RUN mkdir -p /app/data /app/public/shirts
VOLUME ["/app/data", "/app/public/shirts"]
EXPOSE 3000
CMD ["npm", "run", "start"]
