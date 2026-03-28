# SEO Command Center

Production-grade autonomous SEO platform with:
- Next.js App Router frontend (`apps/web`)
- TypeScript orchestrator backend (`services/orchestrator`)
- Supabase Postgres + pgvector (`supabase/migrations`)
- OpenClaw daemon bridge + internal campaign autopilot loop
- Dynamic `Skill_Discover_And_Install` execution via `skills.sh`
- Clerk authentication + per-user encrypted API credentials
- Realtime dashboard and 3D SEO office

## Phases Implemented

### Phase 1
1. Core monorepo, backend orchestrator, and Supabase schema.
2. OpenClaw daemon/dispatch integration.
3. Dynamic skill discovery/install tool (`Skill_Discover_And_Install`).
4. Telegram intake (`Start SEO campaign for ...`).

### Phase 2
1. Six-agent persona definitions:
   - Shiva
   - Brahma
   - Vishnu
   - Hanuman
   - Lakshmi
   - Nandi
2. Team manifest and route map.
3. Runtime schema validation for agent/team configs.

### Phase 3
1. 24/7 autopilot loop for sequential and cyclic execution.
2. JSON handoff logging between agents (`json_handoff`).
3. Realtime state logging (`searching_for_skill`, `installing_skill`, `executing_task`, etc.).
4. Context snapshots per cycle (`cycle_context_snapshot`).
5. Anthropic-driven structured agent outputs persisted into:
   - `keywords`
   - `content_pipeline`
   - `backlink_outreach`

### Phase 4
1. Professional landing page and authenticated app shell.
2. Protected pages:
   - `/dashboard`
   - `/campaigns`
   - `/agents`
   - `/settings`
   - `/seo-office`
3. Clerk auth middleware.
4. Encrypted per-user integration vault:
   - `user_integrations`
   - `credential_requests`
5. Supabase realtime subscriptions for dashboard/office updates.
6. 3D SEO office with live agent status overlays.
7. Custom dark/light orb theme toggle.

## Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies:
   - `npm install`
3. Run migrations:
   - `supabase/migrations/0001_phase1_core.sql`
   - `supabase/migrations/0002_auth_credentials_rls.sql`
4. Configure Clerk:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - Create JWT template named `supabase`
5. Configure encryption:
   - `CREDENTIAL_ENCRYPTION_KEY` must decode to exactly 32 bytes
6. Start orchestrator:
   - `npm run dev:orchestrator`
7. Start web app:
   - `npm run dev:web`

## API Surface

- `GET /health`
- `POST /campaigns`
- `POST /campaigns/:campaignId/trigger`
- `POST /tools/skill-discover-install`
- `POST /telegram/webhook`
- `GET /agents`
- `GET /autopilot/status`
- `POST /api/campaigns` (web app)
- `GET /api/integrations` (web app)
- `POST /api/integrations` (web app)
