import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';

@Component({
  selector: 'app-jira-priority-cell',
  styles: [``],
  template: `<img src="{{iconUrl}}" width="16"/> {{params}}`,
  encapsulation: ViewEncapsulation.None
})
export class JiraPriorityRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  iconUrl: any;

  agInit(params: any): void {
    this.params = params.value.name;
    this.iconUrl = params.value.iconUrl;
  }

  ngOnDestroy() {
  }

  getValue() {

  }

  refresh(): boolean {
    return false;
  }
}
