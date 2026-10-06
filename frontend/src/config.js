// Nexus AWS Configuration - Production Defaults Baked In

export const DEFAULT_CONFIG = {
  apiBaseUrl: 'https://g72yaap6w0.execute-api.ap-southeast-2.amazonaws.com/prod',
  
  cognito: {
    region: 'ap-southeast-2',
    userPoolId: 'ap-southeast-2_a4JMIQqzK',
    clientId: '36ru7i36ng8jpvmhhhg3s4cdub',
  },
  
  s3BucketName: 'nexus-item-photos-nived2026',
};

export const setConfig = (newConfig) => {
  if (newConfig.apiBaseUrl) localStorage.setItem('nexus_api_url', newConfig.apiBaseUrl);
  if (newConfig.userPoolId) localStorage.setItem('nexus_pool_id', newConfig.userPoolId);
  if (newConfig.clientId) localStorage.setItem('nexus_client_id', newConfig.clientId);
};
