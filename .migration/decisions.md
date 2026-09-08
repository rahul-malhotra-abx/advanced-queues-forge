# Decisions — Advanced Queues → Forge

Stage B interview, 2026-09-07. Answers from the product owner; consequences and
open threads recorded alongside each.

---

## 1. The `dashboards` tree is dropped

Delete `src/app/modules/project/dashboards/`. It has a route but no nav link,
and `dashboards.component.ts:283` is half-commented — it was never navigable.

**Consequences, all simplifying:**

- Removes 3 `AP.request` families (`/rest/api/3/dashboard/*/items/*/properties`).
- Removes one of the two `showJQLEditor` sites — only
  `queue.component.ts:155` survives, so decision 3 applies to one file, not two.
- The DASHBOARD storage context needs no Forge mapping at all. It was already
  branch-only with no constructor, so nothing is stranded.
- `project-routing.module.ts` loses its `dashboards` route.

Confirm nobody is mid-way through finishing this feature before the delete
commit lands. It is the one decision here that is awkward to reverse later,
because the tree goes out of the Forge repo entirely.

## 2. Development install goes to `appbox-fulldev-2`

Consistent with Checklist, Risk Register and Backlog Prioritization.

**R7 raised and now closed.** The concern was that fulldev-2 might have no JSM
licence, which would make the JSM path untestable and — because decision 4
preserves the unguarded call — leave every project page throwing on a site with
no service projects.

**Confirmed by the user 2026-09-07: `JSMPROJ`, a service management project,
already exists on `appbox-fulldev-2`.** So:

- `/rest/servicedeskapi/servicedesk/projectId:{id}/queue`
  (`jira.service.ts:403`), the import-native-queues dialog and the only JSM call
  in the app, **can be exercised on the development site.** No need to route
  JSM validation to `melon-inc`.
- The non-JSM throw from decision 4 is still present on software and business
  projects there, but it is now a specific, reproducible behaviour to test
  rather than a site-wide failure.

**Test both on fulldev-2:** `JSMPROJ` for the queues and import paths, and any
non-JSM project for the decision-4 throw.

## 3. The JQL Builder is ported, not dropped

Port `jql-codemirror.ts` + `jql-autocomplete.service.ts` from
`checklist-forge` (via Backlog and Risk Register — Risk Register's copy differs
from Backlog's by ~6 lines).

Per decision 1, this now lands in **one** call site,
`queue.component.ts:155`, not two. Delete the dead `JiraService.openJQLEditor`
wrapper at `jira.service.ts:148` — it has zero callers.

Note the dependency: `@codemirror/autocomplete` needs TypeScript 4.5+. AQ is on
4.6.4, so it is satisfied — this is the same requirement that forced Backlog's
Angular upgrade and it costs AQ nothing.

## 4. Non-JSM behaviour is preserved as-is

`getProjectQueues` (`jira.service.ts:403`) stays unguarded, and no JSM condition
is added to the module. The Forge build stays behaviourally identical to Connect
so the QA diff stays clean.

The pre-existing bug is therefore **carried forward deliberately, not
overlooked.** Two things follow:

- It should be logged as a defect against the Connect app in
  `advanced-queues-connect-qa/DEFECTS.md`, so it is tracked as a known product
  issue rather than rediscovered as a Forge regression.
- Marketplace review sees a JSM listing whose project page errors on a software
  project. That is a plausible rejection reason. If review raises it, gating the
  module is a small change and this decision can be revisited then.

See decision 2 for how this interacts with the chosen development site.

## 5. Google Analytics goes — assumed, not yet confirmed

Deleting `assets/js/advanced-queues.js` (decision 4 in `plan.md`) removes
Google Analytics `UA-181882142-5` along with it. Proceeding on the assumption
that this is acceptable, because:

- It is a **Universal Analytics** property, and UA stopped processing data —
  the tag is already collecting nothing.
- `ENVIRONMENT.ANALYTICS_ENABLED` is `true` in both variants
  (`environment.ts:12`, `:26`) but **nothing else in the Angular code reads it**.
- The script's own `AP.getCurrentUser()` call is the callback-style legacy API
  awaited as a promise, so it resolves `undefined` and the `userId` it sets has
  always been blank.

Say so if analytics needs a home on Forge instead; it is not a blocker either
way, but it is easier to add during Phase 1 than after.

## 6. Forge app ARI — pending `forge create`

Cannot be derived. It comes from `forge create` in Phase 1, which is the user's
command to run, not the agent's.

---

## Carried from `plan.md` without challenge

| # | Decision |
| --- | --- |
| 1 | Ship `com.appbox.ai.advanced.queues` — the PRO listing |
| 2 | Free listing out of scope; pin `ENVIRONMENT` to `ADVANCED_QUEUES_PRO` |
| 3 | No Angular upgrade — port on 13.3.11 |
| 4 | Delete `advanced-queues.js`, `ResizeSensor.js`, the `connect-cdn all.js` tag |
| 5 | Delete the 3 unreachable addon-property calls; no `@forge/kvs`, no `storage:app` |
| 7 | Leave `_hostOrigin` and the `FREE_VERSION`/`PAID_VERSION` gates in place |
| 8 | Fix the compile break on `advanced-queues-connect` first |
