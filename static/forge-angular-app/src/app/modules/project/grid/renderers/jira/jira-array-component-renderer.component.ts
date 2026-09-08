import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';

@Component({
  selector: 'app-jira-array-component-cell',
  styles: [``],
  template: `{{components}}`,
  encapsulation: ViewEncapsulation.None
})
export class JiraArrayComponentRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  components: string;

  agInit(params: any): void {
    this.params = params;
    this.components = this.params.value?.map(v => v.name).join(', ');
  }

  ngOnDestroy() {
  }

  refresh(): boolean {
    return false;
  }
}
