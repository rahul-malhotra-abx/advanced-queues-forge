const environments = {
  ADVANCED_QUEUES_PRO: {
    /**
     * String
     * Name of the App.
     */
    APP_NAME: 'Advanced Queues Pro',
    APP_MODE: 'ADVANCED_QUEUES_PRO',
    APP_KEY: 'com.appbox.ai.advanced.queues',
    APP_BASE_KEY: 'com.appbox.ai.advanced.queues',
    ANALYTICS_ENABLED: true,
    // false on Forge. Under Connect this was `true` and nothing read it, so an
    // unlicensed install was fully functional. Forge ships paid-only, so an
    // install without an active licence must be gated — see
    // JiraService.hasValidLicense.
    ALLOW_UNLICENSED: false,
    FREE_VERSION: false,
    PAID_VERSION: true,
  },
  ADVANCED_QUEUES_FREE: {
    /**
     * String
     * Name of the App.
     */
    APP_NAME: 'Advanced Queues Free',
    APP_MODE: 'ADVANCED_QUEUES_FREE',
    APP_KEY: 'com.appbox.ai.advanced.queues.free',
    APP_BASE_KEY: 'com.appbox.ai.advanced.queues',
    ANALYTICS_ENABLED: true,
    ALLOW_UNLICENSED: true,
    FREE_VERSION: true,
    PAID_VERSION: false,
  },
};

// Forge ships the paid listing only — company rule, no free Forge apps.
// APP_BASE_KEY is identical across both variants, so this switch does not
// renamespace any stored project/user entity properties. Never change that key.
export const ENVIRONMENT = environments['ADVANCED_QUEUES_PRO'];
