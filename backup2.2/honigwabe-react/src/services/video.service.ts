import axios, { AxiosProgressEvent } from 'axios';
import { useAuthStore } from '../store/authStore';
import { awsConfig } from '../config/aws-config';

const API_BASE_URL = awsConfig.api.user;

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
  status: 'draft' | 'published';
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
  videoUrl?: string;
  thumbnailUrl?: string | null;
}

export interface UploadUrlResponse {
  videoId: string;
  uploadUrl: string;
  s3Key: string;
  thumbnailUploadUrl?: string;
  thumbnailKey?: string;
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
  status?: 'draft' | 'published';
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

  // Public: Get all published videos
  async getVideos(): Promise<Video[]> {
    const response = await axios.get(`${API_BASE_URL}/videos`);
    console.log('Videos API Response:', response.data);
    console.log('First video thumbnailUrl:', response.data.videos[0]?.thumbnailUrl);
    return response.data.videos;
  }

  // Public: Get single video
  async getVideo(videoId: string): Promise<Video> {
    const response = await axios.get(`${API_BASE_URL}/videos/${videoId}`);
    return response.data.video;
  }

  // Admin: Generate upload URL
  async generateUploadUrl(fileName: string, contentType: string, fileType: 'video' | 'thumbnail' = 'video', videoId?: string): Promise<UploadUrlResponse> {
    console.log('Generating upload URL:', { fileName, contentType, fileType, videoId, apiUrl: API_BASE_URL });
    const headers = this.getAuthHeaders();
    console.log('Auth headers:', headers);
    
    const response = await axios.post(
      `${API_BASE_URL}/videos/upload-url`,
      { fileName, contentType, fileType, videoId },
      { headers }
    );
    console.log('Upload URL response:', response.data);
    return response.data;
  }

  // Admin: Upload file to S3 using presigned URL
  async uploadToS3(uploadUrl: string, file: File, onProgress?: (progress: number) => void): Promise<void> {
    await axios.put(uploadUrl, file, {
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
  }

  // Admin: Create video metadata
  async createVideo(data: CreateVideoRequest): Promise<Video> {
    console.log('Creating video metadata:', data);
    const response = await axios.post(
      `${API_BASE_URL}/videos`,
      data,
      { headers: this.getAuthHeaders() }
    );
    console.log('Create video response:', response.data);
    return response.data.video;
  }

  // Admin: Update video
  async updateVideo(videoId: string, data: UpdateVideoRequest): Promise<Video> {
    const response = await axios.put(
      `${API_BASE_URL}/videos/${videoId}`,
      data,
      { headers: this.getAuthHeaders() }
    );
    return response.data.video;
  }

  // Admin: Delete video
  async deleteVideo(videoId: string): Promise<void> {
    await axios.delete(
      `${API_BASE_URL}/videos/${videoId}`,
      { headers: this.getAuthHeaders() }
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
