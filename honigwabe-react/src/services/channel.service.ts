import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_CHANNEL_API_URL || '';

export interface SocialChannel {
  id: string;
  name: string;
  platform: string;
  url: string;
  followers: string;
  description: string;
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

  async getChannels(): Promise<SocialChannel[]> {
    const response = await axios.get(`${API_URL}/channels`);
    return response.data.channels;
  }

  async updateChannels(channels: SocialChannel[]): Promise<void> {
    await axios.put(
      `${API_URL}/channels`,
      { channels },
      { headers: this.getAuthHeaders() }
    );
  }
}

export const channelService = new ChannelService();
