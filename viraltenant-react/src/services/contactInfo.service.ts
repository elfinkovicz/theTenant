import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { awsConfig } from '../config/aws-config';

const API_BASE_URL = awsConfig.api.user;

export interface ContactInfo {
  id: string;
  type: 'email' | 'phone' | 'address' | 'custom';
  title: string;
  value: string;
  icon: string;
  enabled: boolean;
}

export interface BookingWidget {
  id: string;
  type: 'calendly' | 'microsoft' | 'zoom' | 'simplybook' | 'custom';
  title: string;
  url: string;
  embedType: 'link' | 'iframe';
  enabled: boolean;
}

export interface ContactData {
  contacts: ContactInfo[];
  bookingWidgets?: BookingWidget[];
  settings: {
    showMap?: boolean;
    mapAddress?: string;
    formEnabled?: boolean;
    formEmail?: string;
  };
}

class ContactInfoService {
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

  async getContactInfo(tenantId?: string): Promise<ContactData> {
    try {
      // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
      const storedTenantId = this.getStoredTenantId();
      const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
      
      console.log('Loading contact info for tenant:', resolvedTenantId, 'stored:', storedTenantId, 'provided:', tenantId);
      
      const response = await axios.get(`${API_BASE_URL}/tenants/${resolvedTenantId}/contact`, {
        headers: { 
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId 
        }
      });
      
      console.log('Contact info response:', response.data);
      
      // Store the resolved tenant ID for subsequent operations
      if (response.data.resolvedTenantId) {
        localStorage.setItem('resolvedTenantId', response.data.resolvedTenantId);
        console.log('Stored resolved tenant ID:', response.data.resolvedTenantId);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error loading contact info:', error);
      return {
        contacts: [
          { id: 'email', type: 'email', title: 'E-Mail', value: 'contact@example.com', icon: 'mail', enabled: true },
          { id: 'phone', type: 'phone', title: 'Telefon', value: '+49 123 456789', icon: 'phone', enabled: true }
        ],
        settings: { showMap: false, formEnabled: false }
      };
    }
  }

  async updateContactInfo(contacts: ContactInfo[], settings?: object, bookingWidgets?: BookingWidget[], tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    
    console.log('Updating contact info for tenant:', resolvedTenantId, 'stored:', storedTenantId, 'provided:', tenantId);
    
    await axios.put(
      `${API_BASE_URL}/tenants/${resolvedTenantId}/contact`,
      { contacts, settings, bookingWidgets },
      { 
        headers: {
          ...this.getAuthHeaders(),
          'X-Creator-ID': resolvedTenantId
        }
      }
    );
  }

  async addContact(contact: Omit<ContactInfo, 'id'>, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    const { contacts, settings, bookingWidgets } = await this.getContactInfo(resolvedTenantId);
    
    const newContact: ContactInfo = {
      id: `contact-${Date.now()}`,
      ...contact
    };
    
    await this.updateContactInfo([...contacts, newContact], settings, bookingWidgets, resolvedTenantId);
  }

  async deleteContact(contactId: string, tenantId?: string): Promise<void> {
    // Use stored resolved tenant ID if available, otherwise use provided or detected tenant ID
    const storedTenantId = this.getStoredTenantId();
    const resolvedTenantId = tenantId || storedTenantId || this.getTenantId();
    const { contacts, settings, bookingWidgets } = await this.getContactInfo(resolvedTenantId);
    
    const updatedContacts = contacts.filter(c => c.id !== contactId);
    await this.updateContactInfo(updatedContacts, settings, bookingWidgets, resolvedTenantId);
  }
}

export const contactInfoService = new ContactInfoService();
