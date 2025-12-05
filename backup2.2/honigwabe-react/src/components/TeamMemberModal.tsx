import { useState, useEffect } from 'react';
import { X, Upload, User as UserIcon } from 'lucide-react';
import { teamService, TeamMember, CreateTeamMemberData } from '../services/team.service';

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
  const [order, setOrder] = useState(999);
  const [socials, setSocials] = useState({
    twitter: '',
    instagram: '',
    youtube: '',
    twitch: '',
    tiktok: '',
    linkedin: '',
    facebook: '',
    discord: ''
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (member && mode === 'edit') {
      setName(member.name);
      setRole(member.role);
      setBio(member.bio);
      setOrder(member.order);
      setSocials({
        twitter: member.socials.twitter || '',
        instagram: member.socials.instagram || '',
        youtube: member.socials.youtube || '',
        twitch: member.socials.twitch || '',
        tiktok: member.socials.tiktok || '',
        linkedin: member.socials.linkedin || '',
        facebook: member.socials.facebook || '',
        discord: member.socials.discord || ''
      });
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
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
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

      // Upload image if new file selected
      if (imageFile) {
        const uploadData = await teamService.generateUploadUrl(
          imageFile.name,
          imageFile.type
        );
        await teamService.uploadToS3(uploadData.uploadUrl, imageFile);
        imageKey = uploadData.imageKey;
      }

      // Filter out empty social links
      const filteredSocials = Object.fromEntries(
        Object.entries(socials).filter(([_, value]) => value.trim() !== '')
      );

      const data: CreateTeamMemberData = {
        name: name.trim(),
        role: role.trim(),
        bio: bio.trim(),
        imageKey,
        socials: filteredSocials,
        order
      };

      if (mode === 'create') {
        await teamService.createTeamMember(data);
      } else if (member) {
        await teamService.updateTeamMember(member.memberId, data);
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern');
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
      setOrder(999);
      setSocials({
        twitter: '',
        instagram: '',
        youtube: '',
        twitch: '',
        tiktok: '',
        linkedin: '',
        facebook: '',
        discord: ''
      });
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-dark-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <h2 className="text-2xl font-bold">
            {mode === 'create' ? 'Team-Mitglied hinzufügen' : 'Team-Mitglied bearbeiten'}
          </h2>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="text-dark-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
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
              placeholder="Kurze Beschreibung..."
              rows={3}
              className="input w-full disabled:opacity-50 resize-none"
              maxLength={300}
            />
          </div>

          {/* Order */}
          <div>
            <label className="block text-sm font-medium mb-2">Reihenfolge</label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
              disabled={uploading}
              className="input w-full disabled:opacity-50"
              min={0}
            />
            <p className="text-sm text-dark-400 mt-1">Niedrigere Zahlen erscheinen zuerst</p>
          </div>

          {/* Social Links */}
          <div>
            <label className="block text-sm font-medium mb-3">Social Media Links</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(socials).map(([platform, url]) => (
                <div key={platform}>
                  <label className="block text-xs text-dark-400 mb-1 capitalize">
                    {platform}
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setSocials({ ...socials, [platform]: e.target.value })}
                    disabled={uploading}
                    placeholder={`https://${platform}.com/...`}
                    className="input w-full disabled:opacity-50 text-sm"
                  />
                </div>
              ))}
            </div>
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
