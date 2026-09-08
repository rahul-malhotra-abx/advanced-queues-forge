// Values are pinned rather than implicit. APPLICATION (2) and DASHBOARD (4)
// have both been removed during the Forge migration, and with implicit
// numbering removing a non-last member silently renumbers the ones after it.
// Nothing persists these numbers today — storage keys are
// `${APP_BASE_KEY}-${storageBaseKey}_${index}` and carry no context id — but
// pinning them means that stays true by construction rather than by review.
export enum StorageContext {
  USER = 0,
  TICKET = 1,
  // 2 was APPLICATION: Connect's add-on property store, which Forge does not
  // serve. It was branch-only with no constructor, so it held no data.
  PROJECT = 3,
  // 4 was DASHBOARD, removed with the dashboards feature.
}
