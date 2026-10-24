# Phase 5 implementation report

## Delivered behavior

The frontend now prefers a typed, validated Laravel body and mission catalog while retaining the Phase 4 local data as a controlled fallback. The local scene renders immediately during loading. API failures, invalid responses, missing configuration, network loss, and five-second timeouts produce a compact fallback notice with an explicit retry action. Successful empty responses display an empty notice instead of silently substituting local records. There are no intrusive popups or scene-wide loading overlays.

Selection, scientific details, ordered travel/inspection missions, explicit travel, arrival completion, camera return, Escape priority, keyboard focus behavior, and localStorage persistence remain in place. Starting a mission does not change selection or start travel. Scientific profiles, mission cards, filtering, destination lookups, and mission reducer operations all consume the same catalog. Mission progress remains entirely client-side.

## Discovery and environment

- Frontend: `C:\laragon\www\interstellar`.
- Backend: `C:\laragon\www\interstellar-api`.
- By the authorized continuation, a new Laravel starter already existed at the confirmed path. It was extended in place; no unrelated Laravel project was used or modified.
- Installed backend: Laravel 13.38.0, PHP 8.3.30, PHPUnit 12.5.40. Existing Composer dependency constraints were retained.
- Frontend: Next.js 16.4.2, React 19.3.0, TypeScript, Tailwind, React Three Fiber, Drei, and Three.js; no frontend dependency was added.
- Verified development database: `C:\laragon\www\interstellar-api\database\database.sqlite`, using SQLite. The existing environment was preserved and the previously implicit SQLite path was made explicit by appending `DB_DATABASE`.
- The frontend initially had no environment file. A public API URL was added to ignored `.env.local`; `.env.example` is tracked.
- Backend `AGENTS.md` required Laravel Boost installation. Boost and its dependencies were installed as development dependencies, and its required guidelines were generated and read before implementation. No dependency upgrade unrelated to Boost was performed.

## Database schema and relationships

All three tables have internal auto-increment IDs and timestamps. API consumers use stable slugs rather than database IDs.

| Table | Columns and constraints |
| --- | --- |
| `celestial_bodies` | Unique `slug`; `name`; `type`; text short/full descriptions; display strings for diameter, mass, gravity, average temperature, distance from Sun, orbital/rotation periods, moon/planet counts; atmosphere/composition text; hex `color`; numeric `scene_radius` and `scene_orbit_radius`; JSON `interesting_facts`; indexed boolean `is_active` |
| `missions` | Unique `slug`; title; description/objective text; category; difficulty; estimated duration; completion label; indexed boolean `is_active` |
| `mission_destinations` | Mission foreign key with cascade delete; body foreign key with restrict delete; stable step `slug`; unsigned `sequence`; `kind` (`visit` or `inspect`); objective text; unique `(mission_id, sequence)` and `(mission_id, slug)` |

Scientific values stay strings because the current UI displays units, ranges, scientific notation, and unavailable-value labels. Geometry has separate numeric fields and remains representative; this phase adds no astronomical calculations. Required catalog fields are non-nullable. A mission's initial destination is derived from its first destination row, avoiding a duplicated body foreign key on missions.

Eloquent relationships have explicit `HasMany`/`BelongsTo` return types: Mission has many ordered destinations; MissionDestination belongs to Mission and CelestialBody; CelestialBody has many destinations.

The seed fixture preserves the existing local labels and scientific content. Transactional upserts by slugs create/update Sun, Earth, Mars, five missions, and eight objectives. Repeated seeding preserves unrelated records and does not create users or delete data. The existing starter's user/cache/job tables were left intact.

| Mission slug | Objective sequence |
| --- | --- |
| `first-contact` | Visit Earth |
| `red-planet` | Visit Mars |
| `solar-observation` | Visit Sun |
| `inner-survey` | Visit Earth, then Mars |
| `stellar-neighborhood` | Inspect Sun, then Earth, then Mars |

## API contract

Read-only named routes:

- `GET /api/celestial-bodies`
- `GET /api/celestial-bodies/{body}`
- `GET /api/missions`
- `GET /api/missions/{mission}`

Parameters are stable slugs constrained to lowercase alphanumeric segments with hyphens. Only active records are public. Resources transform explicit public fields; internal IDs, foreign keys, timestamps, and active flags are omitted. Mission destinations are eager-loaded with their bodies and ordered by sequence.

Collections use `{ "data": [...] }`; detail responses use `{ "data": {...} }`. For example, a mission's resource has this structure (abbreviated destinations for readability):

```json
{
  "data": {
    "slug": "inner-survey",
    "title": "Inner System Survey",
    "description": "Explore two rocky worlds in a short guided itinerary.",
    "objective": "Arrive at Earth, then travel to Mars.",
    "category": "travel",
    "difficulty": "standard",
    "estimated_duration": "1–2 minutes",
    "completion_label": "Inner system survey complete",
    "destinations": [
      { "slug": "survey-earth", "body_slug": "earth", "sequence": 1, "kind": "visit", "objective": "Arrive at Earth" },
      { "slug": "survey-mars", "body_slug": "mars", "sequence": 2, "kind": "visit", "objective": "Arrive at Mars" }
    ]
  }
}
```

Body resources expose `slug`, `name`, `type`, `short_description`, `full_description`, `diameter`, `mass`, `gravity`, `average_temperature`, `distance_from_sun`, `orbital_period`, `rotation_period`, `number_of_moons`, `number_of_planets`, `atmosphere`, `composition`, `color`, `scene_radius`, `scene_orbit_radius`, and `interesting_facts`.

Unknown, inactive, and invalid slugs return 404; unsupported methods return 405 with HTTP method headers preserved. Failed database queries return 503. Malformed catalog records, missing/inactive destinations, non-contiguous itineraries, or other internal failures return 500. Resource validation prevents malformed records from being silently presented as usable catalog entries. Empty collections return 200 with an empty `data` array.

```json
{"error":{"code":"not_found","message":"The requested resource was not found."}}
```

Other codes are `method_not_allowed`, `service_unavailable`, and `catalog_error`. API exceptions do not reveal stack traces, SQL, credentials, or connection details, even with development debugging enabled.

## Frontend architecture and progress

- `lib/api/client.ts`: shared request handling, public base URL validation, JSON envelope checks, safe typed errors, credential omission, timeout, and combined cancellation signals.
- `lib/api/celestialBodies.ts` and `missions.ts`: resource requests, outside presentational components.
- `lib/api/adapters.ts`: runtime validation of untrusted JSON and centralized snake_case-to-domain mapping. Domain-facing types remain the existing `CelestialBodyDetails` and `Mission`. The three supported body IDs remain Sun/Earth/Mars; unknown additional bodies are ignored, and wholly unsupported or malformed catalogs fall back safely. Mission and step slugs are not limited to the seed records.
- `features/exploration/catalogStore.ts`: one parallel request pair per provider load, shared across consumers, cached until explicit retry. Both catalogs are published atomically. Unmount aborts in-flight work; Strict Mode resubscription shares requests. Aborted work cannot publish late updates.
- `ExplorationDataProvider.tsx`: React context and `useSyncExternalStore` with a stable server snapshot, avoiding hydration mismatches.
- `CatalogNotice.tsx`: compact accessible loading/API/empty/fallback status and retry. Retry is disabled only during camera travel.

The versioned mission storage key remains `interstellar:mission-state:v1`. Hydration waits until the catalog resolves before validating active itineraries, avoiding overwriting progress with the initial local loading snapshot. Valid unavailable mission IDs and partial progress are retained across outages or empty catalogs. An unavailable active mission can be explicitly abandoned; retry can recover its catalog. If a known mission's itinerary changes incompatibly across reloads, only that incompatible active itinerary is reset; completed mission IDs are retained. A changed live itinerary cannot incorrectly complete older partial progress.

A small camera guard ensures catalog hydration cannot restart or discard an animation with the same travel request ID. The existing travel states and animation implementation are otherwise preserved. No mission progress is sent to Laravel.

## Environment and startup

Frontend `.env.local` (ignored) and `.env.example` (tracked):

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

There is no hardcoded production API URL in components. The environment value includes `/api`, is public, and requires a development restart or production rebuild when changed. Missing configuration uses local fallback without attempting an arbitrary server.

Backend uses `DB_CONNECTION=sqlite` and the verified absolute `DB_DATABASE` path. Omitting the database path uses the backend's own SQLite file. `FRONTEND_ORIGINS` is a comma-separated exact-origin allowlist, defaulting to localhost/127.0.0.1 ports 3000 and 3010. CORS allows GET/HEAD/OPTIONS and no credentials. Production must set its actual origins, `APP_ENV=production`, and `APP_DEBUG=false`. Existing environment secrets were not overwritten or included in reports.

Start the backend from its directory with `php artisan serve --host=127.0.0.1 --port=8000 --no-interaction`. Start the frontend with `npm.cmd run dev`, or use `npm.cmd run start -- --port 3010` after a production build. Testing servers and isolated Chrome were stopped after verification.

## Validation and executed commands

Backend discovery/setup included `php --version`, `php -m`, `composer --version`, `composer show --direct`, `composer require laravel/boost --dev --no-interaction`, and `php artisan boost:install --guidelines --no-interaction`. Artisan `make:model --migration --factory`, `make:seeder`, `make:controller`, `make:resource`, and `make:test --phpunit` generated the implementation stubs.

Backend validation:

- `php artisan config:show database.default` and `database.connections.sqlite`: verified SQLite and the exact authorized development path before migrations.
- `php artisan migrate --seed --no-interaction`: passed; only the three new migrations ran.
- `php artisan migrate:status --no-interaction`: passed; new migrations recorded alongside unchanged starter migrations.
- `php artisan db:seed --class=ExplorationSeeder --no-interaction`: passed; repeatable seeding verified.
- `php artisan route:list --path=api --no-interaction`: passed; four requested read-only routes.
- `php artisan test --compact`: nine tests and 68 assertions passed, including the starter tests. New feature tests cover seed idempotency and preservation of unrelated data, core records, detail responses, ordered travel/inspection destinations, empty data, unknown/invalid/inactive resources, malformed internal data, missing destinations, sanitized database failures, and allowed/rejected CORS origins.
- PHP formatting passed with Pint on the explicit changed-file list. `php vendor/bin/pint --dirty --format agent` was attempted as required by the generated guidelines, but this starter is not a Git repository; its documented alternative formatted only selected Phase 5 files.
- PHPUnit forces `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`, empty `DB_URL`, and testing environment. `Tests\TestCase` additionally refuses to start tests if configuration is not testing/in-memory SQLite, before database-refresh traits run. No `migrate:fresh` command was run against the development database; test database lifecycle work was confined to disposable in-memory SQLite.

Frontend validation:

- `npm.cmd run lint`: passed.
- `npx.cmd tsc --noEmit`: passed.
- `npm.cmd test`: fifteen tests passed, including the seven existing mission tests and eight API/catalog tests.
- `npm.cmd run build`: passed; static production routes generated successfully.
- `node tests/api-browser.mjs`: passed against the production frontend and running Laravel. It verified genuine API responses, exactly two requests per load/retry, delayed loading with a real canvas body click, travel during loading without animation restart, API-only scientific content and mission IDs, explicit mission start, arrival completion, reload persistence, connection failure, fallback/retry, successful empty catalogs, malformed/unknown data, retained progress, and readable mobile notices.
- `node tests/mission-browser.mjs`: passed with the live API and again after the API was actually stopped, covering mission/travel/inspection flows, cancellation, return to overview, nested Escape, keyboard focus, storage corruption/unavailability, mobile details scrolling, and scene dragging after dialogs close.
- Confirmed the stopped backend refused connections and the browser displayed the local fallback notice.
- Responsive assertions passed at 1440×900, 768×1024, 375×812, and 320×568, without horizontal overflow. The 320-pixel fallback screenshot was visually reviewed. Application runtime exceptions and console errors were absent; browser network diagnostics during deliberately unavailable requests are expected.

Browser checks were automated real-Chrome interactions, including actual canvas pointer input, plus screenshot review. An exhaustive human-operated manual pass, physical touch devices, Safari, and Firefox were not tested. No claim is made that those manual checks passed.

An intermediate production build panicked when CSS processing encountered a locked temporary Chrome profile inside the source tree. Closing Chrome allowed the same build to pass. Temporary test profiles were removed; the test README instructs using a profile outside the source tree. This qualified for the configured anonymized Next.js feedback review pass. Earlier test adjustments corrected a database-failure mock and waited for the 3D canvas to finish initializing before synthetic pointer input.

## Complete frontend source/configuration file inventory

Created:

- `.env.example`
- `.env.local` (ignored; public local API URL only)
- `lib/api/client.ts`
- `lib/api/adapters.ts`
- `lib/api/celestialBodies.ts`
- `lib/api/missions.ts`
- `features/exploration/catalogStore.ts`
- `features/exploration/ExplorationDataProvider.tsx`
- `features/exploration/CatalogNotice.tsx`
- `tests/helpers/loadTypeScript.mjs`
- `tests/api-catalog.test.mjs`
- `tests/api-browser.mjs`
- `PHASE_5.md`

Modified:

- `.gitignore` — allow the public example environment file to be tracked.
- `README.md` — actual frontend/backend setup and validation.
- `package.json` — add the unit-test command; no dependency changes.
- `app/page.tsx` — mount the shared catalog provider.
- `features/missions/components/MissionBrowser.tsx`
- `features/missions/components/MissionCard.tsx`
- `features/missions/components/MissionList.tsx`
- `features/missions/hooks/useMissionState.ts`
- `features/missions/utils/missionProgress.ts`
- `features/solar-system/components/SelectionPanel.tsx`
- `features/solar-system/components/SolarSystemScene.tsx`
- `features/solar-system/components/TravelCamera.tsx`

The local body/mission data files, scientific components, travel-state hook, global styles, dependencies, and existing browser regression script were preserved.

## Complete backend source/configuration file inventory

All paths in this section are relative to `C:\laragon\www\interstellar-api`.

Created:

- `app/Models/CelestialBody.php`
- `app/Models/Mission.php`
- `app/Models/MissionDestination.php`
- `app/Http/Controllers/Api/CelestialBodyController.php`
- `app/Http/Controllers/Api/MissionController.php`
- `app/Http/Resources/CelestialBodyResource.php`
- `app/Http/Resources/MissionResource.php`
- `app/Http/Resources/MissionDestinationResource.php`
- `database/factories/CelestialBodyFactory.php`
- `database/factories/MissionFactory.php`
- `database/factories/MissionDestinationFactory.php`
- `database/migrations/2026_10_22_234855_create_celestial_bodies_table.php`
- `database/migrations/2026_10_22_234856_create_missions_table.php`
- `database/migrations/2026_10_22_234857_create_mission_destinations_table.php`
- `database/seeders/ExplorationSeeder.php`
- `database/seeders/data/exploration.json`
- `routes/api.php`
- `config/cors.php`
- `tests/Feature/ExplorationApiTest.php`
- `boost.json` — generated by required Boost setup.

Modified:

- `bootstrap/app.php` — API routing and sanitized error rendering.
- `database/seeders/DatabaseSeeder.php` — seed the exploration catalog rather than the starter sample user.
- `phpunit.xml` — force isolated test environment/database settings.
- `tests/TestCase.php` — refuse unsafe test database configuration.
- `.env.example` — SQLite/CORS documentation; no secrets.
- `.env` — append the exact authorized SQLite path, preserving existing settings.
- `composer.json` and `composer.lock` — required development Boost setup and lock changes.
- `AGENTS.md` and `CLAUDE.md` — generated Laravel Boost guidelines.
- `README.md` — API contract, configuration, safe migration/seeding, and validation.

Generated/local artifacts, outside the source inventory: installed Boost dependency files under `vendor/`; Composer package discovery caches `bootstrap/cache/packages.php` and `services.php`; updated `database/database.sqlite`; PHPUnit result cache; backend application logs; frontend `.next` output and TypeScript incremental cache. Temporary implementation staging, browser profiles, and screenshots were removed from the frontend after verification. Environment files, database files, dependency trees, logs, and build output remain outside version control under existing ignore rules.

## Limits and Phase 6 recommendation

This phase supports the existing three-body scene. Catalog requests are cached in memory for the provider lifetime, with explicit retry rather than polling, cross-tab synchronization, or offline catalog caching. A failed resource invalidates the paired catalog load, intentionally retaining a consistent local pair. Player progress is local and user-editable, without authentication or server synchronization. No backend write endpoints, accounts, admin UI, or unrelated features were added.

Recommended Phase 6: establish deployment configuration and an explicitly versioned API contract, add pagination/schema compatibility tests if the catalog grows, and broaden browser/device coverage. Add server-side player progress only in a separately authorized identity/progress phase.
