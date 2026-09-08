# Order 01 — ui-bridge (Phase 3 barrier)

**Repo:** `/Users/rahulabx2/Work/Appbox/advanced-queues/advanced-queues-forge`
**UI root:** `static/forge-angular-app/` (Angular 13.3.11, TypeScript 4.6.4)

You own exactly these, and nothing else:

- `static/forge-angular-app/src/app/services/jira.service.ts`
- `static/forge-angular-app/src/app/app.component.ts`
- `static/forge-angular-app/package.json` (to add `@forge/bridge`)

**Do not touch any component.** The four component-level call sites below belong
to a later `ui-porter` order. Leave them compiling against your shim.

---

## Goal

Replace the Connect `AP` surface with a `@forge/bridge` shim **shaped exactly
like `AP`**, so the 33 `AP.request` call sites in `jira.service.ts` are not
edited at all. Then add module-key routing to `app.component.ts`.

## The seam you are replacing

`jira.service.ts:13-34` currently holds:

```ts
  static AP: any = (() => {
      const jiraAP = window['AP'];
      // ... 13-27: a wrapper that NEITHER RESOLVES NOR REJECTS when AP is
      //            undefined. That is a latent hang. Fix it; do not port it.
  })();
  // 28-34 maps the surface onto one object:
  //   context: window['AP'].context,   user:   window['AP'].user,
  //   jira:    window['AP'].jira,      navigator: window['AP'].navigator,
  //   flag:    window['AP'].flag,      resize: window['AP'].resize,
  //   events:  window['AP'].events,
```

## Copy the shim, do not design one

`/Users/rahulabx2/Work/Appbox/backlog/backlog-prioritization-forge/static/forge-angular-app/src/app/services/jira.service.ts`
is the proven implementation. **You may read that file and Risk Register's
equivalent at
`/Users/rahulabx2/Work/Appbox/risk-register/risk-register-forge/static/forge-angular-app/src/app/services/jira.service.ts`.
Those two paths only.** Its `static AP = {...}` block gives you:

- `request` — `requestJira`, resolving to the **parsed body** as Connect's
  wrapper did, throwing on non-ok so callers that depend on rejection still work
- `context.getContext` — via a cached `getContext()`; never cache a context that
  arrived without an `extension`
- `flag.create` — Connect's `{title, body, type, close}` → `showFlag`'s shape
- `navigator.reload` — `view.refresh()`, swallowed if the view cannot

Use `requestJira` from `@forge/bridge`, **not** a resolver: issue edits must be
attributed to the user, and a resolver would attribute them to the app.

## What differs for Advanced Queues

| Item | Where | Do this |
| --- | --- | --- |
| `AP.request` ×33 | all in `jira.service.ts` | shim it; **edit no call site** |
| `AP.context.getContext` | `jira.service.ts:42` | shim it |
| `AP.flag.create` | `jira.service.ts:480` | shim it |
| `AP.events.on('flag.action')` | `jira.service.ts:525`, **module top level, outside the class** | See below. This is the only genuinely new work. |
| `AP.resize` | `jira.service.ts:167` | **Delete.** Forge auto-sizes; there is no `resize` on the bridge. |
| `AP.jira.showJQLEditor` | `jira.service.ts:148` wrapper | **Delete the wrapper — it has zero callers.** Do not stub `jira.showJQLEditor`; a later order replaces the two component sites with a real editor. |
| `AP._hostOrigin` | `utils.service.ts:70` | **Leave the file alone.** `window['AP']` is undefined on Forge, the guard falls through, and all three prior apps ship it unchanged. |

### `AP.events.on('flag.action')` — the one new piece

Current code, module top level:

```ts
JiraService.AP.events.on('flag.action', (event: any) => {
  window.open(UtilsService.getIssueUrl({ key: event.actionIdentifier }), '_blank');
});
```

It is the only consumer of the flag `actions` payload, reached from the grid's
new-issue notification (`grid.component.ts` polling → `showNotification` →
`AP.flag.create`). There is no `events` bus on `@forge/bridge`. Replace it with
the `showFlag` return value: `showFlag(...)` resolves an object whose `onClose`
tells you which action fired, and `router.open` from `@forge/bridge` replaces
`window.open` (a Forge iframe cannot reliably `window.open`).

Keep `flag.create`'s signature identical so `jira.service.ts:480` is untouched;
put the action wiring inside the shim's `flag.create`.

## Routing — `app.component.ts`

Connect put the route in the descriptor's URL. Forge loads one bundle for every
module and hands you a context instead. Add an `ngOnInit` switch. Read
`moduleKey`, `type` and `projectId` from
`view.getContext()` — `ctx.extension?.moduleKey ?? ctx.moduleKey`, same for
`type`, and `ctx.extension?.project?.id`.

```
advanced-queues-project  → /project/${projectId}/queues
project-enablement       → /app-admin-panel/project-enablement
```

Then a **fallback switch on `type`** (`jira:projectPage`, `jira:adminPage`) for
contexts that omit `moduleKey`, and a `console.warn` default.

Wrap the context read in try/catch and `return` on failure — outside a Forge
iframe (plain `ng serve`) there is no context, and **a throw during bootstrap
stops Angular rendering entirely**, which presents as a blank panel and reads
like a CSS bug. Backlog's `app.component.ts:44-112` is the reference.

## Verify before you report

```bash
cd /Users/rahulabx2/Work/Appbox/advanced-queues/advanced-queues-forge
npm run ui:build          # must exit 0
grep -rn "window\['AP'\]\|AP\." static/forge-angular-app/src/app/services/jira.service.ts
```

The grep must show only your own `JiraService.AP` shim references — no
`window['AP']` left in that file.

## Rules

- **Never run a repo-wide grep, find, or ls.** If you need a fact this order
  does not give you, stop and return `NEED: <fact>`. Do not go looking.
- Do not edit any component, `utils.service.ts`, `storage.service.ts`,
  `manifest.yml`, or anything in `.migration/`.
- Do not run `forge deploy`, `install`, `tunnel`, or any git command.

## Output

Write full notes to `.migration/findings/02-ui-bridge.md`, ending with a
**Contract** section: the exact signature of every method you expose on
`JiraService.AP` and on `JiraService` itself, since the next orders code against
it without reading your source.

Return to the lead **at most 20 lines**: what changed, the build result, and the
contract's method names only.
