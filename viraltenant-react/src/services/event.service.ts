import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { awsConfig } from '../config/aws-config';

const API_BASE_URL = awsConfig.api.user;

export interface EventGuest {
  id: string;
  name: string;
  imageUrl?: string;
  links?: string[];
}

export interface Event {
  eventId: string;
  title: string;
  description: string;
  eventDate: string;
  eventTime?: string;
  location?: string;
  locationUrl?: string;
  imageUrl?: string;
  imageKey?: string;
  ticketUrl?: string;
  status: 'draft' | 'published' | 'scheduled';
  isExclusive?: boolean;
  createdAt: string;
  updatedAt: string;
  guests?: EventGuest[];
  scheduledAt?: string;
}

export interface CreateEventData {
  title: string;
  description: string;
  eventDate: string;
  eventTime?: string;
  location?: string;
  locationUrl?: string;
  imageKey?: string;
  ticketUrl?: string;
  status?: 'draft' | 'published' | 'scheduled';
  isExclusive?: boolean;
  guests?: EventGuest[];
  scheduledAt?: string;
}

class EventService {
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

  async getEvents(tenantId?: string): Promise<{ events: Event[]; settings: object }> {
    try {
      // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
      const storedTenantId = this.getStoredTenantId();
      const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
      
      console.log('Loading events for tenant:', resolvedTenantId, 'stored:', storedTenantId, 'provided:', tenantId);
      
      const response = await axios.get(`${API_BASE_URL}/tenants/${resolvedTenantId}/events`, {
        headers: { 
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId 
        }
      });
      
      console.log('Events response:', response.data);
      
      // Store the resolved tenant ID for subsequent operations
      if (response.data.resolvedTenantId) {
        localStorage.setItem('resolvedTenantId', response.data.resolvedTenantId);
        console.log('Stored resolved tenant ID:', response.data.resolvedTenantId);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error loading events:', error);
      return { events: [], settings: {} };
    }
  }

  async updateEvents(events: Event[], settings?: object, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    
    console.log('Updating events for tenant:', resolvedTenantId, 'stored:', storedTenantId, 'provided:', tenantId);
    
    await axios.put(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/events`,
      { events, settings },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    );
  }

  async createEvent(data: CreateEventData, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    const { events, settings } = await this.getEvents(resolvedTenantId);
    
    const newEvent: Event = {
      eventId: `event-${Date.now()}`,
      ...data,
      status: data.status || 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add new event at the beginning (position 1)
    await this.updateEvents([newEvent, ...events], settings, resolvedTenantId);
  }

  async updateEvent(eventId: string, data: Partial<CreateEventData>, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    const { events, settings } = await this.getEvents(resolvedTenantId);
    
    const updatedEvents = events.map(e => 
      e.eventId === eventId 
        ? { ...e, ...data, updatedAt: new Date().toISOString() }
        : e
    );
    
    await this.updateEvents(updatedEvents, settings, resolvedTenantId);
  }

  async deleteEvent(eventId: string, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    const { events, settings } = await this.getEvents(resolvedTenantId);
    
    const eventToDelete = events.find(e => e.eventId === eventId);
    if (eventToDelete?.imageKey) {
      await this.deleteAsset(eventToDelete.imageKey, resolvedTenantId);
    }
    
    const updatedEvents = events.filter(e => e.eventId !== eventId);
    await this.updateEvents(updatedEvents, settings, resolvedTenantId);
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
      `${API_BASE_URL}/tenants/${resolvedTenantId}/events/upload-url`,
      { fileName, fileType, uploadType: 'image' },
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
      `${API_BASE_URL}/tenants/${resolvedTenantId}/events/asset`,
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

export const eventService = new EventService();
