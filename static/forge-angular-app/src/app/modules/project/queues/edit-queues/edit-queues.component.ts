import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { QueueScopes } from 'src/app/models/default.queue.model';
import { JiraService } from 'src/app/services/jira.service';
import { UtilsService } from 'src/app/services/utils.service';

@Component({
  selector: 'app-edit-queues',
  templateUrl: './edit-queues.component.html',
  styleUrls: ['./edit-queues.component.scss'],
})
export class EditQueuesComponent implements OnInit {
  queues: any[];
  isAdmin = false;
  QueueScopes = QueueScopes;
  constructor(private dialogRef: MatDialogRef<EditQueuesComponent>, @Inject(MAT_DIALOG_DATA) public dataFromPatent: any) {
    this.queues = dataFromPatent.queues;
  }

  async ngOnInit() {
    const advancedQueueAdminRole = ['SYSTEM_ADMIN', 'ADMINISTER', 'ADMINISTER_PROJECTS'];
    const userPermissions = await JiraService.getUserPermissions(advancedQueueAdminRole);
    if (UtilsService.hasOneOfPermission(advancedQueueAdminRole, userPermissions)) {
      this.isAdmin = true;
    }
  }

  deleteQueue(index: number) {
    this.queues.splice(index, 1);
  }

  cancelEditing() {
    this.dialogRef.close();
  }

  async clickOk() {
    this.dialogRef.close(this.queues);
  }
}
