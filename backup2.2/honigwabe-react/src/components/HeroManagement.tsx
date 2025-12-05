import { useState, useEffect } from 'react'
import { Image, Type, Upload, Trash2, Save, X, Palette, Home, Settings, Video, Sparkles } from 'lucide-react'
import { heroService, HeroContent, HeroBackground, DesignSettings } from '../services/hero.service'
import { themeService, themePresets, ThemeConfig } from '../services/theme.service'
import { useAuthStore } from '../store/authStore'

interface HeroManagementProps {
  onClose: () => void
}

type TabType = 'hero' | 'theme' | 'design'

const defaultDesignSettings: DesignSettings = {
  buttonSize: 'medium',
  buttonRoundness: 8,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 16,
  spacing: 1,
  cardRoundness: 12,
  cardPadding: 24,
  borderWidth: 1,
  animations: {
    speed: 'normal',
    hoverScale: 1.05,
    hoverEnabled: true,
    transitionType: 'ease-in-out',
    pageTransitions: true,
    scrollAnimations: true
  }
}

export const HeroManagement = ({ onClose }: HeroManagementProps) => {
  const { accessToken } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabType>('hero')
  const [hero, setHero] = useState<HeroContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Hero settings
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoSize, setLogoSize] = useState<number>(160)
  const [navbarLogoFile, setNavbarLogoFile] = useState<File | null>(null)
  const [navbarLogoPreview, setNavbarLogoPreview] = useState<string | null>(null)
  const [navbarTitle, setNavbarTitle] = useState('')
  const [heroHeight, setHeroHeight] = useState<number>(70)
  const [heroWidth, setHeroWidth] = useState<'full' | 'contained'>('full')
  const [heroBackground, setHeroBackground] = useState<HeroBackground>({
    type: 'gradient',
    value: 'linear-gradient(to bottom right, rgba(245, 158, 11, 0.2), rgba(3, 7, 18, 1))'
  })
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null)
  
  // Theme state
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(themePresets[0])
  const [selectedPreset, setSelectedPreset] = useState<string>('default')
  
  // Design settings
  const [designSettings, setDesignSettings] = useState<DesignSettings>(defaultDesignSettings)

  useEffect(() => {
    loadHeroContent()
    loadTheme()
  }, [])

  const loadHeroContent = async () => {
    try {
      const content = await heroService.getHeroContent()
      setHero(content)
      setTitle(content.title)
      setSubtitle(content.subtitle)
      setLogoPreview(content.logoUrl || null)
      setLogoSize(typeof content.logoSize === 'number' ? content.logoSize : 160)
      setNavbarLogoPreview(content.navbarLogoUrl || null)
      setNavbarTitle(content.navbarTitle || 'Your Brand')
      setHeroHeight(content.heroHeight || 70)
      setHeroWidth(content.heroWidth || 'full')
      if (content.heroBackground) {
        setHeroBackground({
          type: content.heroBackground.type,
          value: content.heroBackground.value || '',
          imageKey: content.heroBackground.imageKey,
          videoKey: content.heroBackground.videoKey
        })
      }
      if (content.designSettings) {
        setDesignSettings(content.designSettings)
      }
      
      // Load theme from hero content
      if (content.themeId && content.themeColors) {
        const theme = {
          themeId: content.themeId,
          name: content.themeName || 'Custom Theme',
          colors: content.themeColors
        }
        setCurrentTheme(theme)
        setSelectedPreset(content.themeId)
      }
    } catch (error) {
      console.error('Failed to load hero content:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTheme = async () => {
    try {
      const theme = await themeService.getTheme()
      setCurrentTheme(theme)
      setSelectedPreset(theme.themeId)
    } catch (error) {
      console.error('Failed to load theme:', error)
    }
  }

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
  }

  const handleNavbarLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setNavbarLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setNavbarLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveNavbarLogo = () => {
    setNavbarLogoFile(null)
    setNavbarLogoPreview(null)
  }

  const handleBackgroundFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setBackgroundFile(file)
      const isVideo = file.type.startsWith('video/')
      
      // Create preview URL for display only
      const reader = new FileReader()
      reader.onloadend = () => {
        setHeroBackground({
          ...heroBackground,
          type: isVideo ? 'video' : 'image',
          value: reader.result as string // This is just for preview
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    if (!accessToken) return

    setSaving(true)
    try {
      let logoKey = hero?.logoKey
      let navbarLogoKey = hero?.navbarLogoKey

      // Upload new hero logo if selected
      if (logoFile) {
        const { logoKey: newLogoKey } = await heroService.uploadLogo(logoFile, accessToken, 'hero')
        logoKey = newLogoKey
      } else if (!logoPreview && hero?.logoKey) {
        await heroService.deleteLogo(accessToken, 'hero')
        logoKey = null
      }

      // Upload new navbar logo if selected
      if (navbarLogoFile) {
        const { logoKey: newNavbarLogoKey } = await heroService.uploadLogo(navbarLogoFile, accessToken, 'navbar')
        navbarLogoKey = newNavbarLogoKey
      } else if (!navbarLogoPreview && hero?.navbarLogoKey) {
        await heroService.deleteLogo(accessToken, 'navbar')
        navbarLogoKey = null
      }

      // Upload background file if selected
      let updatedBackground = { ...heroBackground }
      if (backgroundFile) {
        const isVideo = backgroundFile.type.startsWith('video/')
        const { key, url } = await heroService.uploadBackground(backgroundFile, accessToken, isVideo ? 'video' : 'image')
        
        updatedBackground = {
          type: isVideo ? 'video' : 'image',
          value: url, // Use the CDN URL instead of base64
          imageKey: isVideo ? undefined : key,
          videoKey: isVideo ? key : undefined
        }
      }

      // Update hero content with all settings
      await heroService.updateHeroContent({
        logoKey: logoKey || null,
        title: title || 'Your Brand',
        subtitle: subtitle || '',
        logoSize: logoSize,
        navbarLogoKey: navbarLogoKey || null,
        navbarTitle: navbarTitle || 'Your Brand',
        heroHeight: heroHeight,
        heroWidth: heroWidth,
        heroBackground: updatedBackground,
        // Theme data
        themeId: currentTheme.themeId,
        themeName: currentTheme.name,
        themeColors: currentTheme.colors,
        // Design settings
        designSettings: designSettings
      }, accessToken)

      // Apply theme and design immediately
      themeService.applyTheme(currentTheme.colors, designSettings)

      alert(activeTab === 'hero' 
        ? 'Hero-Bereich erfolgreich aktualisiert!' 
        : activeTab === 'theme'
        ? 'Theme erfolgreich gespeichert!'
        : 'Design-Einstellungen erfolgreich gespeichert!')
      
      onClose()
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handlePresetSelect = (presetId: string) => {
    const preset = themePresets.find(p => p.themeId === presetId)
    if (preset) {
      setCurrentTheme(preset)
      setSelectedPreset(presetId)
      // Live preview
      themeService.applyTheme(preset.colors, designSettings)
    }
  }

  const handleColorChange = (key: keyof typeof currentTheme.colors, value: string) => {
    const newTheme = {
      ...currentTheme,
      colors: {
        ...currentTheme.colors,
        [key]: value
      }
    }
    setCurrentTheme(newTheme)
    // Live preview
    themeService.applyTheme(newTheme.colors, designSettings)
  }

  const handleDesignChange = (key: keyof DesignSettings, value: any) => {
    const newSettings = {
      ...designSettings,
      [key]: value
    }
    setDesignSettings(newSettings)
    // Live preview
    themeService.applyTheme(currentTheme.colors, newSettings)
  }

  const handleAnimationChange = (key: keyof DesignSettings['animations'], value: any) => {
    const newSettings = {
      ...designSettings,
      animations: {
        ...designSettings.animations,
        [key]: value
      }
    }
    setDesignSettings(newSettings)
    // Live preview
    themeService.applyTheme(currentTheme.colors, newSettings)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-dark-900 rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-dark-800 flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl font-bold">Einstellungen</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-dark-800 flex-shrink-0">
          <div className="flex">
            <button
              onClick={() => setActiveTab('hero')}
              className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'hero'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <Home size={20} />
              Hero-Bereich
            </button>
            <button
              onClick={() => setActiveTab('theme')}
              className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'theme'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <Palette size={20} />
              Farben
            </button>
            <button
              onClick={() => setActiveTab('design')}
              className={`flex-1 px-6 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'design'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <Settings size={20} />
              Design & Animationen
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {activeTab === 'hero' ? (
            <>
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Image size={16} className="inline mr-2" />
                  Logo (empfohlen: 200x200px, transparent)
                </label>
                
                {logoPreview ? (
                  <div className="relative inline-block">
                    <div className="w-48 h-48 bg-dark-800 rounded-lg flex items-center justify-center p-4">
                      <img 
                        src={logoPreview} 
                        alt="Logo Preview" 
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <button
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 p-2 bg-red-600 hover:bg-red-700 rounded-full"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="block w-48 h-48 border-2 border-dashed border-dark-700 rounded-lg hover:border-primary-500 cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="hidden"
                    />
                    <div className="h-full flex flex-col items-center justify-center text-dark-400">
                      <Upload size={48} className="mb-2" />
                      <p className="text-sm">Logo hochladen</p>
                      <p className="text-xs">PNG, SVG bis 2MB</p>
                    </div>
                  </label>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Type size={16} className="inline mr-2" />
                  Titel
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Your Brand"
                  className="input w-full text-2xl font-bold"
                  maxLength={50}
                />
                <p className="text-sm text-dark-400 mt-1">
                  {title.length}/50 Zeichen
                </p>
              </div>

              {/* Subtitle with line breaks */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Type size={16} className="inline mr-2" />
                  Untertitel (Zeilenumbrüche mit Enter)
                </label>
                <textarea
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Deine moderne Creator-Plattform..."
                  className="input w-full h-32 resize-none"
                  maxLength={500}
                />
                <p className="text-sm text-dark-400 mt-1">
                  {subtitle.length}/500 Zeichen
                </p>
              </div>

              {/* Logo Size */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Logo-Größe: {logoSize}px
                </label>
                <input
                  type="range"
                  min="50"
                  max="800"
                  value={logoSize}
                  onChange={(e) => setLogoSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-dark-400 mt-1">
                  <span>50px</span>
                  <span>800px</span>
                </div>
              </div>

              {/* Hero Height */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Hero-Höhe: {heroHeight}vh
                </label>
                <input
                  type="range"
                  min="40"
                  max="100"
                  value={heroHeight}
                  onChange={(e) => setHeroHeight(parseInt(e.target.value))}
                  className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-dark-400 mt-1">
                  <span>40vh</span>
                  <span>100vh</span>
                </div>
              </div>

              {/* Hero Width */}
              <div>
                <label className="block text-sm font-medium mb-2">Hero-Breite</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setHeroWidth('full')}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                      heroWidth === 'full'
                        ? 'border-primary-500 bg-primary-500/20'
                        : 'border-dark-700 hover:border-dark-600'
                    }`}
                  >
                    Volle Breite
                  </button>
                  <button
                    onClick={() => setHeroWidth('contained')}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                      heroWidth === 'contained'
                        ? 'border-primary-500 bg-primary-500/20'
                        : 'border-dark-700 hover:border-dark-600'
                    }`}
                  >
                    Container
                  </button>
                </div>
              </div>

              {/* Hero Background */}
              <div className="border-t border-dark-800 pt-6">
                <h3 className="text-lg font-semibold mb-4">Hintergrund</h3>
                
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setHeroBackground({ ...heroBackground, type: 'color' })}
                    className={`px-4 py-2 rounded-lg ${
                      heroBackground.type === 'color' ? 'bg-primary-600' : 'bg-dark-800'
                    }`}
                  >
                    Farbe
                  </button>
                  <button
                    onClick={() => setHeroBackground({ ...heroBackground, type: 'gradient' })}
                    className={`px-4 py-2 rounded-lg ${
                      heroBackground.type === 'gradient' ? 'bg-primary-600' : 'bg-dark-800'
                    }`}
                  >
                    Verlauf
                  </button>
                  <button
                    onClick={() => setHeroBackground({ ...heroBackground, type: 'image' })}
                    className={`px-4 py-2 rounded-lg ${
                      heroBackground.type === 'image' ? 'bg-primary-600' : 'bg-dark-800'
                    }`}
                  >
                    <Image size={16} className="inline mr-1" />
                    Bild
                  </button>
                  <button
                    onClick={() => setHeroBackground({ ...heroBackground, type: 'video' })}
                    className={`px-4 py-2 rounded-lg ${
                      heroBackground.type === 'video' ? 'bg-primary-600' : 'bg-dark-800'
                    }`}
                  >
                    <Video size={16} className="inline mr-1" />
                    Video
                  </button>
                </div>

                {heroBackground.type === 'color' && (
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={heroBackground.value}
                      onChange={(e) => setHeroBackground({ ...heroBackground, value: e.target.value })}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={heroBackground.value}
                      onChange={(e) => setHeroBackground({ ...heroBackground, value: e.target.value })}
                      className="input flex-1"
                      placeholder="#030712"
                    />
                  </div>
                )}

                {heroBackground.type === 'gradient' && (
                  <textarea
                    value={heroBackground.value}
                    onChange={(e) => setHeroBackground({ ...heroBackground, value: e.target.value })}
                    className="input w-full h-20 resize-none font-mono text-sm"
                    placeholder="linear-gradient(to bottom right, rgba(245, 158, 11, 0.2), rgba(3, 7, 18, 1))"
                  />
                )}

                {(heroBackground.type === 'image' || heroBackground.type === 'video') && (
                  <div>
                    {heroBackground.value && (heroBackground.imageKey || heroBackground.videoKey || backgroundFile) ? (
                      <div className="relative">
                        {heroBackground.type === 'video' ? (
                          <video 
                            src={heroBackground.value} 
                            className="w-full h-48 object-cover rounded-lg"
                            controls
                          />
                        ) : (
                          <img 
                            src={heroBackground.value} 
                            alt="Background Preview" 
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        )}
                        <button
                          onClick={() => {
                            setBackgroundFile(null)
                            setHeroBackground({
                              ...heroBackground,
                              value: '',
                              imageKey: undefined,
                              videoKey: undefined
                            })
                          }}
                          className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-full"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="block w-full h-32 border-2 border-dashed border-dark-700 rounded-lg hover:border-primary-500 cursor-pointer transition-colors">
                        <input
                          type="file"
                          accept={heroBackground.type === 'video' ? 'video/*' : 'image/*'}
                          onChange={handleBackgroundFileSelect}
                          className="hidden"
                        />
                        <div className="h-full flex flex-col items-center justify-center text-dark-400">
                          {heroBackground.type === 'video' ? <Video size={48} /> : <Image size={48} />}
                          <p className="text-sm mt-2">
                            {heroBackground.type === 'video' ? 'Video hochladen' : 'Bild hochladen'}
                          </p>
                          <p className="text-xs mt-1">Max. 10MB</p>
                        </div>
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Navbar Section */}
              <div className="border-t border-dark-800 pt-6">
                <h3 className="text-lg font-semibold mb-4">Navbar-Einstellungen</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    <Image size={16} className="inline mr-2" />
                    Navbar Logo (empfohlen: 40x40px)
                  </label>
                  
                  {navbarLogoPreview ? (
                    <div className="relative inline-block">
                      <div className="w-20 h-20 bg-dark-800 rounded-lg flex items-center justify-center p-2">
                        <img 
                          src={navbarLogoPreview} 
                          alt="Navbar Logo Preview" 
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <button
                        onClick={handleRemoveNavbarLogo}
                        className="absolute -top-2 -right-2 p-2 bg-red-600 hover:bg-red-700 rounded-full"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="block w-20 h-20 border-2 border-dashed border-dark-700 rounded-lg hover:border-primary-500 cursor-pointer transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleNavbarLogoSelect}
                        className="hidden"
                      />
                      <div className="h-full flex flex-col items-center justify-center text-dark-400">
                        <Upload size={24} className="mb-1" />
                        <p className="text-xs">Logo</p>
                      </div>
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Type size={16} className="inline mr-2" />
                    Navbar Titel
                  </label>
                  <input
                    type="text"
                    value={navbarTitle}
                    onChange={(e) => setNavbarTitle(e.target.value)}
                    placeholder="Your Brand"
                    className="input w-full"
                    maxLength={30}
                  />
                  <p className="text-sm text-dark-400 mt-1">
                    {navbarTitle.length}/30 Zeichen
                  </p>
                </div>
              </div>
            </>
          ) : activeTab === 'theme' ? (
            <>
              {/* Theme Presets */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Theme Presets</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {themePresets.map((preset) => (
                    <button
                      key={preset.themeId}
                      onClick={() => handlePresetSelect(preset.themeId)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedPreset === preset.themeId
                          ? 'border-primary-500 bg-primary-500/20'
                          : 'border-dark-700 hover:border-dark-600'
                      }`}
                    >
                      <div className="flex gap-2 mb-2">
                        <div 
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: preset.colors.primary }}
                        />
                        <div 
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: preset.colors.secondary }}
                        />
                        <div 
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: preset.colors.accent }}
                        />
                      </div>
                      <p className="text-sm font-medium">{preset.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Colors */}
              <div className="border-t border-dark-800 pt-6">
                <h3 className="text-lg font-semibold mb-4">Farben anpassen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(currentTheme.colors).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium mb-2 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={value}
                          onChange={(e) => handleColorChange(key as any, e.target.value)}
                          className="w-12 h-10 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => handleColorChange(key as any, e.target.value)}
                          className="input flex-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="border-t border-dark-800 pt-6">
                <h3 className="text-lg font-semibold mb-4">Vorschau</h3>
                <div className="space-y-4">
                  <div className="p-6 rounded-lg" style={{ backgroundColor: currentTheme.colors.background }}>
                    <button 
                      className="px-6 py-3 rounded-lg font-semibold transition-all"
                      style={{ 
                        backgroundColor: currentTheme.colors.primary,
                        color: currentTheme.colors.text 
                      }}
                    >
                      Primär Button
                    </button>
                    <button 
                      className="ml-3 px-6 py-3 rounded-lg font-semibold border transition-all"
                      style={{ 
                        backgroundColor: currentTheme.colors.secondary,
                        borderColor: currentTheme.colors.border,
                        color: currentTheme.colors.text 
                      }}
                    >
                      Sekundär Button
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Button Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Button-Einstellungen</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Button-Größe</label>
                    <div className="flex gap-3">
                      {(['small', 'medium', 'large'] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => handleDesignChange('buttonSize', size)}
                          className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                            designSettings.buttonSize === size
                              ? 'border-primary-500 bg-primary-500/20'
                              : 'border-dark-700 hover:border-dark-600'
                          }`}
                        >
                          {size === 'small' ? 'Klein' : size === 'medium' ? 'Mittel' : 'Groß'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Rundung: {designSettings.buttonRoundness}px
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={designSettings.buttonRoundness}
                      onChange={(e) => handleDesignChange('buttonRoundness', parseInt(e.target.value))}
                      className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>
                </div>
              </div>

              {/* Typography */}
              <div className="border-t border-dark-800 pt-6">
                <h3 className="text-lg font-semibold mb-4">Typografie</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Schriftart</label>
                    <select
                      value={designSettings.fontFamily}
                      onChange={(e) => handleDesignChange('fontFamily', e.target.value)}
                      className="input w-full"
                    >
                      <option value="system-ui, -apple-system, sans-serif">System (Standard)</option>
                      <option value="'Inter', sans-serif">Inter</option>
                      <option value="'Roboto', sans-serif">Roboto</option>
                      <option value="'Open Sans', sans-serif">Open Sans</option>
                      <option value="'Montserrat', sans-serif">Montserrat</option>
                      <option value="'Poppins', sans-serif">Poppins</option>
                      <option value="Georgia, serif">Georgia (Serif)</option>
                      <option value="'Courier New', monospace">Courier (Mono)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Basis-Schriftgröße: {designSettings.fontSize}px
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="20"
                      value={designSettings.fontSize}
                      onChange={(e) => handleDesignChange('fontSize', parseInt(e.target.value))}
                      className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>
                </div>
              </div>

              {/* Card Settings */}
              <div className="border-t border-dark-800 pt-6">
                <h3 className="text-lg font-semibold mb-4">Karten-Einstellungen</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Rundung: {designSettings.cardRoundness}px
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={designSettings.cardRoundness}
                      onChange={(e) => handleDesignChange('cardRoundness', parseInt(e.target.value))}
                      className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Innenabstand: {designSettings.cardPadding}px
                    </label>
                    <input
                      type="range"
                      min="16"
                      max="48"
                      value={designSettings.cardPadding}
                      onChange={(e) => handleDesignChange('cardPadding', parseInt(e.target.value))}
                      className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>
                </div>
              </div>

              {/* Spacing & Borders */}
              <div className="border-t border-dark-800 pt-6">
                <h3 className="text-lg font-semibold mb-4">Abstände & Rahmen</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Abstands-Multiplikator: {designSettings.spacing}x
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={designSettings.spacing}
                      onChange={(e) => handleDesignChange('spacing', parseFloat(e.target.value))}
                      className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Rahmenbreite: {designSettings.borderWidth}px
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      value={designSettings.borderWidth}
                      onChange={(e) => handleDesignChange('borderWidth', parseInt(e.target.value))}
                      className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>
                </div>
              </div>

              {/* Animations */}
              <div className="border-t border-dark-800 pt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles size={20} />
                  Animationen
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Animations-Geschwindigkeit</label>
                    <div className="flex gap-3">
                      {(['slow', 'normal', 'fast'] as const).map((speed) => (
                        <button
                          key={speed}
                          onClick={() => handleAnimationChange('speed', speed)}
                          className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                            designSettings.animations.speed === speed
                              ? 'border-primary-500 bg-primary-500/20'
                              : 'border-dark-700 hover:border-dark-600'
                          }`}
                        >
                          {speed === 'slow' ? 'Langsam' : speed === 'normal' ? 'Normal' : 'Schnell'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Übergangstyp</label>
                    <select
                      value={designSettings.animations.transitionType}
                      onChange={(e) => handleAnimationChange('transitionType', e.target.value)}
                      className="input w-full"
                    >
                      <option value="ease">Ease</option>
                      <option value="ease-in">Ease In</option>
                      <option value="ease-out">Ease Out</option>
                      <option value="ease-in-out">Ease In-Out</option>
                      <option value="linear">Linear</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={designSettings.animations.hoverEnabled}
                        onChange={(e) => handleAnimationChange('hoverEnabled', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">Hover-Effekte aktivieren</span>
                    </label>
                  </div>

                  {designSettings.animations.hoverEnabled && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Hover-Skalierung: {designSettings.animations.hoverScale}x
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="1.2"
                        step="0.01"
                        value={designSettings.animations.hoverScale}
                        onChange={(e) => handleAnimationChange('hoverScale', parseFloat(e.target.value))}
                        className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                  )}

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={designSettings.animations.pageTransitions}
                        onChange={(e) => handleAnimationChange('pageTransitions', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">Seiten-Übergänge</span>
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={designSettings.animations.scrollAnimations}
                        onChange={(e) => handleAnimationChange('scrollAnimations', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">Scroll-Animationen</span>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-dark-800 flex gap-3 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
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
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-secondary flex-1"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
