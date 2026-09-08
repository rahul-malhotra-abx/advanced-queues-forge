import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectComponent } from './project/project.component';
import { ProjectSettingsComponent } from './settings/project-settings.component';
import { ProjectRoutingModule } from './project-routing.module';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { RouterModule } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { QueuesComponent } from './queues/queues.component';
import { FilterPipeModule } from 'ngx-filter-pipe';
import { QueueComponent } from './queues/queue/queue.component';
import { ImportQueuesComponent } from './queues/import-queues/import-queues.component';
import { MatSelectModule } from '@angular/material/select';
import { QueueListViewComponent } from './queues/queue-list-view/queue-list-view.component';
import { MarkdownModule } from 'ngx-markdown';
import { NgMultiSelectDropDownModule } from 'ng-multiselect-dropdown';
import { AgGridModule } from 'ag-grid-angular';
import { GridComponent } from './grid/grid.component';
import { JiraNumberRendererComponent } from './grid/renderers/jira/jira-number-renderer';
import { JiraUserRendererComponent } from './grid/renderers/jira/jira-user-renderer';
import { JiraDateTimeRendererComponent } from './grid/renderers/jira/jira-date-time-renderer';
import { JiraArrayVersionRendererComponent } from './grid/renderers/jira/jira-array-version-renderer';
import { JiraArrayStringRendererComponent } from './grid/renderers/jira/jira-array-string-renderer';
import { JiraArrayComponentRendererComponent } from './grid/renderers/jira/jira-array-component-renderer.component';
import { JiraPriorityRendererComponent } from './grid/renderers/jira/jira-priority-renderer';
import { JiraIssueKeyRendererComponent } from './grid/renderers/jira/jira-issue-key-renderer';
import { JiraStatusRendererComponent } from './grid/renderers/jira/jira-status-renderer';
import { JiraDescriptionRendererComponent } from './grid/renderers/jira/jira-description-renderer';
import { JiraRichTextRendererComponent } from './grid/renderers/jira/jira-rich-text-renderer';
import { JiraSprintRendererComponent } from './grid/renderers/jira/jira-sprint-renderer';
import { JiraEpicLinkRendererComponent } from './grid/renderers/jira/jira-epic-link-renderer';
import { JiraStringRendererComponent } from './grid/renderers/jira/jira-string-renderer';
import { AddEditFoldersComponent } from './queues/add-edit-folders/add-edit-folders.component';
import { JiraTimeToResolutionRendererComponent } from './grid/renderers/jira/jira-time-to-resolution-renderer';
import { JiraResolutionRendererComponent } from './grid/renderers/jira/jira-resolution-renderer';
import { EditQueuesComponent } from './queues/edit-queues/edit-queues.component';
import { AutocompleteComponent } from './grid/autocomplete/autocomplete.component';

@NgModule({
  declarations: [
    ProjectComponent,
    ProjectSettingsComponent,
    QueueComponent,
    QueuesComponent,
    ImportQueuesComponent,
    QueueListViewComponent,
    GridComponent,
    JiraNumberRendererComponent,
    JiraStringRendererComponent,
    JiraUserRendererComponent,
    JiraDateTimeRendererComponent,
    JiraArrayVersionRendererComponent,
    JiraArrayStringRendererComponent,
    JiraArrayComponentRendererComponent,
    JiraPriorityRendererComponent,
    JiraIssueKeyRendererComponent,
    JiraSprintRendererComponent,
    JiraStatusRendererComponent,
    JiraDescriptionRendererComponent,
    JiraRichTextRendererComponent,
    JiraEpicLinkRendererComponent,
    JiraResolutionRendererComponent,
    JiraTimeToResolutionRendererComponent,
    AddEditFoldersComponent,
    EditQueuesComponent,
    AutocompleteComponent,
  ],
  imports: [
    CommonModule,
    ProjectRoutingModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatMenuModule,
    MatSelectModule,
    RouterModule,
    NgbTooltipModule,
    MatTabsModule,
    DragDropModule,
    FormsModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    FilterPipeModule,
    MarkdownModule.forRoot(),
    NgMultiSelectDropDownModule.forRoot(),
    AgGridModule.withComponents([
      JiraNumberRendererComponent,
      JiraStringRendererComponent,
      JiraUserRendererComponent,
      JiraDateTimeRendererComponent,
      JiraArrayVersionRendererComponent,
      JiraArrayStringRendererComponent,
      JiraArrayComponentRendererComponent,
      JiraPriorityRendererComponent,
      JiraIssueKeyRendererComponent,
      JiraStatusRendererComponent,
      JiraDescriptionRendererComponent,
      JiraRichTextRendererComponent,
      JiraSprintRendererComponent,
      JiraEpicLinkRendererComponent,
      JiraTimeToResolutionRendererComponent,
      JiraResolutionRendererComponent,
    ]),
  ],
})
export class ProjectModule {}
