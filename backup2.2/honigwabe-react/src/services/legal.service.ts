import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_LEGAL_API_URL || '';

export interface LegalDocument {
  id: string;
  title: string;
  content: string;
  lastUpdated: string;
}

class LegalService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getLegalDocs(): Promise<LegalDocument[]> {
    const response = await axios.get(`${API_URL}/legal`);
    return response.data.legalDocs;
  }

  async updateLegalDocs(legalDocs: LegalDocument[]): Promise<void> {
    await axios.put(
      `${API_URL}/legal`,
      { legalDocs },
      { headers: this.getAuthHeaders() }
    );
  }
}

export const legalService = new LegalService();
