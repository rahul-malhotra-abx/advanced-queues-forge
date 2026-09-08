export const QueueFolderScopes = {
  PERSONAL: 'Personal',
  PROJECT: 'Project',
};

export interface QueueFolder {
  id: string;
  name: string;
  collapsed: boolean;
  queues: string[];
  scope: string;
}

export const DefaultQueueFolders: QueueFolder[] = [
  {
    id: '36126830-2dbb-4b94-8cfa-edc77ae10158',
    name: 'Starred',
    collapsed: false,
    queues: ['93ac4a78-a399-4fed-bfaa-d3d3147872a1'],
    scope: QueueFolderScopes.PROJECT,
  },
  {
    id: 'e6d3184f-db12-42ec-99fb-43a4bab0c3cf',
    name: 'Team Priority',
    collapsed: false,
    queues: ['e469f85b-c896-4fbf-b874-dad548798ebc', 'e9b757cb-349a-4e4f-8ffe-a933df838554'],
    scope: QueueFolderScopes.PROJECT,
  },
  {
    id: '09587775-bd4f-436b-a080-91fa365f39ed',
    name: 'Hidden',
    collapsed: true,
    queues: [],
    scope: QueueFolderScopes.PROJECT,
  },
];
