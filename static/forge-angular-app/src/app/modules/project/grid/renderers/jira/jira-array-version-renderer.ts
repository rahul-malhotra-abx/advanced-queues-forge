import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';

@Component({
  selector: 'app-jira-array-version-cell',
  styles: [``],
  template: `{{versions}}`,
  encapsulation: ViewEncapsulation.None
})
export class JiraArrayVersionRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  versions: string;

  agInit(params: any): void {
    this.params = params;
    this.versions = this.params.value?.map(v => v.name).join(', ');
  }

  ngOnDestroy() {
  }

  refresh(): boolean {
    return false;
  }
}
