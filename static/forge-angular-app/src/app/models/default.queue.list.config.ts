export interface QueueListConfig {
  show: {
    queuePriority: boolean;
    order: boolean;
    issueCount: boolean;
    lastIssueCreateTime: boolean;
    lastIssueUpdateTime: boolean;
    description: boolean;
    queueScope: boolean;
  };
}

export const DefaultQueueListConfig: QueueListConfig = {
  show: {
    queuePriority: true,
    order: true,
    issueCount: true,
    lastIssueCreateTime: true,
    lastIssueUpdateTime: true,
    description: false,
    queueScope: false,
  },
};
