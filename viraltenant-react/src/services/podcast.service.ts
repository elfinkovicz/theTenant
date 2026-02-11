import axios, { AxiosProgressEvent } from 'axios';
import { useAuthStore } from '../store/authStore';
import { awsConfig } from '../config/aws-config';
import { tenantService } from './tenant.service';

const API_BASE_URL = awsConfig.api.user;

export interface PodcastGuest {
  id: string;
  name: string;
  imageUrl?: string;
  links?: string[]; // Up to 7 social media links - platform auto-detected
}

export interface Podcast {
  podcastId: string;
  title: string;
  description: string;
  category: string;
  audioKey: string;
  thumbnailKey: string | null;
  duration: number;
  fileSize: number;
  plays: number;
  status: 'draft' | 'published' | 'scheduled';
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
  audioUrl?: string;
  thumbnailUrl?: string | null;
  guests?: PodcastGuest[];
  isExclusive?: boolean;
  scheduledAt?: string;
}

export interface PodcastsResponse {
  podcasts: Podcast[];
  categories: string[];
  settings: object;
  resolvedTenantId?: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

class PodcastService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private getStoredTenantId(): string | null {
    // Priority: currentTenantId (set by TenantProvider) > resolvedTenantId (legacy)
    return localStorage.getItem('currentTenantId') || localStorage.getItem('resolvedTenantId');
  }

  private getTenantId(): string {
    // Priority: currentTenantId (set by TenantProvider) > tenantService
    const currentTenantId = localStorage.getItem('currentTenantId');
    if (currentTenantId) {
      return currentTenantId;
    }
    return tenantService.getCurrentTenantId();
  }

  async getPodcasts(tenantId?: string): Promise<PodcastsResponse> {
    try {
      const resolvedTenantId = tenantId || this.getTenantId();
      const response = await axios.get(`${API_BASE_URL}/tenants/${resolvedTenantId}/podcasts`, {
        headers: { 'X-Creator-ID': resolvedTenantId }
      });
      
      if (response.data.resolvedTenantId) {
        localStorage.setItem('resolvedTenantId', response.data.resolvedTenantId);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error loading podcasts:', error);
      return { podcasts: [], categories: [], settings: {} };
    }
  }

  async getPodcast(podcastId: string, tenantId?: string): Promise<Podcast | null> {
    try {
      const resolvedTenantId = tenantId || this.getTenantId();
      const data = await this.getPodcasts(resolvedTenantId);
      return data.podcasts.find(p => p.podcastId === podcastId) || null;
    } catch (error) {
      console.error('Error loading podcast:', error);
      return null;
    }
  }

  async generateUploadUrl(fileName: string, fileType: string, uploadType: 'audio' | 'thumbnail' = 'audio', tenantId?: string): Promise<UploadUrlResponse> {
    const resolvedTenantId = tenantId || this.getTenantId();
    
    const response = await axios.post(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/podcasts/upload-url`,
      { fileName, fileType, uploadType },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    );
    return response.data;
  }

  async uploadToS3(uploadUrl: string, file: File, onProgress?: (progress: number) => void): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: { 'Content-Type': file.type },
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  }

  async updatePodcasts(podcasts: Podcast[], categories?: string[], settings?: object, tenantId?: string): Promise<void> {
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    
    await axios.put(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/podcasts`,
      { podcasts, categories, settings },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    );
  }

  async addPodcast(podcast: Omit<Podcast, 'plays' | 'uploadedAt' | 'updatedAt'>, tenantId?: string): Promise<void> {
    const resolvedTenantId = tenantId || this.getTenantId();
    const data = await this.getPodcasts(resolvedTenantId);
    
    const newPodcast: Podcast = {
      ...podcast,
      plays: 0,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const targetTenantId = data.resolvedTenantId || resolvedTenantId;
    // Add new podcast at the beginning (position 1)
    await this.updatePodcasts([newPodcast, ...data.podcasts], data.categories, data.settings, targetTenantId);
  }

  async deletePodcast(podcastId: string, tenantId?: string): Promise<void> {
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    const data = await this.getPodcasts(resolvedTenantId);
    
    const podcastToDelete = data.podcasts.find(p => p.podcastId === podcastId);
    if (podcastToDelete) {
      if (podcastToDelete.audioKey) {
        await this.deleteAsset(podcastToDelete.audioKey, resolvedTenantId);
      }
      if (podcastToDelete.thumbnailKey) {
        await this.deleteAsset(podcastToDelete.thumbnailKey, resolvedTenantId);
      }
    }
    
    const updatedPodcasts = data.podcasts.filter(p => p.podcastId !== podcastId);
    await this.updatePodcasts(updatedPodcasts, data.categories, data.settings, resolvedTenantId);
  }

  async deleteAsset(key: string, tenantId?: string): Promise<void> {
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    
    await axios.delete(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/podcasts/asset`,
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        },
        data: { key }
      }
    );
  }

  async getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      
      audio.onloadedmetadata = () => {
        window.URL.revokeObjectURL(audio.src);
        resolve(Math.round(audio.duration));
      };
      
      audio.onerror = () => {
        resolve(0);
      };
      
      audio.src = URL.createObjectURL(file);
    });
  }

  async startAiTranscription(podcastId: string, audioKey: string, tenantId?: string): Promise<{ status: string; jobName?: string }> {
    const resolvedTenantId = tenantId || this.getTenantId();
    
    const response = await axios.post(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/podcasts/ai-transcribe`,
      { podcastId, audioKey },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    );
    return response.data;
  }

  async getAiStatus(podcastId: string, tenantId?: string): Promise<{ status: string; description?: string }> {
    const resolvedTenantId = tenantId || this.getTenantId();
    
    const response = await axios.get(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/podcasts/ai-status/${podcastId}`,
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    );
    return response.data;
  }
}

export const podcastService = new PodcastService();
