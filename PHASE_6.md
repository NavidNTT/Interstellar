# Phase 6 — versioned catalog and browser coverage

## Scope and delivered behavior

The client now requests `/api/v1/celestial-bodies` and `/api/v1/missions`. Laravel publishes four v1 read routes and retains all four original `/api` routes with their original names as compatibility aliases. Both route groups use the existing controllers and API Resources; no production schema or serialization implementation is duplicated. Existing loading, shared paired requests, validated adapters, five-second timeout, explicit retry, successful empty catalogs, and labeled local fallback are preserved. Selection, details, camera travel, Escape priority, and client-local progress keep their existing behavior.

Both repositories were clean before editing. The backend is now an independent Git repository, superseding Phase 5's historical note that it had no Git repository. No repositories, remotes, dependencies, environment files, or development records were replaced. No write endpoints, authentication, accounts, administration, server progress, or analytics were added.

Installed versions verified from dependencies: Next.js 16.4.2, React 19.3.0, Laravel 13.38.0, PHP 8.3.30, PHPUnit 12.5.40. Node used for validation: 24.21.0. No dependency upgrades.

## Version 1 request and response contract

Requests use `Accept: application/json`, no credentials, no authorization, and no request body. These collections are unpaginated; no query parameters or filters are part of v1.

| Canonical GET route | Compatibility GET route | Named routes | Success |
| --- | --- | --- | --- |
| `/api/v1/celestial-bodies` | `/api/celestial-bodies` | `v1.bodies.index`, `bodies.index` | `{"data":[Body,...]}` |
| `/api/v1/celestial-bodies/{body}` | `/api/celestial-bodies/{body}` | `v1.bodies.show`, `bodies.show` | `{"data":Body}` |
| `/api/v1/missions` | `/api/missions` | `v1.missions.index`, `missions.index` | `{"data":[Mission,...]}` |
| `/api/v1/missions/{mission}` | `/api/missions/{mission}` | `v1.missions.show`, `missions.show` | `{"data":Mission}` |

GET success is 200 with `Content-Type: application/json`. HEAD is supported with GET semantics and no body. OPTIONS is handled by CORS. Empty collections are exactly `{"data":[]}` with 200. There is no top-level pagination or metadata. Route parameters are stable slugs matching `[a-z0-9]+(?:-[a-z0-9]+)*`, not database IDs. Unknown, inactive, and syntactically invalid slugs return 404. Only active bodies and missions are public. Body collection order is ascending `scene_orbit_radius`; mission collection order is ascending internal creation ID (the ID itself is private). No tie order is promised for bodies at equal orbit radii.

`Body` has exactly these public fields. All fields are required and non-null:

| Fields | JSON type and meaning |
| --- | --- |
| `slug`, `name` | Nonempty strings; stable identifier and display name |
| `type` | `"star"` or `"planet"` |
| `short_description`, `full_description` | Nonempty display strings |
| `diameter`, `mass`, `gravity`, `average_temperature`, `distance_from_sun`, `orbital_period`, `rotation_period`, `number_of_moons`, `number_of_planets`, `atmosphere`, `composition` | Nonempty display strings, including units, notation, ranges, or unavailable labels; counts are strings too |
| `color` | String matching `#[0-9a-fA-F]{6}` |
| `scene_radius` | JSON number greater than 0 and at most 10; representative scene size |
| `scene_orbit_radius` | JSON number from 0 through 100; representative orbit distance, distinct from scientific `distance_from_sun` |
| `interesting_facts` | Nonempty JSON list of nonempty strings |

`Mission` has exactly `slug`, `title`, `description`, `objective`, `category`, `difficulty`, `estimated_duration`, `completion_label`, `destinations`. All except `destinations` are nonempty strings. Category is `observation`, `travel`, or `science`; difficulty is `introductory` or `standard`. Duration is display text, not a numeric timer. `destinations` is a nonempty JSON list in contiguous sequence order starting at 1; each item has exactly:

```json
{"slug":"survey-earth","body_slug":"earth","sequence":1,"kind":"visit","objective":"Arrive at Earth"}
```

Destination `slug` and `body_slug` follow the same slug syntax. A destination slug is unique within its mission. `sequence` is a positive JSON integer; `kind` is `visit` or `inspect`; `objective` is nonempty display text. `body_slug` references an active body. For example, `inner-survey` has Earth at sequence 1 and Mars at sequence 2, regardless of database insertion order. Internal IDs, foreign keys, timestamps, active flags, and credentials never appear. The existing Resources validate records before publishing; malformed records fail the request instead of silently becoming a partial catalog.

Error bodies are exactly `{"error":{"code":"...","message":"..."}}`:

| HTTP | Code | Exact message | Trigger |
| --- | --- | --- | --- |
| 404 | `not_found` | `The requested resource was not found.` | Unknown/inactive/invalid slug or unknown API route |
| 405 | `method_not_allowed` | `This API is read-only.` | Unsupported method on a read route; `Allow: GET, HEAD` retained |
| 503 | `service_unavailable` | `Catalog storage is temporarily unavailable.` | Database query failure |
| 500 | `catalog_error` | `The catalog could not be loaded.` | Invalid catalog, missing/inactive destination, noncontiguous itinerary, other internal error |

These application errors omit SQL, stack traces, database paths, and exception details even with debug enabled. Infrastructure errors before Laravel (proxy failures, maintenance, TLS, etc.) may differ; the frontend safely falls back on non-2xx or invalid responses.

CORS applies to both route groups through `api/*`. `FRONTEND_ORIGINS` is a comma-separated exact-origin allowlist (scheme, host, port; no paths/trailing slash). Allowed methods: GET, HEAD, OPTIONS; allowed request headers: Accept, Content-Type; preflight max age: 600 seconds; credentials: false. Unlisted origins receive no allow-origin header. CORS is a browser policy, not authentication: these catalogs are public.

Contract tests intentionally pin wire keys/types independently of Resource field selection so an accidental Resource change fails tests. Resources remain the sole public serializer. Tests cover collection/detail parity, both aliases, empty arrays, active visibility, order independent of insertion, all existing error classes, method headers, and CORS on both versions. A breaking future change should use another URL version; no legacy removal is scheduled. The current frontend still supports only the Sun/Earth/Mars scene and ignores additional unsupported body slugs under its existing validation policy.

## Environment and production operations

The practical target is two independently deployed services behind HTTPS: a Node Next server and a PHP web server/PHP-FPM Laravel application. This is a deployment recipe, not a verified hosting deployment. Review actual platform support before rollout.

Frontend configuration:

```dotenv
# Development, in ignored .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
# Production build environment, example only; replace with a real public host
# NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api
```

The base includes `/api`, **not `/v1`**; resource clients append `v1/...`. Existing Phase 5 environment files work without editing. A custom path prefix is allowed if the proxy maps it to Laravel's `/api`. Only absolute HTTP(S) URLs without credentials/query/fragment pass validation. Missing configuration uses the local catalog. Production must use HTTPS to avoid mixed-content blocking. A browser-facing localhost URL addresses the user's own computer; private container DNS is also unsuitable for this public value. NEXT_PUBLIC values are inlined at build time and frozen in the browser bundle: changing them requires rebuilding and redeploying, not just restarting. Never place `APP_KEY`, database paths, passwords, or private service configuration in any NEXT_PUBLIC variable, client prop, or `next.config` `env` entry. The frontend requires no backend secret.

Backend production environment, example values only:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.example.com
APP_KEY=<existing securely provisioned application key>
DB_CONNECTION=sqlite
DB_DATABASE=/srv/interstellar-data/catalog.sqlite
FRONTEND_ORIGINS=https://explore.example.com
LOG_CHANNEL=stack
LOG_STACK=single
LOG_LEVEL=warning
CACHE_STORE=database
SESSION_DRIVER=database
QUEUE_CONNECTION=sync
```

Remove any conflicting `DB_URL` or set it empty. Preserve APP_KEY for an existing environment; generate it only for a new one. Inject secrets using the platform secret store or a protected backend `.env` outside public access. Do not copy backend `.env` into the frontend. Development CORS defaults allow localhost/127.0.0.1 on ports 3000/3010; production must explicitly replace them with actual deployed origins, never `*`. No queue worker is needed for the current catalog; sync avoids implying an unconfigured worker. Existing database cache/session tables are included in the migrations, though these stateless read routes do not create player sessions.

Deployment sequence (run on the target environment, **not executed against a production host here**):

1. Provision supported Node (Next requires >=20.9; validation used 24.21), PHP >=8.3 with required Laravel extensions including PDO SQLite, Composer, and a TLS web server. Use the lockfiles. Install backend dependencies with `composer install --no-dev --optimize-autoloader --no-interaction`; run `composer check-platform-reqs --no-dev`. Avoid the starter `composer setup` shortcut because it generates keys and runs migrations automatically.
2. Configure Laravel environment and persistent volume first. Point the web server document root only at backend `public/`, forwarding application requests to `public/index.php`. Deny access to dotfiles, vendor, storage, and databases. Grant the service user the necessary access to `storage/`, `bootstrap/cache/`, and the SQLite file **and its directory** for journals; do not use world-writable permissions. Serve Next behind a TLS reverse proxy and bind its Node port to a private interface.
3. Inspect `php artisan config:show database.default` and `php artisan config:show database.connections.sqlite`. Verify SQLite, exact intended persistent absolute file path, and no DB_URL override **before every migration/seed**. Stale config caches can override new environment values: clear/rebuild cached configuration deliberately, then verify again. Back up existing data first. For a new environment create the SQLite file only if missing, on the persistent volume; never truncate an existing file.
4. Run `php artisan migrate:status --no-interaction`, then `php artisan migrate --force --no-interaction`. On first provisioning seed deliberately with `php artisan db:seed --class=ExplorationSeeder --force --no-interaction`. This upserts curated slugs and their destinations; it preserves unrelated records but can overwrite edited curated fields. Do not blindly seed every release. Never use `migrate:fresh`, `db:wipe`, resets, or rollback as a normal deployment step.
5. With final environment values, run `php artisan config:cache --no-interaction`, `php artisan route:cache --no-interaction`, and `php artisan view:cache --no-interaction`. Recheck configuration and `php artisan route:list --path=api --no-interaction`; serve PHP via the supervised web server/FPM, not `artisan serve`. Keep logs private and rotate them. Configure TLS proxy trust narrowly for the actual proxy topology if required; no broad trust change was added here.
6. In the separate frontend release, run `npm ci`, set the production public API base **before** `npm run build`, then supervise `npm run start -- --hostname 127.0.0.1 --port 3000`. On Windows use `npm.cmd`. Retain the `.next` build and required dependencies; no static-export or standalone-output configuration was introduced. Preserve the existing Cache Components configuration using the standard Node server. Keep old assets available during rollout if using a CDN or rolling releases.
7. Deploy the compatible backend before the v1 frontend. Check `/up` for Laravel liveness, both versioned collections and details for actual database readiness, expected origin/preflight headers, rejected origins, errors, and the frontend connected notice. `/up` alone does not establish catalog/database health. Exercise an unavailable API and retry. Revert the frontend release if needed; legacy aliases allow the previous frontend to remain functional. Do not roll back the database destructively.

SQLite must live outside ephemeral release/container storage and be deliberately mounted across restarts. Use a single persistent database writer/migration coordinator; independent replicas with separate SQLite files will diverge. Back up using SQLite's online backup facility or a consistent stopped-service snapshot, including journal/WAL state where appropriate; copying only a live `.sqlite` file can be inconsistent. Define retention and periodically restore to a separate file to verify recovery. Preserve application keys and restore permissions too. No backup/restore or provider persistence configuration was executed here. Reassess storage architecture separately if multi-node writes or catalog scale require it.

Guidance checked against the installed Next 16.4.2 guides (`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`, `self-hosting.md`, and `01-app/01-getting-started/17-deploying.md`), installed Laravel configuration/routing, and official Laravel 13 deployment/configuration documentation. The backend's referenced `testing-best-practices` skill was not present in the available skills or searched local skill directories; existing guarded PHPUnit conventions were followed.

## Browser automation and isolation

`node tests/run-browser.mjs` performs an actual production build using the test API base, checks that its three ports are free, creates a unique OS temporary SQLite file and Chrome profile, prints the configured connection/path, migrates and seeds that file, and starts PHP's local server and Next production server. It bypasses any existing Laravel config/route cache using temporary cache paths, passes explicit SQLite/empty DB_URL settings, and uses exact test CORS origin. No environment files are edited. Browser state is isolated; mission scripts clear only the disposable profile's localStorage. The runner stops only its owned process trees in `finally`, removes its database/profile, and leaves screenshots at the printed temporary path. The final production build artifact contains the test API URL; rebuild with your intended URL before normal use/deployment.

Defaults: frontend `http://localhost:3010`, isolated API `http://localhost:8016/api`, Chrome debugging `http://127.0.0.1:9338`. Optional runner overrides: `BROWSER_BACKEND_DIR`, `BROWSER_CHROME_PATH`, `BROWSER_FRONTEND_PORT`, `BROWSER_API_PORT`, `BROWSER_DEBUG_PORT`, `BROWSER_SCREENSHOT_DIR`. Default Chrome path is the standard Windows installation; override for another OS. The scripts require Node with native fetch/WebSocket support (24.21 used). Both suites can also attach independently using `MISSION_TEST_URL` and `BROWSER_DEBUG_URL`; API suite additionally uses `BROWSER_API_BASE`. Use only an isolated Chrome profile because storage is intentionally changed. Ports must be unoccupied; the runner does not stop unrelated servers. Abrupt OS termination cannot guarantee cleanup.

The expanded API suite reuses Phase 5's request interception and UI helpers. Genuine v1 Laravel requests are checked first; delayed/custom API content, deliberate connection failures, empty/malformed data, persistence, and exact paired request counts retain their earlier coverage. Across every viewport below, it checks loading, connected and fallback notices, scrollable mission and scientific dialogs, selection, nested Escape, real pointer actions on scrolled controls, travel cancellation/arrival/overview, and retry with retained progress. Actual application requests must be exclusively the two v1 collection URLs. Layout assertions examine page and container bounds, horizontal content overflow, notice text bounds/minimum font size, and clicked control bounds/hit targets; screenshots complement these assertions rather than proving all visual accessibility.

| Viewport | Mode |
| --- | --- |
| 1440 × 900 | Desktop |
| 768 × 1024 | Tablet emulation |
| 375 × 812 | Narrow mobile emulation |
| 320 × 568 | Small mobile emulation |

The mission suite retains existing filter, visit/inspection itinerary, focus containment, persistence/storage failure, nested Escape, scene drag, and dialog-scrolling checks. The runner runs it once with the isolated API and once after actually stopping that API and verifying connection refusal. API interception simulates failures in the expanded matrix; the final mission pass exercises real network unavailability.

## Validation results

Executed on October 24, 2026:

| Command/check | Result |
| --- | --- |
| `git status --short` in both repositories before edits | Both clean |
| `composer show --direct`, installed package metadata, `node --version`, `php --version` | Versions recorded above; no installs/upgrades |
| Backend `php artisan config:show database.default` and `database.connections.sqlite` | Development connection SQLite; exact path `C:\laragon\www\interstellar-api\database\database.sqlite` verified read-only |
| Backend `php artisan migrate:status --no-interaction` | All six existing migrations applied; no development migration/seed run |
| Backend `php artisan test --compact --filter=ExplorationApiTest` | 18 tests passed, 974 assertions |
| Backend `php artisan test --compact` | 20 tests passed, 976 assertions, including starter tests |
| Backend `php artisan route:list --path=api --no-interaction` | Eight GET/HEAD routes: four legacy, four v1, expected names |
| Backend `php vendor/bin/pint --dirty --format agent` | Passed; test import/PHPDoc formatting applied, final rerun clean |
| Frontend `npm.cmd run lint` | Passed |
| Frontend `npx.cmd tsc --noEmit` | Passed |
| Frontend `npm.cmd test` | 16 tests passed, zero failures/skips |
| `node tests/run-browser.mjs` | Passed: isolated database config verification and six migrations/seeding, Next production build, expanded API suite, mission suite online, mission suite after actual API shutdown |
| Runner build: `node node_modules/next/dist/bin/next build` | Passed; `/` and `/_not-found` generated as static routes |
| Final `npm.cmd run build` using the unchanged local environment | Passed; restores the normal local API build configuration after isolated browser testing |
| Final `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `node --check tests/run-browser.mjs` | Passed after the test harness updates |
| `git diff --check` in both repositories | Passed; frontend Git reports only normal LF-to-CRLF conversion notices |
| Final listening-port and temporary-file audit | No listeners on 3010/8016/9338; successful-run database and Chrome profile absent |

The runner's final complete successful run used a newly created OS temporary `browser.sqlite`, API port 8016, frontend port 3010, and Chrome debugging port 9338. All four viewport matrix entries passed, including loading, connected/fallback, retry, pointer hit tests, dialog bounds and horizontal overflow checks. No application console errors or runtime exceptions were recorded. Browser-level Chrome background service/extension/updater diagnostics and network failures from deliberate API outages are separate from application console errors.

Thirteen screenshots were captured automatically (one initial mobile fallback plus connected-details, fallback, and fallback-details at each of four sizes). Focused visual review used `320-fallback.png`, `320-fallback-details.png`, `768-connected-details.png`, and `1440-connected-details.png`: fallback text/retry fit at 320 pixels; scientific-dialog headers, close controls, related mission text, and scroll areas fit the respective viewports. Content below scroll boundaries is intentionally scrollable. This was tool-assisted screenshot inspection, not an exhaustive human-operated manual test. Other captured screenshots were not manually reviewed. The successful run's screenshots remain outside the repositories under the printed OS temporary directory `interstellar-phase6-w8tFLL/screenshots`.

Intermediate validation failures were resolved: a sandboxed full backend run could not append backend logs/result cache, then passed with authorized filesystem access; the first temporary PHP server used the wrong working directory, corrected to `public/`; the existing mission script's fixed 600 ms reload wait raced catalog hydration when checking corrupted storage, replaced with an explicit resolved-catalog wait. No product validation, CORS, error sanitization, or database protection was weakened. The complete browser sequence passed after these corrections.

Final Git status matches the inventory below. Temporary staging was removed; the unchanged local environment was used for a final successful production rebuild so the delivered local build no longer targets the disposable API. The cleanup containment assertion was subsequently exercised by the complete final-code browser run recorded below. The Next.js feedback reporting pass found no qualifying new framework issue; the resolved issues above were test harness/sandbox setup, not Next.js feedback candidates.

### Final delivered-code verification — October 24, 2026

This verification reran the delivered code without source/configuration edits or added features. Only this report was updated. Existing Phase 6 working-tree changes in both repositories were preserved. The runner's SHA-256 before and after was `76AF1A68DDA45E1C2161BFD18B68438F6B3941F5E3702BC169C87D1A167DB985`, confirming that the last cleanup containment assertion was present throughout the actual run.

| Command/check | Exact result |
| --- | --- |
| Backend `php artisan config:show database.default` and `database.connections.sqlite` | Confirmed normal development SQLite path `C:\laragon\www\interstellar-api\database\database.sqlite`; no normal-environment migrations or seeding |
| `node tests/run-browser.mjs` | Exit 0; final delivered code passed, including the cleanup containment assertion |
| Isolated runner setup | New `%TEMP%\interstellar-phase6-jlsdwo\browser.sqlite`; printed configuration confirmed SQLite and this exact temporary path before six migrations and `ExplorationSeeder`; no DB_URL override |
| Runner production build | Passed on Next.js 16.4.2; `/` and `/_not-found` generated |
| `node tests/api-browser.mjs` under the runner | Passed all existing API scenarios and responsive loading/connected/fallback/retry, pointer actions, details/missions, nested Escape, travel cancellation/arrival/overview, and retained progress at 1440×900, 768×1024, 375×812, 320×568; no application console errors |
| `node tests/mission-browser.mjs` with isolated API online | Passed mission flows, cancellation, focus, Escape, persistence/storage failures, scene drag, and all four responsive layouts; no application console errors |
| API shutdown and second mission pass | Runner verified actual connection refusal after stopping its API; the same mission suite then passed with local fallback, including all four responsive layouts; no application console errors |
| Cleanup containment and artifact audit | Runner exited successfully after all four containment checks; `chrome`, `browser.sqlite`, `browser.sqlite-wal`, and `browser.sqlite-shm` absent from its owned temporary directory; only `screenshots/` remains with 13 PNGs, intentionally retained |
| Prior temporary artifacts | All three pre-existing `interstellar-phase6-*` directories preserved; all 26 existing screenshot files retained identical SHA-256 hashes |
| Process ownership and shutdown audit | Source review confirmed shutdown operates on recorded spawned children using PID-scoped `taskkill /PID <owned-child> /T /F`, skipping exited children; no process-name kill or unrelated-server shutdown. All 19 pre-existing relevant processes (12 Chrome, 5 Node, 2 PHP) remained present, with available start times matching. Authorized OS audit found no runner-specific processes and no listeners on 3010, 8016, or 9338 |
| Development database integrity | Before/after SHA-256 identical: `DCDCED7E0AABA8E3703A73859AF96735994E086034C5496D66290A9ADDEF0459`; size unchanged at 192,512 bytes; last write unchanged at `2026-10-22T23:53:08.1475030Z`; no database WAL/SHM/journal sidecars appeared |
| Local environment integrity | All four existing `.env*` files across both repositories retained identical SHA-256 hashes; no environment file was edited |
| Post-browser `npm.cmd run build` | Exit 0 using the unchanged normal local environment (`.env.local`); compiled successfully and generated `/` and `/_not-found` |
| `rg --files-with-matches --fixed-strings 'http://localhost:8016/api' .next/static .next/server` after normal rebuild | Exit 1 with no output, the expected no-match result: disposable API base absent from served static/server output |
| `rg --files-with-matches --fixed-strings 'http://localhost:8000/api' .next/static/chunks` after normal rebuild | Exit 0; normal local API base found in `.next/static/chunks/2k5iwqi0fq5ie.js` |

Baseline was captured at `2026-10-24T05:20:21Z`; post-run integrity audit at `05:23:26Z`; final authorized Windows process/listener audit at `05:25:13Z`. The disposable database/profile were observed during execution and confirmed absent afterward. Ownership verification combines the runner's cleanup code with before/after artifact hashes, preserved pre-existing processes, and the final OS query; a complete live descendant-process snapshot was not captured. Initial read-only observation probes encountered inaccessible process start times/CIM access under the sandbox and an unsuitable IPv6 socket probe; nullable timestamps and an authorized OS process/listener query resolved those observation limitations. The browser runner and normal build themselves had no failures, and no code correction was necessary.

The 13 new screenshots remain under `%TEMP%\interstellar-phase6-jlsdwo\screenshots`. This final pass was automated verification; no additional screenshot/manual review, physical-device, Safari, Firefox, or production-deployment testing was performed. Earlier focused screenshot-review results above remain historical results from the prior run. The final Next.js feedback review found no new qualifying framework issue.

## Complete Phase 6 source/config/test inventory

Frontend created: `PHASE_6.md`, `tests/run-browser.mjs`.

Frontend modified: `README.md`, `.env.example`, `lib/api/celestialBodies.ts`, `lib/api/missions.ts`, `tests/api-catalog.test.mjs`, `tests/api-browser.mjs`, `tests/mission-browser.mjs`.

Backend modified: `routes/api.php`, `tests/Feature/ExplorationApiTest.php`, `README.md`.

No backend source files were created. Existing Resources, controllers, models, migrations, seeders, CORS configuration, error handler, test database protections, lockfiles, and local environment files remain unchanged. Temporary implementation staging files are removed before delivery. Build output, TypeScript cache, backend test result cache/logs, and disposable browser artifacts are generated/local artifacts rather than source changes.

## Limits and deferred work

No production host, TLS termination, real persistent-volume deployment, backup restore, physical device, Safari, or Firefox was tested. Chrome viewport emulation does not establish physical touch behavior. This is a focused regression pass, not exhaustive manual usability/accessibility certification. Pagination, future API versions, provider-specific manifests, authenticated writes, and server-side progress remain outside scope. Local progress remains browser-local and user-editable with no cross-device synchronization.
