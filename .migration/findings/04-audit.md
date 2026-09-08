# 04 — Forge auditor (Phase 7), adversarial pre-submission audit

Read-only. Tree: `forge/06-data`. Nothing was deployed, installed or tunnelled.

## Verdicts

| Claim | Verdict |
| --- | --- |
| C1 needs no resolver, and that is safe | SURVIVED on escalation, BROKEN on "needs no resolver" |
| C2 no carry-forward trigger needed | SURVIVED |
| C3 scope set is minimal | BROKEN (one unused scope, two redundant) |
| C4 manifest condition reproduces Connect | SURVIVED |
| C5 Trap 7 handled | SURVIVED |
| C6 licensing | BROKEN |
| C7 Connect-era leftovers | BROKEN (four) |

## First: the four green gates are narrower than they read

The gate scripts are not in this repo. They live in
`/Users/rahulabx2/Work/Appbox/connect-to-forge-migration/skill/scripts/`. Re-run from there,
all still green, but each is green for a reason that has nothing to do with this app.

1. `forge-audit.mjs` regex-matches `resolver.define("name", ... => { ... }` bodies and looks for
   `asApp()` inside them. This app has zero `resolver.define` calls, so the scan has zero blocks to
   examine and returns 0 findings by construction. It never reads `requestJira`. I confirmed this by
   pointing it at `jira.service.ts`, which contains all 33 Jira call sites: also 0 findings.
2. `check-scope-ceiling.mjs` maps each DECLARED scope up to a Connect verb. It cannot see a scope
   nothing calls, and it cannot see a call whose scope is missing. It reads the manifest, never the code.
3. `forge lint` does not run FSRT. Stated in the runbook.
4. `forge eligibility --environment production` reports on **version 1.1.0**, not this tree.
   `forge eligibility --environment development` reports 2.1.0. The production green is about a
   different artifact.

`forge version details --json` still demands a TTY. `forge version list --json` does not, and it
gives the same fields. Deployed major version 2 reports:

```
"scopes": "10", "connectKeys": "2", "functions": "1", "remotes": "0",
"egresses": [], "requiresLicense": false
```

Two of those contradict the working tree: `manifest.yml` sets `licensing.enabled: true` but the
deployed artifact reports `requiresLicense: false`, and `app.connect.key` declares ONE connect key
but the artifact reports two. The `dist/` bundle (22:31) is also newer than the deploy (22:14 local).
Whatever the platform gates validated, it is not what is on disk.

---

## FINDING 1 — BLOCKS/BREAKS. Project admin of any one project reads as admin of every project

`static/forge-angular-app/src/app/services/jira.service.ts:508`

```ts
url: `/rest/api/3/mypermissions?permissions=${permissions.join(",")}`,
```

No `projectId` and no `projectKey`. Five call sites pass
`["SYSTEM_ADMIN", "ADMINISTER", "ADMINISTER_PROJECTS"]`:

- `modules/project/queues/queues.component.ts:147`
- `modules/project/queues/add-edit-folders/add-edit-folders.component.ts:43`
- `modules/project/queues/edit-queues/edit-queues.component.ts:21`
- `modules/project/queues/queue/queue.component.ts:120`
- `modules/project/queues/import-queues/import-queues.component.ts:53`

`ADMINISTER_PROJECTS` is a PROJECT permission. Asked without a project context, Jira answers whether
the caller holds it in AT LEAST ONE project. So a user who administers a single unrelated project
gets `isAdmin = true` on every project page, and the shared project-level queue and folder editing UI
unlocks everywhere. This is the runbook Trap 1 bullet word for word: "Pass the project to permission
checks. ADMINISTER_PROJECTS cannot be evaluated without one, so administering any single project read
as admin everywhere."

The write is refused server side, because `PUT /rest/api/3/project/{id}/properties/{key}` needs
ADMINISTER_PROJECTS on THAT project. That is not a mitigation, it is the second half of the bug.
`AP.request` now throws on a non-ok response, and every `StorageService.save()` call in
`queues.component.ts` (lines 167, 209, 235, 242, 247, 265, 271, 321, 322, 324, 325, 328, 351, 352,
353, 382, 383 and more) is invoked with no `await` and no `.catch`. The UI updates optimistically,
the 403 becomes an unhandled promise rejection, and the user is shown an edit that was never stored.

None of the four gates can see this. `forge-audit.mjs` only inspects `resolver.define` bodies.

---

## FINDING 2 — C6. Licensing is declared and enforced nowhere

`manifest.yml:84` sets `licensing.enabled: true`. `ALLOW_UNLICENSED`, `FREE_VERSION` and
`PAID_VERSION` exist only as three keys in `app/environment.ts:12-14` and are read by nothing.
Grepped `licen`, `LICENSE`, `active` across every `.ts` and `.html`: no reader.

What actually happens on an unlicensed install: `licensing.enabled: true` causes Forge to populate
`license` on the object returned by `view.getContext()`. `JiraService.getContext()` spreads that
object through untouched and no component ever looks at `.license`. There is no resolver to gate
anything server side. So an expired trial, a lapsed subscription and a paid install are
indistinguishable at runtime: every queue, every edit and every write works.

The runbook asks for `forge install --license inactive` precisely because Response Templates shipped
an `ALLOW_UNLICENSED` flag that nothing read. This is the same flag, unread, in the next app.

Two things stop this being a clean "regression":

- The Connect app was identical. `advanced-queues-connect/src/app/environment.ts` has the same three
  keys and the same absence of any reader, and the Pro descriptor sets `enableLicensing: true`. So
  the live Marketplace listing already ships with no licence gate.
- The deployed Forge artifact reports `requiresLicense: false`, so the manifest change may not even
  be in the deployed version.

It is still a submission risk: the Forge listing is a fresh review, reviewers do exercise licence
state on paid apps, and the app has no read-only mode to fall back to. Ranking: risks a Marketplace
rejection, does not break an existing customer.

---

## FINDING 3 — C7. Undeclared third-party image egress to a stock-photo CDN

`modules/project/grid/autocomplete/autocomplete.component.ts` lines 29, 60, 66:

```ts
avatarUrl: 'https://cdn.pixabay.com/photo/2017/06/13/12/54/profile-2398783_1280.png'
```

Line 29 is unconditional, with the real value commented out on the same line
(`//params.node.data.fields.avatarUrls[16x16]`). Line 60 is the fallback for every assignee row.
Line 66 is the "Unassignee" entry. Present in the built bundle, chunk `937.0dc4a846e3a6d8d1.js`.

The manifest declares no `permissions.external`, and the comment at `manifest.yml:118` says so
deliberately to keep Runs on Atlassian. That leaves the app in the worst of both positions: the
Custom UI CSP has no `img-src` entry for `cdn.pixabay.com`, so the avatar is a broken image in the
inline assignee picker, and the only way to make it load is `permissions.external.images`, which
forfeits Runs on Atlassian (Trap 5). It is byte-identical in the Connect repo, where the vendor-served
CSP allowed it, so this is a Connect-era assumption that does not survive the move.

A JSM app that contacts a stock-photo CDN on every queue open is also a security-review question
independent of whether the image renders.

---

## FINDING 4 — C7. `getParentDomain()` is Connect-only and still builds three live hrefs

`services/utils.service.ts:62-73` is byte-identical to Connect:

```ts
if (this.getParameterByName('xdm_e')) { return decodeURIComponent(this.getParameterByName('xdm_e')); }
if (window['AP'] && window['AP']._hostOrigin && window['AP']._hostOrigin !== '*') { domain = window['AP']._hostOrigin; }
```

Neither `xdm_e` nor `window[AP]` exists in a Forge iframe. The function degrades to
`document.location.ancestorOrigins[0] || window.location.origin`, and the reference doc is explicit:
"The parent origin is the Forge CDN now, not the customer site. Anything depending on the host URL is
dead." Live callers:

- `modules/project/grid/renderers/jira/jira-issue-key-renderer.ts:19` — `issueUrl` for every issue
  key link in the grid, the primary interaction in the app
- `modules/project/queues/queues.component.html:168` — the issue-navigator link
- `modules/app-admin-panel/project-enablement/project-enablement.component.html:38` — project lead link
- `services/utils.service.ts:37` — `getIssueUrl`

The port knew. `jira.service.ts:66-67` says "router.open, not window.open ... because getParentDomain()
reads AP._hostOrigin and cannot resolve the host from inside a Forge frame", and the flag action was
switched to `router.open`. The other four call sites were not. The file documents its own bug and
ships it.

Same class, same file set: `modules/project/project/project.component.html:13,25` link to
`https://support.appbox.ai/...` and line 30 to `https://appbox.atlassian.net/servicedesk/customer/portal/13`
with `target="_blank"`, as plain anchors rather than `router.open`. Not egress in the manifest sense,
but a sandboxed Forge iframe does not navigate the top frame.

---

## FINDING 5 — C3. One scope nothing calls, two that are redundant

`read:avatar:jira` has no call site. Grepped every `/rest/` literal in the tree: no `/rest/api/3/avatar`
and no `/universal_avatar`. Avatars are only ever read out of `avatarUrls` already embedded in user and
issue JSON, and rendered as image URLs by the browser, which needs no scope. It is a consent prompt and
a review question for nothing.

`read:project.property:jira` and `write:project.property:jira` are redundant next to the classic
`read:jira-work` / `write:jira-work`, which already cover project entity properties. Harmless, but the
manifest comment presents them as load-bearing.

The reverse direction is clean. Every path in the tree maps to a declared scope:

```
/rest/api/3/field, /filter/my, /issuetype, /priority, /jql/match, /jql/parse,
/jql/autocompletedata[/suggestions], /search/jql, /search/approximate-count,
/project/{id}, /project/search, /project/{id}/properties[/{key}]      read:jira-work + project.property
/rest/api/3/myself, /user, /user/groups, /groups/picker,
/user/assignable/search, /mypermissions                               read:jira-user
/rest/api/3/user/properties[/{key}]                                   read+write:user.property:jira
/rest/api/3/issue/{key}/assignee                                      write:jira-work
/rest/servicedeskapi/servicedesk/projectId:{id}/queue                 read:servicedesk + read:queue
```

`check-scope-ceiling.mjs` cannot produce either half of this. It only walks the declared list upward.

---

## FINDING 6 — C1. The resolver the claim says is unnecessary is shipped anyway

`src/index.js` argues the empty resolver "exists only because manifest.yml two modules name a resolver
function", and in the next sentence quotes the rule against it: "a resolver definition is a live
endpoint that anyone on the site can call over the bridge whether or not the UI does". The reasoning is
circular. `resolver` is optional on `jira:projectPage` and `jira:adminPage`; it is only needed if the UI
calls `invoke()`, and this UI never does. The manifest names it on both modules and declares a
`function: resolver` block, and `forge version list --json` confirms `"functions": "1"` deployed.

The runbook non-negotiable is "A dead resolver is still a live endpoint ... Delete unused ones."
Security impact is low (zero definitions means `invoke()` finds no handler), but the app ships a live
FaaS endpoint and a Node 22 runtime it never calls, in contradiction of the rule the file cites.

`package.json` compounds it: `@forge/api` and `@forge/kvs` are declared dependencies and are imported
by nothing. A reviewer who sees `@forge/api` in a manifest with no resolver definitions will ask where
`asApp()` is.

---

## What I tried and could NOT break

### C1, the escalation half. SURVIVED.

The lead argument is that the allowlist rule targets a resolver-side proxy where `asApp()` and
`/rest/forge/1/app/` are reachable, and that client-side `requestJira` is already user-scoped. I tried
four ways to break it:

1. **Enumerated every path the shim can be handed.** `JiraService.AP.request` takes `options.url` and
   `options.type` verbatim with no prefix test, no method restriction and no normalisation, so any
   caller in the bundle can name any path. But every path it is actually handed is `/rest/api/3/` or
   `/rest/servicedeskapi/`, and each is permission-checked by Jira against the CALLER, not the app.
2. **Looked for endpoints where the app scope exceeds the user.** The candidates are the ones taking an
   arbitrary `accountId`: `getUserProperties`, `saveUserProperties` and `saveUserProperty`
   (`jira.service.ts:169, 190, 221`) all interpolate a caller-supplied `accountId` into
   `/rest/api/3/user/properties`. Reading or writing another user property requires Administer Jira,
   and Jira enforces that on the user, not the app. Same for `PUT /project/{id}/properties` (Administer
   Projects) and `PUT /issue/{key}/assignee` (Assign Issues). I found no endpoint in the set where the
   declared scope grants what the user lacks.
3. **Checked reachability of the admin surface from the unprivileged module.** Both modules load the
   SAME `resource: main` bundle and `app.component.ts` routes on `moduleKey`, so the project page
   (`isLoggedIn: true`, any user) ships `ProjectEnablementComponent` and `saveProjectSettings` into a
   frame the user controls. A non-admin can call them from the console. Jira refuses the write. The
   client-side route gate is cosmetic, which is correct, and is not an escalation.
4. **`/rest/forge/1/app/`.** Whether `@forge/bridge` requestJira forwards that prefix is not decidable
   from source, and the order forbids installing. Flagging it honestly: UNVERIFIABLE. It matters more
   here than in a normal Forge app because `app.connect.key` is set, which per runbook Phase 6 means the
   Connect add-on property store at `/rest/atlassian-connect/1/addons/com.appbox.ai.advanced.queues/properties`
   is still live on every upgraded tenant, and that store is app-authenticated rather than
   user-authenticated. One line in the shim (`if (!url.startsWith("/rest/api/3/") && !url.startsWith("/rest/servicedeskapi/")) throw`)
   would close the question without an install. Its absence is why the question is open at all.

Note the runbook mapping table is not on the lead side of this argument. It maps `AP.request(...)` to
`invoke("jiraRequest", ...)` "Via a resolver with a path allowlist", and reserves direct `requestJira`
for "comments/issue edits" on attribution grounds. The port inverted that for all 33 call sites. I could
not turn that into a demonstrated escalation, and I am not going to invent one.

### C2, stranded data. SURVIVED.

- `models/data.storage.keys.model.ts` is byte-identical Connect to Forge. `diff` is empty.
- `services/storage.service.ts` differs only by the removal of the DASHBOARD and APPLICATION branches.
  Key construction (`ENVIRONMENT.APP_BASE_KEY + "-" + storageBaseKey`, then `${base}_${index}`) is
  unchanged.
- `modules/project/queues/queues.component.ts` is byte-identical, so every `referenceKey` and every
  `storageBaseKey` is the one Connect wrote.
- `app/environment.ts` switches `ADVANCED_QUEUES_FREE` to `ADVANCED_QUEUES_PRO`, but `APP_BASE_KEY` is
  the same string `com.appbox.ai.advanced.queues` in both entries, so the switch does not renamespace.
- The APPLICATION claim checks out. In the CONNECT repo, `grep -rn "new StorageService("` returns six
  hits, all in `queues.component.ts`, all PROJECT or USER. `StorageContext.APPLICATION` and
  `.DASHBOARD` appear only inside `storage.service.ts` own branches. Never constructed, so the add-on
  property store and the dashboard item store are genuinely empty. Nothing is stranded.

Residue, not a finding: `StorageContext.TICKET`, `getTicketProperties` and `saveTicketProperties`
survive with no constructor anywhere. Dead code, no data behind it.

### C4, the display condition. SURVIVED.

Compared field by field against `advanced-queues-pro-atlassian-connect.json`. Connect uses a top-level
`conditions` LIST, which is an implicit AND, holding `user_is_logged_in` and an `or` of
`entity_property_equal_to` and `entity_property_exists` with `invert: true`. The Forge tree is the same
shape with `and`/`or` as maps and `invert` expressed as `not`. Property key, `objectName` and
`value: "true"` all match. I specifically checked the absent-property branch, which is the one that
would hide the app from every never-configured project, and it is present. I found no input where one
shows and the other hides.

Two cosmetic deltas, neither a visibility change: Connect named the admin page "Project Enablement"
inside a web section named "Advanced Queues", the Forge `jira:adminPage` title is "Advanced Queues";
and Connect `weight: 100` on the project page is dropped, which affects sidebar ordering only.

### C5, Trap 7. SURVIVED. There are two readers, not three.

`grep -rn "PROJECT_ADMIN_SETTINGS\\|advancedQueuesEnabled"` over every `.ts` and `.html` returns exactly
two read paths, and both go through `normaliseProjectAdminSettings`:

- `jira.service.ts:325` in `getProjectSettings`
- `project-enablement.component.ts:56` for the bulk project fetch

Writers (`saveProjectSettings`, `updateStatus`) do not need it. Shapes I tried against the coercion:
`"true"`, `"false"`, `"TRUE"` and `" true "` are all handled (`trim().toLowerCase() === "true"`); a real
boolean is passed through by reference, which is correct; `null` and a non-object return early, which is
correct; a numeric `1` would not coerce, but Connect `entityPropertyEqualTo` never wrote a number.

One narrow asymmetry worth knowing: the normaliser is MORE permissive than the manifest. A stored
`"TRUE"` would be read as enabled by the admin screen while `entityPropertyEqualTo value: "true"` does
a literal string compare and hides the module. Connect only ever wrote a boolean or exactly
`"true"`/`"false"`, so this is theoretical.

### Egress and Runs on Atlassian, beyond finding 3.

Scanned the built bundle for absolute external URLs. `styles.bc73f6868f8e61fd.css` has zero
`url(https://...)`, so the Google Fonts removal is real and the ag-grid font is genuinely local
(`agGridBalham.9d46b424b70f433b.woff`). `index.html` has no external `link` or `script`.
`xp.atlassian.com`, `statsigapi.net`, `featureassets.org`, `prodregistryv2.org`, `api.statsigcdn.com`
and `cloudflare-dns.com` are all in chunk `624`, which is the vendored `@forge/bridge` feature-gate
SDK, not app code. `manifest.yml` declares no `remotes` and no `permissions.external`, and the deployed
artifact confirms `"remotes": "0"` and `"egresses": []`. The only app-authored external hosts are the
three in findings 3 and 4, all in chunk `937`.

---

## Smaller, real, not ranked above

- `jira.service.ts:343` — `getAllProjects` builds `queryParams` then appends `query=${projectQuery}`
  with **no `&` separator**, producing
  `...&properties=com.appbox.ai.advanced.queues_project-admin-settingsquery=TERM`. Whenever a query is
  passed, the properties expansion is corrupted and the search term is never applied. Byte-identical in
  Connect, so pre-existing, and currently masked because the only caller
  (`project-enablement.component.ts:45`) passes an empty string. It becomes a live bug the moment the
  admin search box is wired up.
- Unencoded user input interpolated into URLs: `getGroups(query)` at line 521 and
  `getAssignees(projectKey)` at line 568 use no `encodeURIComponent`. Self-inflicted only, but it is the
  shape a scanner flags.
- `jira.service.ts:243` — the fallback avatar points at `assets/images/system-icon.png`, which does not
  exist. The comment acknowledges it. A shipped broken image reference.
- `jira.service.ts:420` — `console.log("Modified JQL:", jql)` and `autocomplete.component.ts:24`
  `console.log(params)` log issue data to the browser console on every render.
- `autocomplete.component.ts:69` — `} catch(error) {` sits at class-body level immediately after
  `ngOnInit`, not attached to any `try`. It parses as a method named `catch`. The error handling it
  looks like is not error handling.
- `JiraService.cache.userPermissions` is declared as a single slot and never read or written. Dead, and
  a trap if someone later wires it up, since the runbook requires keying on project plus sorted
  permission list.

## Not verified

- `forge version details --json` still requires a TTY. `forge version list --json` was used instead and
  carries the same fields.
- `forge install --license inactive` was not run. Out of scope by order.
- Whether `@forge/bridge` requestJira forwards `/rest/forge/1/app/` or
  `/rest/atlassian-connect/1/addons/`. Needs a live frame.
