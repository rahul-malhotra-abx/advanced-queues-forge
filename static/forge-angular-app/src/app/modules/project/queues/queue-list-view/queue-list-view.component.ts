import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {UtilsService} from "../../../../services/utils.service";

@Component({
  selector: 'app-queue-list-view',
  templateUrl: './queue-list-view.component.html',
  styleUrls: ['./queue-list-view.component.scss']
})
export class QueueListViewComponent implements OnInit {

  queueListConfig;

  constructor(private dialogRef: MatDialogRef<QueueListViewComponent>, @Inject(MAT_DIALOG_DATA) public dataFromPatent) {
  }

  ngOnInit(): void {
    this.queueListConfig = UtilsService.deepCopy(this.dataFromPatent.queueListConfig);
  }

  cancelEditing() {
    this.dialogRef.close();
  }

  async clickOk() {
    this.dialogRef.close(this.queueListConfig);
  }

}
