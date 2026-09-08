import Resolver from "@forge/resolver";

// Advanced Queues has NO resolver functions, and that is deliberate.
//
// The Angular app talks to Jira through `requestJira` from @forge/bridge, so
// every call is attributed to the signed-in user without a round trip through
// here. There is no app-scoped storage to guard either: the APPLICATION storage
// context was branch-only with no constructor anywhere, so it is empty on every
// tenant, and decisions.md 5 rules out @forge/kvs on that basis.
//
// This file exists only because manifest.yml's two modules name a resolver
// function. Keep it empty: a resolver definition is a live endpoint that anyone
// on the site can call over the bridge whether or not the UI does, so an unused
// one is a liability rather than something neutral (Trap 2).
//
// When Phase 6 adds the install/upgrade carry-forward trigger, it goes here and
// brings its own `@forge/api` import with it — asApp() is legitimate inside a
// trigger, and only there.

const resolver = new Resolver();

export const handler = resolver.getDefinitions();
