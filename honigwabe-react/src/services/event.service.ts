import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_EVENT_API_URL || '';

export interface Event {
  eventId: string;
  title: string;
  description: string;
  eventDate: string;
  eventTime?: string;
  location?: string;
  imageKey?: string;
  imageUrl?: string;
  ticketUrl?: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventData {
  title: string;
  description: string;
  eventDate: string;
  eventTime?: string;
  location?: string;
  imageKey?: string;
  ticketUrl?: string;
  status?: 'draft' | 'published';
}

class EventService {
  private getAuthHeaders() {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getEvents(): Promise<Event[]> {
    const response = await axios.get(`${API_URL}/events`);
    return response.data.events;
  }

  async getEvent(eventId: string): Promise<Event> {
    const response = await axios.get(`${API_URL}/events/${eventId}`);
    return response.data.event;
  }

  async createEvent(data: CreateEventData): Promise<Event> {
    const response = await axios.post(
      `${API_URL}/events`,
      data,
      { headers: this.getAuthHeaders() }
    );
    return response.data.event;
  }

  async updateEvent(eventId: string, data: Partial<CreateEventData>): Promise<void> {
    await axios.put(
      `${API_URL}/events/${eventId}`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  async deleteEvent(eventId: string): Promise<void> {
    await axios.delete(
      `${API_URL}/events/${eventId}`,
      { headers: this.getAuthHeaders() }
    );
  }

  async generateUploadUrl(fileName: string, fileType: string): Promise<{
    uploadUrl: string;
    imageKey: string;
    imageUrl: string;
  }> {
    const response = await axios.post(
      `${API_URL}/events/upload-url`,
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

export const eventService = new EventService();
