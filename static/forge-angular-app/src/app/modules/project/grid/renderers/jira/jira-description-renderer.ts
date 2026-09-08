import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';

@Component({
  selector: 'app-jira-description-cell',
  styles: [``],
  template: `<div [innerHTML]="params"></div>`,
  encapsulation: ViewEncapsulation.None
})
export class JiraDescriptionRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  iconUrl: any;

  agInit(params: any): void {
    this.params = params.data.renderedFields.description;
  }

  ngOnDestroy() {
  }

  refresh(): boolean {
    return false;
  }
}
