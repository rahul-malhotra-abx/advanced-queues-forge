import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';
import {UtilsService} from '../../../../../services/utils.service';

@Component({
  selector: 'app-jira-epic-link-cell',
  styles: [``],
  template: `<a *ngIf="epic" [href]="epicLink" target="_blank">{{epic}} <i class="fa fa-external-link-alt"></i> </a>`,
  encapsulation: ViewEncapsulation.None
})
export class JiraEpicLinkRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  epic: string;
  epicLink: string;

  agInit(params: any): void {
    this.params = params;
    this.epic = this.params.value;
    this.epicLink = UtilsService.getIssueUrl({key: this.epic});
  }

  ngOnDestroy() {
  }

  refresh(): boolean {
    return false;
  }
}
