import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { awsConfig } from '../config/aws-config';

const API_BASE_URL = awsConfig.api.user;

export type TeamMemberWidth = 'small' | 'medium' | 'large' | 'full';

export interface TeamMember {
  memberId: string;
  name: string;
  role: string;
  bio: string;
  imageUrl?: string;
  imageKey?: string;
  order?: number;
  width?: TeamMemberWidth;
  socials: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    twitch?: string;
    facebook?: string;
    linkedin?: string;
    tiktok?: string;
    discord?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamMemberData {
  name: string;
  role: string;
  bio: string;
  imageKey?: string;
  order?: number;
  width?: TeamMemberWidth;
  socials?: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    twitch?: string;
    facebook?: string;
    linkedin?: string;
    tiktok?: string;
    discord?: string;
  };
}

class TeamService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private getStoredTenantId(): string | null {
    // Priority: currentTenantId (set by TenantProvider) > resolvedTenantId (legacy)
    return localStorage.getItem('currentTenantId') || localStorage.getItem('resolvedTenantId');
  }

  private getTenantId(): string {
    // Priority: currentTenantId (set by TenantProvider) > hostname detection > platform UUID
    const currentTenantId = localStorage.getItem('currentTenantId');
    if (currentTenantId) return currentTenantId;
    
    const hostname = window.location.hostname;
    if (hostname.includes('viraltenant.com')) {
      const parts = hostname.split('.');
      return (parts.length >= 3 && parts[0] !== 'www') ? parts[0] : '319190e1-0791-43b0-bd04-506f959c1471';
    }
    return '319190e1-0791-43b0-bd04-506f959c1471';
  }

  async getTeamMembers(tenantId?: string): Promise<{ members: TeamMember[]; settings: object }> {
    try {
      // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
      const storedTenantId = this.getStoredTenantId();
      const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
      
      console.log('Loading team for tenant:', resolvedTenantId, 'stored:', storedTenantId, 'provided:', tenantId);
      
      const response = await axios.get(`${API_BASE_URL}/tenants/${resolvedTenantId}/team`, {
        headers: { 
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId 
        }
      });
      
      console.log('Team response:', response.data);
      
      // Store the resolved tenant ID for subsequent operations
      if (response.data.resolvedTenantId) {
        localStorage.setItem('resolvedTenantId', response.data.resolvedTenantId);
        console.log('Stored resolved tenant ID:', response.data.resolvedTenantId);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error loading team:', error);
      return { members: [], settings: {} };
    }
  }

  async updateTeamMembers(members: TeamMember[], settings?: object, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    
    console.log('Updating team for tenant:', resolvedTenantId, 'stored:', storedTenantId, 'provided:', tenantId);
    
    await axios.put(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/team`,
      { members, settings },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    );
  }

  async createTeamMember(data: CreateTeamMemberData, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    const { members, settings } = await this.getTeamMembers(resolvedTenantId);
    
    const newMember: TeamMember = {
      memberId: `member-${Date.now()}`,
      ...data,
      socials: data.socials || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await this.updateTeamMembers([...members, newMember], settings, resolvedTenantId);
  }

  async updateTeamMember(memberId: string, data: Partial<CreateTeamMemberData>, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    const { members, settings } = await this.getTeamMembers(resolvedTenantId);
    
    const updatedMembers = members.map(m => 
      m.memberId === memberId 
        ? { ...m, ...data, updatedAt: new Date().toISOString() }
        : m
    );
    
    await this.updateTeamMembers(updatedMembers, settings, resolvedTenantId);
  }

  async deleteTeamMember(memberId: string, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    const { members, settings } = await this.getTeamMembers(resolvedTenantId);
    
    const memberToDelete = members.find(m => m.memberId === memberId);
    if (memberToDelete?.imageKey) {
      await this.deleteAsset(memberToDelete.imageKey, resolvedTenantId);
    }
    
    const updatedMembers = members.filter(m => m.memberId !== memberId);
    await this.updateTeamMembers(updatedMembers, settings, resolvedTenantId);
  }

  async generateUploadUrl(fileName: string, fileType: string, tenantId?: string): Promise<{
    uploadUrl: string;
    key: string;
    publicUrl: string;
  }> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    
    const response = await axios.post(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/team/upload-url`,
      { fileName, fileType, uploadType: 'avatar' },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    );
    return response.data;
  }

  async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: { 'Content-Type': file.type }
    });
  }

  async deleteAsset(key: string, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    
    await axios.delete(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/team/asset`,
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        },
        data: { key }
      }
    );
  }
}

export const teamService = new TeamService();
