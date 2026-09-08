import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { UtilsService } from '../../../services/utils.service';
import { MatDialog } from '@angular/material/dialog';
import { QueueComponent } from './queue/queue.component';
import { ActivatedRoute } from '@angular/router';
import { confirm } from 'basic-modals';
import { ImportQueuesComponent } from './import-queues/import-queues.component';
import { QueueListViewComponent } from './queue-list-view/queue-list-view.component';
import { format } from 'timeago.js';
import { JiraService } from '../../../services/jira.service';
import { DefaultQueues, Queue, QueuePriorities, QueueScopes } from '../../../models/default.queue.model';
import { AddEditFoldersComponent } from './add-edit-folders/add-edit-folders.component';
import { EditQueuesComponent } from './edit-queues/edit-queues.component';
import { DefaultQueueFolders, QueueFolder, QueueFolderScopes } from 'src/app/models/default.folder.model';
import { DefaultSortingOptions } from 'src/app/models/default.sorting.options';
import { DefaultQueueListConfig, QueueListConfig } from 'src/app/models/default.queue.list.config';
import { JiraUserModel } from 'src/app/models/jira.user.model';
import { StorageService } from 'src/app/services/storage.service';
import { StorageContext } from 'src/app/models/storage.context.enum';
import { DataStorageKeys } from 'src/app/models/data.storage.keys.model';
import { DEFAULT_QUEUE_VIEW_SETTINGS, QueueViewSettings } from 'src/app/models/default.queue-view-settings';
import { DefaultQueueSortConfig } from 'src/app/models/default.queue.sort.config';

@Component({
  selector: 'app-queues',
  templateUrl: './queues.component.html',
  styleUrls: ['./queues.component.scss'],
})
export class QueuesComponent implements OnInit, OnDestroy {
  myProjectQueuesView: QueueViewSettings;
  myProjectQueuesViewStorageService: StorageService;

  myProjectAndPersonalFolders: QueueFolder[]; // Saves all queues, ordered, personal + project
  myProjectAndPersonalQueues: Queue[]; // Saves all folders, ordered, personal + project
  myProjectAndPersonalFoldersStorageService: StorageService;
  myProjectAndPersonalQueuesStorageService: StorageService;

  projectQueues: Queue[];
  projectFolders: QueueFolder[];
  projectQueuesStorageService: StorageService;
  projectFoldersStorageService: StorageService;

  personalQueues: Queue[];
  personalFolders: QueueFolder[];
  personalQueuesStorageService: StorageService;
  personalFoldersStorageService: StorageService;

  currentUser: JiraUserModel;
  currentUserJiraGroups: any[];

  pageLoaded = false;

  currentQueue: Queue;
  currentFolder: any;

  queueListHidden = false;
  projectIdOrKey: string;
  UtilsService = UtilsService;

  mySortedProjectQueues = {};

  queueListConfig: QueueListConfig;
  timeFormat = format;
  jiraFields: any[];
  QueuePriorities = QueuePriorities;
  QueueScopes = QueueScopes;
  searchFilter = { name: '' };
  queueSorting = {
    sortBy: '',
    sortOrder: '',
  };
  availableSortingOptions = DefaultSortingOptions;
  isAdmin = false;
  refreshInterval: any;

  constructor(private changeDetectorRef: ChangeDetectorRef, public dialog: MatDialog, private route: ActivatedRoute) {}

  async ngOnInit() {
    this.projectIdOrKey = this.route.parent.params['value'].id;
    this.currentUser = await JiraService.getCurrentJiraUser();
    this.currentUserJiraGroups = await JiraService.getUserGroups(this.currentUser.accountId);
    this.jiraFields = await JiraService.getJiraFields();

    // Load PROJECT queues and folders
    this.projectFoldersStorageService = new StorageService(StorageContext.PROJECT, this.projectIdOrKey, DataStorageKeys.PROJECT_FOLDERS);
    this.projectFolders = (await this.projectFoldersStorageService.get()) || UtilsService.deepCopy(DefaultQueueFolders);

    this.projectQueuesStorageService = new StorageService(StorageContext.PROJECT, this.projectIdOrKey, DataStorageKeys.PROJECT_QUEUES);
    this.projectQueues = (await this.projectQueuesStorageService.get()) || DefaultQueues;

    // Load PERSONAL queues and folders
    this.personalFoldersStorageService = new StorageService(
      StorageContext.USER,
      this.currentUser.accountId,
      DataStorageKeys.USER_PROJECT_FOLDERS(this.projectIdOrKey)
    );
    this.personalFolders = (await this.personalFoldersStorageService.get()) || [];

    this.personalQueuesStorageService = new StorageService(
      StorageContext.USER,
      this.currentUser.accountId,
      DataStorageKeys.USER_PROJECT_QUEUES(this.projectIdOrKey)
    );
    this.personalQueues = (await this.personalQueuesStorageService.get()) || [];

    // Load MY queues and folders
    this.myProjectAndPersonalFoldersStorageService = new StorageService(
      StorageContext.USER,
      this.currentUser.accountId,
      DataStorageKeys.MY_USER_PROJECT_FOLDERS(this.projectIdOrKey)
    );
    this.myProjectAndPersonalFolders = (await this.myProjectAndPersonalFoldersStorageService.get()) || [];
    this.myProjectAndPersonalQueues = [...this.personalQueues, ...this.projectQueues];

    this._mergeProjectAndMyProjectFolders();

    this.myProjectQueuesViewStorageService = new StorageService(
      StorageContext.USER,
      this.currentUser.accountId,
      DataStorageKeys.MY_USER_PROJECT_QUEUES_VIEW(this.projectIdOrKey)
    );
    this.myProjectQueuesView = (await this.myProjectQueuesViewStorageService.get()) || UtilsService.deepCopy(DEFAULT_QUEUE_VIEW_SETTINGS);
    this.myProjectQueuesView = Object.assign({}, DEFAULT_QUEUE_VIEW_SETTINGS, this.myProjectQueuesView);

    // this.currentQueue =
    //   this.myProjectAndPersonalQueues.find((mpq) => mpq.id === this.myProjectQueuesView.currentQueueId) || this.myProjectAndPersonalQueues[0];
    // this.currentFolder =
    //   this.myProjectAndPersonalFolders.find((mpg) => mpg.id === this.myProjectQueuesView.currentQueueFolderId) || this.myProjectAndPersonalFolders[0];

    // Set initial state of queue list
    this.queueListConfig = this.myProjectQueuesView.queueListConfig || UtilsService.deepCopy(DefaultQueueListConfig);
    this.queueSorting = this.myProjectQueuesView.queueSorting || UtilsService.deepCopy(DefaultQueueSortConfig);
    this.queueListHidden = this.myProjectQueuesView.queueListHidden;
    this.setQueueSorting(this.queueSorting.sortBy, this.queueSorting.sortOrder);

    this._cleanFolderQueues();
    this._loadMySortedProjectQueues();

    this.pageLoaded = true;

    this.loadQueue(
      this.myProjectAndPersonalFolders.find((mpg) => mpg.id === this.myProjectQueuesView.currentQueueFolderId),
      this.myProjectAndPersonalQueues.find((mpq) => mpq.id === this.myProjectQueuesView.currentQueueId)
    );

    const advancedQueueAdminRole = ['SYSTEM_ADMIN', 'ADMINISTER', 'ADMINISTER_PROJECTS'];
    const userPermissions = await JiraService.getUserPermissions(advancedQueueAdminRole);
    if (UtilsService.hasOneOfPermission(advancedQueueAdminRole, userPermissions)) {
      this.isAdmin = true;
    }

    this.refreshInterval = setInterval(() => {
      this.refreshQueueIssueCount();
    }, 30000);
    await this.refreshQueueIssueCount();
  }

  ngOnDestroy() {
    clearInterval(this.refreshInterval);
  }

  setQueueSorting(sortBy: string, sortOrder: string) {
    this.queueSorting.sortBy = sortBy;
    this.queueSorting.sortOrder = sortOrder;
    this.myProjectQueuesView.queueSorting = this.queueSorting;
    this.myProjectQueuesViewStorageService.save(this.myProjectQueuesView);
    this._loadMySortedProjectQueues();
  }

  getFolderQueues(folder: QueueFolder) {
    let folderQueues: Queue[] = [];
    if (!this.queueSorting.sortBy || this.queueSorting.sortBy === 'USER_SORT') {
      folder.queues.map((queueId) => {
        const queue = this.myProjectAndPersonalQueues.find((q) => q.id === queueId);
        if (queue) {
          folderQueues.push(queue);
        }
      });
    } else {
      if (this.queueSorting.sortBy === 'NAME' && this.queueSorting.sortOrder === 'DESC') {
        folderQueues = this.myProjectAndPersonalQueues.filter((pq) => folder.queues.indexOf(pq.id) > -1).sort(UtilsService.dynamicSort('-name'));
      } else if (this.queueSorting.sortBy === 'NAME' && this.queueSorting.sortOrder === 'ASC') {
        folderQueues = this.myProjectAndPersonalQueues.filter((pq) => folder.queues.indexOf(pq.id) > -1).sort(UtilsService.dynamicSort('name'));
      } else if (this.queueSorting.sortBy === 'PRIORITY' && this.queueSorting.sortOrder === 'DESC') {
        folderQueues = this.myProjectAndPersonalQueues.filter((pq) => folder.queues.indexOf(pq.id) > -1).sort(UtilsService.prioritySort('-priority'));
      } else if (this.queueSorting.sortBy === 'PRIORITY' && this.queueSorting.sortOrder === 'ASC') {
        folderQueues = this.myProjectAndPersonalQueues.filter((pq) => folder.queues.indexOf(pq.id) > -1).sort(UtilsService.prioritySort('priority'));
      } else if (this.queueSorting.sortBy === 'CREATED_AT' && this.queueSorting.sortOrder === 'DESC') {
        folderQueues = this.myProjectAndPersonalQueues
          .filter((pq) => folder.queues.indexOf(pq.id) > -1)
          .sort(UtilsService.dynamicSort('-lastCreatedDateMilliSeconds'));
      } else if (this.queueSorting.sortBy === 'UPDATED_AT' && this.queueSorting.sortOrder === 'DESC') {
        folderQueues = this.myProjectAndPersonalQueues
          .filter((pq) => folder.queues.indexOf(pq.id) > -1)
          .sort(UtilsService.dynamicSort('-lastUpdatedDateMilliSeconds'));
      } else {
        folderQueues = this.myProjectAndPersonalQueues.filter((pq) => folder.queues.indexOf(pq.id) > -1);
      }
    }
    folderQueues = folderQueues.filter((q) => {
      return this._isQueueVisible(q);
    });
    return folderQueues;
  }

  toggleFolderCollapse(folder: QueueFolder) {
    folder.collapsed = !folder.collapsed;
    this.myProjectAndPersonalFoldersStorageService.save(this.myProjectAndPersonalFolders);
  }

  async refreshQueueIssueCount() {
    for (const queue of this.myProjectAndPersonalQueues) {
      queue.lastRefreshedData = await JiraService.getCountAndLastIssueForJQL(queue.jql, true);
      queue.lastCreatedDateMilliSeconds = queue.lastRefreshedData?.lastCreated
        ? new Date(queue.lastRefreshedData.lastCreated.fields.created).getTime()
        : 0;
      queue.lastUpdatedDateMilliSeconds = queue.lastRefreshedData?.lastUpdated
        ? new Date(queue.lastRefreshedData.lastUpdated.fields.updated).getTime()
        : 0;
      await UtilsService.sleep(1000);
    }
  }

  loadQueue(folder?: QueueFolder, queue?: Queue) {
    if (!folder && !queue) {
      queue = this.myProjectAndPersonalQueues[0];
      folder = this.myProjectAndPersonalFolders.find((f) => f.queues.indexOf(queue.id) > -1);
    }
    this.currentFolder = folder;
    this.currentQueue = queue;
    this.myProjectQueuesView.queueGridConfig[this.currentQueue.id] = { gridOptions: { pageSize: 10 } };
    this.myProjectQueuesView.currentQueueFolderId = folder.id;
    this.myProjectQueuesView.currentQueueId = queue.id;
    this.myProjectQueuesViewStorageService.save(this.myProjectQueuesView);
    this.changeDetectorRef.detectChanges();
  }

  toggleQueueListVisibility() {
    this.queueListHidden = !this.queueListHidden;
    this.myProjectQueuesView.queueListHidden = this.queueListHidden;
    this.myProjectQueuesViewStorageService.save(this.myProjectQueuesView);
  }

  onQueueDrop(event: any, folderIndex: number) {
    this._moveQueueToNthPosition(this.myProjectAndPersonalFolders[folderIndex].queues, event.previousIndex, event.currentIndex);
    this.myProjectAndPersonalFoldersStorageService.save(this.myProjectAndPersonalFolders);
    this._loadMySortedProjectQueues();
  }

  cloneCurrentQueue() {
    const currentQueueCopy = UtilsService.deepCopy(this.currentQueue);
    currentQueueCopy.name = `Copy - ${currentQueueCopy.name}`;
    currentQueueCopy.id = UtilsService.uuidv4();
    this.addEditQueue(currentQueueCopy, true);
  }

  async deleteCurrentQueue() {
    if (await confirm('Are you sure?')) {
      if (this.currentQueue.scope === QueueScopes.PERSONAL) {
        this.personalQueues.splice(
          this.personalQueues.findIndex((pq) => pq.id === this.currentQueue.id),
          1
        );
        this.personalQueuesStorageService.save(this.personalQueues);
      } else {
        this.projectQueues.splice(
          this.projectQueues.findIndex((pq) => pq.id === this.currentQueue.id),
          1
        );
        this.projectQueuesStorageService.save(this.projectQueues);
      }
      const currentQueueIndex = this.myProjectAndPersonalQueues.findIndex((pq) => pq.id === this.currentQueue.id);
      this.myProjectAndPersonalQueues.splice(currentQueueIndex, 1);
      // this.myProjectAndPersonalQueuesStorageService.save(this.myProjectAndPersonalQueues);
      this.currentFolder.queues.splice(
        this.currentFolder.queues.findIndex((q) => q.id === this.currentQueue.id),
        1
      );
      this._loadMySortedProjectQueues();
      this.currentQueue = this.myProjectAndPersonalQueues.length ? this.myProjectAndPersonalQueues[0] : undefined;
      this.currentFolder = this.myProjectAndPersonalFolders.find((mpg) => mpg.queues.indexOf(this.currentQueue.id) > -1);
      this.loadQueue(this.currentFolder, this.currentQueue);
    }
  }

  importQueues() {
    const dialogRef = this.dialog.open(ImportQueuesComponent, {
      width: '500px',
      data: {
        projectIdOrKey: this.projectIdOrKey,
        folders: UtilsService.deepCopy(this.projectFolders),
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        result.queues.map((queue: any) => {
          // Returns a JIRA Queue.
          const newQueue = {
            name: queue.name,
            jql: queue.jql,
            columns: queue.fields,
            priority: QueuePriorities.MEDIUM,
            scope: result.selectedQueueScope || QueueScopes.PROJECT,
            id: UtilsService.uuidv4(),
          };
          this.myProjectAndPersonalQueues.push(newQueue);
          this.myProjectAndPersonalFolders[this.myProjectAndPersonalFolders.findIndex((g) => g.id === result.importFolderId)].queues.push(
            newQueue.id
          );
          if (result.selectedQueueScope === QueueScopes.PERSONAL) {
            this.personalQueues.push(newQueue);
            this.personalFolders[this.personalFolders.findIndex((g) => g.id === result.importFolderId)].queues.push(newQueue.id);
          } else {
            this.projectQueues.push(newQueue);
            this.projectFolders[this.projectFolders.findIndex((g) => g.id === result.importFolderId)].queues.push(newQueue.id);
          }
        });
        if (result.selectedQueueScope === QueueScopes.PERSONAL) {
          this.personalQueuesStorageService.save(this.personalQueues);
          this.personalFoldersStorageService.save(this.personalFolders);
        } else {
          this.projectQueuesStorageService.save(this.projectQueues);
          this.projectFoldersStorageService.save(this.projectFolders);
        }
        // this.myProjectAndPersonalQueuesStorageService.save(this.myProjectAndPersonalQueues);
        this.myProjectAndPersonalFoldersStorageService.save(this.myProjectAndPersonalFolders);

        this._loadMySortedProjectQueues();
      }
    });
  }

  editFolders() {
    const dialogRef = this.dialog.open(AddEditFoldersComponent, {
      width: '600px',
      data: {
        projectIdOrKey: this.projectIdOrKey,
        folders: UtilsService.deepCopy(this.myProjectAndPersonalFolders),
        queues: UtilsService.deepCopy(this.myProjectAndPersonalQueues),
      },
    });

    dialogRef.afterClosed().subscribe(async (result: QueueFolder[]) => {
      if (result) {
        this.myProjectAndPersonalFolders = result;
        this.personalFolders = result.filter((qg) => qg.scope === QueueFolderScopes.PERSONAL);
        this.projectFolders = result.filter((qg) => qg.scope === QueueFolderScopes.PROJECT);

        this.myProjectAndPersonalFoldersStorageService.save(this.myProjectAndPersonalFolders);
        this.personalFoldersStorageService.save(this.personalFolders);
        this.projectFoldersStorageService.save(this.projectFolders);
        this._loadMySortedProjectQueues();
      }
    });
  }

  editQueues() {
    const dialogRef = this.dialog.open(EditQueuesComponent, {
      width: '700px',
      data: {
        projectIdOrKey: this.projectIdOrKey,
        queues: UtilsService.deepCopy(this.myProjectAndPersonalQueues),
      },
    });

    dialogRef.afterClosed().subscribe(async (result: Queue[]) => {
      if (result) {
        this.myProjectAndPersonalQueues = result;
        this.projectQueues = result.filter((q: Queue) => q.scope === QueueScopes.PROJECT);
        this.personalQueues = result.filter((q: Queue) => q.scope === QueueScopes.PERSONAL);
        const currentQueueExists = this.myProjectAndPersonalQueues.find((pq) => pq.id === this.currentQueue.id);
        if (this.myProjectAndPersonalQueues.length) {
          if (!currentQueueExists) {
            this.currentQueue = this.myProjectAndPersonalQueues[0];
          }
        } else {
          this.currentQueue = undefined;
        }
        // this.myProjectAndPersonalQueuesStorageService.save(this.myProjectAndPersonalQueues);
        this.personalQueuesStorageService.save(this.personalQueues);
        this.projectQueuesStorageService.save(this.projectQueues);

        this._loadMySortedProjectQueues();
      }
    });
  }

  editQueueList() {
    const dialogRef = this.dialog.open(QueueListViewComponent, {
      width: '500px',
      data: {
        projectIdOrKey: this.projectIdOrKey,
        queueListConfig: this.queueListConfig,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        this.queueListConfig = result;
        this.myProjectQueuesView.queueListConfig = result;
        this.myProjectQueuesViewStorageService.save(this.myProjectQueuesView);
      }
    });
  }

  addEditQueue(queue?: Queue, cloning?: boolean) {
    const newQueue = !queue || cloning;
    queue = queue || {
      id: UtilsService.uuidv4(),
      name: '',
    };
    const dialogRef = this.dialog.open(QueueComponent, {
      width: '600px',
      data: {
        newQueue,
        queue: UtilsService.deepCopy(queue),
        projectIdOrKey: this.projectIdOrKey,
        queues: UtilsService.deepCopy(this.myProjectAndPersonalQueues),
        folders: UtilsService.deepCopy(this.myProjectAndPersonalFolders),
        jiraFields: this.jiraFields,
      },
    });

    dialogRef.afterClosed().subscribe(async (result: { queue: Queue; folder: QueueFolder }) => {
      if (result?.queue) {
        const queue = result.queue;
        queue.updatedAt = new Date();
        const matchIndex = this.myProjectAndPersonalQueues.findIndex((pq) => pq.id === queue.id);
        if (matchIndex > -1) {
          this.myProjectAndPersonalQueues[matchIndex] = queue; // Update matching queue.
          if (queue.scope === QueueScopes.PERSONAL) {
            const matchingQueueIndex = this.personalQueues.findIndex((pq) => pq.id === queue.id);
            this.personalQueues[matchingQueueIndex] = queue;
            await this.personalQueuesStorageService.save(this.personalQueues);
          } else {
            const matchingQueueIndex = this.projectQueues.findIndex((pq) => pq.id === queue.id);
            this.projectQueues[matchingQueueIndex] = queue;
            await this.projectQueuesStorageService.save(this.projectQueues);
          }
        } else {
          this.myProjectAndPersonalQueues.push(queue); // Insert new queue.
          if (queue.scope === QueueScopes.PERSONAL) {
            this.personalQueues.push(queue);
            this.personalQueuesStorageService.save(this.personalQueues);
          } else {
            this.projectQueues.push(queue);
            this.projectQueuesStorageService.save(this.projectQueues);
          }
          this._mergeProjectAndPersonalQueues();
          // this.myProjectAndPersonalQueuesStorageService.save(this.myProjectAndPersonalQueues);
          await this._createOrAddToQueueFolder(result.folder, queue);
        }
        // await this.myProjectAndPersonalQueuesStorageService.save(this.myProjectAndPersonalQueues); // Save all queues.
        this._loadMySortedProjectQueues();
        if (!this.currentQueue && !this.currentFolder) {
          this.loadQueue(this.myProjectAndPersonalFolders[0], this.myProjectAndPersonalQueues[0]);
        }
      }
    });
  }

  myQueuesViewChanged(queueGridOptions: any) {
    this.myProjectQueuesView.queueGridConfig[this.currentQueue.id] = this.myProjectQueuesView.queueGridConfig[this.currentQueue.id] || {
      gridOptions: {},
    };
    this.myProjectQueuesView.queueGridConfig[this.currentQueue.id].gridOptions = queueGridOptions;
    this.myProjectQueuesViewStorageService.save(this.myProjectQueuesView);
  }

  private async _createOrAddToQueueFolder(folder: QueueFolder, queue: Queue) {
    if (queue.scope === QueueScopes.PERSONAL) {
      if (this.personalFolders?.length) {
        folder ? this.personalFolders.find((pg) => pg.id === folder.id).queues.push(queue.id) : this.personalFolders[0].queues.push(queue.id);
        await this.personalFoldersStorageService.save(this.personalFolders);
      } else {
        this.personalFolders = [
          {
            id: UtilsService.uuidv4(),
            name: 'Personal Queues',
            scope: QueueFolderScopes.PERSONAL,
            collapsed: false,
            queues: [queue.id],
          },
        ];
        await this.personalFoldersStorageService.save(this.personalFolders);
      }
    } else {
      if (this.projectFolders?.length) {
        folder ? this.projectFolders.find((pg) => pg.id === folder.id).queues.push(queue.id) : this.projectFolders[0].queues.push(queue.id);
        await this.projectFoldersStorageService.save(this.projectFolders);
      } else {
        this.projectFolders = [
          {
            id: UtilsService.uuidv4(),
            name: 'Project Queues',
            scope: QueueFolderScopes.PROJECT,
            collapsed: false,
            queues: [queue.id],
          },
        ];
        await this.projectFoldersStorageService.save(this.projectFolders);
      }
    }
    this._mergeProjectAndPersonalFolders();
    await this.myProjectAndPersonalFoldersStorageService.save(this.myProjectAndPersonalFolders);
  }

  _isQueueVisible(queue: Queue) {
    if (!queue.visibilityGroups?.length) return true;
    let visible = false;
    for (const userFolder of this.currentUserJiraGroups) {
      for (const qvg of queue.visibilityGroups) {
        if (qvg === userFolder.name) {
          visible = true;
        }
      }
    }
    return visible;
  }

  _mergeProjectAndMyProjectFolders() {
    // Delete My Project Folders if they don't exist anymore;
    for (let i = this.myProjectAndPersonalFolders.length - 1; i >= 0; i--) {
      if (
        this.myProjectAndPersonalFolders[i].scope === QueueFolderScopes.PROJECT &&
        this.projectFolders.findIndex((pg) => pg.id === this.myProjectAndPersonalFolders[i].id) < 0
      ) {
        this.myProjectAndPersonalFolders.splice(i, 1);
      }
    }

    // Add Project Folders to My Folders if they don't exist;
    for (const projectFolder of this.projectFolders) {
      if (this.myProjectAndPersonalFolders.findIndex((mg) => mg.id === projectFolder.id) < 0) {
        this.myProjectAndPersonalFolders.push(projectFolder);
      }
    }
  }

  private _mergeProjectAndPersonalQueues() {
    this.myProjectAndPersonalQueues = [...this.personalQueues, ...this.projectQueues];
  }

  private _mergeProjectAndPersonalFolders() {
    this.myProjectAndPersonalFolders = [...this.personalFolders, ...this.projectFolders];
  }

  _loadMySortedProjectQueues() {
    for (const folder of this.myProjectAndPersonalFolders) {
      this.mySortedProjectQueues[folder.id] = this.getFolderQueues(folder);
    }
  }

  _cleanFolderQueues() {
    for (const folder of this.myProjectAndPersonalFolders) {
      for (let i = folder.queues.length - 1; i >= 0; i--) {
        if (this.myProjectAndPersonalQueues.findIndex((q) => q.id === folder.queues[i]) < 0) {
          folder.queues.splice(i, 1);
        }
      }
    }
  }

  _moveQueueToNthPosition(queuesIdArr: string[], currentPosition: number, newPosition: number) {
    let countOfNotVisibleQueuesBeforeCurrentPosition = 0;
    for (let i = 0; i <= currentPosition; i++) {
      if (!this._isQueueVisible(this.myProjectAndPersonalQueues.find((mpq) => mpq.id === queuesIdArr[i]))) {
        countOfNotVisibleQueuesBeforeCurrentPosition++;
      }
    }
    currentPosition = currentPosition + countOfNotVisibleQueuesBeforeCurrentPosition;

    let countOfNotVisibleQueuesBeforeNewPosition = 0;
    for (let i = 0; i <= newPosition; i++) {
      if (!this._isQueueVisible(this.myProjectAndPersonalQueues.find((mpq) => mpq.id === queuesIdArr[i]))) {
        countOfNotVisibleQueuesBeforeNewPosition++;
      }
    }
    newPosition = newPosition + countOfNotVisibleQueuesBeforeNewPosition;

    moveItemInArray(queuesIdArr, currentPosition, newPosition);
  }
}
