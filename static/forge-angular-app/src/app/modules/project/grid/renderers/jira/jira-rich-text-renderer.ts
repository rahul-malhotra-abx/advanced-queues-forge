import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';

@Component({
  selector: 'app-jira-rich-text-cell',
  styles: [``],
  template: `<div [innerHTML]="params"></div>`,
  encapsulation: ViewEncapsulation.None
})
export class JiraRichTextRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  iconUrl: any;

  agInit(params: any): void {
    this.params = params.data.renderedFields[params.colDef.id];
  }

  ngOnDestroy() {
  }

  refresh(): boolean {
    return false;
  }
}
