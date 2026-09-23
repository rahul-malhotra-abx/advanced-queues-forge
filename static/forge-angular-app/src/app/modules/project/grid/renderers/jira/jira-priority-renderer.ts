import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';

@Component({
  selector: 'app-jira-priority-cell',
  styles: [``],
  template: `<img *ngIf="iconUrl" src="{{iconUrl}}" width="16"/> {{params}}`,
  encapsulation: ViewEncapsulation.None
})
export class JiraPriorityRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  iconUrl: any;

  agInit(params: any): void {
    // An issue can have no priority at all: a project can leave the field off
    // its screens, and Jira then returns null here. Reading `.name` off it threw
    // and took the whole grid down with it (BUG-15). Jira's own UI calls this
    // "None", and the icon is dropped rather than requested as "undefined".
    this.params = params.value?.name ?? 'None';
    this.iconUrl = params.value?.iconUrl;
  }

  ngOnDestroy() {
  }

  getValue() {

  }

  refresh(): boolean {
    return false;
  }
}
