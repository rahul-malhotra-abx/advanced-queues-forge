# Order 03 — forge-auditor (Phase 7)

**Repo:** `/Users/rahulabx2/Work/Appbox/advanced-queues/advanced-queues-forge`
**Branch:** `forge/06-data` — the tip, containing every phase.
**Deployed:** v2.1.0 on `development`, installed on `appbox-fulldev-2`.

You are read-only and adversarial. **You wrote none of this code, which is the
point.** Four Marketplace rejections on a previous migration happened because
the author's model said "this is authorized" and Atlassian's scanner disagreed.

**Your job is to REFUTE, not to confirm.** A report that says "looks good" is a
failed audit. Find the thing that breaks.

---

## Gates already run by the lead — do not just re-run and report green

```
forge-audit src/index.js     0 findings      (exit 0)
check-scope-ceiling          within ceiling  (exit 0)
forge lint                   No issues found
forge eligibility -e development   eligible for Runs on Atlassian
```

`forge version details` could not run — it demands a TTY even with `-e`. Note it
as unverified; do not attempt to force it.

These gates all compare the code to itself. **Assume they are insufficient and
look for what they structurally cannot see.**

---

## The claims this migration rests on. Try to break each one.

### C1 — "This app needs no resolver, and that is safe."

`src/index.js` is an empty `Resolver` with zero definitions. All Jira traffic
goes through `requestJira` from `@forge/bridge`, client-side, in
`src/app/services/jira.service.ts`.

The runbook's rule is: *"Allowlist paths in the generic proxy. `jiraRequest`
accepts `/rest/api/3/` and nothing else — never `/rest/forge/1/app/`."*
**This shim has no path allowlist at all.** The lead's reasoning is that the
rule targets a *resolver-side* proxy, where `asApp()` and `/rest/forge/1/app/`
are reachable, whereas client-side `requestJira` is already user-scoped so Jira
enforces the caller's own permissions.

**Is that reasoning correct?** Specifically: can `requestJira` from the browser
reach anything the signed-in user could not reach on their own — app properties,
`/rest/forge/1/app/`, or any endpoint where the app's scopes exceed the user's?
If yes, the missing allowlist is a real finding.

### C2 — "No carry-forward trigger is needed."

Claim: live data is Jira project and user entity properties, read via the same
REST API and identical key format Connect wrote them with, so nothing needs
copying. Check `storage.service.ts` and the key construction. **Find data that
would be stranded**, or confirm the key format genuinely matches.

### C3 — "The scope set is minimal and within the Connect ceiling."

Ten scopes. For each, find the call site that requires it. **Report any scope
nothing needs** — an unused scope is a consent prompt and a review question.
Then the reverse: find a REST call whose scope is missing.

### C4 — "The manifest condition reproduces Connect's behaviour."

`jira:projectPage` has `and: {isLoggedIn, or: {entityPropertyEqualTo, not: entityPropertyExists}}`.
Compare against the Connect descriptor at
`/Users/rahulabx2/Work/Appbox/advanced-queues/advanced-queues-connect/src/assets/advanced-queues-pro-atlassian-connect.json`.
**Does it hide or show the app in any case where Connect did the opposite?**

### C5 — "Trap 7 is handled."

`JiraService.normaliseProjectAdminSettings` coerces `advancedQueuesEnabled` when
it is a string. **Find a reader that bypasses it**, or a stored shape it gets
wrong. There were two readers; confirm there are not three.

### C6 — Licensing

`manifest.yml` sets `licensing.enabled: true`, but the survey found
`ALLOW_UNLICENSED`, `FREE_VERSION` and `PAID_VERSION` are **read by nothing**.
So what happens on an unlicensed install? The runbook wants
`forge install --license inactive` exercised. **You cannot install** — report
what the code would do, and whether shipping with no licence gate is a
Marketplace risk.

### C7 — Anything else that ships and should not

The port deleted a lot. Look for Connect-era leftovers still in the tree or the
built bundle: dead endpoints, `window['AP']` references, `xdm_e`, descriptors,
analytics, absolute `/assets/` paths.

---

## Rules

- **Read-only.** You have no write tools except the findings file below.
- You may read the Connect repo at
  `/Users/rahulabx2/Work/Appbox/advanced-queues/advanced-queues-connect` for
  comparison, and this repo. Nothing else.
- Read-only Forge commands only (`lint`, `eligibility`). **Never** `deploy`,
  `install`, `tunnel`, or any git command.
- Rank findings by whether they block a Marketplace submission, break a
  customer, or are merely untidy. Say which.
- If a claim above survives your attempt to break it, say so **and say what you
  tried** — an unexamined "confirmed" is worth nothing.

## Output

Full report to `.migration/findings/04-audit.md`. Return **at most 20 lines**:
one line per claim with a verdict of BROKEN / SURVIVED / UNVERIFIABLE, then the
single most serious finding.
