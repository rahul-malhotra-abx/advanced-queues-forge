import { Component, Inject, OnInit, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { UtilsService } from '../../../../services/utils.service';
import { alert, confirm } from 'basic-modals';
import { QueueFolder, QueueFolderScopes } from 'src/app/models/default.folder.model';
import { JiraService } from 'src/app/services/jira.service';
import { Queue, QueueScopes } from 'src/app/models/default.queue.model';

@Component({
  selector: 'app-add-edit-folders',
  templateUrl: './add-edit-folders.component.html',
  styleUrls: ['./add-edit-folders.component.scss'],
})
export class AddEditFoldersComponent implements OnInit {
  folders: any[];
  queues: any[];
  defaultDropdownSettings = {
    singleSelection: false,
    idField: 'id',
    textField: 'name',
    selectAllText: 'Select All',
    unSelectAllText: 'UnSelect All',
    allowSearchFilter: true,
  };
  QueueFolderScopes = QueueFolderScopes;
  QueueScopes = QueueScopes;
  personalQueues: any;
  projectQueues: any;
  isAdmin = false;

  constructor(private dialogRef: MatDialogRef<AddEditFoldersComponent>, @Inject(MAT_DIALOG_DATA) public dataFromPatent) {
    this.folders = dataFromPatent.folders;
    this.queues = dataFromPatent.queues;
    this.folders.map((g) => {
      g.queues = this.getFolderQueues(g);
    });
    this.personalQueues = this.queues.filter((q) => q.scope === QueueScopes.PERSONAL);
    this.projectQueues = this.queues.filter((q) => q.scope === QueueScopes.PROJECT);
  }

  async ngOnInit() {
    const advancedQueueAdminRole = ['SYSTEM_ADMIN', 'ADMINISTER', 'ADMINISTER_PROJECTS'];
    const userPermissions = await JiraService.getUserPermissions(advancedQueueAdminRole);
    if (UtilsService.hasOneOfPermission(advancedQueueAdminRole, userPermissions)) {
      this.isAdmin = true;
    }
  }

  onFolderDrop(event: any) {
    moveItemInArray(this.folders, event.previousIndex, event.currentIndex);
  }

  getFolderQueues(folder: QueueFolder) {
    return this.queues.filter((q) => {
      return folder.queues.indexOf(q.id) > -1;
    });
  }

  async columnSelectionUpdated(operation: string, column: any) {}

  addFolder() {
    this.folders.push({
      id: UtilsService.uuidv4(),
      new: true,
      name: '',
      queues: [],
      scope: QueueFolderScopes.PERSONAL,
    });
  }

  async deleteFolder(index: number) {
    if (await confirm('Are you sure?')) {
      this.folders.splice(index, 1);
    }
  }

  cancelEditing() {
    this.dialogRef.close();
  }

  async clickOk() {
    // BUG-14: this dialog had no validation at all, so a nameless folder and a
    // second folder with an existing name both saved and both rendered in the
    // rail. Checked on Save rather than per keystroke: a row is blank for as
    // long as it takes to type into it.
    const named = this.folders.filter((g) => g.name?.trim());
    if (named.length !== this.folders.length) {
      await alert('Every folder needs a name.');
      return;
    }
    const seen = new Set<string>();
    for (const folder of this.folders) {
      const key = `${folder.scope}:${folder.name.trim().toLowerCase()}`;
      if (seen.has(key)) {
        await alert(`Two ${folder.scope.toLowerCase()} folders are called "${folder.name.trim()}".`);
        return;
      }
      seen.add(key);
    }

    this.folders.map((g) => {
      delete g.new;
      g.name = g.name.trim();
      g.queues = g.queues.map((q: Queue) => q.id);
    });
    this.dialogRef.close(this.folders);
  }
}
