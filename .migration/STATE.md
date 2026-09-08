# Migration state

**App:** Advanced Queues for Jira Service Management. Pro (`com.appbox.ai.advanced.queues`)
**Stage:** Phases 1 and 2 complete. Both gates green. Phase 3 (bridge + routing)
is next.
**Updated:** 2026-09-07

## Next action

**A force-push is outstanding, and it must happen before any other push.**

The first push carried 97 MB of Angular build cache (see below). History has been
rewritten locally to remove it, so the remote and local branches have diverged
and an ordinary `git push` will be rejected as non-fast-forward. The agent's
force-push was blocked by the permission classifier, so this one is the user's:

```bash
cd /Users/rahulabx2/Work/Appbox/advanced-queues/advanced-queues-forge
git push --force-with-lease origin main
```

Safe to force here: the branch is four days old at most, was created by this
migration, and nobody else has cloned it.

Then Phase 3 — bridge + routing, the `ui-bridge` barrier.

## App registered

`forge register` run by the user 2026-09-07 in developer space
`b962437b-0fc3-4504-964b-6f8a494ab322` (Appbox.ai). ARI written into
`manifest.yml`:

```
ari:cloud:ecosystem::app/d9c91408-9ee5-43a9-8336-4cec143708b9
```

Console: https://developer.atlassian.com/console/myapps/d9c91408-9ee5-43a9-8336-4cec143708b9/overview

Note for the playbook: `forge register` stops at an agreement covering the
Atlassian Developer Terms **and billing** ("I agree to be billed for any excess
usage"). `-y` auto-accepts both and must not be used by an agent.

## Phase 2 — done

Commit `1dd5bda`. Three Connect module types became two Forge modules.

| Connect | Forge |
| --- | --- |
| `jiraProjectPages` / `advanced-queues-project` | `jira:projectPage` |
| `webSections` / `advanced-queues-section` | absorbed — a Forge web section has no counterpart and needs none |
| `adminPages` / `project-enablement` | `jira:adminPage` |

The condition tree ported 1:1, with two things that are easy to get wrong:
Forge's `and`/`or` are **maps, not lists**, and the `not: entityPropertyExists`
branch is load-bearing — an absent property means "never configured", which
Connect treated as enabled, so dropping it would hide the app from every project
that has not opened the settings screen.

**Gates:**

```
forge lint            No issues found
check-scope-ceiling   within ceiling (exit 0)
script self-check     9 passed
```

`forge lint` is also what validated the four scope names that had no in-house
precedent.

## Second gap in the shared gate, same shape as R2

`check-scope-ceiling.mjs` was missing `read:user.property:jira` and
`write:user.property:jira` as well as the JSM rows — Advanced Queues is the
first of the four apps to store **user-scoped** entity properties, so nothing
had ever exercised them. Both added and mapped to READ/WRITE, with a self-check
assertion. Worth expecting a third gap on the next app: the map only covers what
previous migrations happened to need.

## Resolved since Phase 1

- **PR #11 merged** as `c923380` on `development`. The compile fix is in; the
  local Connect checkout is synced to it.
- **R7 closed.** `JSMPROJ`, a service management project, already exists on
  `appbox-fulldev-2` (confirmed by the user). The JSM path is testable on the
  development site, so JSM validation does not have to move to `melon-inc`.
- **R2 fixed.** JSM scopes added to `SCOPE_MAP` in
  `connect-to-forge-migration/skill/scripts/check-scope-ceiling.mjs`
  (`read:servicedesk-request`, `read:queue:jira-service-management`,
  `read:servicedesk:jira-service-management` → `READ`;
  `write:servicedesk-request` → `WRITE`). Self-check now 8 passed, and the probe
  that previously exited 1 on `read:servicedesk-request` exits 0. Two new
  assertions cover it, including that JSM *write* still escalates against a
  READ-only ceiling.

## The build-cache mistake, and the upstream fix

The first push carried **97 MB of Angular build cache across 382 files**
(`static/forge-angular-app/.angular/`), one pack file of which tripped GitHub's
50 MB warning. Cause: `init-migration.mjs` generates a `.gitignore` covering
`node_modules/` and `dist/` but **not `.angular/`**, and Angular 12+ writes that
cache on every build — so the scaffold → build → commit order guarantees it
exists by the time anyone runs `git add`. The pre-commit check looked for
`node_modules` and `dist` and did not think to look for it.

Fixed in three places:

1. History rewritten with `git filter-branch --index-filter` to strip the path
   from all commits. Local `main` verified clean; only the stale
   `refs/remotes/origin/main` still referenced it, which the force-push clears.
2. `.angular/` added to this repo's `.gitignore` (commit `e1a5353`).
3. **`init-migration.mjs`'s `.gitignore` template fixed**, so the next migration
   does not repeat it.

## Phase 1 — done

Commits `bd165b0`, `c8b032a` (hashes changed in the history rewrite).

- Scaffolded with `init-migration.mjs --no-create`. Angular tree copied (not
  submoduled), inner `src/` tracked, no `node_modules` or `dist` leaked. Both of
  the Response Templates packaging errors avoided and verified.
- `.migration/` plan, decisions, inventory and findings preserved — the script
  skips files that already exist.
- **Dashboards dropped** (decision 1): tree, route, module wiring, DASHBOARD
  storage context, and `get`/`saveDashboardProperties`. Retires the three
  `/rest/api/3/dashboard/*/items/*/properties` sites before the port reaches
  them. Enum values 0-3 unchanged, so no stored data is affected.
- **`ENVIRONMENT` pinned to `ADVANCED_QUEUES_PRO`** (R3). It was selecting
  `ADVANCED_QUEUES_FREE`, so every configuration including `build-prod` had been
  producing the Free build. `APP_BASE_KEY` is identical across variants, so
  nothing is renamespaced.
- **Trap 13 closed**: production `optimization` set explicitly with
  `inlineCritical: false`.

**Exit criterion met.** `npm run ui:build` exits 0 and emits
`static/forge-angular-app/dist/advanced-queues/index.html` with `<base href="./">`.
Initial total 974 kB / 207 kB transfer.

## Measured, and it corrects the playbook

**`NODE_OPTIONS=--openssl-legacy-provider` is not needed.** The runbook
prescribes it for Angular ≤ 15 on Node 22. Measured here: Angular 13.3.11 on Node
22.20.0 builds clean without it, so the generated `ui:build` script is left
alone. Worth folding back into `01-runbook.md` as a version boundary rather than
a blanket rule.

## Connect repo findings, none of them blocking Phase 2

The compile break is fixed in [PR #11](https://github.com/appbox-ai/advanced-queues/pull/11)
(`jira.service.ts:492`, missing brace closing `getSavedFilters()`; verified with
`tsc --noEmit --skipLibCheck` clean and a production build at exit 0). Two more
turned up while verifying it, deliberately left out of that PR:

- **`npm ci` cannot run on the Connect repo at all.** `package.json` and
  `package-lock.json` are out of sync — the lock has `@angular/compiler@13.3.11`
  against `^13.4.0` in `package.json`, and `ng-multiselect-dropdown@0.3.6`
  against `1.0.0-beta.15`. Only `npm install --legacy-peer-deps` works, and it
  rewrites ~6300 lines of lock.
- **`@angular/compiler` resolves to 13.4.0 while `@angular/core` is pinned
  `~13.3.11`.** Angular expects these to match. It builds, but the skew looks
  unintentional.

The Forge tree sidesteps both: `init-migration.mjs` does not copy the lockfile,
so `npm run ui:install` generated a fresh one that matches its own
`package.json`. It is committed.

Also still open on the Connect repo, from the closed PR #9 review: `.gitignore`
is missing `/build-server/public`.

## Baseline — no pending Connect work to absorb

`appbox-ai/advanced-queues` **PR #9 (`AQ-43-1`) reviewed and closed 2026-09-07**
as superseded. Its `openIssueDialog` feature had already landed on `development`
in `06492fc` (2024-12-19) via ag-Grid's `onCellClicked`, and its
`build-server/server.js` and `package.json` changes were absorbed separately;
merging it would have fired `openIssueDialog` twice per click.

Port baseline is `development` @ `40382a1` plus PR #11, which is what the
170-case QA suite is written against.

**For Phase 4:** if ctrl/cmd-click should open an issue in a new tab on Forge,
that is `router.open` from `@forge/bridge` alongside the `ViewIssueModal` port,
not `window.open`. Development's anchor is `href="javascript:void(0)"`, so
ctrl/cmd-click currently does nothing.

## Gate status

```
check-scope-ceiling   not yet meaningful — manifest.yml is still the stub
```

The ceiling script has **no JSM scopes in `SCOPE_MAP`**. Verified against AQ's
own descriptor: `read:servicedesk-request` returns `UNKNOWN` and exits 1. AQ is
the first JSM app through, and Phase 2 must add that mapping to the shared script
in `connect-to-forge-migration/` before the gate result means anything.

Dry-run with Risk Register's scope block against AQ's descriptor: **exit 0,
within ceiling** — so the scope set itself is fine once JSM is expressible.

## Why this one is cheaper than the previous three

No Angular upgrade (Trap 15's floor is Angular 13 / TS 4.5; AQ is 13.3.11 /
4.6.4). No custom field, so no one-way adoption risk. No Trap 2 / KVS work — the
APPLICATION store is empty on every tenant. Near-zero data carry-forward: live
data is project and user entity properties, which Forge reads through the same
REST API Connect wrote them with.
