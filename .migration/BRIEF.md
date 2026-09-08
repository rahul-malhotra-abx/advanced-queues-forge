# Migration brief — advanced-queues

<!-- Written ONCE, in Stage B. Every agent reads this and nothing else by default.
     Keep it under ~120 lines. If it grows past that, the excess belongs in
     inventory.json (facts) or a work order (task context), not here. -->

## What we are doing

Porting **advanced-queues** from Atlassian Connect to Forge. It is a **port, not a
rewrite**: the Angular app moves across essentially unchanged. What changes is
the layer underneath — `AP.*` becomes `@forge/bridge`, the server becomes
resolvers, JWT disappears. Data model, components and business logic stay.

## Target architecture

```
<app>-forge/
  manifest.yml          # one app, one manifest
  src/index.js          # every resolver and trigger. One file.
  static/forge-angular-app/
    src/    committed
    dist/   gitignored — what Forge actually serves
  .migration/           # this scaffold. Committed. Never shipped.
```

Forge uploads only `src/` and the directories named by `resources[].path`.
Nothing else in the repo reaches Atlassian.

## Invariants — violating any of these is a defect, not a style choice

1. **`asUser()` for everything reachable from the UI.** `asApp()` only in a
   trigger, or behind a permission check written INLINE in the same resolver.
2. **Never change a property key.** Customer data is keyed on them.
3. **Never declare egress.** No `remotes`, no `permissions.external`.
4. **Never exceed the Connect scope ceiling** (see `inventory.json.descriptor`).
5. **Comments and issue edits go through `requestJira` from `@forge/bridge`**,
   never a resolver — otherwise Jira attributes them to the app.
6. **Every optimistic UI update has a rollback.**
7. **Paid only.** `licensing.enabled: true`. No free listings, no variant switch.
8. **Read-only Forge commands only.** `deploy`, `install`, `tunnel` are the
   user's to run.

## Where things are

| | |
| --- | --- |
| Facts about the Connect app | `.migration/inventory.json` |
| Decisions already made | `.migration/decisions.md` |
| Current stage and next action | `.migration/STATE.md` |
| Your task | `.migration/orders/<your order>` |
| Full playbook (do NOT bulk-read) | `<path>/connect-to-forge-migration/` |

## Working rules

- **Your work order is your context.** It names your files and inlines what you
  need. Read those files; read nothing else.
- **Never run a repo-wide grep, find, or ls.** If you need a fact that is not in
  your order, STOP and return `NEED: <fact>`. The orchestrator adds it to
  `inventory.json` once, for everyone. Going to look for it yourself costs the
  team the same discovery N times.
- **Write output to `.migration/findings/`. Return ≤20 lines.** Your return value
  lands in the orchestrator's context; your findings land on disk.
- **Report what you could not do.** A silent omission is worse than a blocked task.
