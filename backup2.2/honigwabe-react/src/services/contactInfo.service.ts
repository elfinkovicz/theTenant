import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_CONTACT_INFO_API_URL || '';

export interface ContactInfo {
  id: string;
  type: 'email' | 'phone' | 'address';
  title: string;
  value: string;
  icon: string;
  enabled: boolean;
}

class ContactInfoService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getContactInfo(): Promise<ContactInfo[]> {
    const response = await axios.get(`${API_URL}/contact-info`);
    return response.data.contactInfo;
  }

  async updateContactInfo(contactInfo: ContactInfo[]): Promise<void> {
    await axios.put(
      `${API_URL}/contact-info`,
      { contactInfo },
      { headers: this.getAuthHeaders() }
    );
  }
}

export const contactInfoService = new ContactInfoService();
