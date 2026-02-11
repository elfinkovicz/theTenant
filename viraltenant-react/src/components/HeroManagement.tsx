import { useState, useEffect } from 'react';
import { Type, Upload, Trash2, Save, X, Video, Sparkles } from 'lucide-react';
import { heroService, HeroContent, HeroBackground } from '../services/hero.service';
import { useAuthStore } from '../store/authStore';
import { useTenant } from './providers/TenantProvider';
import { ImageCropper } from './ImageCropper';
import { toast } from '../utils/toast-alert';

interface HeroManagementProps {
  onClose: () => void;
  onSave?: () => void;
}

export const HeroManagement = ({ onClose, onSave }: HeroManagementProps) => {
  const { accessToken } = useAuthStore();
  const { tenant } = useTenant();
  const [hero, setHero] = useState<HeroContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState<number>(160);
  const [logoEnabled, setLogoEnabled] = useState<boolean>(true);
  const [heroHeight, setHeroHeight] = useState<number>(70);
  const [heroBackground, setHeroBackground] = useState<HeroBackground>({
    type: 'color',
    value: '#030712' // Neutral dark background as default
  });
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [cropperType, setCropperType] = useState<'hero' | 'background'>('hero');
  
  // Gradient settings - neutral defaults instead of orange
  const [gradientColor1, setGradientColor1] = useState('#6366f1');
  const [gradientColor2, setGradientColor2] = useState('#8b5cf6');
  const [gradientType, setGradientType] = useState<'linear' | 'radial'>('linear');
  const [gradientDirection, setGradientDirection] = useState('135deg');
  const [gradientPosition, setGradientPosition] = useState('center');

  useEffect(() => {
    loadHeroContent();
  }, []);

  const loadHeroContent = async () => {
    try {
      const content = await heroService.getHeroContent(tenant?.id);
      setHero(content);
      setTitle(content.title);
      setSubtitle(content.subtitle);
      setLogoPreview(content.logoUrl || null);
      setLogoSize(typeof content.logoSize === 'number' ? content.logoSize : 160);
      setLogoEnabled(content.logoEnabled !== false); // Default to true if not set
      setHeroHeight(content.heroHeight || 70);
      if (content.heroBackground) {
        setHeroBackground({
          type: content.heroBackground.type,
          value: content.heroBackground.value || '',
          imageKey: content.heroBackground.imageKey,
          videoKey: content.heroBackground.videoKey,
          blur: content.heroBackground.blur || 0
        });
      }
    } catch (error) {
      console.error('Failed to load hero content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropperImage(reader.result as string);
        setCropperType('hero');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], 'cropped.png', { type: 'image/png' });
    const previewUrl = URL.createObjectURL(croppedBlob);
    if (cropperType === 'hero') {
      setLogoFile(file);
      setLogoPreview(previewUrl);
    } else {
      setBackgroundFile(file);
      setHeroBackground({ ...heroBackground, type: 'image', value: previewUrl });
    }
    setCropperImage(null);
  };

  const handleCropCancel = () => {
    setCropperImage(null);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleBackgroundFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      if (isVideo) {
        setBackgroundFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setHeroBackground({ ...heroBackground, type: 'video', value: reader.result as string });
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setCropperImage(reader.result as string);
          setCropperType('background');
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const updateGradient = () => {
    let gradientValue = '';
    if (gradientType === 'linear') {
      gradientValue = `linear-gradient(${gradientDirection}, ${gradientColor1}, ${gradientColor2})`;
    } else {
      gradientValue = `radial-gradient(circle at ${gradientPosition}, ${gradientColor1}, ${gradientColor2})`;
    }
    setHeroBackground({ ...heroBackground, type: 'gradient', value: gradientValue });
  };

  const handleSave = async () => {
    if (!accessToken) return;
    setSaving(true);
    try {
      let logoKey = hero?.logoKey;
      const tenantId = tenant?.id;

      if (logoFile) {
        const result = await heroService.uploadLogo(logoFile, accessToken, 'hero', tenantId);
        logoKey = result.logoKey;
      } else if (!logoPreview && hero?.logoKey) {
        await heroService.deleteLogo(accessToken, 'hero', tenantId);
        logoKey = null;
      }

      let updatedBackground: HeroBackground = { ...heroBackground };
      if (backgroundFile) {
        const isVideo = backgroundFile.type.startsWith('video/');
        const bgType: 'image' | 'video' = isVideo ? 'video' : 'image';
        const result = await heroService.uploadBackground(backgroundFile, accessToken, bgType, tenantId!);
        updatedBackground = {
          type: bgType,
          value: result.url,
          imageKey: isVideo ? undefined : result.key,
          videoKey: isVideo ? result.key : undefined,
          blur: heroBackground.blur
        };
      }

      await heroService.updateHeroContent({
        logoKey: logoKey || null,
        title: title || '',
        subtitle: subtitle || '',
        logoSize,
        logoEnabled,
        heroHeight,
        heroBackground: updatedBackground
      }, accessToken, tenantId);

      toast.success('Hero-Bereich erfolgreich aktualisiert!');
      
      // Callback für Refresh der Daten im Parent
      if (onSave) {
        onSave();
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to save hero content:', error);
      toast.error('Fehler beim Speichern des Hero-Bereichs');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-dark-900 rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-dark-800 flex justify-between items-center">
          <h2 className="text-xl font-bold">Hero-Bereich bearbeiten</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">
                <Upload size={16} className="inline mr-2" />
                Logo (empfohlen: 200x200px)
              </label>
              <div 
                onClick={() => setLogoEnabled(!logoEnabled)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span className="text-sm text-dark-400">Logo anzeigen</span>
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    logoEnabled ? 'bg-primary-600' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      logoEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </div>
              </div>
            </div>
            
            <div className={logoEnabled ? '' : 'opacity-50 pointer-events-none'}>
              {logoPreview ? (
                <div className="relative inline-block">
                  <div className="bg-transparent border border-dark-700 rounded-lg p-4">
                    <img src={logoPreview} alt="Logo" className="max-w-full max-h-32 object-contain bg-transparent" />
                  </div>
                  <button type="button" onClick={handleRemoveLogo} className="absolute -top-2 -right-2 p-1.5 bg-red-600 hover:bg-red-700 rounded-full">
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <label className="block w-full h-32 border-2 border-dashed border-dark-700 rounded-lg hover:border-primary-500 cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                  <div className="h-full flex flex-col items-center justify-center text-dark-400">
                    <Upload size={40} className="mb-2" />
                    <p className="text-sm">Hochladen</p>
                  </div>
                </label>
              )}
              
              {/* Logo Size and Hero Height - directly under logo */}
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Logo-Größe: {logoSize}px</label>
                  <input type="range" min="80" max="800" value={logoSize} onChange={(e) => setLogoSize(parseInt(e.target.value))} className="w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Bereichsgröße: {heroHeight}%</label>
                  <input type="range" min="40" max="100" value={heroHeight} onChange={(e) => setHeroHeight(parseInt(e.target.value))} className="w-full" />
                </div>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              <Type size={16} className="inline mr-2" />
              Titel
            </label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Your Brand" className="input w-full" maxLength={50} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              <Type size={16} className="inline mr-2" />
              Untertitel
            </label>
            <textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Beschreibung..." className="input w-full h-20 resize-none" maxLength={500} />
          </div>
          <div className="border-t border-dark-800 pt-6">
            <h3 className="text-lg font-semibold mb-4">Hintergrund</h3>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setHeroBackground({ ...heroBackground, type: 'color' })} className={`px-3 py-2 rounded-lg text-sm ${heroBackground.type === 'color' ? 'bg-primary-600' : 'bg-dark-800'}`}>
                Farbe
              </button>
              <button onClick={() => setHeroBackground({ ...heroBackground, type: 'gradient' })} className={`px-3 py-2 rounded-lg text-sm ${heroBackground.type === 'gradient' ? 'bg-primary-600' : 'bg-dark-800'}`}>
                Verlauf
              </button>
              <button onClick={() => setHeroBackground({ ...heroBackground, type: 'image' })} className={`px-3 py-2 rounded-lg text-sm ${heroBackground.type === 'image' ? 'bg-primary-600' : 'bg-dark-800'}`}>
                <Upload size={14} className="inline mr-1" />
                Bild
              </button>
              <button onClick={() => setHeroBackground({ ...heroBackground, type: 'video' })} className={`px-3 py-2 rounded-lg text-sm ${heroBackground.type === 'video' ? 'bg-primary-600' : 'bg-dark-800'}`}>
                <Video size={14} className="inline mr-1" />
                Video
              </button>
            </div>
            {heroBackground.type === 'color' && (
              <div className="space-y-3">
                <div className="flex gap-3 items-center">
                  <input 
                    type="color" 
                    value={heroBackground.value || '#1a1a2e'} 
                    onChange={(e) => setHeroBackground({ ...heroBackground, value: e.target.value })} 
                    className="w-16 h-16 rounded cursor-pointer" 
                  />
                  <div className="flex-1">
                    <label className="block text-xs text-dark-400 mb-1">Hex-Farbe</label>
                    <input 
                      type="text" 
                      value={heroBackground.value || '#1a1a2e'} 
                      onChange={(e) => setHeroBackground({ ...heroBackground, value: e.target.value })} 
                      className="input w-full" 
                      placeholder="#1a1a2e"
                    />
                  </div>
                </div>
                <div 
                  className="w-full h-24 rounded-lg border-2 border-dark-700" 
                  style={{ backgroundColor: heroBackground.value || '#1a1a2e' }}
                />
              </div>
            )}
            {heroBackground.type === 'gradient' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Farbe 1</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={gradientColor1} 
                        onChange={(e) => { setGradientColor1(e.target.value); }} 
                        onBlur={updateGradient}
                        className="w-12 h-10 rounded cursor-pointer" 
                      />
                      <input 
                        type="text" 
                        value={gradientColor1} 
                        onChange={(e) => setGradientColor1(e.target.value)} 
                        onBlur={updateGradient}
                        className="input flex-1" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Farbe 2</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={gradientColor2} 
                        onChange={(e) => { setGradientColor2(e.target.value); }} 
                        onBlur={updateGradient}
                        className="w-12 h-10 rounded cursor-pointer" 
                      />
                      <input 
                        type="text" 
                        value={gradientColor2} 
                        onChange={(e) => setGradientColor2(e.target.value)} 
                        onBlur={updateGradient}
                        className="input flex-1" 
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Verlaufstyp</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setGradientType('linear'); setTimeout(updateGradient, 0); }} 
                      className={`px-4 py-2 rounded-lg text-sm flex-1 ${gradientType === 'linear' ? 'bg-primary-600' : 'bg-dark-800'}`}
                    >
                      Linear
                    </button>
                    <button 
                      onClick={() => { setGradientType('radial'); setTimeout(updateGradient, 0); }} 
                      className={`px-4 py-2 rounded-lg text-sm flex-1 ${gradientType === 'radial' ? 'bg-primary-600' : 'bg-dark-800'}`}
                    >
                      Radial
                    </button>
                  </div>
                </div>

                {gradientType === 'linear' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Richtung</label>
                    <div className="grid grid-cols-4 gap-2">
                      <button onClick={() => { setGradientDirection('0deg'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientDirection === '0deg' ? 'bg-primary-600' : 'bg-dark-800'}`}>↑ Oben</button>
                      <button onClick={() => { setGradientDirection('90deg'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientDirection === '90deg' ? 'bg-primary-600' : 'bg-dark-800'}`}>→ Rechts</button>
                      <button onClick={() => { setGradientDirection('180deg'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientDirection === '180deg' ? 'bg-primary-600' : 'bg-dark-800'}`}>↓ Unten</button>
                      <button onClick={() => { setGradientDirection('270deg'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientDirection === '270deg' ? 'bg-primary-600' : 'bg-dark-800'}`}>← Links</button>
                      <button onClick={() => { setGradientDirection('45deg'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientDirection === '45deg' ? 'bg-primary-600' : 'bg-dark-800'}`}>↗</button>
                      <button onClick={() => { setGradientDirection('135deg'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientDirection === '135deg' ? 'bg-primary-600' : 'bg-dark-800'}`}>↘</button>
                      <button onClick={() => { setGradientDirection('225deg'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientDirection === '225deg' ? 'bg-primary-600' : 'bg-dark-800'}`}>↙</button>
                      <button onClick={() => { setGradientDirection('315deg'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientDirection === '315deg' ? 'bg-primary-600' : 'bg-dark-800'}`}>↖</button>
                    </div>
                  </div>
                )}

                {gradientType === 'radial' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Position</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => { setGradientPosition('top left'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientPosition === 'top left' ? 'bg-primary-600' : 'bg-dark-800'}`}>↖ Oben Links</button>
                      <button onClick={() => { setGradientPosition('top'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientPosition === 'top' ? 'bg-primary-600' : 'bg-dark-800'}`}>↑ Oben</button>
                      <button onClick={() => { setGradientPosition('top right'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientPosition === 'top right' ? 'bg-primary-600' : 'bg-dark-800'}`}>↗ Oben Rechts</button>
                      <button onClick={() => { setGradientPosition('left'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientPosition === 'left' ? 'bg-primary-600' : 'bg-dark-800'}`}>← Links</button>
                      <button onClick={() => { setGradientPosition('center'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientPosition === 'center' ? 'bg-primary-600' : 'bg-dark-800'}`}>● Mitte</button>
                      <button onClick={() => { setGradientPosition('right'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientPosition === 'right' ? 'bg-primary-600' : 'bg-dark-800'}`}>→ Rechts</button>
                      <button onClick={() => { setGradientPosition('bottom left'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientPosition === 'bottom left' ? 'bg-primary-600' : 'bg-dark-800'}`}>↙ Unten Links</button>
                      <button onClick={() => { setGradientPosition('bottom'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientPosition === 'bottom' ? 'bg-primary-600' : 'bg-dark-800'}`}>↓ Unten</button>
                      <button onClick={() => { setGradientPosition('bottom right'); setTimeout(updateGradient, 0); }} className={`px-3 py-2 rounded text-xs ${gradientPosition === 'bottom right' ? 'bg-primary-600' : 'bg-dark-800'}`}>↘ Unten Rechts</button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">Vorschau</label>
                  <div 
                    className="w-full h-24 rounded-lg border-2 border-dark-700" 
                    style={{ background: heroBackground.value }}
                  />
                </div>
              </div>
            )}
            {(heroBackground.type === 'image' || heroBackground.type === 'video') && (
              <div>
                {heroBackground.value ? (
                  <div className="relative mb-4">
                    {heroBackground.type === 'video' ? (
                      <video src={heroBackground.value} className="w-full max-h-48 object-cover rounded-lg" controls />
                    ) : (
                      <img src={heroBackground.value} alt="BG" className="w-full max-h-48 object-cover rounded-lg" />
                    )}
                    <button onClick={() => { setBackgroundFile(null); setHeroBackground({ ...heroBackground, value: '', imageKey: undefined, videoKey: undefined }); }} className="absolute top-2 right-2 p-2 bg-red-600 rounded-full">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="block w-full h-28 border-2 border-dashed border-dark-700 rounded-lg cursor-pointer">
                    <input type="file" accept={heroBackground.type === 'video' ? 'video/*' : 'image/*'} onChange={handleBackgroundFileSelect} className="hidden" />
                    <div className="h-full flex flex-col items-center justify-center text-dark-400">
                      {heroBackground.type === 'video' ? <Video size={32} /> : <Upload size={32} />}
                      <p className="text-sm mt-2">{heroBackground.type === 'video' ? 'Video' : 'Bild'} hochladen</p>
                    </div>
                  </label>
                )}
              </div>
            )}
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">
                <Sparkles size={16} className="inline mr-2" />
                Unschaerfe: {heroBackground.blur || 0}px
              </label>
              <input type="range" min="0" max="20" value={heroBackground.blur || 0} onChange={(e) => setHeroBackground({ ...heroBackground, blur: parseInt(e.target.value) })} className="w-full" />
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-dark-800 flex gap-3">
          <button onClick={onClose} disabled={saving} className="btn-secondary flex-1">
            Abbrechen
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Speichern...
              </>
            ) : (
              <>
                <Save size={18} />
                Speichern
              </>
            )}
          </button>
        </div>
      </div>
      {cropperImage && (
        <ImageCropper 
          image={cropperImage} 
          onCropComplete={handleCropComplete} 
          onCancel={handleCropCancel} 
          aspectRatio={cropperType === 'background' ? 16/9 : 1} 
          cropShape="rect" 
          title={cropperType === 'hero' ? 'Logo zuschneiden' : 'Hintergrund zuschneiden'} 
          optimizeForCrossposting={cropperType === 'background'}
          preserveFormat={cropperType === 'hero'}
        />
      )}
    </div>
  );
};
