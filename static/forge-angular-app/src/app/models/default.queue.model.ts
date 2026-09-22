import { JiraUserModel } from './jira.user.model';

export interface Queue {
  id: string;
  name: string;
  scope?: string;
  filters?: [];
  columns?: string[];
  description?: string;
  alert?: string;
  alertLevel?: string;
  jql?: string;
  priority?: any;
  visibilityGroups?: any[];
  updatedAt?: Date;
  updatedBy?: JiraUserModel;
}

/** Per queue, refreshed every 30 seconds. Kept beside the queues, never on them: a Queue is stored as-is. */
export interface QueueRefreshData {
  count?: number;
  lastCreated?: any;
  lastUpdated?: any;
  createdMs: number;
  updatedMs: number;
}

export const QueueScopes = {
  PERSONAL: 'Personal',
  PROJECT: 'Project',
};

export const QueuePriorities = {
  HIGHEST: 'Highest',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  LOWEST: 'Lowest',
};

export const QueuePriorityOrder = {};
QueuePriorityOrder[QueuePriorities.HIGHEST] = 5;
QueuePriorityOrder[QueuePriorities.HIGH] = 4;
QueuePriorityOrder[QueuePriorities.MEDIUM] = 3;
QueuePriorityOrder[QueuePriorities.LOW] = 2;
QueuePriorityOrder[QueuePriorities.LOWEST] = 1;

export const DefaultQueues: Queue[] = [
  {
    id: '93ac4a78-a399-4fed-bfaa-d3d3147872a1',
    name: 'Assigned to me',
    scope: QueueScopes.PROJECT,
    filters: [],
    columns: ['summary', 'reporter', 'assignee', 'status', 'created'],
    description: 'All unresolved issues',
    alert: '',
    alertLevel: '',
    jql: 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC',
    priority: QueuePriorities.HIGH,
    visibilityGroups: [],
    updatedAt: new Date(),
  },
  {
    id: 'e9b757cb-349a-4e4f-8ffe-a933df838554',
    name: 'Unassigned issues',
    scope: QueueScopes.PROJECT,
    filters: [],
    columns: ['summary', 'reporter', 'assignee', 'status', 'created'],
    description: 'All unresolved issues',
    alert: '',
    alertLevel: '',
    jql: 'assignee is EMPTY AND resolution = Unresolved ORDER BY updated DESC',
    priority: QueuePriorities.HIGH,
    visibilityGroups: [],
    updatedAt: new Date(),
  },
  {
    id: 'e469f85b-c896-4fbf-b874-dad548798ebc',
    name: 'All Open',
    scope: QueueScopes.PROJECT,
    filters: [],
    columns: ['summary', 'reporter', 'assignee', 'status', 'created'],
    description: 'All unresolved issues',
    alert: '',
    alertLevel: '',
    jql: 'resolution = Unresolved ORDER BY updated DESC',
    priority: QueuePriorities.HIGHEST,
    visibilityGroups: [],
    updatedAt: new Date(),
  },
];
