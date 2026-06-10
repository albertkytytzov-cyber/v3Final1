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

Rules:

- With both flags missing or false, matrix UI must be hidden.
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true` is ignored unless
  `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true`.
- Because the flags are `NEXT_PUBLIC_*`, changing them requires rebuilding the
  web app before the browser can see the new state.

## Pre-deploy checks

Run before merge/deploy:

```bash
npm run build --workspace @training-platform/shared
npm run build --workspace @training-platform/api
npm run build --workspace @training-platform/web
npm run check:constructor-core
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
- active `matrix_primary_pilot` draft is read-only;
- save/template/assign controls stay disabled for `matrix_internal` and
  `matrix_primary_pilot`;
- return to legacy works;
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
- save/template/assign remained unavailable for matrix sources;
- return-to-legacy result.

## Rollback smoke

Disable both flags, rebuild web and redeploy.

Manual browser checks:

- matrix preview panel disappears;
- active matrix state cannot be reopened after hard refresh;
- legacy constructor generation still works;
- production `/api/v1/plans/constructor/draft` remains legacy-backed;
- browser console has no errors.

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
- no production save/template/assign path is available for matrix sources;
- coach feedback confirms the review package is understandable.

Stop or roll back if:

- matrix UI appears when flags are off;
- D-3/travel/weigh-in can become primary production drafts;
- save/template/assign becomes available for matrix sources;
- review export leaks identity/raw ids;
- constructor legacy flow regresses.

