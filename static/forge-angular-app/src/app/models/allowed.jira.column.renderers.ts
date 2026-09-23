/**
 * Which Jira field types the grid can render, and how wide each wants to be.
 *
 * `width` is what the content needs; `flex` is what absorbs the space left
 * over. Only the text columns flex, so a summary takes the room a status or a
 * date does not need. Everything used to be built at a flat 150px with
 * `flex: 1` inherited from the grid's defaults, which gave a date the same
 * share as a summary and left the summary wrapping onto three lines (BUG-36).
 */
export interface AllowedJiraColumnRenderer {
  fieldKey: string;
  headerKey: string;
  valueKey?: string;
  renderer: string;
  filter: string;
  width?: number;
  minWidth?: number;
  flex?: number;
}

export const ALLOWED_JIRA_COLUMN_RENDERERS: { [fieldType: string]: AllowedJiraColumnRenderer } = {
  number: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraNumberRenderer',
    filter: 'agNumberColumnFilter',
    width: 90,
    minWidth: 70,
  },
  string: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: '',
    renderer: 'jiraStringRenderer',
    filter: 'agTextColumnFilter',
    // Summary is a `string`, and it is the column people read.
    flex: 2,
    minWidth: 200,
  },
  resolution: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: 'name',
    renderer: 'jiraResolutionRenderer',
    filter: 'agTextColumnFilter',
    width: 120,
  },
  status: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: 'name',
    renderer: 'jiraStatusRenderer',
    filter: 'agTextColumnFilter',
    width: 130,
  },
  securitylevel: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: 'name',
    renderer: 'jiraStringRenderer',
    filter: 'agTextColumnFilter',
    width: 140,
  },
  votes: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: 'votes',
    renderer: 'jiraNumberRenderer',
    filter: 'agNumberColumnFilter',
    width: 90,
    minWidth: 70,
  },
  user: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraUserRenderer',
    filter: 'agTextColumnFilter',
    width: 150,
  },
  priority: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraPriorityRenderer',
    filter: 'agTextColumnFilter',
    width: 120,
  },
  textarea: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraRichTextRenderer',
    filter: 'agTextColumnFilter',
    flex: 2,
    minWidth: 220,
  },
  description: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraDescriptionRenderer',
    filter: 'agTextColumnFilter',
    flex: 2,
    minWidth: 220,
  },
  // Rich text behind a `string` schema, so it needs an entry of its own to reach the rich-text renderer.
  environment: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraRichTextRenderer',
    filter: 'agTextColumnFilter',
    flex: 1,
    minWidth: 180,
  },
  datetime: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraDateTimeRenderer',
    filter: 'agTextColumnFilter',
    // Wide enough for a date AND a time, which is what the renderer prints.
    width: 170,
  },
  date: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraDateTimeRenderer',
    filter: 'agTextColumnFilter',
    width: 130,
  },
  array_string: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraArrayStringRenderer',
    filter: 'agTextColumnFilter',
    flex: 1,
    minWidth: 140,
  },
  array_version: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraArrayVersionRenderer',
    filter: 'agTextColumnFilter',
    flex: 1,
    minWidth: 140,
  },
  array_component: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraArrayComponentRenderer',
    filter: 'agTextColumnFilter',
    flex: 1,
    minWidth: 140,
  },
  'gh-sprint': {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraSprintRenderer',
    filter: 'agTextColumnFilter',
    flex: 1,
    minWidth: 140,
  },
  'gh-epic-link': {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraEpicLinkRenderer',
    filter: 'agTextColumnFilter',
    width: 130,
  },
  'sd-sla-field': {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'jiraTimeToResolutionRenderer',
    filter: 'agTextColumnFilter',
    width: 150,
  },
  assignee: {
    fieldKey: 'id',
    headerKey: 'name',
    renderer: 'autocompleteCellEditor',
    filter: 'agTextColumnFilter',
    width: 160,
  },
};
