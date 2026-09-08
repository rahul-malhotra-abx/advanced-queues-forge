export interface JiraUserModel {
  key?: string;
  accountId?: string;
  name?: string;
  emailAddress?: string;
  avatarUrls: {
    '48x48'?: string,
    '24x24': string,
    '16x16'?: string,
    '32x32'?: string
  };
  displayName: string;
  active?: boolean;
  timeZone?: string;
  self?: string;
  locale?: string;
  avatarUrl?: string;
  accountType?: string
}
