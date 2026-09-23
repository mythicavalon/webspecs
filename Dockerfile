FROM node:24-alpine

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json replit.md ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
COPY lib/webspecs-classifier/package.json lib/webspecs-classifier/package.json
COPY lib/webspecs-middleware/package.json lib/webspecs-middleware/package.json
COPY lib/webspecs-snippet/package.json lib/webspecs-snippet/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @workspace/api-server run build
CMD ["pnpm", "--filter", "@workspace/api-server", "run", "start"]