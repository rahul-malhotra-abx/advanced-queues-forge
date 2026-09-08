import { Component, Inject, OnInit } from '@angular/core';
import { JiraService } from '../../../../services/jira.service';
import { UtilsService } from '../../../../services/utils.service';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { QueueScopes } from 'src/app/models/default.queue.model';
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
  groups: any[];
  importIntoGroupId: any;
  isAdmin = false;
  QueueScopes = QueueScopes;
  selectedQueueScope = QueueScopes.PERSONAL;

  constructor(private dialogRef: MatDialogRef<ImportQueuesComponent>, @Inject(MAT_DIALOG_DATA) public dataFromPatent) {
    this.groups = dataFromPatent.groups;
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
    this.importIntoGroupId = this.groups[0]?.id;

    const advancedQueueAdminRole = ['SYSTEM_ADMIN', 'ADMINISTER', 'ADMINISTER_PROJECTS'];
    const userPermissions = await JiraService.getUserPermissions(advancedQueueAdminRole);
    if (UtilsService.hasOneOfPermission(advancedQueueAdminRole, userPermissions)) {
      this.isAdmin = true;
    }

    this.pageLoaded = true;
  }

  displayFn = (variable) => {
    console.log('variable', variable);
    if (variable) {
      this.loadQueuesForProject(variable.id);
    }
    return variable && variable.name ? variable.name : '';
  };

  async loadQueuesForProject(projectId) {
    const queues = await JiraService.getProjectQueues(projectId);
    this.currentProjectQueues = queues.values;
    this.currentProjectQueues.map((cpq) => (cpq.selected = false));
  }

  private _filter(value: string): any[] {
    const filterValue = value.toLowerCase();
    return this.projects.filter((option) => option.name.toLowerCase().includes(filterValue));
  }

  cancelEditing() {
    this.dialogRef.close();
  }

  async clickOk() {
    if (this.currentProjectQueues.filter((cpq) => cpq.selected).length === 0) {
      await alert('Please select at least one queue to import');
      return;
    }

    this.dialogRef.close({
      importGroupId: this.importIntoGroupId,
      selectedQueueScope: this.selectedQueueScope,
      queues: this.currentProjectQueues.filter((cpq) => cpq.selected),
    });
  }
}
