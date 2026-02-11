import { useState, useEffect } from 'react'
import { heroService } from '../services/hero.service'

interface PageTitleConfig {
  title: string
  subtitle?: string
}

// Default titles for each page
const DEFAULT_TITLES: Record<string, PageTitleConfig> = {
  '/': { title: 'Home', subtitle: 'Willkommen' },
  '/live': { title: 'Live Stream', subtitle: 'Erlebe spannende Live-Inhalte und sei Teil der Community' },
  '/videos': { title: 'Videos', subtitle: 'Entdecke unsere Video-Sammlung' },
  '/podcasts': { title: 'Podcasts', subtitle: 'Höre unsere neuesten Episoden' },
  '/shop': { title: 'Shop', subtitle: 'Exklusive Produkte für echte Unterstützer' },
  '/events': { title: 'Events', subtitle: 'Kommende Veranstaltungen und Termine' },
  '/newsfeed': { title: 'Newsfeed', subtitle: 'Bleib auf dem Laufenden' },
  '/channels': { title: 'Channels', subtitle: 'Folge uns auf allen Plattformen' },
  '/team': { title: 'Team', subtitle: 'Lerne unser Team kennen' },
  '/contact': { title: 'Kontakt', subtitle: 'Wir freuen uns auf deine Nachricht' },
  '/cart': { title: 'Warenkorb', subtitle: 'Deine ausgewählten Produkte' },
  '/legal': { title: 'Rechtliches', subtitle: 'Impressum, Datenschutz & AGB' },
}

/**
 * Hook to get the page title and subtitle from navSettings
 * Also updates the browser tab title
 */
export function usePageTitle(pagePath: string): { title: string; subtitle: string; isLoading: boolean } {
  const [pageLabels, setPageLabels] = useState<Record<string, string>>({})
  const [pageSubtitles, setPageSubtitles] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [tenantName, setTenantName] = useState<string>('')

  useEffect(() => {
    loadPageLabels()
  }, [])

  const loadPageLabels = async () => {
    try {
      const content = await heroService.getHeroContent()
      setPageLabels(content.navSettings?.pageLabels || {})
      setPageSubtitles(content.navSettings?.pageSubtitles || {})
      setTenantName(content.title || '')
    } catch (error) {
      console.error('Failed to load page labels:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Get the custom label/subtitle or default
  const defaultConfig = DEFAULT_TITLES[pagePath] || { title: pagePath.replace('/', ''), subtitle: '' }
  const customTitle = pageLabels[pagePath]
  const customSubtitle = pageSubtitles[pagePath]
  const title = customTitle || defaultConfig.title
  const subtitle = customSubtitle || defaultConfig.subtitle || ''

  // Update browser tab title
  useEffect(() => {
    if (!isLoading) {
      const baseTitle = tenantName || 'ViralTenant'
      document.title = `${title} | ${baseTitle}`
    }
  }, [title, tenantName, isLoading])

  return { title, subtitle, isLoading }
}
