import { Component, OnDestroy, ViewEncapsulation } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { UtilsService } from '../../../../../services/utils.service';

@Component({
  selector: 'app-jira-epic-link-cell',
  styles: [``],
  template: `
    <div class="d-flex" *ngIf="params && params.value">
      <div style="width: 80px" class="text-end me-2">{{ params.value.ongoingCycle?.remainingTime?.friendly }}</div>
      <i class="fa fa-pause my-auto" [ngClass]="params.value.ongoingCycle?.breached ? 'text-danger' : 'text-success'"></i>
    </div>
  `,
})
export class JiraTimeToResolutionRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  epic: string;
  epicLink: string;

  agInit(params: any): void {
    this.params = params;
  }

  ngOnDestroy() {}

  refresh(): boolean {
    return false;
  }
}
