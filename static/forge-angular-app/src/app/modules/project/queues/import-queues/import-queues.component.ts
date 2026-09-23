import { Component, Inject, OnInit } from '@angular/core';
import { JiraService } from '../../../../services/jira.service';
import { UtilsService } from '../../../../services/utils.service';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Queue, QueueScopes } from 'src/app/models/default.queue.model';
import { QueueFolder } from 'src/app/models/default.folder.model';
import { alert } from 'basic-modals';

@Component({
  selector: 'app-import-queues',
  templateUrl: './import-queues.component.html',
  styleUrls: ['./import-queues.component.scss'],
})
export class ImportQueuesComponent implements OnInit {
  myControl = new FormControl();
  filteredOptions: Observable<any[]>;

  projects: any[] = [];
  pageLoaded = false;
  searchFilter = {
    name: '',
  };
  maxResults = 50;
  UtilService = UtilsService;
  currentProjectQueues: any[];
  /** The selected project has no service desk, so there are no native queues to import. */
  noServiceDeskForProject = false;
  folders: QueueFolder[];
  importIntoFolder: QueueFolder;
  isAdmin = false;
  QueueScopes = QueueScopes;
  selectedQueueScope = QueueScopes.PERSONAL;

  /** `<project id>:<native queue id>` for every queue in the rail that came from an import. */
  importedSources: Set<string>;
  sourceProjectId: string;

  constructor(private dialogRef: MatDialogRef<ImportQueuesComponent>, @Inject(MAT_DIALOG_DATA) public dataFromPatent) {
    this.folders = dataFromPatent.folders;
    this.importedSources = new Set(
      (dataFromPatent.queues ?? []).map((q: Queue & { importedFrom?: string }) => q.importedFrom).filter(Boolean)
    );
  }

  async ngOnInit() {
    let response: any = { isLast: false, values: [] };
    while (!response.isLast) {
      response = await JiraService.getAllProjects('', this.maxResults, this.projects.length);
      this.projects.push(...response.values);
    }
    this.projects = this.projects.filter((p) => p.projectTypeKey === 'service_desk');
    this.filteredOptions = this.myControl.valueChanges.pipe(
      startWith(''),
      map((value) => (typeof value === 'string' ? value : value.name)),
      map((name) => (name ? this._filter(name) : this.projects.slice()))
    );

    const advancedQueueAdminRole = ['SYSTEM_ADMIN', 'ADMINISTER', 'ADMINISTER_PROJECTS'];
    const userPermissions = await JiraService.getUserPermissions(advancedQueueAdminRole);
    if (UtilsService.hasOneOfPermission(advancedQueueAdminRole, userPermissions)) {
      this.isAdmin = true;
    }

    this.pageLoaded = true;
  }

  displayFn = (variable) => {
    if (variable) {
      this.loadQueuesForProject(variable.id);
    }
    return variable && variable.name ? variable.name : '';
  };

  async loadQueuesForProject(projectId) {
    const queues = await JiraService.getProjectQueues(projectId);
    // undefined means the chosen project has no service desk. The picker lists
    // every project the user can see, not just service ones, so this is a
    // routine selection rather than an error — say so instead of leaving an
    // empty list that reads as "this project has no queues".
    if (!queues?.values) {
      this.currentProjectQueues = undefined;
      this.noServiceDeskForProject = true;
      return;
    }
    this.noServiceDeskForProject = false;
    this.sourceProjectId = projectId;
    this.currentProjectQueues = queues.values;
    // BUG-14: nothing checked whether a native queue had been imported before,
    // so importing twice left two identical rows. Matched on the source queue
    // rather than on the name: the app ships a project queue called "All Open"
    // and JSM's is "All open", so a name match refused the commonest import
    // there is. Queues imported before this shipped carry no source and are
    // not marked; importing one again marks it from then on.
    this.currentProjectQueues.map((cpq) => {
      cpq.selected = false;
      cpq.alreadyImported = this.importedSources.has(`${projectId}:${cpq.id}`);
    });
  }

  private _filter(value: string): any[] {
    const filterValue = value.toLowerCase();
    return this.projects.filter((option) => option.name.toLowerCase().includes(filterValue));
  }

  cancelEditing() {
    this.dialogRef.close();
  }

  async clickOk() {
    // Optional chaining, because currentProjectQueues is undefined both before
    // a project is chosen and when the chosen one has no service desk. Without
    // it, Import threw a TypeError in either case rather than prompting.
    if (!this.currentProjectQueues?.some((cpq) => cpq.selected)) {
      await alert('Please select at least one queue to import');
      return;
    }

    this.dialogRef.close({
      folder: this.importIntoFolder,
      selectedQueueScope: this.selectedQueueScope,
      projectId: this.sourceProjectId,
      // Already-imported rows cannot be ticked; filtered again so that a stale
      // tick from before a project switch cannot slip one through.
      queues: this.currentProjectQueues.filter((cpq) => cpq.selected && !cpq.alreadyImported),
    });
  }
}
