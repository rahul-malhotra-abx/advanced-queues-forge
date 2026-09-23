import {Component, OnDestroy, ViewEncapsulation} from '@angular/core';
import {ICellRendererAngularComp} from 'ag-grid-angular';
import {router} from '@forge/bridge';

@Component({
  selector: 'app-jira-epic-link-cell',
  styles: [``],
  template: `<a *ngIf="epic" href="javascript:void(0)" (click)="open($event)">{{epic}} <i class="fa fa-external-link-alt"></i> </a>`,
  encapsulation: ViewEncapsulation.None
})
export class JiraEpicLinkRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  epic: string;

  agInit(params: any): void {
    this.params = params;
    this.epic = this.params.value;
  }

  /**
   * `router.open`, not an `href`.
   *
   * This cell used to build an absolute URL with `UtilsService.getIssueUrl`,
   * which resolves the host through `getParentDomain()` — `xdm_e`,
   * `ancestorOrigins` and `AP._hostOrigin`, none of which give the customer's
   * Jira origin from inside a Forge frame. The link therefore pointed at
   * whatever that guess returned.
   *
   * Same call the Key cell and the flag actions already use: hand the parent a
   * product-relative path and let it resolve the host.
   */
  open(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    router.open(`/browse/${this.epic}`);
  }

  ngOnDestroy() {
  }

  refresh(): boolean {
    return false;
  }
}
