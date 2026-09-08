# Findings 03 — ui-porter (Phase 4)

Build: `npm run ui:build` exits 0. Verification grep over
`static/forge-angular-app/src/app/modules/` for `window['AP'] | AP.jira | AP.resize`
comes back empty (a comment of mine tripped it on the first pass; reworded).

## 1. `queue.component.ts` — JQL editor

`window['AP'].jira.showJQLEditor(options, this.jqlEditorCallback)` and its callback
are gone. Ported Risk Register's in-house editor verbatim into
`src/app/services/jql-codemirror.ts` and `src/app/services/jql-autocomplete.service.ts`
(RR was the most recent working copy; Checklist's was older). One edit to the copy:

```ts
// jql-autocomplete.service.ts, ensureProcessShim()
hrtime: Object.assign(() => [0, 0], { bigint: () => (globalThis as any).BigInt(0) }),
```

RR's `BigInt(0)` does not compile here — `TS2583: Cannot find name 'BigInt'`, this
app's tsconfig `lib` predates it. Reading it off `globalThis` keeps runtime
behaviour identical and leaves `tsconfig.json` (not mine) alone.

Mounting: the order permits new files only under `src/app/services/`, so there is no
new dialog component. The editor replaces the plain `<textarea>` **in place** — the
field itself is the builder — and the "Use JQL Builder" button is deleted along with
the call site it triggered. "Saved Filters" is untouched.

The host lives behind `*ngIf="pageLoaded"`, so the editor is created from a
`@ViewChild('jqlHost') set` rather than `ngAfterViewInit`, which would run before the
element exists. `ngOnDestroy` destroys the `EditorView` (the dialog is created per
open, so without this every open leaks one editor and its listeners).

Two places set `queue.jql` from outside the editor — `onFilterSelected` and
`toggleSavedFilters` — and now go through `setJql()`, which dispatches the change
into the CodeMirror document as well. Assigning the model alone would have left the
old query visible on screen while a different one was saved.

Autocomplete, values, users, icons and validation all go over `JiraService.AP.request`
(→ `requestJira`). No resolver added, no `invoke`.

## 2. `grid.component.ts` — issue dialog

`window['AP'].jira.openIssueDialog(key, cb)` → `new ViewIssueModal({ context: { issueKey } }).open()`,
with `router.open('/browse/<key>')` as the fallback (`preventDefault()` has already
cancelled the anchor by then, so a failure with no fallback is a dead click).
The Connect `cb` was empty, so no `onClose` is passed and nothing refreshes on dismiss.

**One path only.** `jira-issue-key-renderer.ts` is left exactly as it was:
`href="javascript:void(0)"`, no click handler. Adding one is what PR #9 did and it
fired the dialog twice. Deliberately NOT taking Risk Register's version of that
renderer, which moves the handler onto a real `href` — it is a better link (cmd-click,
middle-click, open-in-new-tab), but adopting it means deleting the `onCellClicked`
branch in the same change, and the order fixes the single path at `onCellClicked`.
Worth doing as its own change if the UX gap matters.

## 3. `project.component.ts` — resize

`ngAfterViewInit` deleted whole: it existed only to measure `#project-root` and feed
`AP.resize`. `AfterViewInit` dropped from the imports and the class signature.
Also `'/assets/images/advanced-queues-dark.svg'` → `'assets/…'` (Trap 14).

## 4. `index.html` + `src/assets/js/`

All three script tags removed; `src/assets/js/` (ResizeSensor.js, advanced-queues.js)
deleted. `src/assets/images/` is untouched. Analytics `UA-181882142-5` and the
`RT [E]:` console.error override go with it, as agreed.

## Reported, not fixed — viewport clamps

Not my files, and the order says report. These are the `100vh` / `max-height` clamps
that Risk Register found deadlock Forge's auto-resizer, so they want removing in the
same change as the `AP.resize` deletion:

- `src/styles.scss:11-12` — `html, body { height: 100vh !important; max-height: 100vh; }`
- `src/styles.scss:50` — `.tableFixHead { height: calc(100vh - 290px); }`
- `src/app/modules/project/project/project.component.scss:18` — `.project-root { height: calc(100vh - 5px); overflow-y: hidden; }`
- `src/app/modules/project/grid/grid.component.scss:5,10` — `.prioritization-grid { height: calc(100vh - 141px) !important; }` and the `.alert-visible` variant

The grid ones are the load-bearing pair: ag-Grid needs a bounded height, so they
cannot simply be deleted — the frame needs a real height source once `100vh` stops
meaning the host page's viewport.

## Other notes

- `clickOk()` now rejects a name longer than `DEFAULT_LIMITS.QUEUE_NAME` (32) in code.
  It was enforced only by `[maxlength]` on the input, which paste and import bypass.
- No optimistic-update rollbacks or flags were added here: this dialog persists
  nothing. It closes with `{queue, folder}` and `queues.component` (not mine) does the
  write, so a flag or a snapshot at this layer would duplicate or mislead.
- The `<label for="queue-jql">` now points at the editor's host `div` rather than a
  `<textarea>`, so clicking the label no longer focuses the field. Cosmetic, and
  fixing it properly means labelling CodeMirror's inner `contenteditable`.
- No unit test added: the ported services are verbatim from a shipping app and the
  new logic here is a mount, a destroy and one dispatch. The build is the check.

## Dependencies added (`static/forge-angular-app/package.json`)

`@codemirror/state ^6.7.1`, `@codemirror/view ^6.43.9`, `@codemirror/commands ^6.11.0`,
`@codemirror/autocomplete ^6.20.3`, `@atlaskit/jql-autocomplete ^3.1.0`
(pulls `@atlaskit/jql-parser`), `antlr4ts ^0.5.0-alpha.4`, `@forge/jira-bridge ^1.0.0`.
Versions match Risk Register's, which is a working Angular 13 build. Installed with
`--legacy-peer-deps`, as `ui:install` does. The engine lands in lazy chunks
(`atlaskit-jql-autocomplete`, ~127KB gzipped total), not in `main`.
