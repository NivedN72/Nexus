// Nexus AWS Configuration
// You can edit these defaults or customize them via the UI Settings drawer

export const DEFAULT_CONFIG = {
  // Replace with your live API Gateway invoke URL (or set in UI Settings)
  apiBaseUrl: localStorage.getItem('nexus_api_url') || 'https://243478202466-k65kqaeq.ap-southeast-2.execute-api.ap-southeast-2.amazonaws.com/prod',
  
  cognito: {
    region: 'ap-southeast-2',
    userPoolId: localStorage.getItem('nexus_pool_id') || 'ap-southeast-2_xxxxxxxxx',
    clientId: localStorage.getItem('nexus_client_id') || 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
  },
  
  s3BucketName: 'nexus-item-photos-nived2026',
};

export const setConfig = (newConfig) => {
  if (newConfig.apiBaseUrl) localStorage.setItem('nexus_api_url', newConfig.apiBaseUrl);
  if (newConfig.userPoolId) localStorage.setItem('nexus_pool_id', newConfig.userPoolId);
  if (newConfig.clientId) localStorage.setItem('nexus_client_id', newConfig.clientId);
};
