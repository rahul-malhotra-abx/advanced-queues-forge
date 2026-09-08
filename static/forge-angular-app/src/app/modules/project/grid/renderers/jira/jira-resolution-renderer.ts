import { Component, OnDestroy, ViewEncapsulation } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';

@Component({
  selector: 'app-jira-resolution-cell',
  styles: [``],
  template: `<div [ngbTooltip]="params.description">{{params.name}}</div>`,
  encapsulation: ViewEncapsulation.None
})
export class JiraResolutionRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  iconUrl: any;

  agInit(params: any): void {
    this.params = params.value || {description: '', name: ''};
  }

  ngOnDestroy() {
  }

  getValue() {

  }

  refresh(): boolean {
    return false;
  }
}
