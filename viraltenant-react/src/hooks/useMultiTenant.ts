import { useState, useEffect } from 'react';
import { multiTenantHelpers } from '../config/aws-config';

interface CreatorInfo {
  creatorId: string;
  name: string;
  displayName: string;
  description?: string;
  customDomain?: string;
  subdomain: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  features: {
    ivs_streaming: boolean;
    ivs_chat: boolean;
    user_auth: boolean;
    video_management: boolean;
    shop: boolean;
    team_management: boolean;
  };
}

interface MultiTenantState {
  creatorId: string;
  creatorInfo: CreatorInfo | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Multi-Tenant Hook für Creator-spezifische Funktionalität
 */
export const useMultiTenant = () => {
  const [state, setState] = useState<MultiTenantState>({
    creatorId: multiTenantHelpers.getCurrentCreator(),
    creatorInfo: null,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    loadCreatorInfo();
  }, [state.creatorId]);

  const loadCreatorInfo = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await multiTenantHelpers.apiCall('/profile');
      
      if (!response.ok) {
        throw new Error(`Failed to load creator info: ${response.status}`);
      }
      
      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        creatorInfo: data.data,
        isLoading: false
      }));
      
      // Apply branding
      applyBranding(data.data.branding);
      
    } catch (error) {
      console.error('Error loading creator info:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      }));
    }
  };

  const applyBranding = (branding: CreatorInfo['branding']) => {
    if (!branding) return;
    
    // Apply CSS custom properties for theming
    const root = document.documentElement;
    root.style.setProperty('--color-primary', branding.primaryColor);
    root.style.setProperty('--color-secondary', branding.secondaryColor);
    root.style.setProperty('--color-accent', branding.accentColor);
  };

  const updateCreatorInfo = async (updates: Partial<CreatorInfo>) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await multiTenantHelpers.apiCall('/profile', {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update creator info: ${response.status}`);
      }
      
      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        creatorInfo: data.data,
        isLoading: false
      }));
      
      // Apply updated branding
      if (updates.branding) {
        applyBranding(updates.branding);
      }
      
      return data.data;
      
    } catch (error) {
      console.error('Error updating creator info:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      }));
      throw error;
    }
  };

  const hasFeature = (feature: keyof CreatorInfo['features']): boolean => {
    return state.creatorInfo?.features[feature] || false;
  };

  const getAssetUrl = (assetPath: string): string => {
    return multiTenantHelpers.getAssetUrl(assetPath);
  };

  const getUploadUrl = (type: 'videos' | 'images' | 'thumbnails' | 'assets'): string => {
    return multiTenantHelpers.getUploadUrl(type);
  };

  return {
    creatorId: state.creatorId,
    creatorInfo: state.creatorInfo,
    isLoading: state.isLoading,
    error: state.error,
    loadCreatorInfo,
    updateCreatorInfo,
    hasFeature,
    getAssetUrl,
    getUploadUrl,
    // Utility functions
    isDemo: state.creatorId === 'demo',
    isPlatform: state.creatorId === '319190e1-0791-43b0-bd04-506f959c1471',
    subdomain: state.creatorInfo?.subdomain || `${state.creatorId}.viraltenant.com`,
    customDomain: state.creatorInfo?.customDomain
  };
};

export default useMultiTenant;