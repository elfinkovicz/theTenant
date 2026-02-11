import { useState, useEffect } from 'react';
import { X, Upload, User as UserIcon, Plus, Trash2, Twitter, Instagram, Youtube, Twitch, Linkedin, Facebook, Globe } from 'lucide-react';
import { teamService, TeamMember, CreateTeamMemberData } from '../services/team.service';
import { ImageCropper } from './ImageCropper';
import { toast } from '../utils/toast-alert';
import { prefetchService } from '../services/prefetch.service';

// TikTok Icon
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || "w-4 h-4"}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

// Discord Icon
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || "w-4 h-4"}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

// Spotify Icon
const SpotifyIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || "w-4 h-4"}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const detectPlatform = (url: string): string => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
  if (lowerUrl.includes('instagram.com')) return 'instagram';
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('twitch.tv')) return 'twitch';
  if (lowerUrl.includes('tiktok.com')) return 'tiktok';
  if (lowerUrl.includes('linkedin.com')) return 'linkedin';
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) return 'facebook';
  if (lowerUrl.includes('discord.gg') || lowerUrl.includes('discord.com')) return 'discord';
  if (lowerUrl.includes('spotify.com') || lowerUrl.includes('open.spotify')) return 'spotify';
  return 'website';
};

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case 'twitter': return <Twitter className="w-4 h-4" />;
    case 'instagram': return <Instagram className="w-4 h-4" />;
    case 'youtube': return <Youtube className="w-4 h-4" />;
    case 'twitch': return <Twitch className="w-4 h-4" />;
    case 'tiktok': return <TikTokIcon className="w-4 h-4" />;
    case 'linkedin': return <Linkedin className="w-4 h-4" />;
    case 'facebook': return <Facebook className="w-4 h-4" />;
    case 'discord': return <DiscordIcon className="w-4 h-4" />;
    case 'spotify': return <SpotifyIcon className="w-4 h-4" />;
    default: return <Globe className="w-4 h-4" />;
  }
};

const getPlatformColor = (platform: string): string => {
  switch (platform) {
    case 'twitter': return '#1DA1F2';
    case 'instagram': return '#E4405F';
    case 'youtube': return '#FF0000';
    case 'twitch': return '#9146FF';
    case 'tiktok': return '#ff0050';
    case 'linkedin': return '#0A66C2';
    case 'facebook': return '#1877F2';
    case 'discord': return '#5865F2';
    case 'spotify': return '#1DB954';
    default: return '#6B7280';
  }
};

interface TeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member?: TeamMember | null;
  mode: 'create' | 'edit';
}

export function TeamMemberModal({ isOpen, onClose, onSuccess, member, mode }: TeamMemberModalProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [bio, setBio] = useState('');
  const [socialLinks, setSocialLinks] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [cropperImage, setCropperImage] = useState<string | null>(null);

  useEffect(() => {
    if (member && mode === 'edit') {
      setName(member.name);
      setRole(member.role);
      setBio(member.bio);
      // Convert old socials object to links array
      const links: string[] = [];
      if (member.socials) {
        Object.values(member.socials).forEach(url => {
          if (url && url.trim()) links.push(url);
        });
      }
      setSocialLinks(links.length > 0 ? links : []);
      if (member.imageUrl) {
        setImagePreview(member.imageUrl);
      }
    }
  }, [member, mode]);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Bitte wähle ein Bild aus');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Bild ist zu groß (max. 5MB)');
        return;
      }
      setError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropperImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], 'profile.png', { type: 'image/png' });
    setImageFile(file);
    setImagePreview(URL.createObjectURL(croppedBlob));
    setCropperImage(null);
  };

  const addSocialLink = () => {
    if (socialLinks.length < 10) {
      setSocialLinks([...socialLinks, '']);
    }
  };

  const updateSocialLink = (index: number, value: string) => {
    const newLinks = [...socialLinks];
    newLinks[index] = value;
    setSocialLinks(newLinks);
  };

  const removeSocialLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  };

  // Convert links array to socials object for backend compatibility
  const linksToSocials = (links: string[]): Record<string, string> => {
    const socials: Record<string, string> = {};
    links.forEach(url => {
      if (url && url.trim()) {
        const platform = detectPlatform(url);
        socials[platform] = url;
      }
    });
    return socials;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !role.trim()) {
      setError('Name und Rolle sind erforderlich');
      return;
    }

    setUploading(true);
    setError('');

    try {
      let imageKey = member?.imageKey;

      if (imageFile) {
        const uploadData = await teamService.generateUploadUrl(
          imageFile.name,
          imageFile.type
        );
        await teamService.uploadToS3(uploadData.uploadUrl, imageFile);
        imageKey = uploadData.key;
      }

      const filteredLinks = socialLinks.filter(url => url.trim() !== '');
      const socials = linksToSocials(filteredLinks);

      const data: CreateTeamMemberData = {
        name: name.trim(),
        role: role.trim(),
        bio: bio.trim(),
        imageKey,
        socials
      };

      if (mode === 'create') {
        await teamService.createTeamMember(data);
      } else if (member) {
        await teamService.updateTeamMember(member.memberId, data);
      }

      toast.success('Team-Mitglied erfolgreich gespeichert!');
      prefetchService.invalidate('team');
      setUploading(false);
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern');
      toast.error('Fehler beim Speichern des Team-Mitglieds');
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setImageFile(null);
      setImagePreview('');
      setName('');
      setRole('');
      setBio('');
      setSocialLinks([]);
      setError('');
      setUploading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      {cropperImage && (
        <ImageCropper
          image={cropperImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropperImage(null)}
          aspectRatio={1}
          cropShape="round"
          title="Profilbild zuschneiden"
          preserveFormat={true}
          optimizeForCrossposting={false}
        />
      )}
      
      <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-dark-800 my-auto">
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <h2 className="text-2xl font-bold">
            {mode === 'create' ? 'Team-Mitglied hinzufügen' : 'Team-Mitglied bearbeiten'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Profilbild</label>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 rounded-full bg-dark-800 overflow-hidden flex items-center justify-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-16 h-16 text-dark-400" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={uploading}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="btn-secondary cursor-pointer inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Bild hochladen
                </label>
                <p className="text-sm text-dark-400 mt-2">Max. 5MB, JPG oder PNG</p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={uploading}
              placeholder="Max Mustermann"
              className="input w-full disabled:opacity-50"
              maxLength={100}
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Rolle <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={uploading}
              placeholder="Founder & Streamer"
              className="input w-full disabled:opacity-50"
              maxLength={100}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium mb-2">Beschreibung</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              disabled={uploading}
              placeholder="Beschreibung..."
              rows={4}
              className="input w-full disabled:opacity-50 resize-none"
              maxLength={3000}
            />
            <p className="text-xs text-dark-400 mt-1">{bio.length}/3000 Zeichen</p>
          </div>

          {/* Social Links - Dynamic */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium">Social Media Links</label>
              <button
                type="button"
                onClick={addSocialLink}
                disabled={uploading || socialLinks.length >= 10}
                className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Link hinzufügen
              </button>
            </div>
            
            {socialLinks.length > 0 ? (
              <div className="space-y-3">
                {socialLinks.map((url, index) => {
                  const platform = url ? detectPlatform(url) : 'website';
                  const color = getPlatformColor(platform);
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {getPlatformIcon(platform)}
                      </div>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => updateSocialLink(index, e.target.value)}
                        disabled={uploading}
                        placeholder="https://twitter.com/..."
                        className="input flex-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeSocialLink(index)}
                        disabled={uploading}
                        className="p-2 text-dark-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-dark-500 text-center py-4 bg-dark-800 rounded-lg">
                Keine Social Links hinzugefügt
              </p>
            )}
            <p className="text-xs text-dark-400 mt-2">
              Plattform wird automatisch erkannt (Twitter, Instagram, YouTube, Twitch, TikTok, LinkedIn, Facebook, Discord, Spotify)
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-500">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
              className="btn-secondary flex-1 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={uploading || !name.trim() || !role.trim()}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Wird gespeichert...' : mode === 'create' ? 'Hinzufügen' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
