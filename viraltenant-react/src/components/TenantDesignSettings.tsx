import { useState, useEffect } from 'react'
import { Save, Palette, Sparkles, Type, Layout, Upload, Trash2, Navigation } from 'lucide-react'
import { heroService, DesignSettings, ThemeColors } from '../services/hero.service'
import { themeService, themePresets, ThemeConfig } from '../services/theme.service'
import { useAuthStore } from '../store/authStore'
import { useTenant } from '../providers/TenantProvider'
import { toast } from '../utils/toast-alert'

// Helper function to determine if a color is light
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

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

export function TenantDesignSettings() {
  const { accessToken } = useAuthStore()
  const { tenantId } = useTenant()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Theme state
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(themePresets[0])
  const [selectedPreset, setSelectedPreset] = useState<string>('default')
  
  // Design settings
  const [designSettings, setDesignSettings] = useState<DesignSettings>(defaultDesignSettings)
  
  // Navbar settings
  const [navbarLogoFile, setNavbarLogoFile] = useState<File | null>(null)
  const [navbarLogoPreview, setNavbarLogoPreview] = useState<string | null>(null)
  const [navbarTitle, setNavbarTitle] = useState('')
  const [existingNavbarLogoKey, setExistingNavbarLogoKey] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const content = await heroService.getHeroContent(tenantId)
      
      if (content.designSettings) {
        setDesignSettings(content.designSettings)
      }
      
      // Load navbar settings
      setNavbarLogoPreview(content.navbarLogoUrl || null)
      setNavbarTitle(content.navbarTitle || '')
      setExistingNavbarLogoKey(content.navbarLogoKey || null)
      
      // Load theme
      if (content.themeId && content.themeColors) {
        const theme: ThemeConfig = {
          themeId: content.themeId,
          name: content.themeId,
          colors: content.themeColors
        }
        setCurrentTheme(theme)
        setSelectedPreset(content.themeId)
      }
    } catch (error) {
      console.error('Error loading design settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDesign = async () => {
    if (!accessToken) return
    
    setSaving(true)
    
    try {
      let navbarLogoKey = existingNavbarLogoKey
      
      // Upload new navbar logo if selected
      if (navbarLogoFile) {
        const { logoKey: newNavbarLogoKey } = await heroService.uploadLogo(navbarLogoFile, accessToken, 'navbar', tenantId)
        navbarLogoKey = newNavbarLogoKey
      } else if (!navbarLogoPreview && existingNavbarLogoKey) {
        // Delete navbar logo if removed
        await heroService.deleteLogo(accessToken, 'navbar', tenantId)
        navbarLogoKey = null
      }
      
      await heroService.updateHeroContent({
        designSettings,
        themeId: currentTheme.themeId,
        themeColors: currentTheme.colors,
        navbarLogoKey: navbarLogoKey || null,
        navbarTitle: navbarTitle || 'Your Brand'
      }, accessToken, tenantId)
      
      // Update existing key reference
      setExistingNavbarLogoKey(navbarLogoKey)
      setNavbarLogoFile(null)
      
      // Apply theme
      themeService.applyTheme(currentTheme.colors, designSettings)
      
      toast.success('Design-Einstellungen erfolgreich gespeichert')
    } catch (error) {
      console.error('Error saving design settings:', error)
      toast.error('Fehler beim Speichern der Einstellungen')
    } finally {
      setSaving(false)
    }
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

  const handlePresetSelect = (presetId: string) => {
    const preset = themePresets.find(p => p.themeId === presetId)
    if (preset) {
      setCurrentTheme(preset)
      setSelectedPreset(presetId)
      // Live preview
      themeService.applyTheme(preset.colors, designSettings)
    }
  }

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    const newTheme = {
      ...currentTheme,
      themeId: 'custom',
      name: 'Benutzerdefiniert',
      colors: {
        ...currentTheme.colors,
        [key]: value
      }
    }
    setCurrentTheme(newTheme)
    setSelectedPreset('custom')
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  // Determine if we need dark text based on background color
  const isLightTheme = isLightColor(currentTheme.colors.cardBackground || currentTheme.colors.background)
  const labelColor = isLightTheme ? '#1f2937' : undefined // dark gray for light themes, undefined uses default
  const labelStyle = isLightTheme ? { color: labelColor } : {}
  const subLabelStyle = isLightTheme ? { color: '#4b5563' } : {} // slightly lighter for secondary text

  return (
    <div className="space-y-6">
      {/* Theme Presets */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={labelStyle}>
          <Palette size={20} className="text-primary-500" />
          Theme Presets
        </h2>
        
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
          {themePresets.map((preset) => (
            <button
              key={preset.themeId}
              onClick={() => handlePresetSelect(preset.themeId)}
              title={preset.name}
              className={`p-2 rounded-lg border-2 ${
                selectedPreset === preset.themeId
                  ? 'border-primary-500 ring-2 ring-primary-500/50'
                  : 'border-dark-700 hover:border-dark-500'
              }`}
              style={{ backgroundColor: preset.colors.background }}
            >
              <div className="flex gap-1 mb-1 justify-center">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: preset.colors.primary }} />
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: preset.colors.secondary }} />
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: preset.colors.accent }} />
              </div>
              <p className="text-[10px] font-medium truncate text-center" style={{ color: preset.colors.text }}>{preset.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Navbar Settings */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={labelStyle}>
          <Navigation size={20} className="text-primary-500" />
          Navbar-Einstellungen
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Navbar Logo */}
          <div>
            <label className="block text-sm font-medium mb-2" style={labelStyle}>
              Navbar Logo (empfohlen: 40x40px)
            </label>
            
            {navbarLogoPreview ? (
              <div className="relative inline-block">
                <div className="w-16 h-16 bg-transparent rounded-lg flex items-center justify-center p-2 border border-dark-700">
                  <img 
                    src={navbarLogoPreview} 
                    alt="Navbar Logo Preview" 
                    className="max-w-full max-h-full object-contain bg-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRemoveNavbarLogo}
                  className="absolute -top-2 -right-2 p-1.5 bg-red-600 hover:bg-red-700 rounded-full"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <label className="block w-16 h-16 border-2 border-dashed border-dark-700 rounded-lg hover:border-primary-500 cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleNavbarLogoSelect}
                  className="hidden"
                />
                <div className="h-full flex flex-col items-center justify-center text-dark-400">
                  <Upload size={20} className="mb-1" />
                  <p className="text-[10px]">Logo</p>
                </div>
              </label>
            )}
          </div>

          {/* Navbar Title */}
          <div>
            <label className="block text-sm font-medium mb-2" style={labelStyle}>
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
            <p className="text-xs text-dark-400 mt-1">
              {navbarTitle.length}/30 Zeichen
            </p>
          </div>
        </div>
      </div>

      {/* Custom Colors */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={labelStyle}>
          <Palette size={20} className="text-primary-500" />
          Farben anpassen
        </h2>
        
        {/* Main Colors */}
        <div className="mb-5">
          <h4 className="text-sm font-medium mb-3" style={subLabelStyle}>Hauptfarben</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {(['primary', 'primaryHover', 'secondary', 'secondaryHover', 'accent', 'glowColor'] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 bg-dark-800 rounded-lg p-2 cursor-pointer hover:bg-dark-700 transition-colors">
                <input
                  type="color"
                  value={currentTheme.colors[key]}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer flex-shrink-0 border border-dark-600"
                />
                <span className="text-xs truncate" style={labelStyle}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Background Colors */}
        <div className="mb-5">
          <h4 className="text-sm font-medium mb-3" style={subLabelStyle}>Hintergrund</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {(['background', 'backgroundLight', 'cardBackground', 'navbarBackground', 'inputBackground'] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 bg-dark-800 rounded-lg p-2 cursor-pointer hover:bg-dark-700 transition-colors">
                <input
                  type="color"
                  value={currentTheme.colors[key]}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer flex-shrink-0 border border-dark-600"
                />
                <span className="text-xs truncate" style={labelStyle}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Text Colors */}
        <div className="mb-5">
          <h4 className="text-sm font-medium mb-3" style={subLabelStyle}>Text & Navbar</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {(['text', 'textSecondary', 'textMuted', 'inputText', 'inputPlaceholder', 'navbarActive'] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 bg-dark-800 rounded-lg p-2 cursor-pointer hover:bg-dark-700 transition-colors">
                <input
                  type="color"
                  value={currentTheme.colors[key] || '#ffffff'}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer flex-shrink-0 border border-dark-600"
                />
                <span className="text-xs truncate" style={labelStyle}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Status & Border Colors */}
        <div>
          <h4 className="text-sm font-medium mb-3" style={subLabelStyle}>Status & Rahmen</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {(['border', 'success', 'warning', 'error', 'info'] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 bg-dark-800 rounded-lg p-2 cursor-pointer hover:bg-dark-700 transition-colors">
                <input
                  type="color"
                  value={currentTheme.colors[key]}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer flex-shrink-0 border border-dark-600"
                />
                <span className="text-xs truncate" style={labelStyle}>{key}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Typography & Layout */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={labelStyle}>
          <Type size={20} className="text-primary-500" />
          Typografie & Layout
        </h2>
        
        <div className="grid md:grid-cols-2 gap-4">
          {/* Font Family */}
          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>Schriftart</label>
            <select
              value={designSettings.fontFamily}
              onChange={(e) => handleDesignChange('fontFamily', e.target.value)}
              className="input w-full text-sm"
            >
              <optgroup label="Standard">
                <option value="system-ui, -apple-system, sans-serif">System (Standard)</option>
              </optgroup>
              <optgroup label="Modern & Geometrisch">
                <option value="'Poppins', sans-serif">Poppins – geometrisch, modern</option>
                <option value="'Outfit', sans-serif">Outfit – clean, minimalistisch</option>
                <option value="'Space Grotesk', sans-serif">Space Grotesk – futuristisch, tech</option>
                <option value="'Montserrat', sans-serif">Montserrat – elegant, geometrisch</option>
                <option value="'Raleway', sans-serif">Raleway – dünn, stylisch</option>
                <option value="'Oswald', sans-serif">Oswald – kondensiert, stark</option>
              </optgroup>
              <optgroup label="Klassisch & Elegant (Serif)">
                <option value="'Playfair Display', serif">Playfair Display – elegant, editorial</option>
                <option value="'Cormorant Garamond', serif">Cormorant Garamond – klassisch, edel</option>
                <option value="'Libre Baskerville', serif">Libre Baskerville – traditionell, lesbar</option>
                <option value="'Merriweather', serif">Merriweather – warm, lesbar</option>
              </optgroup>
              <optgroup label="Freundlich & Rund">
                <option value="'Nunito', sans-serif">Nunito – weich, freundlich</option>
                <option value="'Quicksand', sans-serif">Quicksand – rund, verspielt</option>
                <option value="'Comfortaa', sans-serif">Comfortaa – sehr rund, modern</option>
              </optgroup>
              <optgroup label="Professionell & Neutral">
                <option value="'Inter', sans-serif">Inter – neutral, UI-optimiert</option>
                <option value="'Roboto', sans-serif">Roboto – Google-Standard, vielseitig</option>
                <option value="'Open Sans', sans-serif">Open Sans – offen, freundlich</option>
                <option value="'Source Sans 3', sans-serif">Source Sans 3 – Adobe, professionell</option>
                <option value="'Work Sans', sans-serif">Work Sans – clean, business</option>
                <option value="'Lato', sans-serif">Lato – warm, professionell</option>
              </optgroup>
            </select>
            {/* Font Preview */}
            <div 
              className="mt-3 p-4 bg-dark-800 rounded-lg border border-dark-700"
              style={{ fontFamily: designSettings.fontFamily }}
            >
              <p className="text-lg font-bold mb-1" style={labelStyle}>Vorschau: Überschrift</p>
              <p className="text-sm" style={subLabelStyle}>Dies ist ein Beispieltext in der gewählten Schriftart. ABCDEFG abcdefg 123456</p>
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>
              Schriftgröße: {designSettings.fontSize}px
            </label>
            <input
              type="range"
              min="8"
              max="24"
              step="1"
              value={designSettings.fontSize}
              onChange={(e) => handleDesignChange('fontSize', parseInt(e.target.value))}
              className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Button Size */}
          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>Button-Größe</label>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => handleDesignChange('buttonSize', size)}
                  className={`flex-1 py-1.5 px-2 rounded text-xs border-2 transition-colors ${
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

          {/* Spacing */}
          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>
              Abstände: {designSettings.spacing}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={designSettings.spacing}
              onChange={(e) => handleDesignChange('spacing', parseFloat(e.target.value))}
              className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Borders & Roundness */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={labelStyle}>
          <Layout size={20} className="text-primary-500" />
          Rahmen & Rundungen
        </h2>
        
        <div className="grid md:grid-cols-2 gap-4">
          {/* Button Roundness */}
          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>
              Button-Rundung: {designSettings.buttonRoundness}px
            </label>
            <input
              type="range"
              min="0"
              max="50"
              step="2"
              value={designSettings.buttonRoundness}
              onChange={(e) => handleDesignChange('buttonRoundness', parseInt(e.target.value))}
              className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Card Roundness */}
          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>
              Karten-Rundung: {designSettings.cardRoundness}px
            </label>
            <input
              type="range"
              min="0"
              max="50"
              step="2"
              value={designSettings.cardRoundness}
              onChange={(e) => handleDesignChange('cardRoundness', parseInt(e.target.value))}
              className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Card Padding */}
          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>
              Karten-Innenabstand: {designSettings.cardPadding}px
            </label>
            <input
              type="range"
              min="16"
              max="48"
              step="4"
              value={designSettings.cardPadding}
              onChange={(e) => handleDesignChange('cardPadding', parseInt(e.target.value))}
              className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Border Width */}
          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>
              Rahmenbreite: {designSettings.borderWidth}px
            </label>
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={designSettings.borderWidth}
              onChange={(e) => handleDesignChange('borderWidth', parseInt(e.target.value))}
              className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Animations */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={labelStyle}>
          <Sparkles size={20} className="text-primary-500" />
          Animationen
        </h2>
        
        <div className="space-y-4">
          {/* Animation Speed */}
          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>Animations-Geschwindigkeit</label>
            <div className="flex gap-2">
              {(['slow', 'normal', 'fast'] as const).map((speed) => (
                <button
                  key={speed}
                  onClick={() => handleAnimationChange('speed', speed)}
                  className={`flex-1 py-1.5 px-2 rounded text-xs border-2 transition-colors ${
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

          <div className="grid md:grid-cols-2 gap-4">
            {/* Transition Type */}
            <div>
              <label className="block text-sm font-medium mb-1" style={labelStyle}>Übergangstyp</label>
              <select
                value={designSettings.animations.transitionType}
                onChange={(e) => handleAnimationChange('transitionType', e.target.value)}
                className="input w-full text-sm"
              >
                <option value="ease">Ease</option>
                <option value="ease-in">Ease In</option>
                <option value="ease-out">Ease Out</option>
                <option value="ease-in-out">Ease In-Out</option>
                <option value="linear">Linear</option>
              </select>
            </div>

            {/* Hover Scale */}
            {designSettings.animations.hoverEnabled && (
              <div>
                <label className="block text-sm font-medium mb-1" style={labelStyle}>
                  Hover-Skalierung: {designSettings.animations.hoverScale}x
                </label>
                <input
                  type="range"
                  min="1"
                  max="1.2"
                  step="0.01"
                  value={designSettings.animations.hoverScale}
                  onChange={(e) => handleAnimationChange('hoverScale', parseFloat(e.target.value))}
                  className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={designSettings.animations.hoverEnabled}
                onChange={(e) => handleAnimationChange('hoverEnabled', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm" style={labelStyle}>Hover-Effekte</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={designSettings.animations.pageTransitions}
                onChange={(e) => handleAnimationChange('pageTransitions', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm" style={labelStyle}>Seitenübergänge</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={designSettings.animations.scrollAnimations}
                onChange={(e) => handleAnimationChange('scrollAnimations', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm" style={labelStyle}>Scroll-Animationen</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={designSettings.animations.backgroundAnimations !== false}
                onChange={(e) => handleAnimationChange('backgroundAnimations', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm" style={labelStyle}>Hintergrund-Animationen</span>
            </label>
          </div>

          {/* Background Animation Type */}
          {designSettings.animations.backgroundAnimations !== false && (
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2" style={labelStyle}>Animations-Stil</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {([
                  { id: 'subtle', name: 'Subtil', desc: 'Sanft schwebend' },
                  { id: 'elegant', name: 'Elegant', desc: 'Fließend & edel' },
                  { id: 'dynamic', name: 'Dynamisch', desc: 'Lebhaft & aktiv' },
                  { id: 'minimal', name: 'Minimal', desc: 'Kaum sichtbar' }
                ] as const).map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleAnimationChange('backgroundAnimationType', type.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      (designSettings.animations.backgroundAnimationType || 'elegant') === type.id
                        ? 'border-primary-500 bg-primary-500/20'
                        : 'border-dark-700 hover:border-dark-600'
                    }`}
                  >
                    <p className="font-medium text-sm" style={labelStyle}>{type.name}</p>
                    <p className="text-xs text-dark-400">{type.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveDesign}
          disabled={saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Speichere...
            </>
          ) : (
            <>
              <Save size={18} />
              Design speichern
            </>
          )}
        </button>
      </div>
    </div>
  )
}
