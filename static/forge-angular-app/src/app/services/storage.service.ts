import { StorageContext } from '../models/storage.context.enum';
import { ENVIRONMENT } from '../environment';
import { JiraService } from './jira.service';
import { UtilsService } from './utils.service';

export class StorageService {
  storageBaseKey: string;
  storageContext: StorageContext;
  referenceKey: string;
  itemKey: string;
  singleKeyCharacterLimit = 25000;

  constructor(storageContext: StorageContext, referenceKey: string, storageBaseKey: string, itemKey?: string) {
    this.storageContext = storageContext;
    this.storageBaseKey = ENVIRONMENT.APP_BASE_KEY + '-' + storageBaseKey;
    this.referenceKey = referenceKey;
    this.itemKey = itemKey;
  }

  async save(data: {}) {
    let dataArray: any[] = [];
    const stringData = JSON.stringify(data);
    if (stringData?.length >= this.singleKeyCharacterLimit) {
      dataArray = stringData.match(/.{1,25000}/g);
      dataArray = dataArray || [''];
    } else {
      dataArray = [data];
    }
    const propertiesArray = [];
    for (const [index, chunk] of dataArray.entries()) {
      const property = {
        key: `${this.storageBaseKey}_${index}`,
        value: {
          data: chunk,
          totalSize: dataArray.length,
          current: index,
        },
      };
      propertiesArray.push(property);
    }
    // Every caller invokes save() without awaiting it and without a .catch, so
    // before this a rejected write was an unhandled promise rejection behind an
    // optimistic UI: the edit appeared to apply and was never stored, silently.
    // A 403 from a permission problem looked exactly like a successful save.
    //
    // Reporting here rather than at the 10+ call sites: they would all need the
    // same await and the same catch, and the one that got missed would be the
    // one that mattered. Swallowing the rejection also means the fire-and-forget
    // callers no longer produce unhandled rejections.
    try {
      if (this.storageContext === StorageContext.PROJECT) {
        await JiraService.saveProjectProperties(this.referenceKey, propertiesArray);
      } else if (this.storageContext === StorageContext.USER) {
        await JiraService.saveUserProperties(this.referenceKey, propertiesArray);
      } else if (this.storageContext === StorageContext.TICKET) {
        await JiraService.saveTicketProperties(this.referenceKey, propertiesArray);
      }
      return true;
    } catch (error) {
      console.error(`Failed to save ${this.storageBaseKey}`, error);
      const permissionDenied = /\b40[13]\b/.test(String((error as any)?.message ?? error));
      JiraService.showNotification(
        'Changes not saved',
        permissionDenied
          ? 'You do not have permission to change this in this project. Your edit has not been stored.'
          : 'Jira rejected the change, so your edit has not been stored. Reload and try again.',
        'error',
        'manual'
      );
      return false;
    }
  }

  async get(): Promise<any> {
    const properties = await this.getChunks(0);
    // save() chunks without limit, so a large value spans more than the first five.
    const totalSize = properties[`${this.storageBaseKey}_0`]?.totalSize ?? 0;
    for (let from = 5; from < totalSize; from += 5) {
      Object.assign(properties, await this.getChunks(from));
    }
    return UtilsService.mergeJiraDataKeys(properties, this.storageBaseKey);
  }

  /** Five chunks from `from`: Jira rejects a project or issue read that names six or more properties (measured). */
  private async getChunks(from: number): Promise<any> {
    const propertyArray = [...Array(5).keys()].map((i) => `${this.storageBaseKey}_${from + i}`);
    if (this.storageContext === StorageContext.PROJECT) {
      return JiraService.getProjectProperties(this.referenceKey, propertyArray);
    } else if (this.storageContext === StorageContext.USER) {
      return JiraService.getUserProperties(this.referenceKey, propertyArray);
    } else if (this.storageContext === StorageContext.TICKET) {
      return JiraService.getTicketProperties(this.referenceKey, propertyArray);
    }
  }
}
