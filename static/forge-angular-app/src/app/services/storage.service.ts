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
    if (this.storageContext === StorageContext.PROJECT) {
      await JiraService.saveProjectProperties(this.referenceKey, propertiesArray);
    } else if (this.storageContext === StorageContext.USER) {
      await JiraService.saveUserProperties(this.referenceKey, propertiesArray);
    } else if (this.storageContext === StorageContext.TICKET) {
      await JiraService.saveTicketProperties(this.referenceKey, propertiesArray);
    } else if (this.storageContext === StorageContext.APPLICATION) {
      await JiraService.saveApplicationProperties(propertiesArray);
    }
  }

  async get(): Promise<any> {
    let propertyArray = [...Array(5).keys()].map((i) => `${this.storageBaseKey}_${i}`);
    let propertyArrayResponse;
    if (this.storageContext === StorageContext.PROJECT) {
      propertyArrayResponse = await JiraService.getProjectProperties(this.referenceKey, propertyArray);
    } else if (this.storageContext === StorageContext.USER) {
      propertyArrayResponse = await JiraService.getUserProperties(this.referenceKey, propertyArray);
    } else if (this.storageContext === StorageContext.TICKET) {
      propertyArrayResponse = await JiraService.getTicketProperties(this.referenceKey, propertyArray);
    } else if (this.storageContext === StorageContext.APPLICATION) {
      propertyArrayResponse = await JiraService.getApplicationProperties(propertyArray[0]);
    }
    return UtilsService.mergeJiraDataKeys(propertyArrayResponse, this.storageBaseKey);
  }
}
