# Order 02 — ui-porter (Phase 4)

**Repo:** `/Users/rahulabx2/Work/Appbox/advanced-queues/advanced-queues-forge`
**UI root:** `static/forge-angular-app/` (Angular 13.3.11, TypeScript 4.6.4)

You own exactly these:

- `src/app/modules/project/queues/queue/queue.component.ts` (+ `.html`)
- `src/app/modules/project/grid/grid.component.ts`
- `src/app/modules/project/grid/renderers/jira/jira-issue-key-renderer.ts`
- `src/app/modules/project/project/project.component.ts`
- `src/index.html`
- `src/assets/js/` (deletions only)
- any **new** files you add under `src/app/services/` for the JQL editor

**Do not edit** `src/app/services/jira.service.ts`, `utils.service.ts`,
`storage.service.ts`, `app.component.ts`, `manifest.yml`, or `.migration/`.
The bridge is done and its contract is below; code against it.

---

## Contract from Order 01 (already shipped, do not re-derive)

`JiraService.AP` — all static:

- `AP.request(opts | urlString): Promise<any>` — parsed body, **rejects** on non-2xx
- `AP.context.getContext(): Promise<any>`
- `AP.flag.create({title, body, type, close, actions}): Flag` — **synchronous**
- `AP.navigator.reload(): Promise<void>`

`JiraService`: `request`, `getContext`, `getModuleKey()`, `isInJira`,
`showNotification(title, body, type, close, actions)`.

**Gone and will not compile:** `AP.user`, `AP.jira`, `AP.jira.showJQLEditor`,
`AP.resize`, `AP.events`, `JiraService.openJQLEditor`, `JiraService.resize`.

---

## The four call sites

### 1. `queue.component.ts:155` — `window['AP'].jira.showJQLEditor(options, this.jqlEditorCallback)`

Triggered by a **Use JQL Builder** button in `queue.component.html`. The callback
writes `obj.jql` back into `this.queue.jql`. There is no `@forge/bridge`
equivalent, so port the in-house editor rather than researching one.

**Copy from** (you may read these three files, and only these):

- `/Users/rahulabx2/Work/Appbox/checklist/checklist-forge/static/forge-angular-app/src/app/services/jql-codemirror.ts`
- `/Users/rahulabx2/Work/Appbox/risk-register/risk-register-forge/static/forge-angular-app/src/app/services/jql-codemirror.ts`
- `/Users/rahulabx2/Work/Appbox/risk-register/risk-register-forge/static/forge-angular-app/src/app/services/jql-autocomplete.service.ts`

Risk Register's copy is the most recent. `@codemirror/*` needs TypeScript 4.5+;
this app is on 4.6.4, so it is satisfied — add the deps to
`static/forge-angular-app/package.json`.

Autocomplete data comes from Jira over the existing shim
(`JiraService.AP.request`), not a resolver. **Do not add a resolver.**

### 2. `grid.component.ts:163` — `window['AP'].jira.openIssueDialog(key, cb)`

Inside `onCellClicked`, guarded by `colId == "key"`, after
`preventDefault()`/`stopPropagation()`.

**Replace with `ViewIssueModal` from `@forge/jira-bridge`.** Risk Register did
exactly this; read
`/Users/rahulabx2/Work/Appbox/risk-register/risk-register-forge/static/forge-angular-app/src/app/modules/**/jira-issue-key-renderer.ts`
— if you cannot find it at that path, return `NEED:` rather than searching the repo.
Add `@forge/jira-bridge` to `package.json`. Wire the modal's close callback to
whatever the old `cb` did (in this app it is an empty function, so a no-op close
is correct).

**Context you need:** `jira-issue-key-renderer.ts` currently renders
`href="javascript:void(0)"`, deliberately inert so that `onCellClicked` is the
single path. Keep exactly one path. Do **not** also add a click handler on the
anchor — a closed PR (#9) did that and it fired the dialog twice.

### 3. `project.component.ts:46` — `window['AP'].resize(...)`

**Delete the call and whatever height-measuring code exists only to feed it.**
Forge sizes the frame itself. Watch for `100vh` / `max-height` clamps in
`styles.scss` or the component's styles: Risk Register found that those and the
auto-resizer deadlock each other, so they have to go in the same change. If you
find such clamps, report them; do not edit `styles.scss` without saying so.

### 4. `index.html:11-13` + `src/assets/js/`

Delete all three script tags and both local files:

```html
<script src="https://connect-cdn.atl-paas.net/all.js"></script>   <!-- :11 -->
<script src="/assets/js/ResizeSensor.js"></script>                <!-- :12 -->
<script src="/assets/js/advanced-queues.js"></script>             <!-- :13 -->
```

`advanced-queues.js` is a verbatim copy-paste from Response Templates: every
`AP.*` call in it is dead (its ResizeSensor targets `#response-template-wrapper`,
an element that does not exist in this repo), and its only live side effects are
a `console.error` override with an `RT [E]:` prefix and Google Analytics
`UA-181882142-5`. Losing the analytics is an accepted decision. The
`connect-cdn` tag is blocked by Forge's CSP anyway, and declaring egress for it
would forfeit Runs on Atlassian.

Also fix the absolute path at `project.component.ts:17`
(`'/assets/images/advanced-queues-dark.svg'` → `'assets/…'`) — a leading slash
escapes the app's scope on Forge (Trap 14).

---

## Verify before reporting

```bash
cd /Users/rahulabx2/Work/Appbox/advanced-queues/advanced-queues-forge
npm run ui:build                                   # must exit 0
grep -rn "window\['AP'\]\|AP\.jira\|AP\.resize" static/forge-angular-app/src/app/modules/
```

The grep must come back empty.

## Rules

- **Never run a repo-wide grep, find, or ls.** If you need a fact this order
  does not give you, stop and return `NEED: <fact>`. Do not go looking.
- Do not add a resolver or use `invoke`. This app needs neither — the shim talks
  to Jira directly through `requestJira`, and a dead resolver is still a live
  endpoint anyone on the site can call.
- Do not run `forge deploy`, `install`, `tunnel`, or any git command.

## Output

Full notes to `.migration/findings/03-ui-porter.md`. Return **at most 20 lines**:
what changed per call site, the build result, any new dependency added, and
anything you found that you were told to report rather than fix.
