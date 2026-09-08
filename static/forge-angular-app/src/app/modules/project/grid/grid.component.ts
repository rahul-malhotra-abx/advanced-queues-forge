import {
  ChangeDetectorRef,
  EventEmitter,
  Component,
  Input,
  Output,
  OnChanges,
  OnInit,
  OnDestroy,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { router } from '@forge/bridge';
import { ViewIssueModal } from '@forge/jira-bridge';
import { GridService } from '../../../services/grid.service';
import { JiraService } from '../../../services/jira.service';
import { UtilsService } from '../../../services/utils.service';
import { ALLOWED_JIRA_COLUMN_RENDERERS } from '../../../models/allowed.jira.column.renderers';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Queue } from 'src/app/models/default.queue.model';
import { DEFAULT_LIMITS } from 'src/app/models/default.limits';

@Component({
  selector: 'app-grid',
  templateUrl: './grid.component.html',
  styleUrls: ['./grid.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class GridComponent implements OnInit, OnChanges, OnDestroy {
  @Input() queue: Queue;
  @Input() queueGridOptions: any;
  @Input() allColumns: any[];
  @Output() myQueuesViewChanged = new EventEmitter<any>();

  // Grid Data
  frameworkComponents: any;
  gridOptions: any;
  rowData: any;
  gridApi: any;
  gridObj: any;
  issues: any[];
  loadingIssues = false;
  loadingProgressBarWidth: any;
  loadingMessage: string;
  availableColumns: any[];
  GRID_PAGE_SIZES = [10, 20, 50, 100, 200, 500];
  checkInterval: any;

  columnOnGridMoved: Subject<any[]> = new Subject<any[]>();
  columnOnGridResized: Subject<any[]> = new Subject<any[]>();
  columnOnGridSortingChanged: Subject<any[]> = new Subject<any[]>();

  constructor(private changeDetectorRef: ChangeDetectorRef, public gridService: GridService) {
    this.columnOnGridMoved.pipe(debounceTime(3000)).subscribe(() => this.persistQueueViewSettings());
    this.columnOnGridResized.pipe(debounceTime(3000)).subscribe(() => this.persistQueueViewSettings());
    this.columnOnGridSortingChanged.pipe(debounceTime(3000)).subscribe(() => this.persistQueueViewSettings());
  }

  async ngOnInit() {
    this.frameworkComponents = this.gridService.getGridFrameworkComponents();
    this.availableColumns = UtilsService.filterRenderableColumns(this.allColumns, ALLOWED_JIRA_COLUMN_RENDERERS);
    this.checkInterval = setInterval(() => {
      this.checkForNewIssues();
    }, 30000);
    this.search();
  }

  async ngOnDestroy() {
    clearInterval(this.checkInterval);
  }

  async search() {
    this.queueGridOptions = this.queueGridOptions || { pageSize: 10 };
    this.gridOptions = this.gridService.getGridOptions();
    this.gridOptions.columnDefs.splice(1, this.gridOptions.columnDefs.length - 1);
    this.gridOptions.columnDefs.push(...UtilsService.getColumnDefinitionsForKeys(this.allColumns, this.queue.columns));
    this.loadingIssues = true;
    this.loadingProgressBarWidth = 0;
    this.loadingMessage = '';
    this.issues = [];
    const maxResults = DEFAULT_LIMITS.MAX_ALLOWED_JQL_RESULTS;

    this.issues = await JiraService.executeJQL(this.queue.jql, DEFAULT_LIMITS.MAX_ALLOWED_JQL_RESULTS, [], this.basicColumnsIncluded());
    this.rowData = this.issues;
    this.loadingIssues = false;
    this.changeDetectorRef.detectChanges();
  }

  private async checkForNewIssues() {
    const issues = await JiraService.executeJQL(this.queue.jql, DEFAULT_LIMITS.MAX_ALLOWED_JQL_RESULTS, [], this.basicColumnsIncluded());
    const newIssues = UtilsService.findNewElementsInArray(this.issues, issues, 'key');
    if (newIssues.length > 0) {
      for (const issue of newIssues) {
        const issueKey = issue.key;
        const actions = {};
        actions[issueKey] = issueKey;
        JiraService.showNotification('New Issue', `A new issue matching your queue criteria is found: ${issueKey}`, 'success', 'auto', actions);
      }
      this.issues.unshift(...newIssues);
      this.gridApi.updateRowData({
        add: newIssues,
        addIndex: 0,
      });
      this.changeDetectorRef.detectChanges();
    }
  }

  basicColumnsIncluded() {
    let columnsCopy = UtilsService.deepCopy(this.queue.columns);
    if (columnsCopy.indexOf('issuetype') === -1) {
      columnsCopy.push('issuetype');
    }
    return columnsCopy;
  }

  async ngOnChanges(changes: SimpleChanges) {
    this.search();
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
    if (this.queueGridOptions.columnState) {
      params.columnApi.applyColumnState({
        state: this.queueGridOptions.columnState,
        applyOrder: false,
      });
    } else {
      params.columnApi.autoSizeAllColumns();
    }
    this.gridApi.paginationSetPageSize(Number(this.queueGridOptions.pageSize));
  }

  onFilterTextBoxChanged(event: any) {
    this.gridApi.setQuickFilter(event.target.value || '');
  }

  async onColumnResized(params: any) {
    this.queueGridOptions.columnState = this.gridOptions.columnApi.getColumnState();
    this.columnOnGridResized.next();
  }

  async onColumnMoved($event: any) {
    this.queueGridOptions.columnState = this.gridOptions.columnApi.getColumnState();
    this.columnOnGridMoved.next();
  }

  async onColumnSortingChanged(params: any) {
    this.queueGridOptions.columnState = this.gridOptions.columnApi.getColumnState();
    this.columnOnGridResized.next();
  }

  async onPageSizeChanged() {
    this.gridApi.paginationSetPageSize(this.queueGridOptions.pageSize);
    this.queueGridOptions.pageSize = this.queueGridOptions.pageSize;
    this.persistQueueViewSettings();
  }

  /**
   * The ONLY path to the issue dialog. jira-issue-key-renderer's anchor is
   * `href="javascript:void(0)"` on purpose so that ag-Grid's cell click is the
   * single trigger — a second handler on the anchor opens the modal twice.
   *
   * Connect's openIssueDialog took a close callback; here it was empty, so the
   * modal is opened with no onClose and nothing is refreshed on dismissal.
   */
  async onCellClicked(selected: any) {
    if (selected.column.colId !== 'key') {
      return;
    }
    if (selected.event) {
      selected.event.preventDefault();
      selected.event.stopPropagation();
    }
    try {
      await new ViewIssueModal({ context: { issueKey: selected.value } }).open();
    } catch (error) {
      // preventDefault() has already cancelled the anchor, so without this the click does nothing.
      console.warn('ViewIssueModal unavailable; opening the issue in a new tab instead.', error);
      router.open(`/browse/${selected.value}`);
    }
  }

  persistQueueViewSettings() {
    this.myQueuesViewChanged.emit(this.queueGridOptions);
  }
}
