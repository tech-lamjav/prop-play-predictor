// Browser-compatible Google Cloud Storage client using REST API
export interface GCSConfig {
  projectId: string;
  bucketName: string;
  apiKey?: string;
  accessToken?: string;
}

export interface GCSFile {
  name: string;
  size: string;
  updated: string;
  contentType?: string;
}

export class GCSClient {
  private projectId: string;
  private bucketName: string;
  private apiKey?: string;
  private accessToken?: string;
  private baseUrl: string;

  constructor(config: GCSConfig) {
    this.projectId = config.projectId;
    this.bucketName = config.bucketName;
    this.apiKey = config.apiKey;
    this.accessToken = config.accessToken;
    this.baseUrl = `https://storage.googleapis.com/storage/v1/b/${this.bucketName}`;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (this.apiKey) {
      const urlWithKey = new URL(url);
      urlWithKey.searchParams.append('key', this.apiKey);
      return fetch(urlWithKey.toString(), { ...options, headers });
    }

    return fetch(url, { ...options, headers });
  }

  async listFiles(prefix?: string): Promise<string[]> {
    try {
      const params = new URLSearchParams();
      if (prefix) params.append('prefix', prefix);
      params.append('fields', 'items(name)');

      const response = await this.makeRequest(`/o?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items?.map((item: GCSFile) => item.name) || [];
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  async getFileContent(filename: string): Promise<string> {
    try {
      // For public files, we can access directly
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filename}`;
      
      const response = await fetch(publicUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to get file content: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error('Error getting file content:', error);
      throw error;
    }
  }

  async getFileMetadata(filename: string): Promise<GCSFile | null> {
    try {
      const response = await this.makeRequest(`/o/${encodeURIComponent(filename)}`);
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get file metadata: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  async uploadFile(filename: string, content: string | Blob): Promise<void> {
    try {
      const body = content instanceof Blob ? content : new Blob([content], { type: 'application/json' });
      
      const response = await this.makeRequest(`/o?name=${encodeURIComponent(filename)}`, {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to upload file: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async deleteFile(filename: string): Promise<void> {
    try {
      const response = await this.makeRequest(`/o/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  // Helper method to check if bucket is public
  async isBucketPublic(): Promise<boolean> {
    try {
      const response = await this.makeRequest('');
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Method to get signed URLs for private files (requires backend)
  async getSignedUrl(filename: string, expirationMinutes: number = 60): Promise<string | null> {
    // This would typically be handled by your backend
    // For now, return null to indicate it's not available
    console.warn('Signed URLs require backend implementation');
    return null;
  }
}

// Factory function to create GCS client from environment variables
export const createGCSClient = (): GCSClient => {
  const projectId = import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID;
  const bucketName = import.meta.env.VITE_GOOGLE_CLOUD_STORAGE_BUCKET;
  const apiKey = import.meta.env.VITE_GOOGLE_CLOUD_API_KEY;
  const accessToken = import.meta.env.VITE_GOOGLE_CLOUD_ACCESS_TOKEN;
  
  if (!projectId || !bucketName) {
    throw new Error('Missing required GCS environment variables: VITE_GOOGLE_CLOUD_PROJECT_ID and VITE_GOOGLE_CLOUD_STORAGE_BUCKET');
  }

  return new GCSClient({
    projectId,
    bucketName,
    apiKey,
    accessToken,
  });
};

// Alternative: Simple HTTP client for public buckets
export class SimpleGCSClient {
  private bucketName: string;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  async listFiles(prefix?: string): Promise<string[]> {
    try {
      // This is a simplified approach for public buckets
      // In production, you'd want to implement proper listing
      console.warn('Simple listing not implemented - use proper GCS client for production');
      return [];
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  async getFileContent(filename: string): Promise<string> {
    try {
      const url = `https://storage.googleapis.com/${this.bucketName}/${filename}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error('Error getting file content:', error);
      throw error;
    }
  }
}
