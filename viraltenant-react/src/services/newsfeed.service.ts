import axios, { AxiosProgressEvent } from 'axios';
import { useAuthStore } from '../store/authStore';
import { awsConfig } from '../config/aws-config';

const API_BASE_URL = awsConfig.api.user;

export interface NewsfeedPost {
  postId: string;
  title: string;
  description: string;
  imageKey?: string;
  imageUrl?: string;
  // Multi-image support
  imageKeys?: string[];
  imageUrls?: string[];
  videoKey?: string;
  videoUrl?: string;
  externalLink?: string;
  location?: string;
  locationUrl?: string;
  status: 'draft' | 'published' | 'scheduled';
  scheduledAt?: string;
  isShort?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledPost {
  schedule_id: string;
  tenant_id: string;
  scheduled_at: string;
  post: NewsfeedPost;
  status: 'pending' | 'published' | 'failed';
  created_at: string;
  published_at?: string;
  failed_at?: string;
  error?: string;
}

export interface NewsfeedData {
  tenant_id: string;
  posts: NewsfeedPost[];
  scheduledPosts?: ScheduledPost[];
  settings: {
    autoPublish: boolean;
    emailNotifications: boolean;
    maxPosts: number;
  };
  created_at: string;
  updated_at: string;
  resolvedTenantId?: string;
}

export interface CreatePostData {
  title: string;
  description: string;
  imageKey?: string;
  videoKey?: string;
  // Multi-image support
  imageKeys?: string[];
  imageUrls?: string[];
  externalLink?: string;
  location?: string;
  locationUrl?: string;
  status?: 'draft' | 'published' | 'scheduled';
  scheduledAt?: string;
  isShort?: boolean;
  tags?: string[];
  // TikTok-specific settings for this post
  tiktokSettings?: {
    privacy?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY' | '';
    allowComment?: boolean;
    allowDuet?: boolean;
    allowStitch?: boolean;
    commercialContentEnabled?: boolean;
    brandOrganic?: boolean;
    brandedContent?: boolean;
  };
}

export interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

class NewsfeedService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private getTenantId(): string {
    // Priority: currentTenantId (set by TenantProvider) > hostname detection > platform UUID
    const currentTenantId = localStorage.getItem('currentTenantId');
    if (currentTenantId) {
      console.log('Using currentTenantId:', currentTenantId);
      return currentTenantId;
    }
    
    // Get tenant ID from subdomain
    const hostname = window.location.hostname;
    
    // Check if it's a viraltenant.com domain
    if (hostname.includes('viraltenant.com')) {
      const parts = hostname.split('.');
      
      // If we have more than 2 parts and first part is not 'www'
      if (parts.length >= 3 && parts[0] !== 'www') {
        const subdomain = parts[0];
        console.log('Detected subdomain:', subdomain);
        return subdomain;
      }
    }
    
    // On main domain or custom domain without resolution - use platform UUID
    console.warn('No subdomain detected - using platform tenant');
    return '319190e1-0791-43b0-bd04-506f959c1471';
  }

  // Public: Get newsfeed data
  async getNewsfeed(tenantId?: string): Promise<NewsfeedData> {
    try {
      // Always use provided tenant ID or detect from subdomain
      // Never use localStorage for tenant ID - always detect from current subdomain
      const requestTenantId = tenantId || this.getTenantId();
      
      console.log('Loading newsfeed for tenant:', requestTenantId);
      
      const response = await axios.get(`${API_BASE_URL}/tenants/${requestTenantId}/newsfeed`, {
        headers: { 
          ...this.getAuthHeaders(),
          'X-Creator-ID': requestTenantId 
        }
      });
      
      console.log('Newsfeed response:', response.data);
      
      // Store the resolved tenant ID for subsequent operations (only for admin operations)
      if (response.data.resolvedTenantId) {
        localStorage.setItem('resolvedTenantId', response.data.resolvedTenantId);
        console.log('Stored resolved tenant ID:', response.data.resolvedTenantId);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error loading newsfeed:', error);
      return { 
        tenant_id: this.getTenantId(),
        posts: [], 
        settings: { autoPublish: true, emailNotifications: false, maxPosts: 50 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
  }

  // Public: Get posts (legacy compatibility)
  async getPosts(tenantId?: string): Promise<{ posts: NewsfeedPost[]; settings: object }> {
    const data = await this.getNewsfeed(tenantId);
    return { posts: data.posts, settings: data.settings };
  }

  // Public: Get single post
  async getPost(postId: string, tenantId?: string): Promise<NewsfeedPost | null> {
    const data = await this.getNewsfeed(tenantId);
    return data.posts.find(p => p.postId === postId) || null;
  }

  // Admin: Generate upload URL for newsfeed assets
  async generateUploadUrl(fileName: string, fileType: string, uploadType: 'image' | 'video' = 'image', tenantId?: string): Promise<UploadUrlResponse> {
    const resolvedTenantId = tenantId || this.getTenantId();
    console.log('Generating upload URL:', { fileName, fileType, uploadType, tenantId: resolvedTenantId });
    
    const response = await axios.post(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/newsfeed/upload-url`,
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

  // Admin: Update newsfeed data (add/update posts)
  async updateNewsfeed(posts: NewsfeedPost[], settings?: object, tenantId?: string): Promise<void> {
    // Always use provided tenant ID or detect from subdomain
    const requestTenantId = tenantId || this.getTenantId();
    
    console.log('Updating newsfeed for tenant:', requestTenantId);
    
    await axios.put(
      `${API_BASE_URL}/tenants/${requestTenantId}/newsfeed`,
      { posts, settings },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': requestTenantId
        }
      }
    );
  }

  // Admin: Update posts (legacy compatibility)
  async updatePosts(posts: NewsfeedPost[], settings?: object, tenantId?: string): Promise<void> {
    await this.updateNewsfeed(posts, settings, tenantId);
  }

  // Admin: Add a new post
  async createPost(data: CreatePostData, tenantId?: string, videoFile?: File, onProgress?: (progress: number) => void, thumbnailFile?: File): Promise<void> {
    const requestTenantId = tenantId || this.getTenantId();
    const newsfeedData = await this.getNewsfeed(requestTenantId);
    
    let videoKey: string | undefined;
    let imageKey: string | undefined;
    
    // Upload video if provided
    if (videoFile) {
      const uploadResponse = await this.generateUploadUrl(videoFile.name, videoFile.type, 'video', requestTenantId);
      await this.uploadToS3(uploadResponse.uploadUrl, videoFile, onProgress);
      videoKey = uploadResponse.key;
    }
    
    // Upload thumbnail if provided
    if (thumbnailFile) {
      const thumbnailResponse = await this.generateUploadUrl(thumbnailFile.name, thumbnailFile.type, 'image', requestTenantId);
      await this.uploadToS3(thumbnailResponse.uploadUrl, thumbnailFile);
      imageKey = thumbnailResponse.key;
    }
    
    const newPost: NewsfeedPost = {
      postId: `post-${Date.now()}`,
      ...data,
      videoKey: videoKey || data.videoKey,
      imageKey: imageKey || data.imageKey,
      status: data.status || 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Use the resolved tenant ID from the backend response if available
    const targetTenantId = newsfeedData.resolvedTenantId || requestTenantId;
    console.log('Adding post to tenant:', targetTenantId, 'original:', requestTenantId);
    
    // If scheduled, use schedule endpoint
    if (data.status === 'scheduled' && data.scheduledAt) {
      await this.schedulePost(newPost, data.scheduledAt, targetTenantId);
    } else {
      await this.updateNewsfeed([newPost, ...newsfeedData.posts], newsfeedData.settings, targetTenantId);
    }
  }
  
  // Admin: Schedule a post
  async schedulePost(post: NewsfeedPost, scheduledAt: string, tenantId?: string): Promise<void> {
    const requestTenantId = tenantId || this.getTenantId();
    
    await axios.post(
      `${API_BASE_URL}/tenants/${requestTenantId}/newsfeed/schedule`,
      { post, scheduledAt },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': requestTenantId
        }
      }
    );
  }
  
  // Admin: Cancel a scheduled post
  async cancelScheduledPost(scheduleId: string, tenantId?: string): Promise<void> {
    const requestTenantId = tenantId || this.getTenantId();
    
    await axios.delete(
      `${API_BASE_URL}/tenants/${requestTenantId}/newsfeed/schedule/${scheduleId}`,
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': requestTenantId
        }
      }
    );
  }

  // Admin: Update a scheduled post
  async updateScheduledPost(scheduleId: string, post: NewsfeedPost, scheduledAt: string, tenantId?: string): Promise<void> {
    const requestTenantId = tenantId || this.getTenantId();
    
    await axios.put(
      `${API_BASE_URL}/tenants/${requestTenantId}/newsfeed/schedule/${scheduleId}`,
      { post, scheduledAt },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': requestTenantId
        }
      }
    );
  }

  // Admin: Update existing post
  async updatePost(postId: string, data: Partial<CreatePostData>, tenantId?: string): Promise<void> {
    // Always use provided tenant ID or detect from subdomain
    const requestTenantId = tenantId || this.getTenantId();
    const newsfeedData = await this.getNewsfeed(requestTenantId);
    
    const updatedPosts = newsfeedData.posts.map(p => 
      p.postId === postId 
        ? { ...p, ...data, updatedAt: new Date().toISOString() }
        : p
    );
    
    // Use the resolved tenant ID from the backend response if available
    const targetTenantId = newsfeedData.resolvedTenantId || requestTenantId;
    await this.updateNewsfeed(updatedPosts, newsfeedData.settings, targetTenantId);
  }

  // Admin: Delete post
  async deletePost(postId: string, tenantId?: string): Promise<void> {
    // Always use provided tenant ID or detect from subdomain
    const requestTenantId = tenantId || this.getTenantId();
    const newsfeedData = await this.getNewsfeed(requestTenantId);
    
    const postToDelete = newsfeedData.posts.find(p => p.postId === postId);
    if (postToDelete) {
      // Delete S3 assets
      if (postToDelete.imageKey) {
        await this.deleteAsset(postToDelete.imageKey, requestTenantId);
      }
      if (postToDelete.videoKey) {
        await this.deleteAsset(postToDelete.videoKey, requestTenantId);
      }
    }
    
    const updatedPosts = newsfeedData.posts.filter(p => p.postId !== postId);
    
    // Use the resolved tenant ID from the backend response if available
    const targetTenantId = newsfeedData.resolvedTenantId || requestTenantId;
    await this.updateNewsfeed(updatedPosts, newsfeedData.settings, targetTenantId);
  }

  // Admin: Delete asset from S3
  async deleteAsset(key: string, tenantId?: string): Promise<void> {
    // Always use provided tenant ID or detect from subdomain
    const requestTenantId = tenantId || this.getTenantId();
    
    await axios.delete(
      `${API_BASE_URL}/tenants/${requestTenantId}/newsfeed/asset`,
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': requestTenantId
        },
        data: { key }
      }
    );
  }
}

export const newsfeedService = new NewsfeedService();
