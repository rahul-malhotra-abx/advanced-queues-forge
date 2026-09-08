export interface ProjectAdminSetting {
  version: number;
  advancedQueuesEnabled: boolean;
  dateColumnFormat: string;
}

export const DefaultProjectAdminSettings: ProjectAdminSetting = {
  version: 1.0,
  advancedQueuesEnabled: true,
  dateColumnFormat: 'MM/DD/YYYY hh:mm:ss',
};
