# Matrix Constructor Controlled Pilot Rollout

This checklist is the production smoke protocol for the internal/limited Matrix
Constructor pilot. It is intentionally operational: it does not change rollout
policy, constructor logic, DB/API contracts, storage, telemetry, mobile
contracts, or save/template/assign behavior.

## Scope

The pilot is considered deployed only after these three states are verified:

1. `flag-off` production behavior: legacy constructor works and matrix UI is
   hidden.
2. `flag-on` internal behavior: matrix preview/workspace/export can be reviewed
   without becoming the default production path.
3. Rollback behavior: disabling the flags hides matrix UI and restores the same
   legacy-only surface after rebuild/redeploy.

## Required flags

Matrix UI is controlled by build-time web flags:

```bash
NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true
NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true
```

The trainer-facing save/assign pilot path has a separate third flag:

```bash
NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT=true
```

This third flag is ignored unless the first two flags are also enabled. It
should stay false unless the smoke explicitly validates matrix template saving
after local and server dry-run evidence pass.

Rules:

- With both flags missing or false, matrix UI must be hidden.
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true` is ignored unless
  `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true`.
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT=true` is ignored unless
  both internal UI and limited primary pilot are enabled.
- Because the flags are `NEXT_PUBLIC_*`, changing them requires rebuilding the
  web app before the browser can see the new state.
- In self-host Docker deploys the flags are wired through `docker-compose.yml`
  as web build args and runtime env. Keep `.env` explicit and run
  `bash scripts/update.sh` after changing them.

## Pre-deploy checks

Run before merge/deploy:

```bash
npm run build --workspace @training-platform/shared
npm run build --workspace @training-platform/api
npm run build --workspace @training-platform/web
npm run check:constructor-core
npm run check:constructor-matrix-evidence-dependencies
npm run check:constructor-matrix-data-dependencies
npm run check:constructor-matrix-ui-gates
npm run check:constructor-matrix-review-export
npm run check
git diff --check
```

Expected evidence:

- all commands exit successfully;
- PR is mergeable;
- production branch includes the rollout commit;
- no local uncommitted changes are required for deploy.

## Registry Hardening + Data Dependency Gate Skeleton

The production rollout checklist now includes the metadata-only evidence/data
checks. These checks do not enable Matrix by default and do not change runtime
behavior.

Required invariants:

- hardened `EvidenceDependencyRegistry` keeps high-risk evidence explicit about
  limitations, review status and automation readiness;
- internal validation and coach-school evidence are not universal hard rules;
- product rollout guards remain operational safety checks, not sport-science
  proof;
- `Data Dependency Gate Skeleton` records what data is needed for future
  weight, hydration, readiness, wearable, pain, injury, female/youth, travel and
  competition-context decisions;
- no numeric thresholds are introduced;
- production `/api/v1/plans/constructor/draft`, rollout gates, preview behavior,
  save/template/assign and legacy fallback stay unchanged.

## Production deploy

After merging to the production branch or deliberately deploying the pilot
branch:

```bash
bash scripts/update.sh
```

Then verify:

```bash
curl -fsS https://185.195.185.67.sslip.io/api/v1/health
docker compose ps
docker compose logs api --tail=100
docker compose logs web --tail=100
docker compose logs reverse-proxy --tail=100
```

Expected evidence:

- API health returns success;
- web/api/reverse-proxy containers are healthy or running;
- logs have no constructor/matrix boot errors.

## Flag-off smoke

Use production with both matrix flags absent or false, then rebuild/redeploy.

Manual browser checks:

- log in as a coach;
- open Planning Studio / Constructor;
- build a normal legacy draft;
- save/template/assign legacy flow works as before;
- no Matrix preview panel is visible;
- no Matrix workspace, Matrix activation button, primary pilot button, or
  review export action is visible;
- browser console has no errors.

Expected evidence to record:

- production URL;
- coach account used;
- date/time;
- screenshot or notes confirming matrix UI is hidden;
- legacy draft can still be generated.

## Flag-on internal smoke

Enable both flags, rebuild web, redeploy, hard-refresh the browser, then test.

Manual browser checks:

- matrix preview panel is visible only in constructor context;
- `far_development_week_d90` style scenario can build preview, rollout,
  readiness, server dry-run evidence and review export;
- matrix primary pilot can be activated only after passing server evidence;
- active `matrix_primary_pilot` draft remains review-only unless the third
  save/assign pilot flag is explicitly enabled;
- with the third flag off, save/template/assign controls stay disabled for
  `matrix_internal` and `matrix_primary_pilot`;
- return to legacy works;
- D-28/D-21/D-10 main-start scenarios can pass as limited primary candidates
  only when rollout/readiness/server dry-run are green;
- D-3 close-start scenario remains preview-only;
- travel and weigh-in scenarios remain internal-only;
- `Copy review summary` and `Copy review JSON` work and do not include athlete
  identity, contact data, raw ids or coach notes;
- browser console has no errors.

Expected evidence to record:

- production URL;
- selected athlete/scenario;
- rollout mode and readiness status;
- server dry-run status;
- export copied successfully;
- save/template/assign remained unavailable for matrix sources when the third
  flag is off;
- return-to-legacy result.

## Optional save/assign pilot smoke

Only run this smoke when the team intentionally tests real matrix template
saving. Enable all three flags, rebuild web, hard-refresh the browser, and use a
known allowed D-90-style scenario.

Manual browser checks:

- build the current draft;
- run the new constructor comparison;
- open the new plan variant;
- activate the limited pilot view;
- confirm local and server safe-save checks are passed;
- confirm the active new draft has coach-readable focus language, concrete
  blocks, warm-up, main work, cool-down/control and editable exercise rows;
- confirm the save button appears only for the active new constructor draft;
- save as template;
- verify the normal template assignment tab opens with the saved template
  preselected;
- verify the selected athlete, full-plan assignment mode and current start date
  are prefilled;
- assign the saved template to the selected athlete through the normal
  assignment flow after checking dates;
- confirm `matrix_internal`, D-3, competition day, travel and weigh-in still
  cannot save.

Expected evidence to record:

- all three flags enabled;
- selected athlete/scenario;
- local and server dry-run status;
- saved template id/name;
- assignment id/date;
- proof that blocked scenarios still do not expose save.

## Rollback smoke

Disable both flags, rebuild web and redeploy.

Manual browser checks:

- matrix preview panel disappears;
- active matrix state cannot be reopened after hard refresh;
- legacy constructor generation still works;
- production `/api/v1/plans/constructor/draft` remains legacy-backed;
- browser console has no errors.

## Main build button smoke

With all three matrix flags enabled, the trainer-facing **build draft** action
must call the controlled pilot draft path before legacy fallback:

```text
POST /api/v1/plans/constructor/internal/matrix-primary-pilot-draft
```

Expected behavior:

- allowed pilot case: the top draft is marked as the new planning logic and can
  proceed through the gated template save flow;
- blocked or preview-only case: the top draft is the current constructor
  fallback, and the message explains the matrix scenario and rollout mode;
- no DB write, template creation or plan assignment happens during this pilot
  draft request;
- production `/api/v1/plans/constructor/draft` remains legacy-backed.

Expected evidence to record:

- date/time;
- flags disabled;
- matrix UI hidden;
- legacy draft generated after rollback.

## Go/no-go decision

Continue the controlled pilot only if:

- flag-off smoke passes;
- flag-on smoke passes;
- rollback smoke passes;
- review exports are anonymized;
- no production save/template/assign path is available for matrix sources unless
  the optional third-flag save/assign pilot smoke is being intentionally run;
- coach feedback confirms the review package is understandable.

Stop or roll back if:

- matrix UI appears when flags are off;
- D-3/travel/weigh-in can become primary production drafts;
- D-28/D-21/D-10 can save without all three web flags and green server evidence;
- save/template/assign becomes available for matrix sources while the third
  save/assign pilot flag is off;
- review export leaks identity/raw ids;
- constructor legacy flow regresses.
