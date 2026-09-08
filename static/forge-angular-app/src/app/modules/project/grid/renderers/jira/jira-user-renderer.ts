import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';

@Component({
  selector: 'app-jira-user-cell',
  styles: [``],
  template: `<img src="{{avatarUrl}}" width="16"/> {{displayName}}`,
  encapsulation: ViewEncapsulation.None
})
export class JiraUserRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  avatarUrl: string;
  displayName: string

  agInit(params: any): void {
    this.params = params;
    this.avatarUrl = this.params.value?.avatarUrls['16x16'];
    this.displayName = params.value?.displayName;
  }

  ngOnDestroy() {
  }

  refresh(): boolean {
    return false;
  }
}
