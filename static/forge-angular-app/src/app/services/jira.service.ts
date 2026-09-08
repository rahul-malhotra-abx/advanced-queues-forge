import { JiraUserModel } from '../models/jira.user.model';
import { UtilsService } from './utils.service';
import { ENVIRONMENT } from '../environment';
import { DataStorageKeys } from '../models/data.storage.keys.model';

export class JiraService {
  static cache: any = {
    userPermissions: undefined,
    fields: undefined,
  };
  static AP = {
    // tslint:disable-next-line:no-unused-expression
    request: async (...args: any): Promise<any> => {
      const jiraAP = window['AP'];
      return new Promise(async (resolve, reject): Promise<any> => {
        if (jiraAP) {
          try {
            const resp = await jiraAP.request(...args);
            resolve(resp.body ? JSON.parse(resp.body) : resp.body);
          } catch (e) {
            reject(e);
          }
        } else {
          console.error('AP is not defined');
        }
      });
    },
    context: window['AP'].context,
    user: window['AP'].user,
    jira: window['AP'].jira,
    navigator: window['AP'].navigator,
    flag: window['AP'].flag,
    resize: window['AP'].resize,
    events: window['AP'].events,
  };

  static async request(data: any) {
    return await this.AP.request(data);
  }

  static async getContext() {
    return this.AP.context.getContext();
  }

  static isInJira() {
    return window.parent !== window;
  }

  static async getProjectProperties(projectIdOrKey: string, properties: string[]) {
    const response = await this.AP.request({
      url: `/rest/api/3/project/${projectIdOrKey}?properties=${properties.join(',')}`,
      type: 'GET',
      contentType: 'application/json',
    });
    return response?.properties ? response.properties : {};
  }

  static async saveProjectProperties(projectIdOrKey: string, properties: any[]) {
    for (const property of properties) {
      await this.AP.request({
        url: `/rest/api/3/project/${projectIdOrKey}/properties/${property.key}`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(property.value),
      });
    }
  }

  static async getUserProperties(accountId: string, properties: string[]) {
    const response = await this.AP.request({
      url: `/rest/api/3/user/properties?accountId=${accountId}`,
      type: 'GET',
      contentType: 'application/json',
    });
    const availableUserProperties = response?.keys ? response.keys : [];
    const finalKeys = {};
    for (const property of properties) {
      if (availableUserProperties.findIndex((up) => up.key === property) > -1) {
        const response = await this.AP.request({
          url: `/rest/api/3/user/properties/${property}?accountId=${accountId}`,
          type: 'GET',
          contentType: 'application/json',
        });
        finalKeys[response.key] = response?.value ? response.value : '';
      }
    }
    return finalKeys;
  }

  static async saveUserProperties(accountId: string, properties: any[]) {
    for (const property of properties) {
      await this.AP.request({
        url: `/rest/api/3/user/properties/${property.key}?accountId=${accountId}`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(property.value),
      });
    }
  }

  static async getTicketProperties(ticketIdOrKey: string, properties: string[]) {
    const response = await this.AP.request({
      url: `/rest/api/3/issue/${ticketIdOrKey}?properties=${properties.join(',')}`,
      type: 'GET',
      contentType: 'application/json',
    });
    return response?.properties ? response.properties : {};
  }

  static async saveTicketProperties(ticketIdOrKey: string, properties: any[]) {
    for (const property of properties) {
      await this.AP.request({
        url: `/rest/api/3/issue/${ticketIdOrKey}/properties/${property.key}`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(property.value),
      });
    }
  }

  static async saveUserProperty(accountId: any, property: { key: any; value: any }) {
    await this.AP.request({
      url: `/rest/api/3/user/properties/${property.key}?accountId=${accountId}`,
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify(property.value),
    });
  }

  static async getCurrentJiraUser(): Promise<JiraUserModel> {
    if (this.isInJira()) {
      return (await this.AP.request(`/rest/api/3/myself`)) as JiraUserModel;
    } else {
      return {
        accountId: '',
        active: true,
        avatarUrls: { '24x24': '/assets/images/system-icon.png' },
        displayName: 'System',
        emailAddress: '',
        key: '',
        name: 'System',
        timeZone: '',
      };
    }
  }

  static openJQLEditor(options: any, callback: any) {
    this.AP.jira.showJQLEditor(options, callback);
  }

  static async checkIssuesAgainstJQLs(issueIds: any[], JQLs: string[]) {
    const JQLChunk = UtilsService.sliceIntoChunks(JQLs, 10);
    const allMatches = [];
    for (const chunk of JQLChunk) {
      const response: any = await this.AP.request({
        url: `/rest/api/3/jql/match`,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ issueIds, jqls: chunk }),
      });
      allMatches.push(...response.matches);
    }
    return allMatches;
  }

  static resize(width: any, height: any) {
    this.AP.resize(width, height);
  }

  static async getApplicationProperties(property: string) {
    const response = await this.AP.request({
      url: `/rest/atlassian-connect/1/addons/${ENVIRONMENT.APP_KEY}/properties/`,
      type: 'GET',
      contentType: 'application/json',
    });
    let keyIndex = response.keys.findIndex((k: { key: string }) => k.key === property);
    if (keyIndex > -1) {
      const response = await this.AP.request({
        url: `/rest/atlassian-connect/1/addons/${ENVIRONMENT.APP_KEY}/properties/${property}`,
        type: 'GET',
        contentType: 'application/json',
      });
      const returnObj: { [key: string]: any } = {};
      returnObj[response.key] = response.value;
      return response?.value ? returnObj : {};
    }
    return {};
  }

  static async saveApplicationProperties(properties: any[]) {
    for (const property of properties) {
      await this.AP.request({
        url: `/rest/atlassian-connect/1/addons/${ENVIRONMENT.APP_KEY}/properties/${property.key}`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(property.value),
      });
    }
  }

  static async getProjectSettings(projectIdOrKey: any) {
    if (this.isInJira()) {
      try {
        let projectSettingAvailable = false;
        let projectProperties: any = await this.AP.request({
          url: `/rest/api/3/project/${projectIdOrKey}/properties`,
          type: 'GET',
          contentType: 'application/json',
        });
        projectProperties = projectProperties['keys'];
        for (const property of projectProperties) {
          if (property.key === `${ENVIRONMENT.APP_BASE_KEY}_${DataStorageKeys.PROJECT_ADMIN_SETTINGS}`) {
            projectSettingAvailable = true;
          }
        }
        if (projectSettingAvailable) {
          const projectSetting = await this.AP.request({
            url: `/rest/api/3/project/${projectIdOrKey}/properties/${ENVIRONMENT.APP_BASE_KEY}_${DataStorageKeys.PROJECT_ADMIN_SETTINGS}`,
            type: 'GET',
            contentType: 'application/json',
          });
          return projectSetting.value;
        } else {
          return undefined;
        }
      } catch (e) {
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  static async getAllProjects(projectQuery?: string, maxResults?: number, startAt?: number) {
    if (this.isInJira()) {
      try {
        let queryParams = `maxResults=${maxResults || 50}&startAt=${startAt || 0}&expand=lead&orderBy=name&properties=${ENVIRONMENT.APP_BASE_KEY}_${
          DataStorageKeys.PROJECT_ADMIN_SETTINGS
        }`;
        if (projectQuery) {
          queryParams += `query=${projectQuery}`;
        }
        const projectWithProperties: any = await this.AP.request({
          url: `/rest/api/3/project/search?${queryParams}`,
          type: 'GET',
          contentType: 'application/json',
        });
        return projectWithProperties;
      } catch (e) {
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  static async saveProjectSettings(projectSettings: any, projectIdOrKey: any) {
    await this.AP.request({
      url: `/rest/api/3/project/${projectIdOrKey}/properties/${ENVIRONMENT.APP_BASE_KEY}_${DataStorageKeys.PROJECT_ADMIN_SETTINGS}`,
      type: 'PUT',
      data: JSON.stringify(projectSettings),
      contentType: 'application/json',
    });
  }

  static async getJiraFields() {
    if (this.isInJira()) {
      try {
        if (!this.cache.fields) {
          const fields = await this.AP.request({
            url: `/rest/api/3/field`,
            type: 'GET',
            contentType: 'application/json',
          });
          this.cache.fields = fields;
          return fields;
        } else {
          return this.cache.fields;
        }
      } catch (e) {
        return undefined;
      }
    } else {
      return [
        {
          id: 'reporter',
          name: 'Reporter',
        },
      ];
    }
  }

  static async getIssueWithProperties(issueKey: string, properties?: string[], fields?: string[], expand?: string[]) {
    expand = expand || ['renderedFields'];
    properties = properties?.map((property) => `${ENVIRONMENT.APP_BASE_KEY}-${property}`);
    const result: { total: number; issues: any[] } = await this.AP.request({
      url: `/rest/api/3/search/jql`,
      type: 'POST',
      data: JSON.stringify({
        properties,
        fields,
        expand,
        jql: `key = ${issueKey}`,
        maxResults: 1,
      }),
      contentType: 'application/json',
    });
    return result?.issues?.length > 0 ? result.issues[0] : undefined;
  }

  static async getCountAndLastIssueForJQL(jql: string, lastUpdated = false) {
    if (jql.includes('ORDER BY')) {
      jql = jql.replace(/ORDER BY .*/, 'ORDER BY created DESC');
    } else {
      jql += ' ORDER BY created DESC';
    }
    console.log('Modified JQL:', jql);
    const result: { total: number; issues: any[] } = await this.AP.request({
      url: `/rest/api/3/search/jql`,
      type: 'POST',
      data: JSON.stringify({
        jql,
        fields: ['created', 'updated'],
        maxResults: 1,
      }),
      contentType: 'application/json',
    });

    let result2: { total: number; issues: any[] };
    if (lastUpdated) {
      if (jql.includes('ORDER BY')) {
        jql = jql.replace(/ORDER BY .*/, 'ORDER BY updated DESC');
      } else {
        jql += ' ORDER BY updated DESC';
      }
      result2 = await this.AP.request({
        url: `/rest/api/3/search/jql`,
        type: 'POST',
        data: JSON.stringify({
          jql,
          fields: ['updated'],
          maxResults: 1,
        }),
        contentType: 'application/json',
      });
    }
    return {
      lastCreated: result.issues?.[0],
      lastUpdated: result2?.issues?.[0],
      count: result.total,
    };
  }

  static async getProject(projectIdOrKey: string) {
    if (this.isInJira()) {
      try {
        return await this.AP.request({
          url: `/rest/api/3/project/${projectIdOrKey}`,
          type: 'GET',
          contentType: 'application/json',
        });
      } catch (e) {
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  static async getProjectQueues(projectIdOrKey: string) {
    return await this.AP.request({
      url: `/rest/servicedeskapi/servicedesk/projectId:${projectIdOrKey}/queue`,
      type: 'GET',
      contentType: 'application/json',
    });
  }

  static async executeJQL(jql: string, maxResults: number, properties?: string[], fields?: string[], expand?: string): Promise<any[]> {
    expand = expand || 'renderedFields';
    properties = properties?.map((property) => `${ENVIRONMENT.APP_BASE_KEY}-${property}`);
    if (!fields) {
      fields = ['*all', '-comment', '-description'];
    }
    let allIssues = [];
    let result: { isLast: boolean; issues: any[]; nextPageToken: string };
    do {
      result = await this.AP.request({
        url: `/rest/api/3/search/jql`,
        type: 'POST',
        data: JSON.stringify({
          jql,
          maxResults,
          properties,
          fields,
          expand,
          nextPageToken: result?.nextPageToken,
        }),
        contentType: 'application/json',
      });
      allIssues.push(...result.issues);
    } while (!result.isLast && allIssues.length < maxResults);
    return allIssues;
  }

  static async getUserPermissions(permissions: string[]) {
    try {
      const userPermissions = await this.AP.request({
        url: `/rest/api/3/mypermissions?permissions=${permissions.join(',')}`,
        type: 'GET',
        contentType: 'application/json',
      });
      return userPermissions;
    } catch (e) {}
  }

  static async getGroups(query: string) {
    try {
      const groupsResponse = await this.AP.request({
        url: `/rest/api/3/groups/picker?query=${query}`,
        type: 'GET',
        contentType: 'application/json',
      });
      return groupsResponse.groups;
    } catch (e) {}
  }

  static async getUserGroups(accountId: string) {
    try {
      const userGroupResponse = await this.AP.request({
        url: `/rest/api/3/user/groups?accountId=${accountId}`,
        type: 'GET',
        contentType: 'application/json',
      });
      return userGroupResponse;
    } catch (e) {}
  }

  static showNotification(
    title: string,
    body: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success',
    close: 'auto' | 'manual' = 'auto',
    actions: any = undefined
  ) {
    const notification = { title, body, type, close };
    if (actions) {
      notification['actions'] = actions;
    }
    this.AP.flag.create(notification);
  }

  static async getSavedFilters() {
    try {
      const userGroupResponse = await this.AP.request({
        url: `/rest/api/3/filter/my`,
        type: 'GET',
        contentType: 'application/json',
      });
      return userGroupResponse;
    } catch (e) {}
  }

  static async getAssignees(projectKey: string) {
    try {
      const assigneeList = await this.AP.request({
        url: `/rest/api/3/user/assignable/search?project=${projectKey}`,
        type: 'GET',
        contentType: 'application/json',
      });
      return assigneeList;
    } catch (e) {
      console.error('Error fetching assignees:', e);
    }
  }  

  static async assignUserToIssue(assigneeId: string, issueKey: string) {
    try {
      const body = {
        accountId: assigneeId
      };
      const response = await this.AP.request({
        url: `/rest/api/3/issue/${issueKey}/assignee`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(body),
      });
      return response;
    } catch (e) {
      console.error('Error assigning user to issue:', e);
      throw e;
    }
  }
}

JiraService.AP.events.on('flag.action', (event: any) => {
  window.open(UtilsService.getIssueUrl({ key: event.actionIdentifier }), '_blank');
});
