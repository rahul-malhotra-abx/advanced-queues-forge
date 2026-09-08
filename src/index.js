import Resolver from "@forge/resolver";
import api, { assumeTrustedRoute, getAppContext, route } from "@forge/api";
import { kvs } from "@forge/kvs";

const resolver = new Resolver();

// asUser() for everything reachable from the UI. asApp() only in a trigger,
// or behind a permission check written INLINE in this same resolver.

export const handler = resolver.getDefinitions();
