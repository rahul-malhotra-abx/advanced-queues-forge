export interface QueueSortConfig {
  sortBy: string;
  sortOrder: string;
}

export const DefaultQueueSortConfig: QueueSortConfig = {
  sortBy: 'NAME',
  sortOrder: 'ASC',
};
