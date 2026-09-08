import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';

@Component({
  selector: 'app-jira-status-cell',
  styles: [``],
  template: `<span class="jira-issue-status">
                    <span class="{{params.data.fields.status.statusCategory.colorName}}">{{params.data.fields.status.name}}</span>
                  </span>`,
  encapsulation: ViewEncapsulation.None
})
export class JiraStatusRendererComponent implements ICellRendererAngularComp, OnDestroy {
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
