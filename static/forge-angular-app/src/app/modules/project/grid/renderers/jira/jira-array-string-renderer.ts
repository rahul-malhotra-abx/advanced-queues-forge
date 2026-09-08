import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';

@Component({
  selector: 'app-jira-array-string-cell',
  styles: [``],
  template: `{{items}}`,
  encapsulation: ViewEncapsulation.None
})
export class JiraArrayStringRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  items: string;

  agInit(params: any): void {
    this.params = params;
    this.items = this.params.value?.join(', ');
  }

  ngOnDestroy() {
  }

  refresh(): boolean {
    return false;
  }
}
