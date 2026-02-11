import axios, { AxiosProgressEvent } from 'axios';
import { useAuthStore } from '../store/authStore';
import { awsConfig } from '../config/aws-config';

const API_BASE_URL = awsConfig.api.user;

export interface VideoGuest {
  id: string;
  name: string;
  imageUrl?: string;
  links?: string[];
}

export interface Video {
  videoId: string;
  title: string;
  description: string;
  category: string;
  s3Key: string;
  thumbnailKey: string | null;
  duration: number;
  fileSize: number;
  views: number;
  status: 'draft' | 'published' | 'scheduled';
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
  videoUrl?: string;
  thumbnailUrl?: string | null;
  isExclusive?: boolean;
  guests?: VideoGuest[];
  scheduledAt?: string;
}

export interface VideosResponse {
  videos: Video[];
  categories: string[];
  settings: object;
  resolvedTenantId?: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

export interface CreateVideoRequest {
  videoId: string;
  title: string;
  description?: string;
  category?: string;
  s3Key: string;
  thumbnailKey?: string;
  duration?: number;
  fileSize?: number;
  status?: 'draft' | 'published' | 'scheduled';
  isExclusive?: boolean;
  scheduledAt?: string;
}

export interface UpdateVideoRequest {
  title?: string;
  description?: string;
  category?: string;
  thumbnailKey?: string;
  status?: 'draft' | 'published';
}

class VideoService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private isCustomDomain(): boolean {
    const hostname = window.location.hostname;
    return !hostname.includes('viraltenant.com');
  }

  private getStoredTenantId(): string | null {
    // Priority: currentTenantId (set by TenantProvider) > resolvedTenantId (legacy)
    return localStorage.getItem('currentTenantId') || localStorage.getItem('resolvedTenantId');
  }

  private getTenantId(): string {
    // Priority: currentTenantId (set by TenantProvider after domain resolution)
    const currentTenantId = localStorage.getItem('currentTenantId');
    if (currentTenantId) {
      return currentTenantId;
    }
    
    // Fallback: detect from hostname (should rarely happen)
    const hostname = window.location.hostname;
    if (hostname.includes('viraltenant.com')) {
      const parts = hostname.split('.');
      if (parts.length >= 3 && parts[0] !== 'www') {
        return parts[0];
      }
    }
    
    return '319190e1-0791-43b0-bd04-506f959c1471';
  }

  // Public: Get all videos for tenant
  async getVideos(tenantId?: string): Promise<VideosResponse> {
    try {
      const resolvedTenantId = tenantId || this.getTenantId();
      const response = await axios.get(`${API_BASE_URL}/tenants/${resolvedTenantId}/videos`, {
        headers: { 'X-Creator-ID': resolvedTenantId }
      });
      
      // Only store the resolved tenant ID for custom domains
      if (response.data.resolvedTenantId && this.isCustomDomain()) {
        localStorage.setItem('resolvedTenantId', response.data.resolvedTenantId);
        console.log('Stored resolved tenant ID:', response.data.resolvedTenantId);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error loading videos:', error);
      return { videos: [], categories: [], settings: {} };
    }
  }

  // Public: Get single video
  async getVideo(videoId: string, tenantId?: string): Promise<Video | null> {
    try {
      const resolvedTenantId = tenantId || this.getTenantId();
      const data = await this.getVideos(resolvedTenantId);
      return data.videos.find(v => v.videoId === videoId) || null;
    } catch (error) {
      console.error('Error loading video:', error);
      return null;
    }
  }

  // Admin: Generate upload URL
  async generateUploadUrl(fileName: string, fileType: string, uploadType: 'video' | 'thumbnail' = 'video', tenantId?: string): Promise<UploadUrlResponse> {
    const resolvedTenantId = tenantId || this.getTenantId();
    console.log('Generating upload URL:', { fileName, fileType, uploadType, tenantId: resolvedTenantId });
    
    const response = await axios.post(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/videos/upload-url`,
      { fileName, fileType, uploadType },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    );
    console.log('Upload URL response:', response.data);
    return response.data;
  }

  // Admin: Upload file to S3 using presigned URL
  async uploadToS3(uploadUrl: string, file: File, onProgress?: (progress: number) => void): Promise<void> {
    const response = await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    
    // Verify upload was successful
    if (response.status !== 200) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
    
    console.log('S3 upload successful, status:', response.status);
  }

  // Admin: Update videos data (add/update video in array)
  async updateVideos(videos: Video[], categories?: string[], settings?: object, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    
    console.log('Updating videos for tenant:', resolvedTenantId, 'stored:', storedTenantId, 'provided:', tenantId);
    
    await axios.put(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/videos`,
      { videos, categories, settings },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    );
  }

  // Admin: Add a new video
  async addVideo(video: Omit<Video, 'views' | 'uploadedAt' | 'updatedAt'>, tenantId?: string): Promise<void> {
    const resolvedTenantId = tenantId || this.getTenantId();
    const data = await this.getVideos(resolvedTenantId);
    
    const newVideo: Video = {
      ...video,
      views: 0,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Use the resolved tenant ID from the backend response if available
    const targetTenantId = data.resolvedTenantId || resolvedTenantId;
    console.log('Adding video to tenant:', targetTenantId, 'original:', resolvedTenantId);
    
    // Add new video at the beginning (position 1)
    await this.updateVideos([newVideo, ...data.videos], data.categories, data.settings, targetTenantId);
  }

  // Admin: Delete video
  async deleteVideo(videoId: string, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    const data = await this.getVideos(resolvedTenantId);
    
    const videoToDelete = data.videos.find(v => v.videoId === videoId);
    if (videoToDelete) {
      // Delete S3 assets
      if (videoToDelete.s3Key) {
        await this.deleteAsset(videoToDelete.s3Key, resolvedTenantId);
      }
      if (videoToDelete.thumbnailKey) {
        await this.deleteAsset(videoToDelete.thumbnailKey, resolvedTenantId);
      }
    }
    
    const updatedVideos = data.videos.filter(v => v.videoId !== videoId);
    await this.updateVideos(updatedVideos, data.categories, data.settings, resolvedTenantId);
  }

  // Admin: Delete asset from S3
  async deleteAsset(key: string, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    
    await axios.delete(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/videos/asset`,
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        },
        data: { key }
      }
    );
  }

  // Helper: Get video duration from file
  async getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(Math.round(video.duration));
      };
      
      video.onerror = () => {
        resolve(0);
      };
      
      video.src = URL.createObjectURL(file);
    });
  }
}

export const videoService = new VideoService();
