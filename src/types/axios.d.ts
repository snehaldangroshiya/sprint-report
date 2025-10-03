// Extend axios types to include custom metadata
import 'axios';

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    metadata?: {
      startTime?: number;
      cacheKey?: string;
      retryCount?: number;
      [key: string]: any;
    };
  }
}
