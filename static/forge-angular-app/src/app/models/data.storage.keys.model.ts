export const DataStorageKeys = {
  PROJECT_SETTINGS: 'project-settings',
  PROJECT_ADMIN_SETTINGS: 'project-admin-settings',
  PROJECT_FOLDERS: 'project-folders',
  PROJECT_QUEUES: 'project-queues',
  USER_PROJECT_QUEUES: (projectIdOrKey: string) => {
    return 'user-project-queues-' + projectIdOrKey;
  },
  USER_PROJECT_FOLDERS: (projectIdOrKey: string) => {
    return 'user-project-folders-' + projectIdOrKey;
  },
  MY_USER_PROJECT_QUEUES: (projectIdOrKey: string) => {
    return 'my-user-project-queues-' + projectIdOrKey;
  },
  MY_USER_PROJECT_FOLDERS: (projectIdOrKey: string) => {
    return 'my-user-project-folders-' + projectIdOrKey;
  },
  MY_USER_PROJECT_QUEUES_VIEW: (projectIdOrKey: string) => {
    return 'my-user-project-queues-view-' + projectIdOrKey;
  },
};
