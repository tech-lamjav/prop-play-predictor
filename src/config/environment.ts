// Environment configuration for the Smartbetting application
export const config = {
  app: {
    name: import.meta.env.VITE_APP_NAME || 'Smartbetting',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    environment: import.meta.env.MODE || 'development',
  },
  
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
  
  posthog: {
    key: import.meta.env.VITE_PUBLIC_POSTHOG_KEY,
    host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
  },
  
  gcs: {
    projectId: import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID,
    bucketName: import.meta.env.VITE_GOOGLE_CLOUD_STORAGE_BUCKET,
    apiKey: import.meta.env.VITE_GOOGLE_CLOUD_API_KEY,
    accessToken: import.meta.env.VITE_GOOGLE_CLOUD_ACCESS_TOKEN,
  },
  
  features: {
    enableRealTimeUpdates: import.meta.env.VITE_ENABLE_REAL_TIME_UPDATES === 'true',
    enableDataExport: import.meta.env.VITE_ENABLE_DATA_EXPORT === 'true',
    enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  },
  
  data: {
    cacheTTL: parseInt(import.meta.env.VITE_DATA_CACHE_TTL || '300000'), // 5 minutes
    refreshInterval: parseInt(import.meta.env.VITE_DATA_REFRESH_INTERVAL || '30000'), // 30 seconds
  },
} as const;

// Validation function to check required environment variables
export function validateEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check Supabase configuration
  if (!config.supabase.url) {
    errors.push('VITE_SUPABASE_URL is required');
  }
  if (!config.supabase.anonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY is required');
  }
  
  // Check GCS configuration
  if (!config.gcs.projectId) {
    errors.push('VITE_GOOGLE_CLOUD_PROJECT_ID is required');
  }
  if (!config.gcs.bucketName) {
    errors.push('VITE_GOOGLE_CLOUD_STORAGE_BUCKET is required');
  }
  
  // Check if at least one GCS authentication method is provided
  if (!config.gcs.apiKey && !config.gcs.accessToken) {
    console.warn('No GCS authentication method provided. Make sure your bucket is public or provide API key/access token.');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Helper function to get environment info for debugging
export function getEnvironmentInfo() {
  return {
    mode: config.app.environment,
    hasSupabase: !!(config.supabase.url && config.supabase.anonKey),
    hasGCS: !!(config.gcs.projectId && config.gcs.bucketName),
    hasGCSAuth: !!(config.gcs.apiKey || config.gcs.accessToken),
    features: config.features,
  };
}

// Development helpers
export const isDevelopment = config.app.environment === 'development';
export const isProduction = config.app.environment === 'production';

// Feature flags
export const canUseRealTimeUpdates = config.features.enableRealTimeUpdates;
export const canExportData = config.features.enableDataExport;
export const canUseAnalytics = config.features.enableAnalytics;







