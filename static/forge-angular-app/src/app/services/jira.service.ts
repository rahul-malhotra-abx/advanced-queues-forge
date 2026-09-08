import { requestJira, router, showFlag, view } from '@forge/bridge';
import { JiraUserModel } from '../models/jira.user.model';
import { UtilsService } from './utils.service';
import { ENVIRONMENT } from '../environment';
import { DataStorageKeys } from '../models/data.storage.keys.model';

export class JiraService {
  static cache: any = {
    userPermissions: undefined,
    fields: undefined,
  };

  /** Resolved Forge context, cached — but never one that arrived without an extension. */
  private static contextCache: any = undefined;

  /** Monotonic, so two flags raised in the same millisecond get distinct ids. */
  private static flagCounter = 0;

  /** The Connect `AP` surface on @forge/bridge — shaped exactly like it, so the 33 call sites are untouched. */
  static AP = {
    /**
     * Resolves to the PARSED body, as Connect's wrapper did, and REJECTS on a
     * non-ok response so callers that rely on rejection keep working. The
     * Connect wrapper it replaces neither resolved nor rejected when AP was
     * missing — a silent hang; that behaviour is deliberately not ported.
     *
     * requestJira, not a resolver: issue edits and comments must be attributed
     * to the user, and a resolver would attribute them to the app.
     */
    request: async (...args: any): Promise<any> => {
      const options = typeof args[0] === 'string' ? { url: args[0] } : args[0] ?? {};
      const response = await requestJira(options.url, {
        method: (options.type || 'GET').toUpperCase(),
        headers: { 'Content-Type': options.contentType || 'application/json' },
        ...(options.data === undefined ? {} : { body: options.data }),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Jira responded ${response.status}: ${(text || '').slice(0, 500)}`);
      }
      if (!text) {
        return undefined;
      }
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    },

    context: {
      getContext: () => JiraService.getContext(),
    },

    flag: {
      /**
       * Connect's {title, body, type, close, actions} -> Forge's
       * {id, title, description, type, isAutoDismiss, actions}, so the call site
       * in showNotification is unchanged.
       *
       * Connect delivered clicks on a separate `AP.events.on('flag.action')`
       * bus. @forge/bridge has no event bus, so the handler that bus fed lives
       * here now, on each action's onClick. Connect's actions are a map of
       * {actionIdentifier: label}; for this app the identifier is an issue key.
       * router.open, not window.open — a Forge iframe cannot reliably open a
       * window — and a product-relative path, because getParentDomain() reads
       * AP._hostOrigin and cannot resolve the host from inside a Forge frame.
       */
      create: (options: { title?: string; body?: string; type?: string; close?: string; actions?: any }) => {
        const appearance = ['info', 'success', 'warning', 'error'].includes(options?.type)
          ? (options.type as 'info' | 'success' | 'warning' | 'error')
          : 'info';
        const actions = Object.entries(options?.actions ?? {}).map(([issueKey, label]) => ({
          text: String(label),
          onClick: () => void router.open(`/browse/${issueKey}`),
        }));
        return showFlag({
          id: `aq-${Date.now()}-${JiraService.flagCounter++}`,
          title: options?.title,
          description: options?.body,
          type: appearance,
          // Explicit `close` wins; otherwise errors stay until dismissed.
          isAutoDismiss: options?.close ? options.close !== 'manual' : appearance !== 'error',
          ...(actions.length ? { actions } : {}),
        });
      },
    },

    navigator: {
      /** Connect reloaded the host page; Forge refreshes the module in place, and not every view can. */
      reload: async () => {
        try {
          await view.refresh();
        } catch {
          /* module cannot refresh; cosmetic, so swallow it */
        }
      },
    },

    // Gone, not stubbed: `resize` (Forge sizes the frame), `events` (no bus —
    // see flag.create), `jira.showJQLEditor` (a later order ships a real editor).
  };

  static async request(data: any) {
    return await this.AP.request(data);
  }

  /**
   * Forge's context, reshaped into the `{jira: {project, issue}}` form the app
   * already reads (project.component and autocomplete.component both reach for
   * `jiraContext.jira.project`).
   */
  static async getContext(): Promise<any> {
    if (this.contextCache) {
      return this.contextCache;
    }
    const context: any = await view.getContext();
    const extension = context?.extension ?? {};
    const adapted = {
      ...context,
      jira: {
        project: extension.project ?? extension.jira?.project,
        issue: extension.issue ?? extension.jira?.issue,
      },
    };
    // NEVER cache a context without an extension. Angular calls this during
    // bootstrap, before the bridge is necessarily connected, and caching that
    // empty result poisons every later caller for the life of the page.
    if (context?.extension) {
      this.contextCache = adapted;
    }
    return adapted;
  }

  /** Which module the user opened. Drives the routing switch in app.component. */
  static async getModuleKey(): Promise<{ moduleKey?: string; type?: string; projectId?: string }> {
    const context: any = await this.getContext();
    return {
      moduleKey: context?.extension?.moduleKey ?? context?.moduleKey,
      type: context?.extension?.type ?? context?.type,
      projectId: context?.extension?.project?.id ?? context?.jira?.project?.id,
    };
  }

  /**
   * Forge is the only place this app ships now, and it ships paid-only, so the
   * licence check is the whole gate — there is no Free variant to fall back to.
   *
   * Only an explicit `license.active === false` counts as unlicensed. A missing
   * licence object off production means a dev or staging install, where Forge
   * does not populate one; locking those out would make every dev install look
   * broken. On production a missing licence falls through to
   * ENVIRONMENT.ALLOW_UNLICENSED, which is `false` for the paid listing.
   */
  static async hasValidLicense(): Promise<boolean> {
    const context: any = await this.getContext();
    if (context?.license) {
      return context.license.active !== false;
    }
    if (String(context?.environmentType || '').toUpperCase() !== 'PRODUCTION') {
      return true;
    }
    return ENVIRONMENT.ALLOW_UNLICENSED;
  }

  static async isValidPaidApplication(): Promise<boolean> {
    const hasValidLicense = await JiraService.hasValidLicense();
    return hasValidLicense && ENVIRONMENT.PAID_VERSION;
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
        // Relative, not '/assets/…': a Forge app is served from a path on the
        // CDN, so a leading slash escapes the app's scope (Trap 14).
        // NOTE: system-icon.png does not exist in assets/images and never did,
        // so this fallback avatar was already a broken image under Connect.
        // Left as a dead reference rather than silently substituting an icon —
        // that is a product decision, not a port decision.
        avatarUrls: { '24x24': 'assets/images/system-icon.png' },
        displayName: 'System',
        emailAddress: '',
        key: '',
        name: 'System',
        timeZone: '',
      };
    }
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

  // get/saveApplicationProperties are DELETED (decisions.md 5). They were the
  // app's only use of Connect's add-on property store,
  // /rest/atlassian-connect/1/addons/<key>/properties, which nothing serves on
  // Forge — every call would 404.
  //
  // Nothing is stranded: the APPLICATION storage context that called them was
  // branch-only with no constructor anywhere in the app, so that store is empty
  // on every tenant. There is no data to migrate and no reason to reach for
  // @forge/kvs, which is why this app declares no `storage:app` scope.

  /**
   * Trap 7. The project-admin-settings property has been written by Connect and
   * is now read by Forge, and Connect's `entityPropertyEqualTo` compares
   * stringified values — so `advancedQueuesEnabled` can come back as a boolean
   * or as the strings "true"/"false".
   *
   * The string form is the dangerous one: `"false"` is TRUTHY in JavaScript, so
   * an unnormalised value makes a DISABLED project's toggle render "Enabled"
   * while the manifest's own `entityPropertyEqualTo` correctly hides the module.
   * The admin screen and the actual behaviour then disagree, which reads as data
   * loss rather than a display bug.
   *
   * Both readers of this property route through here — `getProjectSettings`
   * below, and the bulk project fetch in project-enablement.component — so the
   * coercion lives in one place rather than at each call site.
   *
   * Returns the original reference when there is nothing to fix.
   */
  static normaliseProjectAdminSettings(raw: any): any {
    if (!raw || typeof raw !== 'object') {
      return raw;
    }
    const flag = raw.advancedQueuesEnabled;
    return typeof flag === 'string' ? { ...raw, advancedQueuesEnabled: flag.trim().toLowerCase() === 'true' } : raw;
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
          return this.normaliseProjectAdminSettings(projectSetting.value);
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

  /**
   * Native JSM queues for a project. Returns `undefined` when the project has
   * no service desk.
   *
   * This is the only Jira Service Management endpoint the app calls, and it is
   * reachable for projects that are not service projects at all: the Connect
   * descriptor declared no JSM condition, so the project page renders on every
   * project type, and the import dialog lets the user pick any project from a
   * list. A software or business project arriving here is therefore ordinary,
   * not exceptional — it was the one unguarded request in this file, and it
   * threw rather than returning nothing.
   *
   * Guarded rather than gated: adding a JSM condition to the module would hide
   * the app from any non-JSM project a customer has enabled today, which is a
   * silent feature removal on upgrade. Degrading this one feature is the
   * smaller change.
   */
  static async getProjectQueues(projectIdOrKey: string) {
    try {
      return await this.AP.request({
        url: `/rest/servicedeskapi/servicedesk/projectId:${projectIdOrKey}/queue`,
        type: 'GET',
        contentType: 'application/json',
      });
    } catch (error) {
      console.warn(`No service desk for project ${projectIdOrKey}; it is probably not a service project.`, error);
      return undefined;
    }
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

  /**
   * Permissions for the CURRENT project. The project scope is not optional.
   *
   * `/rest/api/3/mypermissions` without a project answers "does this user hold
   * the permission in AT LEAST ONE project". Every caller here asks about
   * ADMINISTER_PROJECTS to decide whether to unlock the shared queue and folder
   * editors — so unscoped, a user who administers one unrelated project reads as
   * an admin on every project in the site. Jira then refuses the property write,
   * and because the save path does not await, the 403 is swallowed and the edit
   * silently vanishes.
   *
   * The project id is resolved here rather than threaded through the five
   * callers: they all render inside the project page, so the Forge context
   * already knows which project, and one resolution point cannot drift.
   *
   * Fails CLOSED. No project id means no answer, and `hasOneOfPermission`
   * treats a missing answer as "no permission".
   */
  static async getUserPermissions(permissions: string[]) {
    try {
      const context = await this.getContext();
      const projectId = context?.jira?.project?.id;
      if (!projectId) {
        console.warn('No project in context; refusing to evaluate project permissions unscoped.');
        return undefined;
      }
      const userPermissions = await this.AP.request({
        url: `/rest/api/3/mypermissions?projectId=${encodeURIComponent(projectId)}&permissions=${permissions.join(',')}`,
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

