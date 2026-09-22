import { Component, OnDestroy, ViewEncapsulation } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { format as timeAgo } from 'timeago.js';

@Component({
  selector: 'app-jira-date-time-cell',
  styles: [``],
  template: `
    {{ relative ? relativeTime : (params.value | date: format) }}
  `,
  encapsulation: ViewEncapsulation.None,
})
export class JiraDateTimeRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params: any;
  format = 'MM/dd/yyyy HH:mm';
  relative = false;
  relativeTime = '';

  agInit(params: any): void {
    this.params = params;
    // The project's setting is written moment-style (MM/DD/YYYY hh:mm:ss); DatePipe spells it dd, yyyy and,
    // for the 24-hour time the Settings labels show, HH.
    const setting: string = params.context?.dateColumnFormat;
    this.relative = setting === 'Relative';
    if (this.relative) {
      this.relativeTime = params.value ? timeAgo(params.value) : '';
    } else if (setting) {
      this.format = setting.replace('DD', 'dd').replace('YYYY', 'yyyy').replace('hh', 'HH');
    }
  }

  ngOnDestroy() {}

  refresh(): boolean {
    return false;
  }
}
