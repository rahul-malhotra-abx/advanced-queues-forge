import { Injectable } from '@angular/core';
import { JiraNumberRendererComponent } from '../modules/project/grid/renderers/jira/jira-number-renderer';
import { JiraUserRendererComponent } from '../modules/project/grid/renderers/jira/jira-user-renderer';
import { JiraDateTimeRendererComponent } from '../modules/project/grid/renderers/jira/jira-date-time-renderer';
import { JiraArrayVersionRendererComponent } from '../modules/project/grid/renderers/jira/jira-array-version-renderer';
import { JiraArrayStringRendererComponent } from '../modules/project/grid/renderers/jira/jira-array-string-renderer';
import { JiraArrayComponentRendererComponent } from '../modules/project/grid/renderers/jira/jira-array-component-renderer.component';
import { JiraPriorityRendererComponent } from '../modules/project/grid/renderers/jira/jira-priority-renderer';
import { JiraIssueKeyRendererComponent } from '../modules/project/grid/renderers/jira/jira-issue-key-renderer';
import { JiraStatusRendererComponent } from '../modules/project/grid/renderers/jira/jira-status-renderer';
import { JiraStringRendererComponent } from '../modules/project/grid/renderers/jira/jira-string-renderer';
import { JiraDescriptionRendererComponent } from '../modules/project/grid/renderers/jira/jira-description-renderer';
import { JiraRichTextRendererComponent } from '../modules/project/grid/renderers/jira/jira-rich-text-renderer';
import { JiraSprintRendererComponent } from '../modules/project/grid/renderers/jira/jira-sprint-renderer';
import { JiraEpicLinkRendererComponent } from '../modules/project/grid/renderers/jira/jira-epic-link-renderer';
import { JiraTimeToResolutionRendererComponent } from '../modules/project/grid/renderers/jira/jira-time-to-resolution-renderer';
import { JiraResolutionRendererComponent } from '../modules/project/grid/renderers/jira/jira-resolution-renderer';
import { AutocompleteComponent } from '../modules/project/grid/autocomplete/autocomplete.component';

@Injectable({
  providedIn: 'root',
})
export class GridService {
  frameworkComponents = {
    jiraIssueKeyRenderer: JiraIssueKeyRendererComponent,
    jiraStatusRenderer: JiraStatusRendererComponent,
    jiraNumberRenderer: JiraNumberRendererComponent,
    jiraStringRenderer: JiraStringRendererComponent,
    jiraUserRenderer: JiraUserRendererComponent,
    jiraDateTimeRenderer: JiraDateTimeRendererComponent,
    jiraArrayVersionRenderer: JiraArrayVersionRendererComponent,
    jiraSprintRenderer: JiraSprintRendererComponent,
    jiraEpicLinkRenderer: JiraEpicLinkRendererComponent,
    jiraArrayStringRenderer: JiraArrayStringRendererComponent,
    jiraArrayComponentRenderer: JiraArrayComponentRendererComponent,
    jiraPriorityRenderer: JiraPriorityRendererComponent,
    jiraResolutionRenderer: JiraResolutionRendererComponent,
    jiraDescriptionRenderer: JiraDescriptionRendererComponent,
    jiraRichTextRenderer: JiraRichTextRendererComponent,
    jiraTimeToResolutionRenderer: JiraTimeToResolutionRendererComponent,
    autocompleteCellEditor: AutocompleteComponent
  };
  defaultGridOptions = {
    columnDefs: [
      {
        id: 'key',
        field: 'key',
        headerName: 'Key',
        filter: 'agTextColumnFilter',
        minWidth: 80,
        width: 100,
        maxWidth: 200,
        resizable: true,
        cellClass: 'cell-wrap-text min-padding-cell summary',
        headerClass: 'min-padding-header custom-grid-header',
        cellRenderer: 'jiraIssueKeyRenderer',
        isJiraCustomField: false,
      },
    ],
    defaultColDef: {
      flex: 1,
      wrapText: true,
      autoHeight: true,
      sortable: false,
      resizable: true,
      filter: false,
      suppressMenu: true,
      suppressMovable: true,
    },
    rowSelection: 'single',
    rowDragManaged: true,
    suppressMoveWhenRowDragging: true,
    suppressHorizontalScroll: false,
    suppressRowClickSelect: true,
    paginationPageSize: 10,
    pagination: true,
  };

  constructor() {}

  getGridFrameworkComponents() {
    return this.frameworkComponents;
  }

  getGridOptions() {
    return this.defaultGridOptions;
  }
}
