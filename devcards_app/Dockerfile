# --- build ---
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# SvelteKit's build imports server modules once to analyse routes, which
# trips our fail-fast `if (!env.X) throw` checks — these placeholders exist
# only to get through that pass; nothing here ever actually connects.
# Real values come from compose.prod.yaml's `environment:` at runtime.
ENV DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder
ENV BETTER_AUTH_SECRET=placeholder-build-time-only
ENV ORIGIN=http://localhost:3000
ENV RESEND_API_KEY=placeholder
RUN npm run build

# --- runtime ---
# Full copy of /app (node_modules included) rather than a trimmed
# --omit=dev install: most of our runtime deps (drizzle-orm, postgres,
# better-auth, @sveltejs/kit) are currently plain devDependencies (standard
# for a Vite/SvelteKit project), so a slim prod-only install would actually
# miss things adapter-node needs at runtime. Simplicity over image size for
# a single personal-scale deploy — worth revisiting only if that ever
# becomes an actual problem.
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["node", "build/index.js"]
