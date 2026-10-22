# Phase 4 implementation report

Implemented a local, typed mission system integrated with the existing solar system. No backend, network data source, account system, or additional game economy was added.

## Behavior

- Browse all five missions from the selection panel, including from overview.
- Scientific details show missions related to the selected body and a button to browse all missions.
- Filter the mission browser by Sun, Earth, or Mars. Cards display category, difficulty, duration, description, objective, destinations, steps, status, and explicit actions.
- Start a mission without changing selection, camera, or travel state. View Destination selects its current body and closes information panels. Press the existing travel button to begin travel.
- One mission may be active. Competing starts are disabled and rejected by the reducer. Finish or explicitly abandon the current mission before starting another. Abandon clears its partial steps and preserves completed missions.
- Completed missions remain visible and cannot be restarted. Active objectives remain visible in the main selection panel.

## Definitions and progress

`Mission` contains `id`, `title`, `description`, `objective`, `destinationBodyId`, `category`, `difficulty`, `estimatedDuration`, `completionLabel`, and a nonempty ordered tuple of steps. Each step has `id`, typed `bodyId`, `kind` (`visit` or `inspect`), and `label`.

Category is `observation | travel | science`; difficulty is `introductory | standard`. Status is derived as `locked | available | active | completed`, keeping static definitions separate from saved progress. Missing destination data locks a mission safely. Unknown mission/body lookups return no result.

```ts
type MissionState = {
  activeMissionId: string | null;
  completedMissionIds: string[];
  completedStepIds: string[];
};
```

Reducer actions are `START_MISSION`, `RECORD_OBJECTIVE`, and `RESET_ACTIVE_MISSION`. Completion is atomic with recording the final matching objective; there is no public action that can force completion without satisfying the steps. The current destination is derived from the first unfinished step. Only the active mission receives progress. Prior visits are not retroactive.

Central definitions:

| Mission | Objective sequence |
| --- | --- |
| First Contact | Arrive at Earth |
| Red Planet Approach | Arrive at Mars |
| Solar Observation | Arrive at the Sun's representative observation point |
| Inner System Survey | Arrive at Earth, then Mars |
| Stellar Neighborhood | Open scientific details for Sun, then Earth, then Mars |

## Travel integration

The existing camera completion callback records a `visit` only for successful `to-body` travel, then completes the existing travel transition. Cancellation and return-to-overview do not record visits. Camera implementation and travel reducer are unchanged. Details opening records an `inspect` event. Starting an inspection mission inside already-open details requires reopening the requested profile, as explained by its objective.

Out-of-order events, wrong objective kinds, unrelated bodies, repeated starts, repeated arrivals, and unknown IDs leave progress unchanged. Selecting another body, closing information panels, and returning to overview preserve the active mission. View Destination never starts an animation and is disabled during travel.

## Persistence

Only the three progress fields are stored under `interstellar:mission-state:v1`. Loading occurs in an effect after hydration; the initial server and client renders agree. A ready guard prevents writes before loading and prevents premature mission starts. Validation checks known mission IDs, uniqueness, active/completed conflicts, valid destinations, and an exact unfinished prefix of the active itinerary. Corruption resets to a clean state. Read/write exceptions retain usable in-memory progress. No Three.js objects are stored.

## Dialogs, accessibility, and responsive behavior

Scientific details and mission browser share a native `dialog` wrapper. It provides dialog semantics, associated headings, a focused close button, inert background content, keyboard focus containment, and focus restoration to a connected opener. Explicit Tab wrapping keeps focus in the panel. Escape is handled on the top dialog before its native default action, preventing nested dialogs from closing together. After panels close, the existing travel/selection Escape handler resumes. Modal cleanup closes its dialog on unmount; effects remove listeners normally.

The mission browser can sit above scientific details: Escape first closes missions, then details, then applies the existing travel/selection behavior. Opening mission UI never changes OrbitControls settings.

Panels retain the dark palette, subtle borders, gray supporting text, warm active accent, and text-based AVAILABLE/ACTIVE/COMPLETED/LOCKED statuses. Buttons have a 44-pixel minimum height, disabled styling, and visible keyboard focus. Cards wrap long text; dialog content is keyboard focusable and scrollable with dynamic viewport height limits. Desktop panels have a 36rem width cap; narrow viewports keep 12-pixel margins. The selection panel also scrolls on short screens.

## Complete created file list

- `features/missions/types/mission.ts`
- `features/missions/data/missions.ts`
- `features/missions/utils/missionProgress.ts`
- `features/missions/hooks/useMissionState.ts`
- `features/missions/components/MissionCard.tsx`
- `features/missions/components/MissionList.tsx`
- `features/missions/components/MissionBrowser.tsx`
- `features/solar-system/components/ExplorationDialog.tsx`
- `tests/mission-progress.test.mjs`
- `tests/mission-browser.mjs`
- `PHASE_4.md`

## Complete modified file list

- `app/globals.css`
- `features/solar-system/components/BodyDetails.tsx`
- `features/solar-system/components/SelectionPanel.tsx`
- `features/solar-system/components/SolarSystemScene.tsx`

## Commands and validation

Executed the required commands through Windows command shims because PowerShell blocks the installed npm/npx scripts:

- `npm.cmd run lint` — passed.
- `npx.cmd tsc --noEmit` — passed.
- `npm.cmd run build` — passed; production static route generation succeeded.
- `node --test tests/mission-progress.test.mjs` — seven tests passed, covering mission definitions, invalid/repeated starts, competing missions, duplicate completion, ordered travel/inspection, abandon, persistence round-trip, and invalid storage recovery.
- `npm.cmd run dev -- --port 3010` — used for initial browser validation.
- `npm.cmd run start -- --port 3010` — used for final production browser validation.
- `node tests/mission-browser.mjs` — Chrome DevTools Protocol regression checks against an isolated headless Chrome profile (port 9338). The test clears that profile's mission storage. It requires an already-running application and Chrome debugging session; set `MISSION_TEST_URL` to override its local application URL.
- Read the installed Next.js client component and client directive guides before implementation; inspected the existing Phase 3 scene, state, details, body data, camera, and styles.

Browser checks exercise overview, mission browsing and body filtering, explicit mission start with unchanged selection flow, travel cancellation without progress, completed arrival, scientific details, Tab containment, nested Escape, return to overview, ordered Earth/Mars travel, reload persistence mid-mission, ordered scientific inspections, corrupted storage, and unavailable storage. Layout assertions cover 1440×900, 768×1024, 375×812, and 320×568: scrollable content, cards within viewport, and no horizontal overflow. Mobile scientific details scrolling and scene dragging after dialogs close are also checked. Browser runtime exceptions and console errors are collected and must be empty.

These are automated real-browser checks. A 375-pixel mission-browser screenshot was visually reviewed. An exhaustive human-operated regression pass, physical touch-device checks, and other browsers were not performed. An existing Three.js Clock deprecation warning appeared during development; no mission runtime errors were observed.

One intermediate build encountered a locked file because the temporary Chrome profile was inside `.next`; closing the test browser resolved it and the production build passed on rerun. An initial nested-dialog Escape failure was fixed and verified. No qualifying Next.js framework feedback candidates remained in the final reporting review.

## Limits and Phase 5

Progress belongs to one browser origin/profile, without cross-tab synchronization or cloud synchronization. There is one active mission and no replay; abandoning resets partial progress. Steps are strictly ordered. Completed mission IDs are a local convenience, not authoritative or tamper-proof records. Scene scale and travel remain representative.

Recommended Phase 5: introduce a typed mission repository/storage adapter behind the existing definitions and reducer, with explicit schema migration and broader browser/device regression coverage. Keep the current local adapter until a future backend phase is separately authorized.
