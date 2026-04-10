# Passage Theatre — Assistant & repo context

This file orients **Claude Code**, **Cursor**, and humans to what this project is, how it is structured, and what comes next. The Passage Theatre Company is a professional equity theatre in Trenton, NJ (Mill Hill Playhouse). **Brishen Miller** is Executive Artistic Director.

## Product (Phase 3)

- **One web app** (`web/`): public assistant at `/`, staff assistant at `/staff` → `/staff/chat` after auth.
- **Brain:** Anthropic Claude via serverless `/api/chat` (never expose API keys in the browser).
- **Unified system prompt:** `web/prompts/passage-phase3-system-prompt.md` — public vs internal behavior is enforced **on the server** (composed prompt + access checks).
- **Deploy:** Vercel with project **Root Directory = `web`**.

## How “memory” works (important)

- **Chat models do not automatically “learn”** from past chats. There is no standing weight update from user conversations.
- **Session memory:** Conversation history is sent with each request so the model stays coherent within a thread.
- **Persistent thread memory (implemented):** Server stores transcript per `threadId` (Upstash Redis when configured) so returning users can **resume** the same conversation from any device that has the same `threadId` in local storage (and staff threads require a staff session).
- **Long-term institutional “memory”** (optional next steps): (1) periodic **summaries** written to Google Drive or a DB, (2) **RAG** over Drive/docs, (3) **fine-tuning** or distillation — only (1)-(2) are typical for nonprofits; (3) is rarely needed.

## Stack

| Layer | Choice |
|--------|--------|
| Frontend | Vite, React, TypeScript, React Router |
| API | Vercel Node serverless functions in `web/api/` |
| LLM | Anthropic Messages API (`@anthropic-ai/sdk`) |
| Staff sessions | Signed HttpOnly cookie (`PASSAGE_SESSION_SECRET`) |
| Thread persistence | Upstash Redis REST (`@upstash/redis`) — optional; app works without it |
| Streaming | SSE from `/api/chat` when `stream: true` |

## Environment variables (Vercel + local `.env.local`)

**Required (core chat + staff password):**

- `ANTHROPIC_API_KEY`
- `PASSAGE_INTERNAL_PASSWORD` — shared staff password (optional if Google-only staff login is enforced — see below)
- `PASSAGE_SESSION_SECRET` — long random string for cookie signing

**Optional:**

- `ANTHROPIC_MODEL` — default is `claude-sonnet-4-20250514`
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — **thread persistence** across reloads
- `VITE_GOOGLE_CLIENT_ID` — public Google Client ID (OAuth client for GIS button); **only** this key is prefixed with `VITE_`
- `GOOGLE_CLIENT_ID` — same Client ID on the server for JWT verification (can match `VITE_GOOGLE_CLIENT_ID`)
- `STAFF_GOOGLE_ALLOWED_DOMAINS` — e.g. `passagetheatre.org` (comma-separated). If set, Google sign-in is restricted to these email domains.
- `CRON_SECRET` — bearer token for `/api/jobs/run` (n8n, Cowork, or Vercel Cron)

**Google Cloud setup (staff “Sign in with Google”):**

1. Create OAuth 2.0 Client ID (Web application).
2. Authorized JavaScript origins: `http://localhost:3000` (or `vercel dev` URL), production `https://your-domain.com`.
3. Authorized redirect URIs: not required for One Tap / JWT credential if using GIS FedCM flow; follow Google Identity Services docs for your chosen flow.

## Passage voice & guardrails (summary)

- **Three pillars:** TrentonPREMIERES, TrentonMAKES, TrentonPRESENTS.
- **Avoid:** savior narratives, “fixing Trenton,” deficit framing of the community; Passage is **of** Trenton.
- **Grants:** triage NOFAs, reuse awarded language, no fabrication of stats or partners — see full prompt file.

## Phase 3b — Google Drive “live knowledge” (RAG)

Not fully automated in code until you choose a vector store and ingestion pipeline. Planned pattern:

1. **OAuth** (Workspace or shared Drive) with least privilege.
2. **Sync job** (Cowork / n8n / Vercel Cron) lists target folders, exports text/PDF text, chunks, embeds.
3. **Retrieve** top-k chunks per user query and inject into system or tool results.
4. **Same guardrails** as prompt: cite sources, no unsourced claims.

**Status endpoint:** `GET /api/integrations/status` — reports `upstashRedis`, `googleStaffSignIn`, `cronWebhook`, `anthropic`, and `driveRag` (stub until wired).

**Optional “learning” from chats (institutional memory, not model fine-tuning):** run a scheduled job that (a) exports recent internal threads from Redis or (b) calls Claude to summarize decisions into a Google Doc or Notion page your team approves — then ingest that doc into RAG. The model still does not self-update; your **knowledge base** does.

## Automation — Cowork, n8n, Vercel Cron

- **`POST /api/jobs/run`** with header `Authorization: Bearer $CRON_SECRET` — generic hook for scheduled jobs (e.g. “refresh grant list”, “reindex Drive”). Implement job branches inside that handler or forward to n8n webhooks.
- **n8n:** schedule → HTTP Request node → this endpoint (or call Google APIs and then POST a digest to Passage).
- **Cowork:** if it can hit a URL on a schedule, point it at the same pattern.

## Later — Calendar & Gmail MCPs

- **Calendar:** board meetings, production milestones — OAuth, read events, optional summarization in chat.
- **Gmail:** donor comms drafts — OAuth + send approval workflow; keep human in the loop.

Document integration contracts here when you add them.

## Client relationship / phases (business context)

- **Phase 1:** Public-facing assistant (completed earlier in engagement).
- **Phase 2 Lite:** Internal grant & development GPT-style assistant — NOFA triage, narrative adaptation, guardrails (delivered as custom GPT; this web app supersedes/parallelizes with more control).
- **Phase 3 (this repo):** Unified assistant, one login story for staff, server-hosted prompt, optional memory and integrations.

Retainer vs project scope boundaries from your contracts still apply; new integrations (full RAG, CRM) are separate scopes unless agreed.

## Local development

```bash
cd web
cp .env.example .env.local
# Fill secrets — use `vercel dev` so `/api/*` routes work (not `vite` alone).
npm run dev
```

## Smoke tests before ship

1. Public `/` — chat, streaming optional, new thread / resume.
2. Staff login — password and/or Google (if configured).
3. Internal `/staff/chat` — chat persists, sign out invalidates session.
4. `POST /api/jobs/run` with `CRON_SECRET` — 200 from production (after setting secret).

---

*Update this file when integrations go live or env names change.*
