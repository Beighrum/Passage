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

## Google Drive — grant knowledge (how this fits today)

You keep **award narratives, NOFAs, budgets, and history** in **Google Drive**. That is the right source of truth for Passage. There are **two different “Claude + Drive” ideas** — both are valid; they solve different jobs:

| Context | What it does | Drive access? |
|--------|----------------|----------------|
| **This Passage web app** (`web/` on Vercel, `/staff/chat`) | Staff chat with your **unified system prompt**, server-side public vs internal rules, optional **thread memory** (Redis). | **Does not read Drive automatically yet.** Staff should **paste** short excerpts, NOFA text, or bullet lists into chat when needed — or we add **Phase 3b RAG** (OAuth + retrieval) in code. |
| **Claude (claude.ai) / Claude app with Google Drive / Workspace** | Good for **browsing and drafting against live Drive** when that connector is enabled for your account. | **Yes** — if you connected Drive there. This is **separate** from the Vercel app until we build the same retrieval into `/api/chat`. |

**Operational rule until Drive RAG ships in this app:** treat Drive as the **canonical library**; treat the **internal chat** as the **workflow + voice + guardrails** tool. When the model needs a document it cannot see, **paste the relevant section** (or upload text in a follow-up message). That keeps answers grounded without inventing stats.

### Recommended Drive layout (fill in your links below)

Use a **Shared drive** or a single top-level folder everyone trusts, with consistent names:

1. **`00 — HOW TO USE THIS DRIVE`** (short doc: naming rules, what “final” means, who approves uploads.)
2. **`01 — Awarded narratives & confirmations`** — PDFs/DOCX of **submitted/awarded** language you are allowed to reuse.
3. **`02 — NOFAs & applications in flight`** — current opportunities; one subfolder per funder/year.
4. **`03 — Declined / archival`** — optional; keeps “what we didn’t pursue” out of the reuse pool.
5. **`04 — Org boilerplate`** — mission, 501(c)(3) letter, board list, audited financials **pointers** (not secrets in chat; follow prompt rules).

**Paste links here (Share → Anyone with link *or* restricted to org — match your policy):**

- **Root folder:** `REPLACE_WITH_GOOGLE_DRIVE_FOLDER_URL`
- **Awarded narratives:** `REPLACE_WITH_LINK`
- **NOFA / active:** `REPLACE_WITH_LINK`

*Update these URLs when folders move. This file is for humans + tooling — not injected into the live chat prompt unless you copy it.*

### What staff should paste in **internal** chat (this web app)

For best grant drafts **before RAG**:

- The **NOFA priorities / scoring criteria** (paste the section, not a screenshot).
- **1–2 past awarded narratives** that match the program (paste key paragraphs, not whole 30‑page PDFs unless needed).
- **Hard constraints:** deadline, page limits, match requirements, anything that must not be wrong.

The assistant will still apply **reuse-of-awarded-language** behavior from the system prompt; it can only use what you actually provided in the thread (plus anything already in a future RAG index).

## Phase 3b — In-app Drive RAG (future code in this repo)

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
