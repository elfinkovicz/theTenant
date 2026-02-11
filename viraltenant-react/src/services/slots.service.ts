import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { awsConfig } from '../config/aws-config';

const API_BASE_URL = awsConfig.api.user;

export interface PostingSlot {
  id: string;
  day: number;        // 0-6 (Sonntag-Samstag)
  time: string;       // "HH:mm"
  enabled: boolean;
  label?: string;
}

export interface PostingSlotsData {
  tenant_id: string;
  slots: PostingSlot[];
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface NextSlotInfo {
  slot_id: string;
  datetime: string;
  day_name: string;
  date: string;
  time: string;
  label?: string;
}

class SlotsService {
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
    
    // On main domain or custom domain without resolution - use platform
    console.warn('No subdomain detected - using platform tenant');
    return '319190e1-0791-43b0-bd04-506f959c1471';
  }

  // Get posting slots
  async getSlots(tenantId?: string): Promise<PostingSlotsData> {
    const tid = tenantId || this.getTenantId();
    const response = await axios.get(
      `${API_BASE_URL}/tenants/${tid}/newsfeed/slots`,
      { headers: { ...this.getAuthHeaders(), 'X-Creator-ID': tid } }
    );
    return response.data;
  }
  
  // Update posting slots
  async updateSlots(slots: PostingSlot[], timezone: string, tenantId?: string): Promise<PostingSlotsData> {
    const tid = tenantId || this.getTenantId();
    const response = await axios.put(
      `${API_BASE_URL}/tenants/${tid}/newsfeed/slots`,
      { slots, timezone },
      { headers: { ...this.getAuthHeaders(), 'X-Creator-ID': tid } }
    );
    return response.data;
  }
  
  // Get next available slot
  async getNextSlot(tenantId?: string): Promise<NextSlotInfo | null> {
    const tid = tenantId || this.getTenantId();
    const response = await axios.get(
      `${API_BASE_URL}/tenants/${tid}/newsfeed/slots/next`,
      { headers: { ...this.getAuthHeaders(), 'X-Creator-ID': tid } }
    );
    return response.data;
  }
}

export const slotsService = new SlotsService();
