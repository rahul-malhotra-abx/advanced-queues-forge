import { JiraUserModel } from '../models/jira.user.model';
import { ALLOWED_JIRA_COLUMN_RENDERERS } from '../models/allowed.jira.column.renderers';
import { v4 as uuidv4 } from 'uuid';
import { QueuePriorityOrder } from '../models/default.queue.model';

export class UtilsService {
  static hasOneOfPermission(requestedPermissions: string[], userPermissions: any) {
    for (const [permissionKey, permission] of Object.entries(userPermissions.permissions)) {
      if (requestedPermissions.indexOf(permissionKey) > -1 && permission['havePermission']) {
        return true;
      }
    }
    return false;
  }
  static mergeJiraDataKeys(properties: any, prefix: string) {
    let stringData = '';
    const orderedProperties = Object.keys(properties)
      .sort()
      .reduce((obj, key) => {
        obj[key] = properties[key];
        return obj;
      }, {});
    let totalSize = properties[`${prefix}_0`] && properties[`${prefix}_0`].totalSize ? properties[`${prefix}_0`].totalSize : 0;
    for (const key of Object.keys(orderedProperties)) {
      if (key.startsWith(prefix) && !isNaN(properties[key].current) && properties[key].current < totalSize) {
        stringData += typeof properties[key].data === 'object' ? JSON.stringify(properties[key].data) : properties[key].data;
      }
    }
    return stringData ? JSON.parse(stringData) : undefined;
  }

  static uuidv4() {
    return uuidv4();
  }

  static getIssueUrl(issue: any) {
    return `${UtilsService.getParentDomain()}/browse/${issue.key}`;
  }

  static deepCopy(object: any) {
    return JSON.parse(JSON.stringify(object));
  }

  static minifyUserDetails(user: JiraUserModel) {
    return {
      accountId: user.accountId,
      displayName: user.displayName,
      avatarUrls: {
        '24x24': user.avatarUrls['24x24'],
      },
    };
  }

  static safeParse(str: string) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return '';
    }
  }

  static getParentDomain() {
    let domain = window.location.origin;
    try {
      domain = document.location.ancestorOrigins[0] || window.location.origin;
    } catch (e) {}
    if (this.getParameterByName('xdm_e')) {
      return decodeURIComponent(this.getParameterByName('xdm_e'));
    }
    if (window['AP'] && window['AP']._hostOrigin && window['AP']._hostOrigin !== '*') {
      domain = window['AP']._hostOrigin;
    }
    return domain;
  }

  static getParameterByName(name: string, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);
    if (!results) {
      return null;
    }
    if (!results[2]) {
      return '';
    }
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  static sliceIntoChunks(arr: any[], chunkSize: number) {
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      const chunk = arr.slice(i, i + chunkSize);
      res.push(chunk);
    }
    return res;
  }

  static filterRenderableColumns(allColumns, allowedColumns) {
    const renderableColumns = [];
    for (const column of allColumns) {
      if (
        (column.schema &&
          Object.keys(allowedColumns).includes(
            column.schema.type === 'array' ? `${column.schema.type}_${column.schema.items}` : column.schema.type
          )) ||
        (column.schema?.custom && Object.keys(allowedColumns).includes(this.getNthElementAfterSplit(column.schema?.custom, ':', 1)))
      ) {
        renderableColumns.push(column);
      }
    }
    return renderableColumns;
  }

  static getSelectedColumn(allColumns, selectedColumnIds) {
    if (!selectedColumnIds || !allColumns) return [];
    const selectedColumns = [];
    selectedColumnIds.map((selectedColumnId) =>
      allColumns.map((column) => {
        if (selectedColumnId === column.id) {
          selectedColumns.push(column);
        }
      })
    );
    return selectedColumns;
  }

  static getNthElementAfterSplit(str, delimiter, index) {
    try {
      return str.split(delimiter)[index];
    } catch (e) {
      return undefined;
    }
  }

  static getColumnType(column) {
    try {
      let columnType;
      if (
        ALLOWED_JIRA_COLUMN_RENDERERS[column.schema.system] ||
        ALLOWED_JIRA_COLUMN_RENDERERS[UtilsService.getNthElementAfterSplit(column.schema.custom, ':', 1)]
      ) {
        columnType =
          ALLOWED_JIRA_COLUMN_RENDERERS[column.schema.system] ??
          ALLOWED_JIRA_COLUMN_RENDERERS[UtilsService.getNthElementAfterSplit(column.schema.custom, ':', 1)];
      } else {
        columnType =
          ALLOWED_JIRA_COLUMN_RENDERERS[
            column.schema.system === 'array' || column.schema.type === 'array' ? `${column.schema.type}_${column.schema.items}` : column.schema.type
          ];
      }
      return columnType;
    } catch (e) {
      return;
    }
  }

  static getPriorityIcon(priority) {
    if (priority === 'Highest') {
      return 'fa fa-angle-double-up';
    } else if (priority === 'High') {
      return 'fa fa-angle-up';
    } else if (priority === 'Medium') {
      return 'fa fa-grip-lines';
    } else if (priority === 'Low') {
      return 'fa fa-angle-down';
    } else if (priority === 'Lowest') {
      return 'fa fa-angle-double-down';
    } else {
      return '';
    }
  }

  static getColumnDefinitionsForKeys(allAllowedColumns, columnKeys: string[]) {
    const columnDefinitions = [];
    for (const columnKey of columnKeys) {
      for (const column of allAllowedColumns) {
        if (column.key === columnKey) {
          const columnType = this.getColumnType(column);
          if (columnType) {
            const def = {
              id: column.id,
              field: `fields.${column[columnType.fieldKey]}`,
              headerName: column[columnType.headerKey],
              cellClass: '',
              cellRenderer: columnType.renderer,
              headerClass: '',
              maxWidth: 700,
              minWidth: 100,
              resizable: true,
              width: 150,
              filter: columnType.filter,
              isJiraCustomField: true,
            };
            columnDefinitions.push(def);
          }
        }
      }
    }
    return columnDefinitions;
  }

  static dynamicSort(property) {
    let sortOrder = 1;
    if (property[0] === '-') {
      sortOrder = -1;
      property = property.substr(1);
    }

    return function (a: any, b: any) {
      const result =
        UtilsService.toLower(a[property]) < UtilsService.toLower(b[property])
          ? -1
          : UtilsService.toLower(a[property]) > UtilsService.toLower(b[property])
          ? 1
          : 0;
      return result * sortOrder;
    };
  }

  static toLower(value: any) {
    return typeof value === 'string' ? value.toLowerCase() : value;
  }

  static prioritySort(property) {
    let sortOrder = 1;
    if (property[0] === '-') {
      sortOrder = -1;
      property = property.substr(1);
    }

    return function (a: any, b: any) {
      let result =
        QueuePriorityOrder[a[property]] < QueuePriorityOrder[b[property]]
          ? -1
          : QueuePriorityOrder[a[property]] > QueuePriorityOrder[b[property]]
          ? 1
          : 0;
      return result * sortOrder;
    };
  }

  static findNewElementsInArray(oldArray, newArray, key) {
    const newElements = [];
    for (const element of newArray) {
      if (!oldArray.find((oldElement) => oldElement[key] === element[key])) {
        newElements.push(element);
      }
    }
    return newElements;
  }

  static sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
