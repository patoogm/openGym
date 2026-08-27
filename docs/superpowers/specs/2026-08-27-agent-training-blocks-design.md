# Agent-generated training blocks — design

**Date:** 2026-08-27
**Status:** draft, pending review
**Base app:** openGym fork (this repo; a rename is planned later — not part of this spec)

---

## 1. Context & goal

openGym today models training as a **single weekly schedule that repeats forever**
(`S.week: {0..6 → routineId}` over a flat `S.routines[]`). There is no notion of a
program that changes week to week.

The owner wants a **personal, periodized training tool**: describe a profile once,
and have an LLM agent generate a training **block** (a few weeks of sessions:
proprioception + strength + cardio). When a block is finished, generate the next
one — this time feeding the agent the training history that was just logged, so
loads and exercise selection adapt.

Long term this may become a product; the design keeps that door open (provider
abstraction, bring-your-own-key) but does not build for it now.

### Locked decisions (from brainstorming, 2026-08-27)

| Decision | Choice |
|---|---|
| Base app | Adapt openGym; discard the separate `gimnastic` app |
| Periodization model | **Approach A — blocks as snapshots** (see §3.2). Revisit approach B only if A proves too limiting. |
| Plan entry (v1) | **Agent, direct** — backend route calls an LLM API. No copy-paste bridge. |
| LLM provider | Swappable adapter; **default Gemini Flash (free tier)**, selectable by env var. Anthropic / Groq as alternates. |
| Generation granularity | **One block at a time.** |
| Agent input | **Profile + training history** (history empty ⇒ first block from profile alone). |
| Exercise mapping | Agent picks only from a **curated ~200-exercise list** shipped in the prompt. |
| Session scope | **Strength + cardio + proprioception** — the full session, not strength-only. |

### Non-goals

- No full periodized-plan data model (approach B). No `PlannedSession[week][day]`.
- No in-app chat with the agent. One structured request → one block.
- No multi-user metering, billing, or per-user keys. Single server-side key.
- No migration of existing openGym users' data beyond additive, back-compatible fields.
- No changes to passkey auth, sync, or the mobile/demo builds' existing behavior.
- The app rename.

---

## 2. High-level architecture

```
┌────────────────────────────── frontend (React) ──────────────────────────────┐
│  Profile screen            Program screen              Block preview          │
│  (goal, days, limits…)     (blocks list, "generate     (routines + week +     │
│         │                   next block", activate)      cardio, Accept)       │
│         │                        │                          │                │
│         └──────────┬─────────────┴──────────────┬───────────┘                │
│                    ▼                            ▼                             │
│           S.profile (synced)          POST /api/plan/generate                 │
│           S.program  (synced)                   │                            │
│           S.routines / S.week  ◄── materialize ─┘  (client merges response)   │
└──────────────────────────────────────────┬───────────────────────────────────┘
                                           ▼
┌────────────────────────────── api/ (Node, no framework) ─────────────────────┐
│  routes['POST /api/plan/generate']                                           │
│     readSession(req) → 401 if not signed in                                  │
│     build prompt: system + curated catalog + output schema + profile + hist  │
│     llm.generate(prompt)   ── adapter: gemini | anthropic | groq             │
│     validate(block)  → on failure, one retry with errors fed back            │
│     respond { block }      (server does NOT persist — client owns state)     │
│                                                                             │
│  api/llm/index.js         provider dispatch (LLM_PROVIDER env)               │
│  api/llm/gemini.js        fetch() to Google AI Studio                        │
│  api/llm/anthropic.js     @anthropic-ai/sdk                                  │
│  api/llm/groq.js          fetch() to Groq                                    │
│  api/plan/prompt.js       prompt builder (shared contract w/ frontend)      │
│  api/plan/schema.js       block JSON schema + validator                      │
│  api/plan/catalog.json    curated ~200 exercises (generated from EXDB)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

The server stays **stateless with respect to plan content**: `/api/plan/generate`
returns a validated block; the client merges it into `S.program` and syncs it
through the existing `PUT /api/data` blob. This keeps the server's single
responsibility (auth + dumb state blob + push) intact.

---

## 3. Data model

All additions live on the synced state object `S` (`frontend/src/store/useStore.js`
`DEF`). Every field is optional and absent-reads-as-before, so existing profiles,
plan files and backups load unchanged (openGym's established compatibility rule).

### 3.1 `S.profile`

```js
profile: {
  goal: 'general' | 'strength' | 'hypertrophy' | 'return' | 'endurance',
  daysPerWeek: 3,                 // 2–6
  sessionMin: 60,                 // target minutes per session
  level: 'beginner' | 'intermediate' | 'advanced',
  equipment: ['dumbbell','barbell','machine','cable','bodyweight','kettlebell','bands'],
  limitations: '',               // free text, e.g. "rodilla derecha operada de LCA, sin restricciones actuales"
  cardio: 'none' | 'light' | 'moderate' | 'priority',
  notes: ''                      // free text extra guidance for the agent
}
```

`limitations` and `notes` are passed to the agent verbatim. They are the escape
hatch for anything the structured fields don't capture (injury history, exercise
dislikes, gym constraints).

### 3.2 `S.program` — blocks as snapshots

```js
program: {
  blocks: [ Block, … ],          // ordered, oldest first
  activeId: 'blk_ab12' | null    // which block is currently materialized into S.routines/S.week
}

// Block
{
  id: 'blk_ab12',
  name: 'Mes 1 — Full Body',
  weeks: 4,                      // intended duration
  source: 'agent' | 'manual',
  createdAt: '2026-08-27',
  startedAt: '2026-08-27' | null,
  completedAt: null,
  rationale: '',                // 1–3 sentences the agent gives explaining the block
  routines: [ Routine, … ],     // SAME shape as S.routines entries (see §3.4)
  week: { 1: 'r_x', 2: 'r_y', 4: 'r_z' }   // weekday → routine id within this block
                                           // weekday ints match S.week: 0=Sun … 6=Sat
}
```

**Materialization.** "Start block" / "Activate block":

1. Deep-clone the block's `routines`, assigning **fresh ids** (`uid()`), keep an
   `id → newId` map.
2. Replace `S.routines` with the clones. Replace `S.week` using the id map.
   Clear `S.dayPlan` overrides that point at now-gone routine ids.
3. Set `program.activeId = block.id`, `block.startedAt = todayISO()`.
4. The previously-active block keeps its own `routines`/`week` snapshot untouched
   in `program.blocks` (it is not written back from the live copy — see "Editing"
   below) and gets `completedAt = todayISO()` if the user chose "finish & start
   next", or is left as-is if they just switched.

Because `S.routines`/`S.week` still hold ordinary routine objects, **every
existing screen (Home, Plan, Workout, RoutineEdit, plan share/print) works with
zero changes.**

**History survival.** Workouts are keyed by `exerciseId`, never routine id
(`frontend/src/lib/history.js` `historyFor`). Swapping routines does not orphan
any logged set. The progression engine keeps suggesting correct next loads across
a block boundary as long as the same exercise id reappears.

**Editing the active block.** The user can still edit routines freely
(RoutineEdit). Those edits land in `S.routines`, i.e. the *materialized* copy, not
`program.blocks[active]`. On "finish block", we snapshot the current
`S.routines`/`S.week` back into the active block before marking it complete, so
the history digest sent to the agent reflects what was actually trained. (Design
choice: the block record is a historical artifact once completed; live edits
belong to the live copy until then.)

**No program yet.** If `S.program` is absent/empty, the app behaves exactly as
today. Loading the PPL starter plan (`lib/starter.js`) stays available and does
not create a program.

### 3.3 Cardio intervals — the one genuine model extension

openGym's cardio mode is `{ mode:'cardio', min, speed }` — single steady state.
The owner's real plan needs intervals ("5 min walk + 8×(1′ jog / 1.5′ walk) +
5 min walk"). Add an optional `intervals` object to a cardio exercise config:

```js
{
  id: 'treadmill',              // a cardio-bp exercise id from the catalog
  mode: 'cardio',
  sets: 1,
  intervals: {                  // optional; absent ⇒ behaves exactly as today
    warmupMin: 5,
    rounds: 8,
    workMin: 1,                 // "jog"
    restMin: 1.5,               // "walk"
    cooldownMin: 5
  }
  // steady-state fallback fields (min, speed) still allowed and used when `intervals` absent
}
```

- **Rendering (Workout view):** when `intervals` present, show the breakdown
  ("Warm-up 5′ · 8 × (1′ / 1.5′) · Cool-down 5′") and a round counter instead of
  the single-duration field.
- **Logging:** the set still reduces to **minutes actually done** for the graph.
  Port `gimnastic/src/domain/cardio.ts` `minutosTrotados` verbatim: logged value
  is `rounds_done × workMin` for intervals, or minutes as-entered for steady
  state. This keeps the running chart comparable across interval and continuous
  weeks (the exact bug that helper was written for).
- **Progression:** cardio stays `policy: 'off'` (as today). Block-to-block cardio
  progression is the agent's job, not the client engine's.

`lib/plan-share.js` `cleanEx` / `parsePlan` gain `intervals` passthrough so
shared/printed plans carry it.

### 3.4 Routine & exercise shape (unchanged, for reference)

Agent output must conform to what openGym already stores:

```js
Routine  = { id, name, emoji, prog?, ex: [ Ex, … ] }
Ex       = {
  id,                          // catalog exercise id
  sets,                        // int
  reps?,       repsMin?, repsMax?,   // reps mode
  sec?,                        // time mode (proprioception holds, planks)
  weight?,                     // starting load, 0 allowed
  mode?: 'reps' | 'time' | 'cardio',
  side?: true,                 // unilateral
  bodyweight?: bool,
  intervals?: {…},             // §3.3, cardio only
  prog?: 'off'|'linear'|'greyskull'|'double'|'time',   // progression policy
  inc?, sg?,                   // load increment, superset group
  note?                        // "carga liviana", "agarre cerrado"
}
```

Proprioception exercises are simply the first N entries of each routine with
`mode:'time'` or `mode:'reps'`, `prog:'off'`. No separate structure.

---

## 4. Curated exercise catalog

`api/plan/catalog.json` — a static file, ~200 entries, generated once from
`frontend/src/lib/exercises-data.js` (1324 entries) by a build script
`scripts/build-catalog.mjs` and committed. Regenerated manually if the dataset
changes.

```json
[
  { "id": "0043", "n": "barbell full squat", "bp": "upper legs", "eq": "barbell", "tg": "quads" },
  …
]
```

**Selection criteria** for the script (tunable):
- Cover every `bp` (body part) and the common `eq` values.
- Prefer barbell/dumbbell/machine/cable compounds + standard accessories.
- Include the proprioception/rehab staples the owner's plan uses (single-leg
  stance, step-down, controlled landings, planks, glute bridges) — add by id
  allowlist since some are `bodyweight`/niche.
- Include 3–5 cardio-bp entries (treadmill walk/run, bike, rower, elliptical).

The **same JSON** is imported by the frontend block-preview screen (to resolve
ids → names/GIFs) and embedded by the backend prompt builder. Single source of
truth. Frontend still falls back to full `EXIDX` for resolution so a
hand-added exercise outside the catalog still renders.

**Prompt size:** ~200 × ~60 chars ≈ 12 KB ≈ ~4 K tokens. Acceptable on Gemini
free tier (1M context, generous RPM). If it becomes a problem, send only the
subset matching `profile.equipment`.

---

## 5. Backend

### 5.1 Route: `POST /api/plan/generate`

Added to the `routes` table in `api/server.js`, same style as the others.

```
Request  (JSON body, session-cookie authenticated):
{
  profile:  { …S.profile… },              // required
  history:  [ SessionDigest, … ],         // may be empty
  previousBlock: { name, weeks, routines } | null,   // for "next block"
  intent:  ''                             // optional free-text nudge for this block only
}

Response 200:
{ block: Block }                          // §3.2, validated, ids resolve to catalog

Response 4xx/5xx:
{ error: 'message', detail?: '…' }
```

- `readSession(req)` guard → `401` if not signed in (copy the pattern from
  `GET /api/data`).
- `readBody(req)` for the body (respects `MAX_BODY`).
- Rate limit: in-memory map `uid → lastGenAt`, reject if < 10 s since last call
  (`429`). Cheap abuse guard; matches the in-memory style of `restTimers` /
  `challenges`.
- Timeout: 60 s hard cap on the LLM call; `504` on timeout.

### 5.2 `SessionDigest` (history sent to the agent)

Built **client-side** from `S.workouts` before the request (keeps the server out
of interpreting workout data). One entry per logged session, most recent ~12:

```js
{
  date: '2026-08-20',
  block: 'Mes 1 — Full Body',
  routine: 'Lunes',
  exercises: [
    { name: 'barbell squat', sets: [ { weight: 40, reps: 12, rpe: 7 }, … ] },
    { name: 'treadmill', cardioMin: 22 }
  ]
}
```

Names, not ids — the agent reasons in names and its output is re-mapped to ids by
the validator.

### 5.3 LLM provider adapter

```
api/llm/index.js
  export async function generate({ system, user, schema }) → parsed JSON object
  dispatches on process.env.LLM_PROVIDER  (default 'gemini')

api/llm/gemini.js     POST to generativelanguage.googleapis.com,
                      model 'gemini-2.5-flash' (or latest Flash), responseMimeType
                      'application/json', responseSchema = schema. Key: LLM_API_KEY.
api/llm/anthropic.js  @anthropic-ai/sdk, model from LLM_MODEL or 'claude-sonnet-5',
                      output_config.format = json schema. Key: ANTHROPIC_API_KEY.
api/llm/groq.js       POST to api.groq.com OpenAI-compat endpoint,
                      model 'llama-3.3-70b-versatile', response_format json_object.
```

Env (added to `.env` / documented in README + `docker-compose.yml` `api.environment`):

```
LLM_PROVIDER=gemini            # gemini | anthropic | groq
LLM_API_KEY=…                  # provider key (anthropic uses ANTHROPIC_API_KEY)
LLM_MODEL=                     # optional override
```

If `LLM_API_KEY` is unset, `/api/plan/generate` returns `503 { error: 'agent not
configured' }` and the frontend hides the "generate" actions (feature-flag via a
field on `GET /api/config`).

Each adapter is ≤ 60 lines. `anthropic.js` is the only one pulling a new
dependency (`@anthropic-ai/sdk`); `gemini.js` and `groq.js` use built-in `fetch`.
Per the `claude-api` skill: the Anthropic adapter uses the official SDK; the
non-Anthropic adapters are plain HTTP and are clearly separate files.

### 5.4 `api/plan/prompt.js` — prompt builder

Pure function `buildPrompt({ profile, history, previousBlock, intent, catalog })
→ { system, user }`. Kept in one place because the exact output contract must
match `schema.js` and the frontend merge.

**System prompt** (outline):
- Role: strength & conditioning coach generating ONE training block.
- Hard rules: output JSON matching the schema; every `exerciseId` MUST be from
  the provided catalog; respect `daysPerWeek`, `sessionMin`, `equipment`,
  `limitations`; each session starts with 2–3 proprioception items when
  `limitations` mentions a joint/injury; include a cardio prescription per
  session scaled to `profile.cardio`.
- Progression: set `prog:'double'` with `repsMin`/`repsMax` on main lifts so the
  client engine can auto-progress within the block.
- Block length: 3–5 weeks; the block is one routine per training day, trained
  each week (within-week load progression handled by the engine, not by emitting
  a routine per week).

**User prompt:** the catalog, the profile, the history digest, the previous
block summary, the per-request `intent`.

### 5.5 `api/plan/schema.js` — schema + validator

- The JSON schema object (shared: passed to Gemini/Anthropic structured output,
  and used to validate Groq's looser output).
- `validate(block, catalog) → { ok, errors[], block }`:
  - every `ex.id` ∈ catalog (else collect error, drop the exercise)
  - `sets` 1–6; reps 1–30; `repsMin ≤ repsMax`; `sec` 5–600; interval fields ≥ 0
  - `week` keys are 0–6 weekday ints (0=Sun), values reference routines in the block
  - number of distinct training days == `profile.daysPerWeek` (warn, don't fail)
  - proprioception present when `limitations` non-empty (warn)
- **One retry:** if `!ok` and it's the first attempt, re-call the LLM with the
  errors appended to the user prompt ("your previous output had these problems:
  …fix and resend"). Second failure → `422 { error, detail: errors }`.

---

## 6. Frontend

### 6.1 Profile screen

New view `views/Profile.jsx`, reachable from Settings ("Training profile"). Plain
form over `S.profile`, `store.update`. No agent call here.

First-run nudge: if `S.program` empty and `S.profile` empty, Home shows a
"Set up your training" card linking to Profile → then to Generate.

### 6.2 Program screen

New view `views/Program.jsx` (route `#/program`, add to nav):

- List of `program.blocks`: name, weeks, date range, status
  (draft / active / completed).
- Active block highlighted; tapping a block shows its routines read-only.
- Actions:
  - **Generate first block** (when no blocks): profile → `POST /api/plan/generate`
    with empty history → preview.
  - **Generate next block** (when active block exists): builds history digest from
    `S.workouts` since `activeBlock.startedAt`, sends with `previousBlock` →
    preview.
  - **Activate** a draft block → materialization (§3.2).
  - **Finish current & generate next** → snapshot active block, mark complete,
    then generate.

### 6.3 Block preview

Component `components/BlockPreview.jsx`, shown after a successful generate:

- Renders the block like the print view does (routines, per-exercise scheme,
  week schedule, cardio breakdown), plus the agent's `rationale`.
- Flags any exercise the validator dropped ("2 exercises the coach suggested
  aren't in the library — review").
- **Accept** → push block into `program.blocks` as a draft (`store.update`),
  offer "Activate now".
- **Discard** / **Regenerate** (with an optional tweak to `intent`).

### 6.4 `lib/agent.js` — client helper

- `buildHistoryDigest(S, since) → SessionDigest[]` (§5.2)
- `generateBlock({ profile, history, previousBlock, intent }) → block`
  (wraps `api('/api/plan/generate', …)`)
- `materializeBlock(s, block)` — the §3.2 clone-and-swap, called inside
  `store.update`
- `snapshotActiveBlock(s)` — copy live `S.routines`/`S.week` back into the active
  block record

### 6.5 Feature flag

`GET /api/config` gains `agent: true|false` (from `!!LLM_API_KEY`). When false,
the Program screen still works for **manual** blocks (create a block, add
routines to it by hand) but the "Generate" buttons are hidden. This keeps
self-hosters without a key fully functional and makes the agent genuinely
optional.

---

## 7. Compatibility & rollout

- All new `S` fields are additive and optional. `Object.assign(clone(DEF), state)`
  in the store already merges them safely on every load path (local, server pull,
  backup import).
- `DEF` gains `profile: {}`, `program: { blocks: [], activeId: null }`.
- Mobile build: no backend, so `agent:false` path — manual blocks only. No
  regression; `nativeSave`/`nativeLoad` serialize the new fields for free.
- Demo build (GitHub Pages): `agent:false`. Optionally seed one example block in
  `lib/demoSeed.js` so the Program screen isn't empty in the demo.
- Plan share/print: `cleanEx`/`parsePlan` gain `intervals`, `repsMin`,
  `repsMax`, `prog` passthrough (some already carried). Blocks themselves are
  **not** added to the share format in v1 — sharing stays "current routines +
  week", which is the materialized active block. Revisit if needed.
- `docker-compose.yml`: document the three `LLM_*` env vars under `api.environment`
  (commented, since the feature is opt-in). `render.yaml` unchanged (still the
  separate open item #4 from the repo review).

---

## 8. Testing

Follow the repo's existing `vitest` setup (`frontend/`) and add a matching one
for `api/` (none exists yet — minimal `vitest` config, no framework needed).

**Backend (`api/`):**
- `plan/schema.test.js` — validator: drops unknown exercise ids; rejects
  out-of-range sets/reps; catches `repsMin > repsMax`; day-count warning; retry
  payload shape.
- `plan/prompt.test.js` — builder is pure; catalog embedded; profile/limitations
  passed verbatim; previous-block summary included only when provided.
- `llm/*.test.js` — adapters with `fetch` mocked: request shape per provider,
  JSON parsed out of each provider's envelope, error surfaces as thrown.
- Route test with the LLM layer stubbed: 401 unauthenticated; 503 when no key;
  429 on rapid repeat; happy path returns validated block; malformed LLM output
  triggers exactly one retry then 422.

**Frontend:**
- `lib/agent.test.js` — `buildHistoryDigest` (windowing by `startedAt`, name
  resolution, cardio minutes); `materializeBlock` (fresh ids, `week` remapped,
  stale `dayPlan` cleared, `S.routines` replaced); `snapshotActiveBlock`
  round-trips.
- `lib/cardio.test.js` — port of gimnastic's `minutosTrotados` tests.
- `lib/plan-share.test.js` — `intervals` survives export → import.
- Store test — `DEF` merge leaves a program-less profile behaving exactly as
  before; a block activate/deactivate cycle doesn't corrupt `S.week`.

**Manual smoke:** local run (API + vite + media, per the memory note), set
`LLM_PROVIDER=gemini` + a real free key, generate a first block from a profile
that mirrors the owner's real one (`docs/plan_entrenamiento.md` in the gimnastic
repo), verify the preview, activate, log a session, generate block 2, confirm the
history digest changed the loads.

---

## 9. Build order (for the implementation plan)

1. **Data model + store** — `DEF` fields, `lib/agent.js` (`materializeBlock`,
   `snapshotActiveBlock`, digest), store tests. No UI, no backend.
2. **Cardio intervals** — config field, `lib/cardio.js` port, Workout rendering,
   plan-share passthrough, tests.
3. **Curated catalog** — `scripts/build-catalog.mjs`, `api/plan/catalog.json`,
   allowlist for rehab staples.
4. **Backend schema + prompt + validator** — pure, fully unit-tested, no network.
5. **LLM adapters** — gemini first (default), then anthropic, then groq.
6. **Route** — `POST /api/plan/generate`, `GET /api/config` flag, rate limit,
   route tests with LLM stubbed.
7. **Frontend** — Profile screen, Program screen, BlockPreview, nav entry,
   first-run card.
8. **Wiring + manual smoke** — real key, real generate, end-to-end.
9. **Docs** — README section, `.env` example, docker-compose comments.

Steps 1–4 are independent of any API key and deliver testable value on their own
(manual blocks work after step 7 even with no provider configured).

---

## 10. Open questions

1. **Gemini model id** — confirm the current free-tier Flash model string at
   implementation time (`gemini-2.5-flash` assumed; verify against AI Studio).
2. **Block length policy** — fixed 4 weeks, or let the agent choose 3–5? Spec
   assumes agent chooses within 3–5.
3. **Within-block week progression** — spec relies entirely on the `double`
   progression engine for load increases inside a block. The owner's real plan
   also bumps *sets* (2→3→4) across weeks, which the engine doesn't do. Options:
   (a) accept engine-only progression in v1; (b) let a block carry a small
   `weekProgression` hint (e.g. "week 3+: +1 set on mains") rendered as a note.
   **Recommend (a) for v1**, revisit.
4. **Manual block editing UX** — v1 can lean on the existing RoutineEdit for the
   active block and skip a dedicated block editor. Draft (non-active) blocks:
   edit by regenerating, not by hand, in v1?
5. **Proprioception as a first-class block field** vs. repeated per routine —
   spec repeats it per routine (simplest). If it feels redundant in the UI, add
   `block.proprioception[]` prepended at materialization later.
