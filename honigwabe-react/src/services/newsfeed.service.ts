import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { awsConfig } from '../config/aws-config';

// Fallback to User API URL if Newsfeed API URL is not set (they use the same gateway)
const API_URL = import.meta.env.VITE_NEWSFEED_API_URL || awsConfig.api.user;

export interface NewsfeedPost {
  postId: string;
  title: string;
  description: string;
  imageKey?: string;
  imageUrl?: string;
  videoKey?: string;
  videoUrl?: string;
  externalLink?: string;
  location?: string;
  locationUrl?: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostData {
  title: string;
  description: string;
  imageKey?: string;
  videoKey?: string;
  externalLink?: string;
  location?: string;
  locationUrl?: string;
  status?: 'draft' | 'published';
}

class NewsfeedService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getPosts(): Promise<NewsfeedPost[]> {
    console.log('Newsfeed API_URL:', API_URL);
    console.log('Full URL:', `${API_URL}/newsfeed`);
    
    if (!API_URL) {
      console.error('VITE_NEWSFEED_API_URL is not set!');
      throw new Error('Newsfeed API URL is not configured');
    }
    
    try {
      const response = await axios.get(`${API_URL}/newsfeed`);
      console.log('Newsfeed response:', response.data);
      return response.data.posts || [];
    } catch (error) {
      console.error('Failed to fetch newsfeed posts:', error);
      throw error;
    }
  }

  async getPost(postId: string): Promise<NewsfeedPost> {
    const response = await axios.get(`${API_URL}/newsfeed/${postId}`);
    return response.data.post;
  }

  async createPost(data: CreatePostData): Promise<NewsfeedPost> {
    console.log('API_URL:', API_URL);
    console.log('Full URL:', `${API_URL}/newsfeed`);
    console.log('Auth headers:', this.getAuthHeaders());
    console.log('Post data:', data);
    
    const response = await axios.post(
      `${API_URL}/newsfeed`,
      data,
      { headers: this.getAuthHeaders() }
    );
    
    console.log('Response:', response);
    return response.data.post;
  }

  async updatePost(postId: string, data: Partial<CreatePostData>): Promise<void> {
    await axios.put(
      `${API_URL}/newsfeed/${postId}`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  async deletePost(postId: string): Promise<void> {
    await axios.delete(
      `${API_URL}/newsfeed/${postId}`,
      { headers: this.getAuthHeaders() }
    );
  }

  async generateUploadUrl(fileName: string, fileType: string, mediaType: 'image' | 'video'): Promise<{
    uploadUrl: string;
    mediaKey: string;
    mediaUrl: string;
  }> {
    const response = await axios.post(
      `${API_URL}/newsfeed/upload-url`,
      { fileName, fileType, mediaType },
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
    });
  }
}

export const newsfeedService = new NewsfeedService();
