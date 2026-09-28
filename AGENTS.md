<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Prisma engine downloads (sandbox network quirk)
- Node's TLS to binaries.prisma.sh gets ECONNRESET; curl works. Prisma is pinned to 6.19.3 (the `prisma@latest` 8.x RC has a rewritten CLI — do not use).
- Engine binaries live in `node_modules/@prisma/engines/` (placed manually). If a fresh `npm install` wipes them, rebuild via the local mirror:
  1. Mirror files are at `/tmp/prisma-mirror/` (binaries + .sha256). Serve: `python3 -m http.server 8765 --directory /tmp/prisma-mirror &`
  2. Run prisma with `PRISMA_BINARIES_MIRROR=http://127.0.0.1:8765` (e.g. `PRISMA_BINARIES_MIRROR=http://127.0.0.1:8765 npx prisma generate`)
- `npx prisma db seed` runs `tsx prisma/seed.ts` (package.json `prisma.seed` key; the Prisma 7 deprecation warning about it is harmless on v6).
- tsx does NOT typecheck. Run `npx tsc --noEmit` after touching TS files.
