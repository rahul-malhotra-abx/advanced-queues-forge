# Order NN — <agent> — <slice>

<!-- Self-contained. An agent reading ONLY this file must be able to finish the
     task. If you are tempted to write "see 02-reference.md", paste the rows
     instead — an agent sent to find something reads 10x what it needed. -->

## Task
<one paragraph: what done looks like>

## Files you own
- `path/to/file`          # you may edit these
- `path/to/other`

## Files you may read but not edit
- `path/to/context`

## Contract you code against
```ts
// Paste the exact signatures from ui-bridge / resolver-author.
// Not a pointer to them. The signatures.
```

## Reference rows for this task
<!-- Paste the 10-20 relevant lines from the playbook. Nothing more. -->

## Done when
- [ ] <verifiable condition>
- [ ] `node scripts/forge-audit.mjs src/index.js` → 0 findings   (backend orders)
- [ ] builds clean

## Rules
Never run a repo-wide grep, find, or ls. If you need a fact that is not in this
order, STOP and return `NEED: <fact>`.
Write your report to `.migration/findings/NN-<agent>.md`. Return ≤20 lines.
