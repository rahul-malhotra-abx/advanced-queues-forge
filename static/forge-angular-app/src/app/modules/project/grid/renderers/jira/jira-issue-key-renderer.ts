import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';

@Component({
  selector: 'app-jira-issue-key-cell',
  styles: [``],
  template: `<a href="javascript:void(0)"
                class="text-decoration-none"> <img src="{{params.data.fields.issuetype.iconUrl}}" width="16"/>
    {{params.data.key}}</a>`,
  encapsulation: ViewEncapsulation.None
})
export class JiraIssueKeyRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;

  agInit(params: any): void {
    this.params = params;
  }

  ngOnDestroy() {
  }

  refresh(): boolean {
    return false;
  }
}
