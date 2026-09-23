import {
  ChangeDetectorRef,
  ElementRef,
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
  /** An overflow smaller than a scrollbar is rounding, not a wide set of columns. */
  private static readonly FIT_TOLERANCE_PX = 16;

  /** Set once the user drags a column edge: from then on their widths stand. */
  private userSizedColumns = false;

  @Input() queue: Queue;
  @Input() queueGridOptions: any;
  @Input() allColumns: any[];
  @Input() dateColumnFormat: string;
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
  /** The queue whose row cap has already been reported, so it is reported once. */
  private cappedWarnedFor: string;
  loadingMessage: string;
  availableColumns: any[];
  GRID_PAGE_SIZES = [10, 20, 50, 100, 200, 500];
  checkInterval: any;

  columnOnGridMoved: Subject<any[]> = new Subject<any[]>();
  columnOnGridResized: Subject<any[]> = new Subject<any[]>();
  columnOnGridSortingChanged: Subject<any[]> = new Subject<any[]>();

  constructor(private changeDetectorRef: ChangeDetectorRef, private elementRef: ElementRef, public gridService: GridService) {
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
    // Widths belong to a queue, so the latch is released when one is opened.
    this.userSizedColumns = false;
    this.gridOptions = this.gridService.getGridOptions();
    this.gridOptions.context = { dateColumnFormat: this.dateColumnFormat };
    this.gridOptions.columnDefs.splice(1, this.gridOptions.columnDefs.length - 1);
    this.gridOptions.columnDefs.push(...UtilsService.getColumnDefinitionsForKeys(this.allColumns, this.queue.columns));
    this.loadingIssues = true;
    // Not 0: the bar is striped and animated, and an empty one reads as stuck
    // rather than as starting. A sliver until the count comes back.
    this.loadingProgressBarWidth = 5;
    this.loadingMessage = 'Counting issues...';
    this.issues = [];
    const maxResults = DEFAULT_LIMITS.MAX_ALLOWED_JQL_RESULTS;

    // BUG-12: the bar and its message were set to 0 and '' and never touched
    // again, so a load showed an empty bar under a blank line. The count is one
    // request and comes back before the first page of issues does; without it
    // (unbounded JQL) the bar reports pages rather than a percentage.
    const expected = Math.min((await JiraService.approximateCount(this.queue.jql)) ?? 0, maxResults);
    this.loadingMessage = expected ? `Loading ${expected} issues...` : 'Loading issues...';
    const onPage = (loaded: number) => {
      this.loadingProgressBarWidth = expected ? Math.min(100, Math.round((loaded / expected) * 100)) : 100;
      this.loadingMessage = expected ? `Loaded ${loaded} of ${expected} issues` : `Loaded ${loaded} issues`;
      this.changeDetectorRef.detectChanges();
    };

    try {
      this.issues = await JiraService.executeJQL(
        this.queue.jql,
        DEFAULT_LIMITS.MAX_ALLOWED_JQL_RESULTS,
        [],
        this.basicColumnsIncluded(),
        undefined,
        onPage
      );
    } catch (error) {
      // BUG-12: this left the grid on its loading bar for ever, with the reason
      // in the console. The queue is a user's own JQL, so the message names it.
      console.warn(`Could not load queue "${this.queue.name}"`, error);
      this.loadingIssues = false;
      this.rowData = [];
      this.changeDetectorRef.detectChanges();
      JiraService.showNotification(
        'Queue could not load',
        `Jira rejected this queue's JQL, so no issues are shown. Edit the queue to correct it.`,
        'error',
        'manual'
      );
      return;
    }

    if (this.issues.length >= maxResults && this.cappedWarnedFor !== this.queue.id) {
      // BUG-12: the cap was silent, so a queue matching more than this looked
      // like a queue with exactly this many issues. Once per queue: opening one
      // runs this twice, and two identical flags stack up on screen.
      this.cappedWarnedFor = this.queue.id;
      JiraService.showNotification(
        'Showing the first ' + maxResults + ' issues',
        'This queue matches more issues than the grid loads. Narrow its JQL to see the rest.',
        'info'
      );
    }
    this.rowData = this.issues;
    this.loadingIssues = false;
    this.changeDetectorRef.detectChanges();
  }

  private async checkForNewIssues() {
    const issues = await JiraService.executeJQL(this.queue.jql, DEFAULT_LIMITS.MAX_ALLOWED_JQL_RESULTS, [], this.basicColumnsIncluded()).catch(
      () => undefined
    );
    if (!issues) {
      return;
    }
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
    }
    // Nothing in the `else`: the columns carry their own widths, and a text
    // column carries the flex that absorbs what is left over. autoSizeAllColumns
    // used to run here, which sizes every column to its content AND clears
    // flex, which is how the grid ended up narrow with a band of empty space
    // beside it (BUG-34, BUG-36).
    this.gridApi.paginationSetPageSize(Number(this.queueGridOptions.pageSize));
    this.stretchColumnsToFit();
  }

  /** Widths settle once there are rows to measure, so fit again then. */
  onFirstDataRendered() {
    this.stretchColumnsToFit();
  }

  /** The pane changes width when the queue rail is hidden or the window resizes. */
  onGridSizeChanged() {
    this.stretchColumnsToFit();
  }

  /**
   * Fill the width when there is room to, and leave the grid alone when there
   * is not.
   *
   * `sizeColumnsToFit()` on its own also SHRINKS a wide set of columns into the
   * viewport, which is the opposite of what a queue with many columns wants:
   * those should keep their width and scroll. So it runs only while the columns
   * leave space unused.
   */
  private stretchColumnsToFit(): void {
    const columnApi = this.gridOptions?.columnApi;
    if (!this.gridApi || !columnApi) {
      return;
    }
    // Deferred a frame: called from gridReady the pane is still settling, and
    // fitting to a width that then changes leaves the columns a few pixels
    // over, which is a scrollbar for nothing.
    setTimeout(() => {
      const viewport: HTMLElement = this.elementRef.nativeElement.querySelector('.ag-center-cols-viewport');
      if (!viewport?.clientWidth || this.userSizedColumns) {
        return;
      }
      const displayed = columnApi.getAllDisplayedColumns();
      // A flex column already absorbs the spare width, and fitting on top of it
      // redistributes everything proportionally, which undoes the per-type
      // widths: a status column came out at 215px next to a 586px summary.
      if (displayed.some((column: any) => column.getColDef?.()?.flex)) {
        return;
      }
      const used = displayed.reduce((total: number, column: any) => total + column.getActualWidth(), 0);
      // Room to spare, or a small overshoot this fit is what produced: both are
      // ours to correct. A set that overflows by more than a scrollbar's width
      // is the user's own columns, and those keep their width and scroll.
      if (used < viewport.clientWidth || used - viewport.clientWidth <= GridComponent.FIT_TOLERANCE_PX) {
        this.gridApi.sizeColumnsToFit();
        // sizeColumnsToFit measures the grid body, which is 2px wider than the
        // centre viewport (measured). Two pixels is still a horizontal
        // scrollbar, so the last column gives them back.
        const over = viewport.scrollWidth - viewport.clientWidth;
        const columns = columnApi.getAllDisplayedColumns();
        const last = columns[columns.length - 1];
        if (over > 0 && over <= GridComponent.FIT_TOLERANCE_PX && last) {
          columnApi.setColumnWidth(last, last.getActualWidth() - over);
        }
      }
    });
  }

  onFilterTextBoxChanged(event: any) {
    this.gridApi.setQuickFilter(event.target.value || '');
  }

  async onColumnResized(params: any) {
    // Only a width the USER chose. A fit or an autosize is this window's
    // arithmetic, and storing it would pin one machine's width into a property
    // every other machine then reads back.
    //
    // `uiColumnDragged` is the header-edge drag, measured: ag-grid's
    // ResizeFeature reports it under that name, not `uiColumnResized`.
    if (params?.source !== 'uiColumnDragged') {
      return;
    }
    // Their widths win from here: an automatic fit would spring back the column
    // they just dragged.
    this.userSizedColumns = true;
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
    // Always cancel the anchor: it is href="javascript:void(0)", so the browser
    // has nothing useful to do with either kind of click. Both paths below are
    // driven explicitly instead.
    if (selected.event) {
      selected.event.preventDefault();
      selected.event.stopPropagation();
    }

    // Ctrl/Cmd-click opens the issue in a new tab, plain click opens the modal.
    //
    // router.open, not a real href with target="_blank": the app runs in a
    // sandboxed Forge iframe, so native modified-click on an anchor is not
    // dependable, and building an absolute URL would need getParentDomain(),
    // which reads AP._hostOrigin and cannot resolve the host from inside a
    // Forge frame. router.open hands the product-relative path to the parent.
    //
    // This stays a SINGLE path deliberately. The renderer has no click handler
    // of its own — closed PR #9 on the Connect repo added one alongside this
    // branch and fired the dialog twice per click.
    const event = selected.event;
    if (event && (event.ctrlKey || event.metaKey)) {
      router.open(`/browse/${selected.value}`);
      return;
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
