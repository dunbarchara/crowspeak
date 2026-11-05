# FRONTEND_2D_DIRECTION.md

The decision to replace the R3F 3D frontend with a 2D walkable world built on Phaser and React. Recorded 2026-11-04, before any code changes, on branch `dunbarchara/2d`.

Related: [`ARCHITECTURE.md`](./ARCHITECTURE.md) (repo-level decisions; sections 2.2, 2.3 and 3 are superseded by this doc) and, in the parent workspace, `docs/crowspeak_architecture_strategy.md` and `crowspeak-core/docs/engine-design.md` section 12 (the session, participant and relationship model).

---

## 1. Decision

The `crowspeak` web client becomes a **top-down 2D walkable world** instead of a 3D React Three Fiber (R3F) planet.

**Why:**

- **Runs anywhere.** The goal is a smooth experience on any device, including low-end phones. WebGL 3D with rigged characters, LODs and shaders is the expensive path on exactly those devices. 2D sprites are cheap in bundle size, GPU memory and asset production.
- **The product is the conversation.** Learners spend their time in voice, chat, translations, corrections and relationships. A 3D world adds cost without adding to that.
- **Direction words become practical.** The learner will often hear and use directions ("left", "east", "past the fountain"). A top-down map with a consistent compass makes those words usable in a way a spherical planet does not.
- **Accessibility.** Text, transcripts and controls are DOM, so they are selectable, scalable and screen-reader friendly.

The 3D approach is not rejected forever. An R3F wrapper may return as a future, separate client (see section 9).

## 2. Constraint: the engine stays frontend-agnostic

`crowspeak-core` does not know about this frontend, or any other. It emits **semantic events** (who spoke, to whom, text, language, expression or intent, NPC silence, usage) and accepts participants, config and input. It never carries positions, sprites, cameras or tile data.

Everything below is a wrapper concern. If a design here needs the engine to change for rendering reasons, that is a signal to revisit the design, not the engine. The test for engine-side work is whether a CLI, a 2D client, a 3D client and a voice-only client could all consume it.

## 3. Stack

| Concern | Choice |
| :--- | :--- |
| Build | Vite + TypeScript (unchanged, see `ARCHITECTURE.md` 2.1) |
| World and game loop | **Phaser**: scenes, input, camera, tilemaps, collision |
| UI | **React**: HUD, chat, transcript, settings, mic controls |
| Map authoring | **Tiled**, exported as JSON |
| Shared state | zustand (unchanged) |
| Package manager | npm (unchanged) |
| Removed | `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`, `simplex-noise` |
| Keep for now | `leva` only if still useful for tuning, otherwise remove |

Phaser is new to the project's author. Versions are pinned at install time and recorded in the first scaffold task, not decided here.

## 4. Architecture

Two layers, as before, with the world swapped:

| Layer | Tech | Contains |
| :--- | :--- | :--- |
| **World** | Phaser canvas | Tilemap, characters, NPCs, props, camera, collision, depth sorting, proximity detection |
| **HUD** | React DOM over the canvas | Chat and transcript, speech bubbles, corrections, mic and voice toggle, settings, connection status |

**State boundary** (carried over from `ARCHITECTURE.md` 2.3):

- **Per-frame data** (positions, animation state, camera) lives inside Phaser scenes and never goes through React state.
- **Shared, UI-relevant state** (voice on or off, the active conversation target, the current transcript, connection status, the NPCs in range) lives in a small zustand store that both Phaser and React read.
- **Engine events** arrive over the WebSocket, are validated and typed in one adapter module (`src/engine/`), and update the store. Scene objects react to the store and do not talk to the socket themselves.
- **Speech bubbles and world-anchored UI** are DOM elements positioned from Phaser's camera and world coordinates, so text stays crisp and accessible.

React mounts the Phaser game into a container element and owns its lifecycle. Communication between the two goes through the store and a small typed event channel, not through direct references.

## 5. The world

### 5.1 Look and feel

- Top-down view with **footprints**. Every object has a small collision shape at its base that is separate from its sprite, so the learner walks behind a post but not through a box.
- Render order is sorted by the footprint's y-position. Overhead pieces (arch tops, awnings) draw on a layer above the player.
- **Elevation levels** model tiered areas. Each level has its own collision set. Stairs are transition zones that switch the player's level. No true 3D.
- **Paper style:** a near-monochrome palette with a light and a dark theme (a palette swap). Semantic colors (red, green, yellow) are reserved for corrections, actions and highlights, so they stand out from the world.
- The reference for feel is *Eastward*'s walking, layering and boundaries. Its lighting and rendering effects are out of scope for now.

### 5.2 Interaction

- Controls: keyboard on desktop, and a virtual stick or tap-to-move on mobile. Tap-to-move with pathfinding also helps accessibility.
- The learner walks up to NPCs. Entering range highlights the NPC's **shadow** to show it is interactable. The same highlight extends to a group.
- Proximity is detected by the wrapper. Interacting calls the engine's `converse(learner, npc)` (the final API is settled by the session model spike). The engine never sees distance.
- A consistent compass appears in the HUD, and NPC context can refer to landmarks and relative layout.

### 5.3 Voice

Voice is a first-class mode. It is a **world-level toggle** that applies to every NPC and character the learner talks to. Capture, voice activity detection, streaming and playback belong to a wrapper audio layer, separate from the renderer, as described in `ARCHITECTURE.md` section 4. Mobile browsers need early attention: audio contexts need a user gesture, iOS Safari is strict, and the microphone permission flow needs care.

### 5.4 First slice

One small town plaza with a few NPCs, a voice toggle, and enough features to test the main mechanics:

- Tiered sections connected by stairs (elevation levels).
- A few small buildings.
- A central fountain (an obstacle to walk around).
- An arch with two base footprints and an overhead layer, so the learner can walk through the middle.
- Proximity highlight and a conversation with an NPC, in text and by voice.

The first build is scenario A and B from the engine design (one learner with one NPC, then one learner with many NPCs), with the world shaped so that scenario C (many learners) fits later.

## 6. World data

"Map data" is three different things:

1. **World definition: static files, versioned.** Tilemap, tilesets, collision footprints, layers, elevation, spawn points, and where NPCs and objects are anchored. Authored in Tiled, exported as JSON, and served as immutable assets by `world_id@version` from the CDN. A session records its world and version, so all participants load identical data and old sessions do not break when a map changes.
2. **Live world state: backend, per session.** Who is where, which NPCs are in a conversation, and any mutable objects. Positions sync over a presence channel in the `crowspeak` backend, not through the engine gateway. Movement can start client-predicted with light server validation at a low tick rate.
3. **Per-learner state: backend.** Relationships, progress and unlocks.

The wrapper maps an engine `npc_id` to a spawn anchor in the world definition. The engine knows participants, never coordinates.

If worlds become authored by others, only the source of the manifest changes (bundled files to backend-served URLs). The `world_id@version` loader stays the same.

## 7. Sessions

- **Multi-user sessions are instanced and ephemeral.** A session is created, learners join it (for example by invite), and it disappears after the last learner leaves. Live world state and unsaved conversations go with it. Per-learner data, including the relationships the engine writes, survives in the backend.
- **Persistent worlds** may exist later for an individual solo learner only. They are not part of the first work.
- The wrapper owns session creation, invites and teardown. The engine needs `join` and `leave` to behave correctly, including when the last participant leaves.

## 8. What changes in this repo

- **Archive, then replace.** The R3F spike in `apps/web` (`src/world`, `src/player`, the terrain and surface helpers, the sky dome) is preserved on a separate branch before it is removed. The branch name is recorded in the archive task.
- **`ARCHITECTURE.md`** gets dated notes marking sections 2.2, 2.3 and 3 as superseded, and a decision log entry. Nothing is rewritten silently.
- **`apps/web/docs_claude/SPIKE_OVERVIEW.md` and `REPO_SETUP.md`** describe the R3F spike. They stay as history once the code is archived, and a short pointer to this doc is enough.
- **Layout under `apps/web/src`** changes from `world/player/npc/hud/store/lib` to roughly: `world` (Phaser scenes and entities), `hud` (React), `store`, `engine` (WebSocket adapter), `audio`, and `lib` (pure helpers such as pathfinding and footprint math).
- **Assets** keep the existing rule: only redistributable licenses, with sources tracked in `CREDITS.md`.
- **Superseded idea:** "keep the world deterministic from a seed" (`ARCHITECTURE.md` section 3) is replaced by versioned world definitions.

## 9. Open questions

- **Art pipeline:** hand-drawn, a licensed tileset, or generated. This sets the pace and must respect the public-repo license rule.
- **Tile size and pixel density:** needs a quick test on phones and desktop before assets are made.
- **Movement sync:** client prediction plus server validation versus something simpler for the first multi-user build.
- **Protocol types:** generate TypeScript types from the `crowspeak-core` schemas (preferred) or hand-maintain them.
- **Performance budget:** the devices and frame rate we commit to.
- **Pathfinding approach** for tap-to-move across elevation levels.
- **Future R3F wrapper:** the archived branch is the starting point if it returns, and the engine contract already supports it.

## 10. Risks

1. **Scope creep toward a game.** A world with a map, collisions, NPC placement and art is real production work. The first slice is one polished plaza, not a town.
2. **Art production.** Even a monochrome style needs a consistent method for tiles, characters and animation.
3. **Multiplayer later.** Shared positions need server-side presence. Keep world state separable from rendering from the start.
4. **Mobile audio.** Autoplay rules, iOS audio contexts and microphone permissions should be prototyped early, alongside the voice latency spike in `crowspeak-core`.

## 11. Decision log

| Date | Decision |
| :--- | :--- |
| 2026-11-04 | Replace the R3F 3D planet with a 2D top-down walkable world: Phaser for the world, React for the HUD. |
| 2026-11-04 | The engine stays frontend-agnostic. It emits semantic events only, with no positions, sprites or tile data. |
| 2026-11-04 | Paper-style, near-monochrome art with light and dark themes. Semantic colors are reserved for corrections and actions. |
| 2026-11-04 | World definitions are static, versioned (`world_id@version`, Tiled JSON). Live presence and per-learner state live in the backend. |
| 2026-11-04 | Multi-user sessions are instanced and ephemeral. Persistent worlds, if any, are solo only and later. |
| 2026-11-04 | Voice is first class, as a world-level toggle. The first slice is one small plaza with a few NPCs. |
