# Migration plan — Advanced Queues → Forge

Survey: [`findings/01-survey.md`](findings/01-survey.md). Facts:
[`inventory.json`](inventory.json). Fourth and last app through, after Response
Templates, Checklist, Risk Register and Backlog Prioritization.

**Verdict: this is the smallest of the four migrations, and the two things that
dominated the previous plans are both absent.** There is no Angular upgrade
(Trap 15 does not bite) and no custom field (so no one-way adoption risk). There
is also no data migration worth the name. One item blocks Phase 1 outright, and
it is a compile error that already exists on `development`.

---

## Stage A facts

| | |
| --- | --- |
| Angular / TypeScript | **13.3.11 / 4.6.4** — exactly at the Trap 15 floor |
| Connect key (PRO) | `com.appbox.ai.advanced.queues`, `enableLicensing: true` |
| Scope ceiling | `READ, WRITE, DELETE` — no `PROJECT_ADMIN`, no `ADMIN` |
| Module types | 3 → **2 Forge modules** |
| `AP.*` sites | 45 — 43 of them inside `jira.service.ts` |
| Storage | one file, `storage.service.ts`; only PROJECT and USER are live |
| Module dirs | 2 — `app-admin-panel`, `project` |
| QA baseline | `advanced-queues-connect-qa` @ `qa/01-bootstrap`, cases traced to `development` @ `40382a1` |
| Toolchain | Node 22.20.0, Forge CLI 13.1.0 — both present |

### Why the extractor undercounted

`extract-inventory.mjs` greps `AP\.` and therefore misses `window['AP']`
entirely — the Trap 14 blind spot. There are **14 such sites**, including
`openIssueDialog`, which does not appear in the extractor's unsolved list at all.
They are now in `inventory.json` under `bracketNotationAp`. Size the port off
that, not off `apSummary`.

The one structural gift: `jira.service.ts:14,28-34` already maps
`window['AP'].{context,user,jira,navigator,flag,resize,events}` onto a single
facade object. That is the seam, and it is the same shape Backlog's shim
replaced. **43 of 45 call sites need no edit.**

---

## Module map

| Connect module | Key | Forge module | Precedent |
| --- | --- | --- | --- |
| `jiraProjectPages` | `advanced-queues-project` | `jira:projectPage` | shipped by all 3 prior apps |
| `webSections` | `advanced-queues-section` | — absorbed; Forge admin pages nest themselves | — |
| `adminPages` | `project-enablement` | `jira:adminPage` | shipped by all 3 prior apps |

Nothing here is new. AQ's module surface is a strict subset of Checklist's, Risk
Register's and Backlog's.

**Conditions** need care but no research. The descriptor has
`user_is_logged_in` AND `OR(entity_property_equal_to advancedQueuesEnabled=true,
NOT entity_property_exists)`. Two known shapes apply: Forge's `and`/`or` are
**maps, not lists**, and Trap 7 — Connect's `entityPropertyEqualTo` stringifies,
so the stored flag may be `true` or `"true"` and both must be accepted.

---

## Already solved next door — copy, do not research

| Item | Source | Delta |
| --- | --- | --- |
| 33 `AP.request` + the facade | the `static AP = {…}` shim in `backlog-prioritization-forge/…/jira.service.ts` — reimplements the Connect surface on `@forge/bridge` so **call sites are untouched** | shape identical; AQ's facade is already the same object |
| `AP.flag.create:480` | same shim (`showFlag`, Connect's `{title,body,type,close}` → Forge's shape) | none |
| `AP.jira.showJQLEditor` ×2 | `jql-codemirror.ts` + `jql-autocomplete.service.ts` (Checklist → Backlog → Risk Register) | Risk Register's differs from Backlog's by **6 lines** |
| `AP.jira.openIssueDialog` | `ViewIssueModal` from `@forge/jira-bridge`, in Risk Register's `jira-issue-key-renderer.ts` | **11 lines** |
| `AP._hostOrigin` (`utils.service.ts:70`) | ships **untouched** in all three prior Forge apps — `window['AP']` is undefined, the guard falls through | none — leave it |
| `assets/js/advanced-queues.js` + `ResizeSensor.js` + `connect-cdn all.js` | delete outright, exactly as Risk Register deleted `risk-register.js` | watch for `100vh`/`max-height` clamps, which deadlock the auto-resizer alongside it |
| ag-Grid balham icon font | `backlog-prioritization-forge/scripts/extract-aggrid-font.mjs` | none — AQ uses that exact theme |
| Scope block | Risk Register's, minus the custom-field scopes | dry-run against AQ's descriptor already **passes the ceiling gate** |

`AP.events.on` was the one call with no precedent in any prior app. The survey
solved it: single event `flag.action`, handler opens an issue in a new tab.
`showFlag`'s `onClose` resolves the action id, and `router.open` replaces
`window.open`. Small, but it is the only genuinely new bridge work in the port.

---

## Risks that are real

### R1 — `development` does not compile. This blocks Phase 1.

`jira.service.ts:492` is missing the brace that closes `getSavedFilters()`
(opened at `:483`; the try/catch closes at `:491`). The class never terminates,
so `getAssignees:493` and `assignUserToIssue:506` end up lexically nested, which
breaks `autocomplete.component.ts:56` and `:98`.

Nothing can be ported out of a tree that does not build, and the QA suite's
baseline is that same commit. **Fix it on `advanced-queues-connect` first**, so
the Connect app and the 170-case suite still agree, then bring the tree across.

### R2 — The scope-ceiling gate cannot see JSM scopes

AQ is the first JSM app through, and `check-scope-ceiling.mjs`'s `SCOPE_MAP` has
no service-desk entries. Verified against AQ's own descriptor:

```
UNKNOWN  read:servicedesk-request is not in SCOPE_MAP — map it before trusting this result
exit=1
```

Connect's `READ` already grants `/rest/servicedeskapi/` GETs, so the scope is
genuinely within the ceiling — the gate simply cannot express it. **One line in
the shared script**, mapping the JSM read scope to `READ`. Do it in Phase 2, and
do it in `connect-to-forge-migration/`, not in a copy.

### R3 — The committed tree builds the **Free** variant

`environment.ts:30` selects the variant by a hand-edited constant, not by an
`angular.json` `fileReplacement`. So `build-prod` produces the Free build today.
Pin to `ADVANCED_QUEUES_PRO` in Phase 1 and confirm it before the first deploy —
this one is invisible until someone checks a licence gate.

`APP_BASE_KEY` is `com.appbox.ai.advanced.queues` and is shared across both
variants **by design**, so pinning to PRO does not renamespace any stored data.
Never change it.

### R4 — The project page renders on non-JSM projects, and then throws

The PRO descriptor declares no JSM module and no JSM condition, so the project
page shows on every project type; `getProjectQueues` (`jira.service.ts:403`) is
the one unguarded request in the file and throws on a non-JSM project. This is a
**pre-existing Connect bug**, not something the port introduces. Forge changes
nothing about it either way — but it is cheap to gate now, and it is the kind of
thing Marketplace review notices in a JSM listing.

### R5 — The gates cannot see the iframe

Trap 12, and it has now caught every migration. Checklist passed every gate and
still shipped a 40px strip. Budget an install-and-look pass before Stage E, with
the context *shape* logged and read back via `forge logs`.

Two live sub-cases here, both certain rather than possible:

- **Trap 13 is live, not latent.** Angular 13 plus a production config with no
  `optimization` key means `inlineCritical` defaults on, and Forge's CSP blocks
  the injected `onload` — **all global CSS silently stops applying.** Set it
  explicitly.
- **Trap 14, ag-Grid.** AQ uses `ag-theme-balham`, which inlines its icon font
  as a `data:` URI. Forge's `font-src` has no `data:`, so every sort arrow,
  checkbox and caret renders as a blank box. This has hit all three prior
  migrations. Run Backlog's extraction script before the first install.

### R6 — The `AP.request` shim hangs instead of failing

`jira.service.ts:13-27` neither resolves nor rejects when `AP` is undefined.
Under Connect that never happened. Fix it in the Forge shim rather than porting
the behaviour — a hung promise is much harder to diagnose in an iframe than a
rejection.

---

## What is *not* a risk here, and was on every prior plan

- **No Angular upgrade.** Trap 15 sets the floor at Angular 13 / TS 4.5 for
  `@forge/bridge`'s `.d.ts` files to parse. AQ is on 13.3.11 / 4.6.4. Material 13
  is pre-MDC, so no `legacy-*` symbol churn; ag-Grid 27 needs no
  `withComponents()` fix. Backlog lost its whole sequencing argument to this and
  AQ simply does not have it.
- **No custom field.** No `jiraCustomField` in the descriptor, so Backlog's R1
  and Risk Register's R1 — one-way, silently-failing field adoption, the largest
  risk in both plans — are absent. Trap 11 does not apply either.
- **No Trap 2 / KVS work.** The APPLICATION-scoped store is branch-only with no
  constructor anywhere, so it is empty on every tenant. There is no global blob
  to move.
- **Almost no data carry-forward.** The live data is Jira **project and user
  entity properties**, which Forge reads through the same REST API that Connect
  wrote them with. The only Connect addon-property calls (`:203`, `:210`, `:224`)
  are unreachable and hold nothing. Phase 6 shrinks to a verification pass plus
  the defensive install/upgrade trigger.

---

## Decisions taken (confirm or overrule)

| # | Decision | Basis |
| --- | --- | --- |
| 1 | Ship `com.appbox.ai.advanced.queues` — the PRO listing | `enableLicensing: true`; the other three descriptors are QA/localhost/Free |
| 2 | Free listing out of scope; pin `ENVIRONMENT` to `ADVANCED_QUEUES_PRO` | Company rule: no free Forge listings |
| 3 | **No Angular upgrade** — port on 13.3.11 | Trap 15's floor is met exactly |
| 4 | Delete `advanced-queues.js`, `ResizeSensor.js`, the `connect-cdn all.js` tag | All AP sites in them are dead; CSP blocks the CDN anyway, and any `permissions.external` forfeits Runs on Atlassian |
| 5 | Delete the 3 unreachable addon-property calls; no `@forge/kvs`, no `storage:app` | No data exists under them |
| 6 | Delete the dead `JiraService.openJQLEditor` wrapper; port the editor into the 2 real call sites | Wrapper has zero callers |
| 7 | Leave `_hostOrigin` and the `FREE_VERSION`/`PAID_VERSION` gates in place | Dead branches; removing them is a cosmetic diff with real regression risk |
| 8 | Fix the compile break on `advanced-queues-connect` first, not only in the Forge tree | Keeps the QA baseline and the Connect app in agreement |

---

## Open questions — ANSWERED 2026-09-07

Full record with consequences: [`decisions.md`](decisions.md).

| Q | Answer |
| --- | --- |
| `dashboards` tree | **Drop it.** Removes 3 `AP.request` families and one of the two `showJQLEditor` sites |
| Development site | **`appbox-fulldev-2`** — consistent with the other three apps. See R7 below |
| JQL Builder | **Port the codemirror editor.** Now lands in one call site, not two |
| Non-JSM projects | **Preserve current behaviour** — the unguarded call ships as-is |
| Google Analytics | Assumed acceptable to lose (UA property, already collecting nothing). Say otherwise and it is a Phase 1 change |
| Forge app ARI | Pending `forge create` in Phase 1 — yours to run |

### R7 — The development site cannot exercise the JSM path *(new, from the answers)*

`appbox-fulldev-2` is not known to hold a JSM licence; `melon-inc` is the site
that does. Combined with the decision to preserve the unguarded call, that means:

- `/rest/servicedeskapi/…/queue` (`jira.service.ts:403`) — the only JSM call in
  the app, and the only reason the manifest needs a JSM scope — **cannot be
  tested on the development site.**
- The project page renders on every project type and throws on non-JSM ones. On
  a site with no service projects, that is every project, so a green deploy
  would still show a broken page.

**Phase 1 action, five minutes:** check whether `appbox-fulldev-2` has a JSM
licence and at least one service project. If not, add one, or route the JSM
validation to `melon-inc`. The development target does not change — this is
about what it can prove.

---

## Phases

Stages per the runbook. Gates are scripts that exit non-zero, not opinions.

### Phase 0 — Approval  ← we are here

Six questions answered above. **Still awaiting go-ahead on the plan as a whole
before anything is scaffolded or ported.**

### Phase 1 — Unblock, then scaffold

Three things before the scaffold, in this order:

1. Fix `jira.service.ts:492` on `advanced-queues-connect` (R1).
2. Delete `src/app/modules/project/dashboards/` and its route.
3. Check `appbox-fulldev-2` for a JSM licence and a service project (R7).

Then:

```bash
node connect-to-forge-migration/skill/scripts/init-migration.mjs \
  advanced-queues/advanced-queues-forge advanced-queues/advanced-queues-connect advanced-queues
```

`forge create` is yours to run — it registers the app and yields the ARI. The
Angular tree then moves to `static/forge-angular-app/`, minus `build-server/`
and `node_modules/`. `.nvmrc` pinned to 22. Pin the variant to PRO (R3) and set
the Trap 13 `optimization` block in the same commit.

**Exit:** `npm run ui:build` emits `static/forge-angular-app/dist/advanced-queues/index.html`.

### Phase 2 — Manifest

Two modules, both proven three times. Add the JSM scope, and add the JSM row to
`SCOPE_MAP` first (R2) so the gate can actually judge it.

```bash
node connect-to-forge-migration/skill/scripts/check-scope-ceiling.mjs \
  advanced-queues/advanced-queues-connect/src/assets/advanced-queues-pro-atlassian-connect.json \
  advanced-queues/advanced-queues-forge/manifest.yml
```

**Exit:** `forge lint` clean, ceiling gate exit 0.

### Phase 3 — Bridge + routing  *(barrier — one agent, alone)*

`ui-bridge` replaces the `window['AP']` facade at `jira.service.ts:14,28-34` with
Backlog's shim, fixes the R6 hang, and adds the `app.component.ts` module-key
switch (`advanced-queues-project` → `/project/:id/queues`, `project-enablement` →
`/app-admin-panel/project-enablement`). Publishes the method contract.

### Phase 4 — Port + resolvers  *(parallel, one message)*

Fan-out here is **two agents, not four.** 43 of 45 `AP.*` sites are in
`jira.service.ts`, and all storage routes through `storage.service.ts` — the
Checklist shape exactly. Splitting `modules/project` across porters would just
make them fight over one file.

- `ui-porter` — the component-level sites that survive the dashboards delete:
  `showJQLEditor` ×1 (`queue.component.ts:155`), `openIssueDialog`
  (`grid.component.ts:163`), `AP.resize` (`project.component.ts:51`), plus the
  Trap 14 absolute `/assets/` paths.
- `resolver-author` — `src/index.js`. `asUser()` throughout, inline permission
  checks, and the generic proxy allowlisted to `/rest/api/3/` **plus the single
  `/rest/servicedeskapi/` path** — that exception is the one deviation from the
  standard allowlist and must be written narrowly, not as a prefix wildcard.

Gate: `node …/skill/scripts/forge-audit.mjs src/index.js`.

### Phase 5 — Iframe pass

Trap 13 CSS, Trap 14 ag-Grid font and absolute asset paths, resize behaviour
after `AP.resize` is gone. Install and look. This is the phase the gates cannot
do for you.

### Phase 6 — Data compatibility  *(small, but not skippable)*

No carry-forward is required — project and user entity properties are read
through the same REST API that wrote them. Still ship the
`avi:forge:installed:app` + `avi:forge:upgraded:app` trigger as the defensive
no-op, and **verify against a real Connect site with data** rather than asserting
it. Trap 7 applies to the condition flag: accept `true` and `"true"`.

### Phase 7 — Verify  *(adversarial; must not be an agent that wrote Stage D code)*

```bash
node connect-to-forge-migration/skill/scripts/forge-audit.mjs src/index.js
forge lint
forge eligibility --environment production
forge version details --json
```

FSRT has no local runner; it executes Atlassian-side at submission, which is why
`forge-audit` exists. Prompt the auditor to **find** a reachable `asApp()` path,
not to confirm the code is fine.

### Phase 8 — Ship

Yours to run, never mine:

```bash
npm run ui:build && forge deploy -e development
forge install -e development --site <site from Q6> --product jira
```

---

## Sequencing note

The 170-case QA suite in `advanced-queues-connect-qa` is written against
`development` @ `40382a1` with `file:line` traces, and `advanced-queues-forge-qa`
is still empty. The cheapest path is to re-point the existing suite at the Forge
install rather than write a second one — but that is a Phase 5 conversation, not
a Phase 1 one, and it depends on Q6.
