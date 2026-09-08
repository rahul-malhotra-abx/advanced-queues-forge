import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';

@Component({
  selector: 'app-jira-sprint-cell',
  styles: [``],
  template: `{{sprints}}`,
  encapsulation: ViewEncapsulation.None
})
export class JiraSprintRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  sprints: string;

  agInit(params: any): void {
    this.params = params;
    this.sprints = this.params.value?.map(v => v.name).join(', ');
  }

  ngOnDestroy() {
  }

  refresh(): boolean {
    return false;
  }
}
