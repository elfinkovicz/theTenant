import axios from 'axios';
import { awsConfig } from '../config/aws-config';
import { tenantService } from './tenant.service';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = awsConfig.api.user;

// Block types for the page builder
export type BlockType = 'heading' | 'text' | 'image' | 'video' | 'divider' | 'spacer' | 'container' | 'grid';

// Grid column options (12-column grid)
export type GridWidth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type GridHeight = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type GridPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface PageBlock {
  id: string;
  type: BlockType;
  content: string;
  // For headings: h1, h2, h3, h4
  level?: 'h1' | 'h2' | 'h3' | 'h4';
  // For images/videos
  imageKey?: string;
  imageUrl?: string;
  videoKey?: string;
  videoUrl?: string;
  alt?: string;
  // Size control (percentage 25-100)
  width?: number;
  // For spacer
  height?: number;
  // Alignment
  align?: 'left' | 'center' | 'right';
  // Grid positioning (12-column grid) - legacy
  gridWidth?: GridWidth;
  gridOffset?: GridWidth | 0;
  // NEW: 2D Grid positioning
  gridColumn?: GridPosition;  // Start column (1-12)
  gridRow?: number;           // Start row (1-N)
  gridColSpan?: GridWidth;    // Width in columns (1-12)
  gridRowSpan?: GridHeight;   // Height in rows (1-12)
  // Container/Grid children
  children?: PageBlock[];
  // Background color (optional)
  bgColor?: string;
  // Padding
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export interface CustomPage {
  pageId: string;
  title: string;
  slug: string;
  blocks: PageBlock[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomPageData {
  title: string;
  slug: string;
  blocks: PageBlock[];
  isPublished?: boolean;
}

class CustomPageService {
  private getHeaders() {
    const token = useAuthStore.getState().accessToken;
    const tenantId = tenantService.getCurrentTenantId();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Creator-ID': tenantId
    };
  }

  async getCustomPages(): Promise<CustomPage[]> {
    const tenantId = tenantService.getCurrentTenantId();
    const response = await axios.get(
      `${API_BASE_URL}/tenants/${tenantId}/custom-pages`,
      { headers: this.getHeaders() }
    );
    return response.data.pages || [];
  }

  async getCustomPage(pageId: string): Promise<CustomPage | null> {
    const tenantId = tenantService.getCurrentTenantId();
    try {
      const response = await axios.get(
        `${API_BASE_URL}/tenants/${tenantId}/custom-pages/${pageId}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async getCustomPageBySlug(slug: string): Promise<CustomPage | null> {
    const tenantId = tenantService.getCurrentTenantId();
    try {
      const response = await axios.get(
        `${API_BASE_URL}/tenants/${tenantId}/custom-pages/by-slug/${slug}`
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async createCustomPage(data: CreateCustomPageData): Promise<CustomPage> {
    const tenantId = tenantService.getCurrentTenantId();
    const response = await axios.post(
      `${API_BASE_URL}/tenants/${tenantId}/custom-pages`,
      data,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async updateCustomPage(pageId: string, data: Partial<CreateCustomPageData>): Promise<CustomPage> {
    const tenantId = tenantService.getCurrentTenantId();
    const response = await axios.put(
      `${API_BASE_URL}/tenants/${tenantId}/custom-pages/${pageId}`,
      data,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async deleteCustomPage(pageId: string): Promise<void> {
    const tenantId = tenantService.getCurrentTenantId();
    await axios.delete(
      `${API_BASE_URL}/tenants/${tenantId}/custom-pages/${pageId}`,
      { headers: this.getHeaders() }
    );
  }

  async generateUploadUrl(filename: string, contentType: string): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    const tenantId = tenantService.getCurrentTenantId();
    const response = await axios.post(
      `${API_BASE_URL}/tenants/${tenantId}/custom-pages/upload-url`,
      { filename, contentType },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: { 'Content-Type': file.type }
    });
  }

  // Generate unique block ID
  generateBlockId(): string {
    return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create empty block
  createBlock(type: BlockType): PageBlock {
    const id = this.generateBlockId();
    
    switch (type) {
      case 'heading':
        return { id, type, content: 'Neue Überschrift', level: 'h2', align: 'center', gridWidth: 12, gridOffset: 0 };
      case 'text':
        return { id, type, content: 'Hier Text eingeben...', align: 'left', gridWidth: 12, gridOffset: 0 };
      case 'image':
        return { id, type, content: '', alt: 'Bild', align: 'center', gridWidth: 12, gridOffset: 0, width: 100 };
      case 'video':
        return { id, type, content: '', alt: 'Video', align: 'center', gridWidth: 12, gridOffset: 0, width: 100 };
      case 'divider':
        return { id, type, content: '', gridWidth: 12, gridOffset: 0 };
      case 'spacer':
        return { id, type, content: '', height: 40, gridWidth: 12, gridOffset: 0 };
      case 'container':
        return { id, type, content: '', gridWidth: 12, gridOffset: 0, children: [], bgColor: 'transparent', padding: 'medium' };
      case 'grid':
        // Grid container with empty children array
        return { id, type, content: '', gridWidth: 12, gridOffset: 0, children: [] };
      default:
        return { id, type, content: '', gridWidth: 12, gridOffset: 0 };
    }
  }

  // Create a block for placement in a grid
  createGridBlock(type: BlockType, column: number, row: number, colSpan: number = 4, rowSpan: number = 2): PageBlock {
    const block = this.createBlock(type);
    block.gridColumn = Math.max(1, Math.min(12, column)) as GridPosition;
    block.gridRow = Math.max(1, row);
    block.gridColSpan = Math.max(1, Math.min(12, colSpan)) as GridWidth;
    block.gridRowSpan = Math.max(1, Math.min(12, rowSpan)) as GridHeight;
    return block;
  }
}

export const customPageService = new CustomPageService();
