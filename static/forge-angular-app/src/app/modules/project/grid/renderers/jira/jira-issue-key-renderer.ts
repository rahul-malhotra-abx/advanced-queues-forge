import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';
import {UtilsService} from '../../../../../services/utils.service';

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
  issueUrl: string;

  agInit(params: any): void {
    this.params = params;
    this.issueUrl = `${UtilsService.getParentDomain()}/browse/${params.data.key}`;
  }

  ngOnDestroy() {
  }

  refresh(): boolean {
    return false;
  }
}
