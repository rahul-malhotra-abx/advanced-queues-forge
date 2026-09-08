import { UtilsService } from '../services/utils.service';
import { DefaultQueueListConfig, QueueListConfig } from './default.queue.list.config';

export interface QueueViewSettings {
  fullScreenMode: boolean;
  currentQueueId?: string;
  currentQueueFolderId?: string;
  queueListConfig: QueueListConfig;
  queueSorting?: any;
  queueListHidden: boolean;
  queueGridConfig?: any;
  // {
  //   "QUEUE_ID": {
  //     gridOptions: {
  //       pageSize: number;
  //       columnState: any;
  //     }
  //   }
  // }
}

export const DEFAULT_QUEUE_VIEW_SETTINGS: QueueViewSettings = {
  fullScreenMode: false,
  queueListConfig: UtilsService.deepCopy(DefaultQueueListConfig),
  queueListHidden: false,
  queueGridConfig: {},
};
