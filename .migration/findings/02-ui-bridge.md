# Finding 02 — ui-bridge (Phase 3 barrier)

**Status:** done. `npm run ui:build` exits 0.
**Owner files touched:** `static/forge-angular-app/src/app/services/jira.service.ts`,
`static/forge-angular-app/src/app/app.component.ts`,
`static/forge-angular-app/package.json`, plus one line in
`static/forge-angular-app/tsconfig.json` (see "One file outside the list").

Zero call sites edited. All 31 `this.AP.request(...)` sites in `jira.service.ts`
and both `JiraService.getContext()` consumers
(`modules/project/project/project.component.ts:36`,
`modules/project/grid/autocomplete/autocomplete.component.ts:52`) are byte for
byte unchanged. No component was opened for editing.

## What changed

### 1. The shim (`jira.service.ts:1-140`)

`static AP` no longer reads `window['AP']`. It is now a plain object over
`@forge/bridge`, shaped exactly like the Connect surface:

- **`request`** — `requestJira`. Accepts both call forms already in the file:
  a string (`this.AP.request('/rest/api/3/myself')`, line 232) and the
  `{url, type, contentType, data}` object every other site uses. Resolves the
  **parsed body**, as Connect's wrapper did, and **rejects** on non-ok with
  `Jira responded <status>: <first 500 chars>`.
  - **The latent hang is fixed, not ported.** The old wrapper (old lines 13-27)
    took the `else` branch when `window['AP']` was undefined, logged
    `'AP is not defined'` and then neither resolved nor rejected. Every
    `await this.AP.request(...)` on that path hung forever, and the six
    `catch (e) {}` blocks in this file would never have fired. There is no such
    branch now: the bridge is imported statically, so there is nothing to be
    undefined, and every path resolves or throws.
  - Empty body returns `undefined`; unparseable body returns the raw text
    rather than throwing (`PUT`/`DELETE` property writes return 204 with no
    body, and the callers at lines 222/350 ignore the return).
- **`context.getContext`** — delegates to `JiraService.getContext()`.
- **`flag.create`** — Connect's `{title, body, type, close, actions}` →
  `showFlag`'s `{id, title, description, type, isAutoDismiss, actions}`.
  Signature identical, so `showNotification` (line 541) is untouched.
- **`navigator.reload`** — `view.refresh()`, rejection swallowed. Not every
  module view can refresh and the effect is cosmetic.

Deleted rather than stubbed: `user`, `jira`, `resize`, `events`.

### 2. `AP.events.on('flag.action')` — the only new bridge work

The module-top-level handler (old lines 495-497) is gone, along with its
`window.open`. Two facts drove the replacement:

- **The order's description of the API is wrong for the installed version.** It
  says `showFlag(...)` "resolves an object whose `onClose` tells you which
  action fired". In `@forge/bridge@6.3.1`, `showFlag` is **synchronous** and
  returns `Flag { close: () => Promise<boolean | void> }` — there is no
  `onClose` and no action identifier reported back. Actions are delivered the
  other way round: `FlagOptions.actions: { text: string; onClick: () => void }[]`.
  Source: `node_modules/@forge/bridge/out/flag/flag.d.ts`. So the handler is
  wired per action, inside `flag.create`, which is where the order wanted it
  anyway.
- **The payload is a map.** `modules/project/grid/grid.component.ts:92-96` builds
  `const actions = {}; actions[issueKey] = issueKey;` — Connect's
  `{actionIdentifier: label}` form, where the identifier is the issue key. That
  is exactly what the old handler assumed when it read `event.actionIdentifier`.
  `flag.create` therefore does `Object.entries(...).map(([issueKey, label]) => ...)`.

`window.open` → `router.open`, per the order (a Forge iframe cannot reliably
open a window). **The URL is now the product-relative `/browse/${issueKey}`, not
`UtilsService.getIssueUrl()`.** `getIssueUrl` calls `getParentDomain()`
(`utils.service.ts:62-74`), which resolves the host from `xdm_e`,
`ancestorOrigins[0]` or `AP._hostOrigin` — all three are Connect-era signals
that are absent or wrong inside a Forge frame, so it would have produced a link
to the app's own resource origin. `utils.service.ts` is untouched, as ordered;
this shim simply stops depending on that function. `router.open` resolves a
relative path against the host product.

Flag ids are `aq-${Date.now()}-${counter++}` — the counter matters because the
grid raises one flag per new issue in a `for` loop, so several land in the same
millisecond and a timestamp-only id would collide and suppress flags.

`isAutoDismiss` defaults **by type**: an explicit `close` wins
(`close !== 'manual'`), otherwise errors stay until dismissed and everything
else auto-dismisses. `showNotification` always passes `close`, so this only
affects direct `flag.create` callers.

Checked with a throwaway node assert over the extracted translation (map →
`FlagAction[]`, the `onClick` URL, id uniqueness, the `type`/`isAutoDismiss`
defaults, and `actions` being absent rather than `[]` when there are none). It
passed; not committed, since the repo has no UI test harness.

### 3. `getContext` + `getModuleKey` (`jira.service.ts:107-140`)

`getContext()` now calls `view.getContext()` and adapts it to the
`{jira: {project, issue}}` shape the app already reads — both consumers reach
straight for `jiraContext.jira.project.key` / `.id`, so without the adapter they
would read `undefined` and the autocomplete would call
`/rest/api/3/user/assignable/search?project=undefined`.

The resolved context is cached, **except when it arrives without an
`extension`**. Angular calls this during bootstrap, before the bridge is
necessarily connected; caching that empty result would poison every later caller
for the life of the page.

`getModuleKey()` is new and reads `extension.moduleKey ?? moduleKey`,
`extension.type ?? type`, `extension.project.id ?? jira.project.id`, per the
order. Note for later verification: Risk Register's equivalent
(`jira.service.ts:337-395`) documents `moduleKey` as measured **top-level** on
all six of its modules and reads it top-level first. Both forms are `??` chains,
so they agree unless a context carries both keys with different values, which
none of the measured modules did. Worth one look at the real context on
`melon-inc` before release; nothing depends on it today.

### 4. Deletions in `jira.service.ts`

| Removed | Old line | Why |
| --- | --- | --- |
| `static openJQLEditor(options, callback)` | 148 | Zero callers. Not stubbed — a later order ships a real editor for the two component sites. |
| `static resize(width, height)` | 167 | Forge sizes the frame; there is no `resize` on the bridge. Removing the wrapper as well as `AP.resize` broke no build, confirming it had no component callers. |
| `JiraService.AP.events.on('flag.action', ...)` | 495-497 | No event bus on the bridge; see above. |

`UtilsService` is still imported — `sliceIntoChunks` uses it at line 249.

### 5. Routing (`app.component.ts`)

`AppComponent` now implements `OnInit`. `ngOnInit` reads `getModuleKey()`
inside **try/catch and `return`s on failure**: outside a Forge iframe (plain
`ng serve`) there is no context, and a throw during bootstrap stops Angular
rendering entirely — a blank panel that reads like a CSS bug.

Switch on `moduleKey`, then a fallback switch on `type`, then `console.warn`:

| `moduleKey` | fallback `type` | route |
| --- | --- | --- |
| `advanced-queues-project` | `jira:projectPage` | `/project/${projectId}/queues` |
| `project-enablement` | `jira:adminPage` | `/app-admin-panel/project-enablement` |

`app-routing.module.ts` is untouched and keeps `useHash: true`; both target
routes resolve against its existing `project/:id` and `app-admin-panel` lazy
children.

### 6. Dependency + one file outside the list

`@forge/bridge@^6.3.1` added to `static/forge-angular-app/package.json`
(installed with `--legacy-peer-deps`, matching `npm run ui:install`).

**`static/forge-angular-app/tsconfig.json` needed one line and is not on my
owned list.** The first build failed with:

```
node_modules/@forge/bridge/out/invoke/invoke.d.ts:1:59 - error TS2307:
Cannot find module '@forge/resolver/shared' or its corresponding type declarations.
```

`@forge/bridge`'s own typings `import type` from `@forge/resolver`, a
server-side package the UI does not install. Both sibling ports already set
`"skipLibCheck": true` (Backlog's `tsconfig.json:6`); this repo did not. Added
it with a comment. The alternative — pulling `@forge/resolver` into the UI's
dependencies for a type-only import — is worse. Flagging it because it is
outside the ordered file set; the only other way to a green build is a change
someone else owns.

## Verification

```
npm run ui:build   # exit 0
grep -rn "window\['AP'\]\|AP\." static/forge-angular-app/src/app/services/jira.service.ts
```

The grep returns only `this.AP.request` / `this.AP.flag.create` shim calls plus
two prose mentions of `AP.events` and `AP._hostOrigin` inside comments. No
`window['AP']` remains in the file.

---

## Contract

Everything below is stable for the `ui-porter` orders. `JiraService` is imported
from `src/app/services/jira.service`; all members are **static**.

### `JiraService.AP`

```ts
JiraService.AP.request(options: { url: string; type?: string; contentType?: string; data?: string } | string): Promise<any>
// Resolves the PARSED response body (undefined on empty, raw text if unparseable).
// REJECTS with Error('Jira responded <status>: <body>') on any non-2xx.

JiraService.AP.context.getContext(): Promise<any>          // alias of JiraService.getContext()

JiraService.AP.flag.create(options: {
  title?: string; body?: string;
  type?: 'info' | 'success' | 'warning' | 'error';         // anything else -> 'info'
  close?: 'auto' | 'manual';                               // omitted -> auto, except type 'error'
  actions?: { [actionIdentifier: string]: string };        // identifier = issue key, value = label; click opens /browse/<key>
}): Flag                                                   // SYNCHRONOUS. Flag = { close(): Promise<boolean | void> }

JiraService.AP.navigator.reload(): Promise<void>           // view.refresh(), never rejects
```

**Removed from `AP` — do not call, they will not compile:** `AP.user`,
`AP.jira` (and `AP.jira.showJQLEditor`), `AP.resize`, `AP.events`
(`AP.events.on` in particular). Use `AP.flag.create`'s `actions` for flag
clicks. `AP.request` accepts a bare URL string as a GET.

### `JiraService`

```ts
JiraService.request(data: any): Promise<any>               // thin wrapper over AP.request

JiraService.getContext(): Promise<any>
// { ...forgeContext, jira: { project, issue } }. Cached, but never a context
// that arrived without `extension`. Read `ctx.jira.project.id` / `.key`.

JiraService.getModuleKey(): Promise<{ moduleKey?: string; type?: string; projectId?: string }>

JiraService.isInJira(): boolean                            // unchanged (window.parent !== window)

JiraService.showNotification(
  title: string,
  body: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'success',
  close: 'auto' | 'manual' = 'auto',
  actions: { [issueKey: string]: string } = undefined
): void                                                    // signature unchanged from Connect
```

**Removed from `JiraService`:** `openJQLEditor(options, callback)` and
`resize(width, height)`. Every other static method on `JiraService`
(`getProjectProperties`, `saveProjectProperties`, `executeJQL`,
`checkIssuesAgainstJQLs`, `getUserPermissions`, `getAssignees`,
`assignUserToIssue`, `getSavedFilters`, `getUserGroups`, …) keeps its existing
signature — only the transport underneath them changed.
