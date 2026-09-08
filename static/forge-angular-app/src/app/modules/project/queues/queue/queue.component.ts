import { ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EditorView } from '@codemirror/view';
import { createJqlEditor } from '../../../../services/jql-codemirror';
import { JqlAutocompleteService } from '../../../../services/jql-autocomplete.service';
import { UtilsService } from '../../../../services/utils.service';
import { DEFAULT_LIMITS } from '../../../../models/default.limits';
import { JiraService } from '../../../../services/jira.service';
import { ALLOWED_JIRA_COLUMN_RENDERERS } from '../../../../models/allowed.jira.column.renderers';
import { confirm, alert } from 'basic-modals';
import { Queue, QueueScopes } from 'src/app/models/default.queue.model';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { QueueFolder } from 'src/app/models/default.folder.model';

@Component({
  selector: 'app-queue',
  templateUrl: './queue.component.html',
  styleUrls: ['./queue.component.scss'],
})
export class QueueComponent implements OnInit, OnDestroy {
  newQueue: boolean;
  queue: Queue;
  queues: any[];
  projectIdOrKey: any;
  initialQueueCopy: Queue;
  DefaultLimits = DEFAULT_LIMITS;
  priorityList = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
  UtilsService = UtilsService;
  defaultDropdownSettings = {
    singleSelection: false,
    idField: 'id',
    textField: 'name',
    selectAllText: 'Select All',
    unSelectAllText: 'UnSelect All',
    allowSearchFilter: true,
  };
  availableColumns: any[] = [];
  selectedColumns: any[] = [];
  isSavedFilterSelected: boolean = false;
  filteredFilters: any[] = [];
  selectedFilter: any = null;
  selectedFilterValue: any = null;

  defaultJiraGroupDropdownSettings = {
    singleSelection: false,
    idField: 'name',
    textField: 'name',
    selectAllText: 'Select All',
    unSelectAllText: 'UnSelect All',
    allowSearchFilter: true,
    allowRemoteDataSearch: true,
  };
  availableJiraGroups: any[] = [];
  selectedJiraGroups: any[] = [];
  isAdmin = false;
  folders: QueueFolder[];
  importIntoFolder: QueueFolder;
  QueueScopes = QueueScopes;
  pageLoaded = false;

  alertLevels = [
    { value: 'primary', label: 'Primary' },
    { value: 'danger', label: 'Critical' },
    { value: 'warning', label: 'Warning' },
  ];

  reorderingColumns = false;

  private visibilityGroupSearchChange: Subject<any> = new Subject();

  private jqlEditor: EditorView;

  /**
   * A setter, not ngAfterViewInit: the dialog body is behind *ngIf="pageLoaded",
   * so the host element does not exist until permissions and fields have loaded.
   */
  @ViewChild('jqlHost') set jqlHost(host: ElementRef<HTMLElement> | undefined) {
    if (!host || this.jqlEditor) {
      return;
    }
    this.jqlEditor = createJqlEditor({
      parent: host.nativeElement,
      doc: this.queue.jql || '',
      placeholder: 'JQL filter for queue.',
      onChange: (jql) => (this.queue.jql = jql),
    });
  }

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private dialogRef: MatDialogRef<QueueComponent>,
    @Inject(MAT_DIALOG_DATA) public dataFromPatent
  ) {
    dialogRef.disableClose = true;
    this.newQueue = dataFromPatent.newQueue;
    this.queue = dataFromPatent.queue;
    this.initialQueueCopy = UtilsService.deepCopy(this.queue);
    this.queue.jql = this.queue.jql || `resolution = Unresolved ORDER BY "Time to resolution" ASC`;
    this.queue.columns = this.queue.columns || ['summary', 'status', 'assignee', 'priority', 'updated'];
    this.projectIdOrKey = dataFromPatent.projectIdOrKey;
    this.queues = dataFromPatent.queues;
    this.folders = dataFromPatent.folders;
    this.visibilityGroupSearchChange.pipe(debounceTime(1000), distinctUntilChanged()).subscribe((name) => this.searchJiraGroup(name));
  }

  async ngOnInit() {
    this.availableColumns = UtilsService.filterRenderableColumns(this.dataFromPatent.jiraFields, ALLOWED_JIRA_COLUMN_RENDERERS).sort(
      UtilsService.dynamicSort('name')
    );
    this.selectedColumns = UtilsService.getSelectedColumn(this.availableColumns, this.queue.columns);

    this.availableJiraGroups = await JiraService.getGroups('');
    this.selectedJiraGroups = this.queue.visibilityGroups;

    this.queue.scope = this.queue.scope || this.QueueScopes.PROJECT;
    this.queue.priority = this.queue.priority || this.priorityList[2];
    const advancedQueueAdminRole = ['SYSTEM_ADMIN', 'ADMINISTER', 'ADMINISTER_PROJECTS'];
    const userPermissions = await JiraService.getUserPermissions(advancedQueueAdminRole);
    if (UtilsService.hasOneOfPermission(advancedQueueAdminRole, userPermissions)) {
      this.isAdmin = true;
    }

    this.pageLoaded = true;
    // Both chunks are ~300ms; fetched while the user reads the form, not on the first keystroke.
    JqlAutocompleteService.preload();
    this.fetchSavedFilters();
  }

  ngOnDestroy() {
    this.jqlEditor?.destroy();
  }

  cancelEditing() {
    this.dialogRef.close();
  }

  async clickOk() {
    if (!this.queue.name) {
      await alert('Name is a required field.');
      return;
    }

    // In code, not only [maxlength]: a name can also arrive by paste or from an import.
    if (this.queue.name.length > DEFAULT_LIMITS.QUEUE_NAME) {
      await alert(`Name must be ${DEFAULT_LIMITS.QUEUE_NAME} characters or fewer.`);
      return;
    }

    if (!this.queue.jql) {
      await alert('JQL is a required field.');
      return;
    }

    if (!this.selectedColumns || this.selectedColumns.length === 0) {
      await alert('Please select atleast one column.');
      return;
    }

    const newQueueColumns = [];
    for (const column of this.selectedColumns) {
      newQueueColumns.push(column.id);
    }

    if (this.queue.scope === QueueScopes.PROJECT && this.selectedJiraGroups?.length > 0) {
      const newQueueVisibilityGroups = [];
      for (const group of this.selectedJiraGroups) {
        newQueueVisibilityGroups.push(group.name);
      }
      this.queue.visibilityGroups = newQueueVisibilityGroups;
    } else {
      this.queue.visibilityGroups = undefined;
    }

    this.queue.columns = newQueueColumns;
    this.dialogRef.close({ queue: this.queue, folder: this.importIntoFolder });
  }

  /**
   * The JQL field is the builder now: Connect's JQL editor dialog has no
   * @forge/bridge equivalent, so the in-house CodeMirror editor is mounted in place
   * of the plain textarea and the "Use JQL Builder" button is gone with it.
   *
   * Anything that sets queue.jql from outside the editor has to come through here,
   * or the model and the visible document drift apart.
   */
  private setJql(jql: string) {
    this.queue.jql = jql;
    this.jqlEditor?.dispatch({ changes: { from: 0, to: this.jqlEditor.state.doc.length, insert: jql } });
    this.changeDetectorRef.detectChanges();
  }

  async columnSelectionUpdated(operation, column) {
    console.log(operation, column);
  }

  async searchJiraGroup(label: string) {
    this.availableJiraGroups = await JiraService.getGroups(label);
  }

  searchJiraGroupChanged(label: any) {
    this.visibilityGroupSearchChange.next(label);
  }

  async jiraGroupSelectionUpdated(operation, column) {
    console.log(operation, column);
  }

  toggleReorderColumns() {
    this.reorderingColumns = !this.reorderingColumns;
  }

  onColumnDrop(event) {
    moveItemInArray(this.selectedColumns, event.previousIndex, event.currentIndex);
  }

  async fetchSavedFilters() {
    try {
      const filters = await JiraService.getSavedFilters();
      this.filteredFilters = filters;
    } catch (error) {
      console.error('Error fetching saved filters:', error);
    }
  }

  onFilterSelected(event: any): void {
    this.selectedFilter = event.option.value;
    this.selectedFilterValue = event.option.value.name;
    this.setJql(this.selectedFilter.jql || '');
  }

   toggleSavedFilters() {
    this.isSavedFilterSelected = !this.isSavedFilterSelected;
    if (this.isSavedFilterSelected) {
      this.selectedFilter = null;
      this.setJql('');
    }
  }
}
