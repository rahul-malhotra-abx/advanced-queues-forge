export const ALLOWED_JIRA_COLUMN_RENDERERS = {
  number: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraNumberRenderer',
    filter: 'agNumberColumnFilter'
  },
  string: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: '',
    renderer: 'jiraStringRenderer',
    filter: 'agTextColumnFilter'
  },
  resolution: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: 'name',
    renderer: 'jiraResolutionRenderer',
    filter: 'agTextColumnFilter'
  },
  status: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: 'name',
    renderer: 'jiraStatusRenderer',
    filter: 'agTextColumnFilter'
  },
  securitylevel: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: 'name',
    renderer: 'jiraStringRenderer',
    filter: 'agTextColumnFilter'
  },
  votes: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: 'votes',
    renderer: 'jiraNumberRenderer',
    filter: 'agNumberColumnFilter'
  },
  user: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraUserRenderer',
    filter: 'agTextColumnFilter'
  },
  priority: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraPriorityRenderer',
    filter: 'agTextColumnFilter'
  },
  textarea: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraRichTextRenderer',
    filter: 'agTextColumnFilter'
  },
  description: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraDescriptionRenderer',
    filter: 'agTextColumnFilter'
  },
  datetime: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraDateTimeRenderer',
    filter: 'agTextColumnFilter'
  },
  date: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraDateTimeRenderer',
    filter: 'agTextColumnFilter'
  },
  array_string: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraArrayStringRenderer',
    filter: 'agTextColumnFilter'
  },
  array_version: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraArrayVersionRenderer',
    filter: 'agTextColumnFilter'
  },
  array_component: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraArrayComponentRenderer',
    filter: 'agTextColumnFilter'
  },
  'gh-sprint': {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraSprintRenderer',
    filter: 'agTextColumnFilter'
  },
  'gh-epic-link': {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraEpicLinkRenderer',
    filter: 'agTextColumnFilter'
  },
  'sd-sla-field': {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraTimeToResolutionRenderer',
    filter: 'agTextColumnFilter'
  },
    assignee: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'autocompleteCellEditor',
    filter: 'agTextColumnFilter',
  },
};
