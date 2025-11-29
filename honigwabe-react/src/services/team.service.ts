import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_TEAM_API_URL || '';

export interface TeamMember {
  memberId: string;
  name: string;
  role: string;
  bio: string;
  imageKey?: string;
  imageUrl?: string;
  socials: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    twitch?: string;
    tiktok?: string;
    linkedin?: string;
    facebook?: string;
    discord?: string;
  };
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamMemberData {
  name: string;
  role: string;
  bio: string;
  imageKey?: string;
  socials?: TeamMember['socials'];
  order?: number;
}

class TeamService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getTeamMembers(): Promise<TeamMember[]> {
    const response = await axios.get(`${API_URL}/team`);
    return response.data.members;
  }

  async createTeamMember(data: CreateTeamMemberData): Promise<TeamMember> {
    const response = await axios.post(
      `${API_URL}/team`,
      data,
      { headers: this.getAuthHeaders() }
    );
    return response.data.member;
  }

  async updateTeamMember(memberId: string, data: Partial<CreateTeamMemberData>): Promise<void> {
    await axios.put(
      `${API_URL}/team/${memberId}`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  async deleteTeamMember(memberId: string): Promise<void> {
    await axios.delete(
      `${API_URL}/team/${memberId}`,
      { headers: this.getAuthHeaders() }
    );
  }

  async generateUploadUrl(fileName: string, fileType: string): Promise<{
    uploadUrl: string;
    imageKey: string;
    imageUrl: string;
  }> {
    const response = await axios.post(
      `${API_URL}/team/upload-url`,
      { fileName, fileType },
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
    });
  }
}

export const teamService = new TeamService();
