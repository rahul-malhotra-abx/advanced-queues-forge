import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { QueueScopes } from 'src/app/models/default.queue.model';
import { alert } from 'basic-modals';
import { DEFAULT_LIMITS } from 'src/app/models/default.limits';
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
  DEFAULT_LIMITS = DEFAULT_LIMITS;
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
    // BUG-14: the field carries the same cap as the queue editor now, but a
    // paste or an imported name can still arrive over it, and the same name can
    // be typed into two rows. Same rules as the editor, one route or the other.
    const blank = this.queues.find((queue) => !queue.name?.trim());
    if (blank) {
      await alert('Every queue needs a name.');
      return;
    }
    const long = this.queues.find((queue) => queue.name.trim().length > DEFAULT_LIMITS.QUEUE_NAME);
    if (long) {
      await alert(`"${long.name.trim()}" is longer than ${DEFAULT_LIMITS.QUEUE_NAME} characters.`);
      return;
    }
    const seen = new Set<string>();
    for (const queue of this.queues) {
      const name = queue.name.trim().toLowerCase();
      if (seen.has(name)) {
        await alert(`Two queues are called "${queue.name.trim()}".`);
        return;
      }
      seen.add(name);
    }

    this.queues.forEach((queue) => (queue.name = queue.name.trim()));
    this.dialogRef.close(this.queues);
  }
}
