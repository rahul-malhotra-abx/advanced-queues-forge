# Stage A survey — Advanced Queues Connect → Forge

Repo surveyed: `/Users/rahulabx2/Work/Appbox/advanced-queues/advanced-queues-connect` (read-only).
Companion facts: `/Users/rahulabx2/Work/Appbox/advanced-queues/advanced-queues-forge/.migration/inventory.json`.
Everything below is judgement the extractor cannot make. Facts already in inventory.json are not repeated.

---

## 1. `src/assets/js/advanced-queues.js` — dead or load-bearing?

**Verdict: loaded, but every AP.* call in it is dead. Only two side effects survive, both droppable.**

It IS referenced — `src/index.html:13`:

```html
<script src="https://connect-cdn.atl-paas.net/all.js"></script>   <!-- index.html:11 -->
<script src="/assets/js/ResizeSensor.js"></script>                <!-- index.html:12 -->
<script src="/assets/js/advanced-queues.js"></script>             <!-- index.html:13 -->
```

It is NOT in `angular.json` `scripts[]` (that array holds only `marked.min.js` and `bootstrap.min.js`,
angular.json build.options.scripts) and it is in no descriptor. It ships only because `src/assets` is
copied wholesale by `assets[]`.

What it actually does, block by block:

| Lines | Behaviour | Live? |
|---|---|---|
| 2-4 | Overrides `console.error` to `console.log("RT [E]:", ...)` | Live, but harmful — it swallows real error levels, and the `RT` prefix is Response Templates branding |
| 6-22 | `setInterval` polling for `#response-template-wrapper`, then `ResizeSensor` → `AP.context.getContext()` (:11) → `AP.resize()` (:16) | **DEAD.** `response-template-wrapper` exists nowhere in this repo — grep across all templates returns only these three lines in the script itself. The interval never clears and polls forever at 100ms |
| 24-30 | `getParentDomain()` | **DEAD.** Never called. The app uses `UtilsService.getParentDomain()` (`src/app/services/utils.service.ts:62`), which is strictly better — it also reads `xdm_e` and `AP._hostOrigin` |
| 33-70 | Google Analytics UA-181882142-5, random clientId, `AP.getCurrentUser()` (:61) for `userId` | GA loads; the AP call is broken. `AP.getCurrentUser` is the callback-style legacy Connect API, so `await window.AP.getCurrentUser()` resolves to `undefined` and `ga("set","userId", undefined)` is what actually runs |
| 72-76 | `getCookie()` | **DEAD.** Never called |

This file is a verbatim copy-paste from the Response Templates Connect app, lightly renamed.
The resize behaviour the Angular app really uses lives at
`src/app/modules/project/project/project.component.ts:51` (`window["AP"].resize(...)`), which is
independent of this script.

**Migration action: delete the file and the `<script>` tags for it and for ResizeSensor.**
Nothing user-visible breaks. GA (UA property, and Universal Analytics is sunset anyway) disappears —
confirm with the lead that analytics loss is acceptable, since `ENVIRONMENT.ANALYTICS_ENABLED` is `true`
in both variants (`src/app/environment.ts:12`, `:26`) but nothing else in the Angular code reads it.

---

## 2. `AP.events.on` — `src/app/services/jira.service.ts:525`

**Verdict: load-bearing, single event, reachable from live UI, and it is the ONLY consumer of the
flag `actions` payload.**

The call is at module top level, *outside* the class body:

```ts
JiraService.AP.events.on("flag.action", (event: any) => {
  window.open(UtilsService.getIssueUrl({ key: event.actionIdentifier }), "_blank");
});
```
(jira.service.ts:525-527, quoted with the quote style normalised)

One event only: `flag.action`. Handler opens `<parentDomain>/browse/<issueKey>` in a new tab
(`UtilsService.getIssueUrl`, utils.service.ts:36-38).

Reachability chain, all live:
1. `src/app/modules/project/grid/grid.component.ts:61-62` — `setInterval` → `checkForNewIssues()`
2. `grid.component.ts:88-96` — new issues matching the queue JQL are diffed, then per issue:
   `JiraService.showNotification("New Issue", ..., "success", "auto", actions)` where
   `actions = { [issueKey]: issueKey }`
3. `jira.service.ts:469-481` — `showNotification` forwards `actions` into `AP.flag.create` (`:480`)
4. User clicks the action link in the flag → `flag.action` fires → handler at `:525`

**If it disappears:** the flag still renders, the action link still renders, clicking it does nothing.
Silent dead link on the new-issue toast.

**Forge substitute:** `showFlag` from `@forge/bridge` returns a flag handle whose `onClose` resolves
with the chosen `actionId`, so the pub/sub round trip collapses into the `showFlag` call site itself.
Navigation should become `router.navigate` / `router.open` from `@forge/bridge` rather than
`window.open`, because `getParentDomain()` relies on `document.location.ancestorOrigins` and `xdm_e`,
neither of which is available in a Forge Custom UI iframe.
This is a two-call-site change: delete `:525-527`, rewrite `showNotification` at `:469-481`.

---

## 3. `AP.jira.showJQLEditor` — `src/app/services/jira.service.ts:148`

**Verdict: the wrapper at :147-149 is DEAD. The capability is load-bearing, but via two direct
`window["AP"]` calls in components that bypass the service entirely.**

```ts
static openJQLEditor(options: any, callback: any) {   // jira.service.ts:147
  this.AP.jira.showJQLEditor(options, callback);      // jira.service.ts:148
}
```
Grep for `JiraService.openJQLEditor` across `src/` returns **zero** call sites. The inventory line
:148 is a wrapper nobody uses.

The two real call sites are:

| Component | Opens at | Callback | Consumes JQL into | Triggered by |
|---|---|---|---|---|
| `src/app/modules/project/queues/queue/queue.component.ts:155` | `openJQLEditor()` :147-156 | `jqlEditorCallback` :158-163 | `this.queue.jql`, then `changeDetectorRef.detectChanges()` | `queue.component.html:81` button "Use JQL Builder" |
| `src/app/modules/project/dashboards/widget/widget.component.ts:54` | `openJQLEditor()` :46-55 | `jqlEditorCallback` :57-62 | `this.widget.jql`, then `detectChanges()` | `widget.component.html:33` button "Use JQL Builder" |

Both build the same options object: `{ jql: <current> || "issuetype = Story", header: "Queue - JQL
Builder", descriptionText, submitText: "Use this JQL", cancelText: "Cancel" }`. Both callbacks guard
on `obj.jql` being truthy, so cancel is a no-op. The queue one then flows into the normal save path
(`dialogRef.close({ queue, folder })`, queue.component.ts:145).

**If it disappears:** the "Use JQL Builder" button becomes inert in both the queue editor and the
dashboard widget editor. Users can still type raw JQL into the text field, so it is a degradation,
not a blocker — but it is the discoverability path for the whole product (queues ARE JQL).

**Forge substitute:** there is no `showJQLEditor` in `@forge/bridge`. Options are the
`@atlassianlabs/jql-editor` React component, or ship a plain textarea plus a validate-on-blur call to
`/rest/api/3/jql/parse`. Note the queue editor already has a live JQL validity signal available via
`checkIssuesAgainstJQLs` (jira.service.ts:151-164).

The dead wrapper at :147-149 should simply not be ported.

---
## 4. `AP.request` — 35 sites, path families

Two of the 35 are plumbing, not REST paths:
- `jira.service.ts:18` — `await jiraAP.request(...args)` inside the static `AP.request` shim
  (:13-27). This is the single choke point every other call funnels through, and it is where
  `JSON.parse(resp.body)` happens. **Port this one function and 33 call sites follow.**
- `jira.service.ts:38` — `static request(data)` generic passthrough. No callers outside the file.

The remaining **33** carry literal paths:

| Family | Count | Lines |
|---|---|---|
| `/rest/api/3/project/*` | 7 | 51, 61, 237, 249, 275, 290, 389 |
| `/rest/api/3/user/*` (properties, groups, assignable/search) | 6 | 71, 80, 93, 123, 461, 496 |
| `/rest/api/3/search/jql` (POST, the 2025 token-paged endpoint) | 4 | 328, 350, 368, 419 |
| `/rest/api/3/issue/*` | 3 | 103, 113, 512 |
| `/rest/api/3/dashboard/*/items/*/properties` | 3 | 172, 179, 193 |
| **`/rest/atlassian-connect/1/addons/*`** | **3** | **203, 210, 224** |
| `/rest/api/3/myself` | 1 | 132 |
| `/rest/api/3/jql/match` | 1 | 156 |
| `/rest/api/3/field` | 1 | 302 |
| `/rest/api/3/mypermissions` | 1 | 439 |
| `/rest/api/3/groups/picker` | 1 | 450 |
| `/rest/api/3/filter/my` | 1 | 486 |
| **`/rest/servicedeskapi/*`** | **1** | **403** |
| | **33** | |

### Every non-`/rest/api/3` path, verbatim

```
jira.service.ts:203  `/rest/atlassian-connect/1/addons/${ENVIRONMENT.APP_KEY}/properties/`
jira.service.ts:210  `/rest/atlassian-connect/1/addons/${ENVIRONMENT.APP_KEY}/properties/${property}`
jira.service.ts:224  `/rest/atlassian-connect/1/addons/${ENVIRONMENT.APP_KEY}/properties/${property.key}`
jira.service.ts:403  `/rest/servicedeskapi/servicedesk/projectId:${projectIdOrKey}/queue`
```

**The three `/rest/atlassian-connect/1/addons/...` paths have no Forge equivalent at all** — that
namespace is Connect app properties and does not exist for a Forge app. It is not an allowlist
problem, it is a nonexistent API. They must become `@forge/kvs`. Good news, see section 5: they are
currently unreachable, so this is a delete rather than a rewrite.

**`/rest/servicedeskapi/...` is reachable and load-bearing** (section 7). In Forge it goes through
`requestJira` all the same — `@forge/api` `requestJira` is not restricted to `/rest/api/3`, it proxies
any Jira product path — but the **scope changes**: it needs `read:servicedesk-request:jira-service-management`
(or the coarse `read:jira-work` will NOT cover it). This must be declared in `manifest.yml` permissions.

### Other things the porter needs from this file
- The shim at :13-27 rejects on error but **falls through silently returning a never-settling promise's
  path when `AP` is undefined** (:23-25 logs and neither resolves nor rejects). Any Forge rewrite
  should reject there instead — it is a latent hang.
- `executeJQL` (:409-434) paginates with `nextPageToken` and stops on `isLast` OR
  `allIssues.length < maxResults`. It reads `result?.nextPageToken` on the first iteration when
  `result` is still undefined — works, but note the `do/while`.
- `getCurrentJiraUser` (:130-145) and several others branch on `isInJira()` (`window.parent !== window`,
  :45-47) and return canned data outside Jira. In Forge everything is always in an iframe, so that
  branch is dead weight but harmless.
- `JiraService.cache` (:7-10) memoises `fields` only (`:300-310`). `userPermissions` is declared and
  never populated — `getUserPermissions` (:436-445) hits the API every time.

---

## 5. Storage contexts

**All storage routes through exactly one file: `src/app/services/storage.service.ts`.**
Nothing else in the app constructs entity-property calls. `StorageService` (chunking, key naming,
context switch) delegates to the ten `*Properties` statics in `jira.service.ts:49-119, 170-230`.
The only writer outside that path is `JiraService.saveProjectSettings` (:288-295), which writes the
admin settings key directly, unchunked.

Key format, `storage.service.ts:15` + `:32`:
`${APP_BASE_KEY}-${storageBaseKey}_${chunkIndex}` → e.g. `com.appbox.ai.advanced.queues-project-queues_0`.
Hyphen before the logical name, underscore before the chunk index. The admin-settings key uses an
underscore in both positions (`com.appbox.ai.advanced.queues_project-admin-settings`) and that exact
string is hard-coded into the descriptor visibility condition — do not "normalise" it.

`APP_BASE_KEY` is `com.appbox.ai.advanced.queues` for **both** Free and Pro (`src/app/environment.ts:11`
and `:25`), even though `APP_KEY` differs. That is deliberate: Free and Pro read each other's data,
which is the upgrade path. Preserve it.

### Per-context breakdown

| Context | Enum ord. | Entity property target | What the data is | Live? |
|---|---|---|---|---|
| `PROJECT` | 3 | `/rest/api/3/project/{id}/properties/{key}` | `...-project-folders_N` and `...-project-queues_N` — the shared, admin-authored queue definitions (jql, columns, visibilityGroups) and the folder tree | **Live.** `queues.component.ts:86` and `:89` |
| `USER` | 0 | `/rest/api/3/user/properties/{key}?accountId=` | `user-project-queues-<pid>`, `user-project-folders-<pid>`, `my-user-project-queues-<pid>`, `my-user-project-folders-<pid>`, `my-user-project-queues-view-<pid>` — per-user personal queues, personal folders, and view preferences, all namespaced by project | **Live.** `queues.component.ts:93, 100, 108, 118` |
| `TICKET` | 1 | `/rest/api/3/issue/{key}/properties/{key}` | n/a | **DEAD.** Branch-only (`storage.service.ts:45, 61`). Zero `new StorageService(StorageContext.TICKET, ...)` in the repo |
| `DASHBOARD` | 4 | `/rest/api/3/dashboard/{dashboardId}/items/{itemId}/properties/{key}` | n/a | **DEAD.** Branch-only (`storage.service.ts:47, 63`) |
| `APPLICATION` | 2 | `/rest/atlassian-connect/1/addons/{APP_KEY}/properties/{key}` | n/a | **DEAD.** Branch-only (`storage.service.ts:49, 65`) |

The inventory counts (PROJECT 4 / USER 6 / TICKET 2 / DASHBOARD 2 / APPLICATION 2) are *enum token*
occurrences, not distinct stores. PROJECT 4 = 2 constructions + 2 switch branches; USER 6 = 4
constructions + 2 branches; TICKET/DASHBOARD/APPLICATION 2 each = the save/get branches only.

### (a) The 2 APPLICATION sites — Trap 2

`storage.service.ts:49-50` (save) and `:65-66` (get), reaching
`JiraService.saveApplicationProperties` (:221-230) and `getApplicationProperties` (:201-219).
They store an app-global, tenant-scoped blob under the Connect addon property namespace. **Nothing in
the app ever selects this context**, so the store is empty on every existing tenant.

**Verdict: do not migrate, delete the branch.** If the lead wants the capability kept alive for a
future global-settings feature, `@forge/kvs` `kvs.set/get` is the one-line substitute and needs
`storage:app` in the manifest — but adding it now is speculative. There is no data to preserve and no
user-visible behaviour to lose.

### (b) What DASHBOARD maps to

Forge has no dashboard-item entity property context, correct. But the question is moot here:
the branch is unreachable. There is no `new StorageService(StorageContext.DASHBOARD, ...)`.
The `dashboards` route (`project-routing.module.ts:18`) exists and `DashboardsComponent` compiles, but:
- no `routerLink` or `router.navigate` anywhere in the app points at it — it is URL-hash-only,
- the one line that would have driven it, `dashboards.component.ts:283`
  (`JiraService.getCountAndLastIssueForJQL(widget.jql, true)`), is **commented out**,
- `dashboards.component.ts:392` onward is a commented-out `layoutConfig` block.

The dashboards feature is unfinished, half-commented, and unnavigable. **Recommend dropping the whole
`modules/project/dashboards` tree from the Forge port** — that also removes the 3
`/rest/api/3/dashboard/...` AP.request sites (:172, :179, :193) and the widget `showJQLEditor` site
from section 3, cutting the migration surface measurably. Flag this to the product owner as a
deliberate scope decision, not an oversight.

---
## 6. Does `development` compile?

**Confirmed. It does not compile. `src/app/services/jira.service.ts` is missing one closing brace,
and the missing brace belongs to `getSavedFilters()`.**

The method opens at `:483` and its `try/catch` closes at `:491`, but the method body itself is never
closed:

```ts
  static async getSavedFilters() {          // :483
    try {                                   // :484
      const userGroupResponse = await this.AP.request({   // :485
        url: `/rest/api/3/filter/my`,       // :486
        type: "GET",
        contentType: "application/json",
      });                                   // :489
      return userGroupResponse;             // :490
    } catch (e) {}                          // :491
                                            // :492  <-- MISSING `}` HERE
  static async getAssignees(projectKey: string) {        // :493
```

Brace-depth trace of the file: depth is 1 (inside the class body) at `:482`, and after `:491` it is
**2** where it should be 1. It never recovers — `:523` closes `getSavedFilters` instead of the class,
and the file ends at depth 1 with the class `JiraService` unterminated. Net: one unbalanced `{`.

Consequences beyond the parse error: `getAssignees` (:493) and `assignUserToIssue` (:506) are
lexically nested inside `getSavedFilters`, so even if a tolerant parser accepted it they would not be
static members. Their two callers,
`src/app/modules/project/grid/autocomplete/autocomplete.component.ts:56` and `:98`, would fail.

Also note the surrounding code style diverges here — `:504` and `:506-522` use two-space-plus-trailing
whitespace and `{ accountId: assigneeId }` unformatted, unlike the prettier-clean rest of the file
(`.prettierrc.json` exists). The assignee/assign-user block looks like an uncommitted work-in-progress
that was never run. **Not fixed, per instruction.** One character, `:492`.

---

## 7. JSM specifics

### servicedeskapi usage — exactly one, and it is load-bearing

`jira.service.ts:401-407`, `getProjectQueues(projectIdOrKey)` →
`/rest/servicedeskapi/servicedesk/projectId:${projectIdOrKey}/queue`

Note the `projectId:` prefix — that is the JSM API's service-desk-by-project-id lookup form, not a
typo and not a template bug.

Single caller: `src/app/modules/project/queues/import-queues/import-queues.component.ts:70`
(`loadQueuesForProject`, reads `queues.values`). Reachable: `queues.component.ts:288` opens
`ImportQueuesComponent` as a Material dialog. This is the **import-native-JSM-queues feature** — the
onboarding path that lets a customer pull their existing JSM queues into the app instead of
retyping them. Losing it does not break existing queues but guts first-run value.

Forge: `requestJira` handles the path fine; the manifest needs the JSM scope
(`read:servicedesk-request:jira-service-management` / `read:queue:jira-service-management`,
confirm against the current scope table). This is the one place the port needs a non-Jira-platform scope.

### JSM-only modules or conditions in the PRO descriptor

**None.** `src/assets/advanced-queues-pro-atlassian-connect.json` declares exactly three module types:
`jiraProjectPages` (1), `webSections` (1), `adminPages` (1). No `jiraServiceDeskQueues`, no
`serviceDesk*` module, no `jira_service_desk_project` or `project_type == service_desk` condition.
The only conditions on the project page are `user_is_logged_in` plus the enablement `or` on
`com.appbox.ai.advanced.queues_project-admin-settings.advancedQueuesEnabled`.

Implication: **the app currently renders its project page on every Jira project type, not just JSM**,
despite being named and marketed "for Jira Service Management". Only the import feature is genuinely
JSM-dependent, and it fails soft (`getProjectQueues` is unguarded — no try/catch at :401-407, unlike
its neighbours — so on a non-JSM project it will reject and `queues.values` throws on undefined).
That is a real latent bug worth carrying into the Forge port as a fix, or fixing by adding
`jira_service_desk_project` to the module condition / `jira:projectPage` `conditions` in `manifest.yml`.

### Licence requirement

- PRO descriptor: `"enableLicensing": true`. FREE descriptor: key absent (= false).
  Local and QA descriptors: absent, so unlicensed — expected for non-prod.
- The **app code enforces nothing**. `ALLOW_UNLICENSED: true` in *both* variants
  (`src/app/environment.ts:12`, `:26`) and no code reads it. `FREE_VERSION` / `PAID_VERSION` flags
  exist (`:13-14`, `:27-28`) — grep them before assuming the free/pro feature split is enforced
  client-side; the licence check is Marketplace-side only.
- Both descriptors declare scopes `READ`, `WRITE`, `DELETE`. `DELETE` is not obviously exercised —
  there is no DELETE-method AP.request in the file. Do not carry a delete scope into the manifest
  without justifying it.
- `lifecycle.installed: /api/installed/v2` and `uninstalled: /api/uninstalled/v2` are served by
  `build-server/`. Forge has no lifecycle webhooks of that shape; whatever those endpoints record
  (install tracking) has no port and should be dropped or replaced with a Forge install trigger.

### Variant selection is a hand-edit, not a build flag

`src/app/environment.ts:30` — `export const ENVIRONMENT = environments["ADVANCED_QUEUES_FREE"];`

`angular.json` `fileReplacements` swaps `src/environments/environment.ts` (a *different*, near-empty
file holding only `production: true|false`), not `src/app/environment.ts`. So **the repo as committed
builds the FREE variant for every configuration, including `build-prod`.** Whoever ships Pro edits
line 30 by hand. In Forge this must become two manifests / two `environment` values driven by the
build, not a tracked source edit.

---

## Machine-readable verdicts

Merge this object into `inventory.json` as `apVerdicts` (this survey has write access to this file
only, so the merge is left to the lead).

```json
{
  "apVerdicts": {
    "src/assets/js/advanced-queues.js": {
      "verdict": "loaded-but-all-AP-dead",
      "referencedFrom": "src/index.html:13",
      "inAngularScripts": false,
      "inDescriptor": false,
      "sites": {
        "AP.context:10": "dead - guard for a ResizeSensor on #response-template-wrapper, an element that does not exist in this repo",
        "AP.context.getContext:11": "dead - same block",
        "AP.resize:16": "dead - same block; real resize is project.component.ts:51",
        "AP.getCurrentUser:61": "broken - callback-style legacy API awaited as a promise, resolves undefined; only feeds ga(set,userId)"
      },
      "liveSideEffects": ["console.error override (RT [E]: prefix, Response Templates leftover)", "Google Analytics UA-181882142-5"],
      "breaksIfRemoved": "nothing user-visible; loses GA only",
      "action": "delete file and its script tag, plus the ResizeSensor script tag"
    },
    "AP.events.on@src/app/services/jira.service.ts:525": {
      "verdict": "load-bearing",
      "events": ["flag.action"],
      "handler": "window.open(UtilsService.getIssueUrl({key: event.actionIdentifier}), _blank)",
      "reachableFrom": ["src/app/modules/project/grid/grid.component.ts:61 setInterval", "grid.component.ts:88 checkForNewIssues", "grid.component.ts:96 showNotification with actions", "jira.service.ts:480 AP.flag.create"],
      "breaksIfRemoved": "new-issue toast still renders with an action link that does nothing",
      "substitute": "showFlag from @forge/bridge (onClose resolves the actionId) + router.open from @forge/bridge instead of window.open"
    },
    "AP.jira.showJQLEditor@src/app/services/jira.service.ts:148": {
      "verdict": "wrapper-dead-capability-live",
      "wrapperCallers": [],
      "realCallSites": ["src/app/modules/project/queues/queue/queue.component.ts:155", "src/app/modules/project/dashboards/widget/widget.component.ts:54"],
      "consumedBy": ["queue.component.ts:158 jqlEditorCallback -> this.queue.jql", "widget.component.ts:57 jqlEditorCallback -> this.widget.jql"],
      "triggeredBy": ["queue.component.html:81 Use JQL Builder", "widget.component.html:33 Use JQL Builder"],
      "breaksIfRemoved": "Use JQL Builder button inert in both editors; raw JQL text entry still works",
      "substitute": "no @forge/bridge equivalent - @atlassianlabs/jql-editor, or textarea + /rest/api/3/jql/parse validation"
    }
  },
  "apRequestFamilies": {
    "plumbing": {"count": 2, "lines": [18, 38], "note": "jira.service.ts:13-27 is the single shim all 33 real calls funnel through"},
    "/rest/api/3/project/*": 7,
    "/rest/api/3/user/*": 6,
    "/rest/api/3/search/jql": 4,
    "/rest/api/3/issue/*": 3,
    "/rest/api/3/dashboard/*/items/*/properties": 3,
    "/rest/atlassian-connect/1/addons/*": 3,
    "/rest/api/3/myself": 1,
    "/rest/api/3/jql/match": 1,
    "/rest/api/3/field": 1,
    "/rest/api/3/mypermissions": 1,
    "/rest/api/3/groups/picker": 1,
    "/rest/api/3/filter/my": 1,
    "/rest/servicedeskapi/*": 1
  },
  "nonApiV3Paths": [
    {"line": 203, "path": "/rest/atlassian-connect/1/addons/${ENVIRONMENT.APP_KEY}/properties/", "forge": "no equivalent - @forge/kvs; currently unreachable, delete"},
    {"line": 210, "path": "/rest/atlassian-connect/1/addons/${ENVIRONMENT.APP_KEY}/properties/${property}", "forge": "no equivalent - @forge/kvs; currently unreachable, delete"},
    {"line": 224, "path": "/rest/atlassian-connect/1/addons/${ENVIRONMENT.APP_KEY}/properties/${property.key}", "forge": "no equivalent - @forge/kvs; currently unreachable, delete"},
    {"line": 403, "path": "/rest/servicedeskapi/servicedesk/projectId:${projectIdOrKey}/queue", "forge": "requestJira works; needs a JSM scope in manifest.yml", "live": true, "caller": "src/app/modules/project/queues/import-queues/import-queues.component.ts:70"}
  ],
  "storage": {
    "singleFile": "src/app/services/storage.service.ts",
    "alsoWrites": "src/app/services/jira.service.ts:288 saveProjectSettings (unchunked, admin settings key)",
    "keyFormat": "${APP_BASE_KEY}-${storageBaseKey}_${chunkIndex}",
    "appBaseKeySharedAcrossVariants": "com.appbox.ai.advanced.queues",
    "PROJECT": {"live": true, "target": "/rest/api/3/project/{id}/properties", "keys": ["project-folders", "project-queues"], "data": "shared admin-authored queue definitions and folder tree", "sites": ["queues.component.ts:86", "queues.component.ts:89"]},
    "USER": {"live": true, "target": "/rest/api/3/user/properties?accountId=", "keys": ["user-project-queues-<pid>", "user-project-folders-<pid>", "my-user-project-queues-<pid>", "my-user-project-folders-<pid>", "my-user-project-queues-view-<pid>"], "data": "personal queues, folders and view prefs per project", "sites": ["queues.component.ts:93", "queues.component.ts:100", "queues.component.ts:108", "queues.component.ts:118"]},
    "TICKET": {"live": false, "reason": "branch-only at storage.service.ts:45,61; no constructor anywhere"},
    "DASHBOARD": {"live": false, "reason": "branch-only at storage.service.ts:47,63; dashboards route has no nav link and dashboards.component.ts:283 is commented out", "forgeMapping": "none needed - drop the modules/project/dashboards tree"},
    "APPLICATION": {"live": false, "reason": "branch-only at storage.service.ts:49,65", "wouldStore": "app-global tenant-scoped blob under Connect addon properties", "forgeMapping": "@forge/kvs + storage:app scope, but no data exists - recommend delete"}
  },
  "compiles": {
    "development": false,
    "file": "src/app/services/jira.service.ts",
    "line": 492,
    "error": "missing closing brace for getSavedFilters() opened at :483; try/catch closes at :491, class JiraService never terminates",
    "sideEffect": "getAssignees:493 and assignUserToIssue:506 are lexically nested, breaking autocomplete.component.ts:56 and :98",
    "fixed": false
  },
  "jsm": {
    "servicedeskapiSites": ["src/app/services/jira.service.ts:403"],
    "jsmOnlyModules": [],
    "jsmOnlyConditions": [],
    "descriptorModuleTypes": ["jiraProjectPages", "webSections", "adminPages"],
    "licensing": {"pro": true, "free": false, "local": false, "qa": false, "enforcedInCode": false, "note": "ALLOW_UNLICENSED true in both variants and read by nothing"},
    "scopes": ["READ", "WRITE", "DELETE"],
    "deleteScopeUnused": true,
    "latentBug": "getProjectQueues (jira.service.ts:401-407) has no try/catch unlike its neighbours; on a non-JSM project it rejects and import-queues.component.ts:71 throws on queues.values",
    "renderConditionGap": "no project_type/service_desk condition, so the project page shows on every Jira project type"
  },
  "variantSelection": {
    "file": "src/app/environment.ts",
    "line": 30,
    "mechanism": "hand-edited source constant, NOT an angular.json fileReplacement",
    "committedValue": "ADVANCED_QUEUES_FREE",
    "impact": "every build configuration including build-prod currently produces the Free variant"
  }
}
```

---

## Addendum — variant flags are read by nothing

`grep -rn "FREE_VERSION|PAID_VERSION|ANALYTICS_ENABLED" src/app` excluding `environment.ts` returns
**zero hits**. There is no client-side free/pro feature gating at all: the two editions are
byte-identical apps distinguished only by descriptor `key` and `enableLicensing`. Anyone planning a
Forge feature split is starting from scratch, not porting one.
