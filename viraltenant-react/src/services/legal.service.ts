import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { awsConfig } from '../config/aws-config';

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

  private getTenantId(): string {
    // Priority: currentTenantId (set by TenantProvider) > hostname detection > platform UUID
    const currentTenantId = localStorage.getItem('currentTenantId');
    if (currentTenantId) return currentTenantId;
    
    // Fallback to subdomain
    const hostname = window.location.hostname;
    if (hostname.includes('viraltenant.com')) {
      const parts = hostname.split('.');
      if (parts.length >= 3 && parts[0] !== 'www') {
        return parts[0];
      }
    }
    return '319190e1-0791-43b0-bd04-506f959c1471';
  }

  async getLegalDocs(): Promise<LegalDocument[]> {
    const tenantId = this.getTenantId();
    const response = await axios.get(`${awsConfig.api.user}/tenants/${tenantId}/legal`);
    return response.data.legalDocs;
  }

  async updateLegalDocs(legalDocs: LegalDocument[]): Promise<void> {
    const tenantId = this.getTenantId();
    await axios.put(
      `${awsConfig.api.user}/tenants/${tenantId}/legal`,
      { legalDocs },
      { headers: this.getAuthHeaders() }
    );
  }
}

export const legalService = new LegalService();
