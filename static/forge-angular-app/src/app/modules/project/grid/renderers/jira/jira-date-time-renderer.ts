import { Component, OnDestroy, ViewEncapsulation } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';

@Component({
  selector: 'app-jira-date-time-cell',
  styles: [``],
  template: `
    {{ params.value | date: 'MM/dd/yyyy HH:mm' }}
  `,
  encapsulation: ViewEncapsulation.None,
})
export class JiraDateTimeRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;

  agInit(params: any): void {
    this.params = params;
  }

  ngOnDestroy() {}

  refresh(): boolean {
    return false;
  }
}
