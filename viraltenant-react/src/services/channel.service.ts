import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { awsConfig } from '../config/aws-config';

const API_BASE_URL = awsConfig.api.user;

export interface SocialChannel {
  id: string;
  name: string;
  platform: string;
  url: string;
  followers?: string;
  description?: string;
  color: string;
  iconType: string;
  category: string;
  enabled: boolean;
}

class ChannelService {
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

  async getChannels(tenantId?: string): Promise<{ channels: SocialChannel[]; settings: object }> {
    try {
      // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
      const storedTenantId = this.getStoredTenantId();
      const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
      
      console.log('Loading channels for tenant:', resolvedTenantId, 'stored:', storedTenantId, 'provided:', tenantId);
      
      const response = await axios.get(`${API_BASE_URL}/tenants/${resolvedTenantId}/channels`, {
        headers: { 
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId 
        }
      });
      
      console.log('Channels response:', response.data);
      
      // Store the resolved tenant ID for subsequent operations
      if (response.data.resolvedTenantId) {
        localStorage.setItem('resolvedTenantId', response.data.resolvedTenantId);
        console.log('Stored resolved tenant ID:', response.data.resolvedTenantId);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error loading channels:', error);
      return { channels: [], settings: {} };
    }
  }

  async updateChannels(channels: SocialChannel[], settings?: object, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    
    console.log('Updating channels for tenant:', resolvedTenantId, 'stored:', storedTenantId, 'provided:', tenantId);
    
    await axios.put(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/channels`,
      { channels, settings },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    );
  }

  async addChannel(channel: Omit<SocialChannel, 'id'>, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    const { channels, settings } = await this.getChannels(resolvedTenantId);
    
    const newChannel: SocialChannel = {
      id: `channel-${Date.now()}`,
      ...channel
    };
    
    await this.updateChannels([...channels, newChannel], settings, resolvedTenantId);
  }

  async deleteChannel(channelId: string, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    const { channels, settings } = await this.getChannels(resolvedTenantId);
    
    const updatedChannels = channels.filter(c => c.id !== channelId);
    await this.updateChannels(updatedChannels, settings, resolvedTenantId);
  }
}

export const channelService = new ChannelService();
