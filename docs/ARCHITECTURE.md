# ARCHITECTURE.md

Architectural decisions for the `crowspeak` repo and how they relate to the rest of the CrowSpeak system. This is a living record. Add a dated note when a decision changes, and don't silently rewrite history.

Related: the workspace-level strategy doc (`docs/crowspeak_architecture_strategy.md` in the parent workspace) covers the two-repo split and the engine. This doc covers decisions made for the **`crowspeak` repo**, mainly the web frontend.

---

## 1. Context

- **`crowspeak-core`** (public): Python engine (`crowspeak-engine`), FastAPI gateway, reference CLI, WebSocket protocol schemas. It owns the speech pipeline (STT → LLM → TTS).
- **`crowspeak`** (this repo): the 3D web client, plus future auth/billing backend and infrastructure code.
- The two are decoupled by a **WebSocket protocol**. The frontend consumes structured domain events (`TranscriptDelta`, `AgentAudioChunk`, `ExpressionChange`, `GrammarFeedback`) and never needs to know how the engine works.

### Repo visibility

The workspace strategy doc describes `crowspeak` as private. **This repo is public and will stay public.** Contributions and forks are welcome. Consequences:

- Don't commit secrets, and never put secrets in `VITE_*` variables (see section 4).
- Only commit assets with redistributable licenses (CC0 and permissive). Track sources in `CREDITS.md` files.
- Anything commercial (auth, billing, hosted proxy) must keep its secrets in deployment environments, not in the repo. Public code is fine. Public credentials are not.

## 2. Frontend decisions

### 2.1 Vite + React + TypeScript, not Next.js

**Decision:** the web client is a Vite single-page app, built to static files and served from Vercel's CDN.

**Why:**

- The app is a client-side WebGL canvas. SSR, server components and file-based routing add nothing to it, and R3F's `<Canvas>` needs the browser, so Next's server defaults mean working around them (`"use client"`, `ssr: false`).
- The backend is Python. Next's API routes would duplicate it. We'd carry the server half of Next without using it.
- Vite gives fast HMR, which matters when tuning shaders, terrain and camera feel. The build output is plain static files, with no server runtime to operate.
- This fits the product goal: "let the client do the work."

**When to revisit:** if we need SEO-heavy public pages (marketing, blog, docs), server-rendered auth flows, or edge logic that can't live in the Python backend. Even then, prefer adding a *separate* app (see 2.4) over moving the game client into Next.

### 2.2 3D stack

- `three` for rendering and `@react-three/fiber` (R3F) for the declarative React layer.
- `@react-three/drei` for helpers (`useGLTF`, `Html`, `Environment`, `Stats`).
- **Assets:** low-poly `.glb`, compressed with Draco or meshopt, served from `public/` via the CDN. Custom shaders for the stylized look.
- **Physics:** none by default. Analytic terrain functions and a custom controller give better feel and less weight. Add `@react-three/rapier` only if collisions or rigid bodies become a real need.
- **Package manager:** npm for now. Move to pnpm workspaces when there's more than one package to share code between.

### 2.3 Scene and HUD split

The UI has two layers, and they should stay separate:

| Layer | Tech | Contains |
| :--- | :--- | :--- |
| **World** | R3F `<Canvas>` | Terrain, characters, NPCs, props, camera, shaders |
| **HUD** | Plain DOM/React over the canvas, plus drei `<Html>` for world-anchored UI | Mic controls, settings, transcript, grammar feedback, NPC speech bubbles |

Speech bubbles use native DOM (via drei `<Html>`) rather than text in WebGL, so text stays crisp, is selectable and accessible, and is styled with CSS. Use `occlude` so the planet hides bubbles on the far side.

**State boundary:**

- **Per-frame data** (positions, rotations, animation blending) lives in refs and is mutated inside `useFrame`. It must never go through React state.
- **Shared, UI-relevant state** (mic on/off, active conversation target, current transcript, connection status) lives in a small store (zustand). Both the scene and the HUD subscribe to it.
- **Engine events** arrive over the WebSocket, are validated and typed in one adapter module, and update the store. Scene objects react to the store. They don't talk to the socket themselves.

### 2.4 Repo layout

```
crowspeak/
├── apps/
│   └── web/              # Vite SPA: the game client (deployed to Vercel)
├── docs/                 # repo-level docs (this file)
└── (future)
    ├── apps/api/         # auth + billing proxy backend (Python)
    ├── apps/site/        # optional marketing/SEO site (could be Next.js)
    ├── packages/         # shared TS packages (protocol types) if needed
    └── infra/            # Terraform / Bicep
```

`apps/web` is the first and currently only app. The layout leaves room for siblings without restructuring.

### 2.5 Code organization within `apps/web`

- `src/world`, `src/player`, `src/npc`: scene content.
- `src/hud`: DOM overlay.
- `src/store`: shared state.
- `src/lib`: **pure functions** (terrain height, sphere and tangent math, noise). No React or Three-scene dependencies where practical, so they're unit-testable and reusable by both the player and NPCs.
- Engine/WebSocket integration goes in its own module (`src/engine/` when it exists), so the protocol is the only coupling point.

## 3. World model

The world is a small planet. The core technique, described in detail in `apps/web/docs_claude/SPIKE_OVERVIEW.md`:

- Radial gravity: up is the normalized position relative to the planet center.
- Terrain is a pure function `height(direction)`, used for both mesh generation and ground-snapping, so no raycasts or physics are needed.
- Characters keep a quaternion orientation (never Euler, never fixed world-up), and move on the local tangent plane.
- Player and NPCs share the same surface-movement code. NPCs differ only in what produces their input (wander logic now, engine-driven intent later).

**Implication for the engine:** keep the world deterministic from a seed. If the terrain is a pure function of `(seed, direction)`, the server or other clients can reason about positions without shipping geometry, which keeps the door open for multiplayer or server-validated state later.

## 4. Frontend ↔ backend relationships

```
Browser (Vercel CDN: static Vite app)
   │
   ├── WebSocket ──► Engine gateway (crowspeak-core: FastAPI)       [self-hosted by OSS users]
   │
   └── HTTPS + JWT ─► crowspeak auth/billing proxy (Python, ACA)    [commercial SaaS path]
                         └── proxies/routes to engine instances
```

- **Open-source path:** a user runs the `crowspeak-gateway` image locally with their own provider keys, and the web client connects directly to it via a configurable URL.
- **Commercial path:** the client authenticates with the proxy, which validates the JWT, meters usage (Stripe) and routes to engine instances. The proxy is the only thing holding provider keys.
- The client talks to exactly **one configurable gateway URL** (`VITE_GATEWAY_URL`, or entered in a settings screen). The same client works against both paths.
- **Secrets:** anything prefixed `VITE_` is embedded in the public bundle. Only non-secret configuration (URLs, feature flags) goes there. Provider keys never reach the browser.
- **Audio:** the mic captures PCM in the browser (AudioWorklet), streams it over the WebSocket, and plays back streamed TTS chunks. This is a latency-sensitive path (the target is a sub-second round trip), so keep it off the main render thread and separate from the React render cycle.
- **CORS and origins:** the gateway must allow the Vercel production and preview origins. Preview URLs are dynamic, so the proxy will need an allowlist pattern.

## 5. Deployment

- **Frontend:** Vercel, project Root Directory `apps/web`, Vite preset, output `dist`. `main` deploys to production and every other branch gets a preview URL.
- **Hobby plan is non-commercial.** Fine while this is an open-source project and spike. Plan to move to a paid plan, or another static host, before accepting payments.
- **Backend and infra:** Azure Container Apps with Terraform/Bicep (per the workspace strategy doc). Out of scope until the engine is integrated.
- **Cache behavior:** Vite fingerprints bundled assets. Files in `public/` (`.glb` models) are not fingerprinted, so version their filenames when they change.
- If we add client-side routes, add a SPA rewrite in `vercel.json`.

### 5.1 Hosting portability

**Decision:** Vercel is a convenient host for the frontend, not a dependency. The deployable is a folder of static files (`apps/web/dist`), so moving to another static host is a small, low-risk change. Billing and auth live in the Python backend, never in the frontend host.

**Migration path** (estimated at about an hour, not verified):

| Target | Fit | Notes |
| :--- | :--- | :--- |
| Cloudflare Pages | Strong candidate | Set root `apps/web`, build `npm run build`, output `dist`. Commercial use is allowed on its free tier (verify current terms). |
| Netlify | Good | Same build settings. Check current free-tier and commercial terms. |
| Azure Static Web Apps or Storage + CDN | Good | Colocates with the planned Azure backend. |
| Railway | Poor fit for the frontend | Built for running services. Better suited to the Python backend than to static files. |

To migrate: re-point the build settings, copy the `VITE_*` env vars, update DNS, and translate SPA rewrites (`vercel.json` becomes `_redirects` on Netlify and Cloudflare). Free-tier limits and commercial-use rules change often, so check the current terms before choosing.

**Guardrails to keep it portable:**

1. **Keep the frontend static.** No Vercel Functions or Edge Middleware. Server-side logic (auth callbacks, API proxying) belongs in the Python backend.
2. **No `@vercel/*` packages** (analytics, speed-insights, blob, KV) in app code. Use platform-neutral tools if analytics are needed.
3. **Configuration through env vars.** The gateway URL is `VITE_GATEWAY_URL`. Nothing platform-specific is hardcoded.
4. **`vercel.json` is the only Vercel-specific file** and stays minimal (SPA rewrite only, when routes exist).
5. **CORS origins are configurable on the backend.** Don't rely on `*.vercel.app` patterns. The allowlist should work for any host.

**Payments:** Stripe checkout and webhooks run in the backend (Python proxy on Azure). The only frontend-hosting question for going commercial is whether the host's terms allow commercial use. Vercel's Hobby plan does not, so pick a paid Vercel plan or move before accepting payments.

## 6. Roadmap alignment

| Phase | Frontend work | Depends on |
| :--- | :--- | :--- |
| Spike (now) | Sphere world, third-person controller, terrain, props; stretch: animated character, NPCs, speech bubble | Nothing |
| Phase 2a | Real art direction, shaders, NPC behaviors, HUD shell with mic controls (mocked) | Spike learnings |
| Phase 2b | Connect to engine WebSocket, wire mic streaming and TTS playback, show transcripts and grammar feedback in HUD | `crowspeak-core` gateway and protocol |
| Later | Auth, billing UI, multiplayer (if ever), mobile polish | Backend proxy |

The 3D world and the speech pipeline are developed independently and meet at the WebSocket protocol. The spike deliberately includes a **mocked speech bubble** to prove the HUD pattern before the engine is connected.

## 7. Open questions

- Shared TypeScript types for the protocol: generate from the schemas in `crowspeak-core` (preferred, since it keeps one source of truth) or hand-maintain?
- Single player or shared world? This affects whether NPC state is client-simulated (current assumption) or server-authoritative.
- How much of the per-NPC conversation state belongs in the client store versus being derived from engine events?
- Target performance budget: devices and frame rate we commit to (mobile browsers included).
- Whether to host the frontend on Vercel after going commercial (see section 5).

## 8. Decision log

| Date | Decision |
| :--- | :--- |
| 2026-10-06 | Frontend is a Vite + React + TS SPA in `apps/web`, not Next.js. Deployed to Vercel from the public `crowspeak` repo. |
| 2026-10-06 | `crowspeak` repo is public (supersedes "private" in the workspace strategy doc). |
| 2026-10-06 | Frontend hosting stays platform-neutral (static `dist/` only, no Vercel-specific features). Vercel for now, with a migration path to Cloudflare Pages, Netlify or Azure before commercial launch. See 5.1. |
| 2026-10-06 | npm for package management. No physics engine for the spike; radial gravity plus analytic height function. |
