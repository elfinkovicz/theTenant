/**
 * Prefetch Service
 * 
 * Lädt Daten für alle Hauptseiten im Hintergrund vor,
 * damit Navigation blitzschnell ist.
 */

import { videoService } from './video.service'
import { podcastService } from './podcast.service'
import { productService } from './product.service'
import { eventService } from './event.service'
import { newsfeedService } from './newsfeed.service'
import { channelService } from './channel.service'
import { liveService } from './live.service'
import { bannerService } from './banner.service'
import { teamService } from './team.service'
import { contactInfoService } from './contactInfo.service'

interface CacheEntry {
  data: any
  timestamp: number
}

interface CachedData {
  videos?: CacheEntry
  podcasts?: CacheEntry
  products?: CacheEntry
  events?: CacheEntry
  newsfeed?: CacheEntry
  channels?: CacheEntry
  live?: CacheEntry
  team?: CacheEntry
  contact?: CacheEntry
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache

class PrefetchService {
  private cache: CachedData = {}
  private prefetchPromise: Promise<void> | null = null
  private prefetchStarted = false

  /**
   * Start prefetching all data in background
   * Call this once when app loads
   */
  startPrefetch(): void {
    if (this.prefetchStarted) return
    this.prefetchStarted = true

    // Banners first (they're visible immediately on page navigation)
    bannerService.preloadAllBanners()

    // Wait a bit for critical resources to load first, then prefetch content
    setTimeout(() => {
      this.prefetchAll()
    }, 500)
  }

  /**
   * Prefetch all main page data in parallel
   */
  private async prefetchAll(): Promise<void> {
    if (this.prefetchPromise) return this.prefetchPromise

    console.log('[Prefetch] Starting background data prefetch...')

    this.prefetchPromise = Promise.allSettled([
      this.prefetchVideos(),
      this.prefetchPodcasts(),
      this.prefetchProducts(),
      this.prefetchEvents(),
      this.prefetchNewsfeed(),
      this.prefetchChannels(),
      this.prefetchLive(),
      this.prefetchTeam(),
      this.prefetchContact()
    ]).then(() => {
      console.log('[Prefetch] All data prefetched')
      this.prefetchPromise = null
    })

    return this.prefetchPromise
  }

  private async prefetchVideos(): Promise<void> {
    try {
      const data = await videoService.getVideos()
      this.cache.videos = { data, timestamp: Date.now() }
      console.log('[Prefetch] Videos loaded')
    } catch (e) {
      console.warn('[Prefetch] Videos failed:', e)
    }
  }

  private async prefetchPodcasts(): Promise<void> {
    try {
      const data = await podcastService.getPodcasts()
      this.cache.podcasts = { data, timestamp: Date.now() }
      console.log('[Prefetch] Podcasts loaded')
    } catch (e) {
      console.warn('[Prefetch] Podcasts failed:', e)
    }
  }

  private async prefetchProducts(): Promise<void> {
    try {
      const data = await productService.getProducts()
      this.cache.products = { data, timestamp: Date.now() }
      console.log('[Prefetch] Products loaded')
    } catch (e) {
      console.warn('[Prefetch] Products failed:', e)
    }
  }

  private async prefetchEvents(): Promise<void> {
    try {
      const data = await eventService.getEvents()
      this.cache.events = { data, timestamp: Date.now() }
      console.log('[Prefetch] Events loaded')
    } catch (e) {
      console.warn('[Prefetch] Events failed:', e)
    }
  }

  private async prefetchNewsfeed(): Promise<void> {
    try {
      const data = await newsfeedService.getNewsfeed()
      this.cache.newsfeed = { data, timestamp: Date.now() }
      console.log('[Prefetch] Newsfeed loaded')
    } catch (e) {
      console.warn('[Prefetch] Newsfeed failed:', e)
    }
  }

  private async prefetchChannels(): Promise<void> {
    try {
      const data = await channelService.getChannels()
      this.cache.channels = { data, timestamp: Date.now() }
      console.log('[Prefetch] Channels loaded')
    } catch (e) {
      console.warn('[Prefetch] Channels failed:', e)
    }
  }

  private async prefetchLive(): Promise<void> {
    try {
      const data = await liveService.getLiveSettings()
      this.cache.live = { data, timestamp: Date.now() }
      console.log('[Prefetch] Live loaded')
    } catch (e) {
      console.warn('[Prefetch] Live failed:', e)
    }
  }

  private async prefetchTeam(): Promise<void> {
    try {
      const data = await teamService.getTeamMembers()
      this.cache.team = { data, timestamp: Date.now() }
      console.log('[Prefetch] Team loaded')
    } catch (e) {
      console.warn('[Prefetch] Team failed:', e)
    }
  }

  private async prefetchContact(): Promise<void> {
    try {
      const data = await contactInfoService.getContactInfo()
      this.cache.contact = { data, timestamp: Date.now() }
      console.log('[Prefetch] Contact loaded')
    } catch (e) {
      console.warn('[Prefetch] Contact failed:', e)
    }
  }

  /**
   * Check if a specific cache entry is still valid
   */
  private isEntryValid(entry?: CacheEntry): boolean {
    if (!entry) return false
    return Date.now() - entry.timestamp < CACHE_TTL
  }

  /**
   * Check if data is cached (synchronous)
   */
  hasCached(type: 'videos' | 'podcasts' | 'products' | 'events' | 'newsfeed' | 'channels' | 'live' | 'team' | 'contact'): boolean {
    return this.isEntryValid(this.cache[type])
  }

  /**
   * Get cached data synchronously (returns null if not cached or expired)
   */
  getCachedSync(type: 'videos' | 'podcasts' | 'products' | 'events' | 'newsfeed' | 'channels' | 'live' | 'team' | 'contact'): any | null {
    const entry = this.cache[type]
    if (this.isEntryValid(entry)) {
      return entry!.data
    }
    return null
  }

  /**
   * Get cached videos or fetch fresh
   */
  async getVideos(): Promise<any> {
    if (this.isEntryValid(this.cache.videos)) {
      return this.cache.videos!.data
    }
    const data = await videoService.getVideos()
    this.cache.videos = { data, timestamp: Date.now() }
    return data
  }

  /**
   * Get cached podcasts or fetch fresh
   */
  async getPodcasts(): Promise<any> {
    if (this.isEntryValid(this.cache.podcasts)) {
      return this.cache.podcasts!.data
    }
    const data = await podcastService.getPodcasts()
    this.cache.podcasts = { data, timestamp: Date.now() }
    return data
  }

  /**
   * Get cached products or fetch fresh
   */
  async getProducts(): Promise<any> {
    if (this.isEntryValid(this.cache.products)) {
      return this.cache.products!.data
    }
    const data = await productService.getProducts()
    this.cache.products = { data, timestamp: Date.now() }
    return data
  }

  /**
   * Get cached events or fetch fresh
   */
  async getEvents(): Promise<any> {
    if (this.isEntryValid(this.cache.events)) {
      return this.cache.events!.data
    }
    const data = await eventService.getEvents()
    this.cache.events = { data, timestamp: Date.now() }
    return data
  }

  /**
   * Get cached newsfeed or fetch fresh
   */
  async getNewsfeed(): Promise<any> {
    if (this.isEntryValid(this.cache.newsfeed)) {
      return this.cache.newsfeed!.data
    }
    const data = await newsfeedService.getNewsfeed()
    this.cache.newsfeed = { data, timestamp: Date.now() }
    return data
  }

  /**
   * Get cached channels or fetch fresh
   */
  async getChannels(): Promise<any> {
    if (this.isEntryValid(this.cache.channels)) {
      return this.cache.channels!.data
    }
    const data = await channelService.getChannels()
    this.cache.channels = { data, timestamp: Date.now() }
    return data
  }

  /**
   * Get cached live settings or fetch fresh
   */
  async getLive(): Promise<any> {
    if (this.isEntryValid(this.cache.live)) {
      return this.cache.live!.data
    }
    const data = await liveService.getLiveSettings()
    this.cache.live = { data, timestamp: Date.now() }
    return data
  }

  /**
   * Get cached team or fetch fresh
   */
  async getTeam(): Promise<any> {
    if (this.isEntryValid(this.cache.team)) {
      return this.cache.team!.data
    }
    const data = await teamService.getTeamMembers()
    this.cache.team = { data, timestamp: Date.now() }
    return data
  }

  /**
   * Get cached contact info or fetch fresh
   */
  async getContact(): Promise<any> {
    if (this.isEntryValid(this.cache.contact)) {
      return this.cache.contact!.data
    }
    const data = await contactInfoService.getContactInfo()
    this.cache.contact = { data, timestamp: Date.now() }
    return data
  }

  /**
   * Invalidate specific cache (call after updates)
   */
  invalidate(type: 'videos' | 'podcasts' | 'products' | 'events' | 'newsfeed' | 'channels' | 'live' | 'team' | 'contact'): void {
    delete this.cache[type]
  }

  /**
   * Invalidate all cache
   */
  invalidateAll(): void {
    this.cache = {}
  }
}

export const prefetchService = new PrefetchService()
