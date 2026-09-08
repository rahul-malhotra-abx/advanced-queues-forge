import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';

@Component({
  selector: 'app-jira-string-cell',
  styles: [``],
  template: `{{value}}`,
  encapsulation: ViewEncapsulation.None
})
export class JiraStringRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  value: any;

  agInit(params: any): void {
    this.params = params;
    if (params.value && params.colDef.valueKey) {
      this.value = params.value[params.colDef.valueKey]
    } else {
      this.value = params.value;
    }
  }

  ngOnDestroy() {
  }

  refresh(): boolean {
    return false;
  }
}
