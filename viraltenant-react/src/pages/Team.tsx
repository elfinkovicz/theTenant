import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Twitter, Instagram, Youtube, Twitch, Plus, Edit, Trash2, Facebook, Linkedin, Save, Globe } from 'lucide-react'
import { teamService, TeamMember, TeamMemberWidth } from '../services/team.service'
import { prefetchService } from '../services/prefetch.service'
import { TeamMemberModal } from '../components/TeamMemberModal'
import { PageBanner } from '../components/PageBanner'
import { useAdmin } from '../hooks/useAdmin'
import { usePageTitle } from '../hooks/usePageTitle'
import { toast } from '../utils/toast-alert'

// TikTok Icon
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
)

// Discord Icon
const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
)

// Spotify Icon
const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
)

const detectPlatform = (url: string): string => {
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter'
  if (lowerUrl.includes('instagram.com')) return 'instagram'
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube'
  if (lowerUrl.includes('twitch.tv')) return 'twitch'
  if (lowerUrl.includes('tiktok.com')) return 'tiktok'
  if (lowerUrl.includes('linkedin.com')) return 'linkedin'
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) return 'facebook'
  if (lowerUrl.includes('discord.gg') || lowerUrl.includes('discord.com')) return 'discord'
  if (lowerUrl.includes('spotify.com') || lowerUrl.includes('open.spotify')) return 'spotify'
  return 'website'
}

export const Team = () => {
  const { title: pageTitle, subtitle: pageSubtitle } = usePageTitle('/team')
  
  // Initialize with cached data if available (prevents flash)
  const cachedData = prefetchService.getCachedSync('team')
  const initialTeam = cachedData?.members || []
  
  const [team, setTeam] = useState<TeamMember[]>(initialTeam)
  const [loading, setLoading] = useState(!cachedData) // Only show loading if no cache
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const { isAdmin } = useAdmin()
  
  // Drag & Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [hasOrderChanged, setHasOrderChanged] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  
  // Resize State
  const [resizingMemberId, setResizingMemberId] = useState<string | null>(null)
  const resizeStartX = useRef<number>(0)
  const resizeStartWidth = useRef<TeamMemberWidth>('small')

  // Width options for team cards (based on 6-column grid)
  const widthOptions: { value: TeamMemberWidth; colSpan: string; cols: number }[] = [
    { value: 'small', colSpan: 'col-span-6 md:col-span-3 lg:col-span-2', cols: 2 },
    { value: 'medium', colSpan: 'col-span-6 md:col-span-3 lg:col-span-3', cols: 3 },
    { value: 'large', colSpan: 'col-span-6 md:col-span-6 lg:col-span-4', cols: 4 },
    { value: 'full', colSpan: 'col-span-6', cols: 6 },
  ]

  const getColSpanClass = (width?: TeamMemberWidth) => {
    const option = widthOptions.find(o => o.value === width)
    return option?.colSpan || 'col-span-6 md:col-span-3 lg:col-span-2'
  }

  const getWidthFromCols = (cols: number): TeamMemberWidth => {
    if (cols <= 2) return 'small'
    if (cols <= 3) return 'medium'
    if (cols <= 4) return 'large'
    return 'full'
  }

  const getColsFromWidth = (width?: TeamMemberWidth): number => {
    const option = widthOptions.find(o => o.value === width)
    return option?.cols || 2
  }

  useEffect(() => {
    loadTeam()
  }, [])

  const loadTeam = async () => {
    try {
      // Only show loading if we don't have cached data
      const hasCachedData = team.length > 0
      if (!hasCachedData) {
        setLoading(true)
      }
      
      // Use prefetch cache if available
      const result = await prefetchService.getTeam()
      console.log('Loaded team:', result);
      // getTeamMembers() returns { members: [...], settings: {...} }
      const members = Array.isArray(result.members) ? result.members : []
      
      // If no members are stored, show empty state (no default members needed)
      setTeam(members)
    } catch (error) {
      console.error('Failed to load team:', error)
      // Fallback to empty array
      setTeam([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setSelectedMember(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  const handleEdit = (member: TeamMember) => {
    setSelectedMember(member)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleDelete = async (member: TeamMember) => {
    if (!confirm(`Team-Mitglied "${member.name}" wirklich löschen?`)) return

    try {
      await teamService.deleteTeamMember(member.memberId)
      toast.success('Team-Mitglied erfolgreich gelöscht')
      prefetchService.invalidate('team')
      loadTeam()
    } catch (error) {
      console.error('Failed to delete member:', error)
      toast.error('Fehler beim Löschen')
    }
  }

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
    setTimeout(() => {
      const target = e.target as HTMLElement
      target.style.opacity = '0.5'
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement
    target.style.opacity = '1'
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null)
      return
    }

    const newTeam = [...team]
    const [draggedMember] = newTeam.splice(draggedIndex, 1)
    newTeam.splice(dropIndex, 0, draggedMember)
    
    setTeam(newTeam)
    setHasOrderChanged(true)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleSaveOrder = async () => {
    try {
      setSavingOrder(true)
      await teamService.updateTeamMembers(team)
      prefetchService.invalidate('team')
      toast.success('Reihenfolge erfolgreich gespeichert!')
      setHasOrderChanged(false)
    } catch (err: any) {
      console.error('Error saving team order:', err)
      toast.error('Fehler beim Speichern der Reihenfolge')
    } finally {
      setSavingOrder(false)
    }
  }

  const handleWidthChange = (memberId: string, newWidth: TeamMemberWidth) => {
    const updatedTeam = team.map(m => 
      m.memberId === memberId ? { ...m, width: newWidth } : m
    )
    setTeam(updatedTeam)
    setHasOrderChanged(true)
  }

  // Resize Handlers
  const handleResizeStart = (e: React.MouseEvent, memberId: string, currentWidth?: TeamMemberWidth) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingMemberId(memberId)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = currentWidth || 'small'
    
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
  }

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingMemberId) return
    
    const deltaX = e.clientX - resizeStartX.current
    const gridWidth = document.querySelector('.grid')?.clientWidth || 1200
    const colWidth = gridWidth / 6
    const deltaColumns = Math.round(deltaX / colWidth)
    
    const startCols = getColsFromWidth(resizeStartWidth.current)
    const newCols = Math.max(2, Math.min(6, startCols + deltaColumns))
    const newWidth = getWidthFromCols(newCols)
    
    if (newWidth !== team.find(m => m.memberId === resizingMemberId)?.width) {
      handleWidthChange(resizingMemberId, newWidth)
    }
  }

  const handleResizeEnd = () => {
    setResizingMemberId(null)
    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeEnd)
  }

  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case 'twitter': return <Twitter size={18} />
      case 'instagram': return <Instagram size={18} />
      case 'youtube': return <Youtube size={18} />
      case 'twitch': return <Twitch size={18} />
      case 'tiktok': return <TikTokIcon />
      case 'facebook': return <Facebook size={18} />
      case 'linkedin': return <Linkedin size={18} />
      case 'discord': return <DiscordIcon />
      case 'spotify': return <SpotifyIcon />
      case 'website': return <Globe size={18} />
      default: return <Globe size={18} />
    }
  }

  return (
    <div className="min-h-screen">
      {/* Page Banner mit Titel */}
      <PageBanner pageId="team">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: 'rgb(var(--color-text))' }}>
            <span className="glow-text">{pageTitle}</span>
          </h1>
          <p className="text-lg" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {pageSubtitle}
          </p>
        </div>
      </PageBanner>

      <div className="container mx-auto px-4 py-8">
        {/* Admin Controls */}
        {isAdmin && (
          <div className="mb-6 flex justify-end gap-3">
            {hasOrderChanged && (
              <button
                onClick={handleSaveOrder}
                disabled={savingOrder}
                className="btn-primary flex items-center gap-2"
              >
                <Save size={20} />
                {savingOrder ? 'Speichern...' : 'Reihenfolge speichern'}
              </button>
            )}
            <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
              <Plus size={20} />
              Team-Mitglied hinzufügen
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        ) : team.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-dark-400 text-lg">Noch keine Team-Mitglieder</p>
            {isAdmin && (
              <button onClick={handleCreate} className="btn-primary mt-4">
                Erstes Mitglied hinzufügen
              </button>
            )}
          </div>
        ) : (
          <div className="w-full">
            <div className="grid grid-cols-6 gap-8">
              {team.map((member, index) => (
                <div
                  key={member.memberId}
                  draggable={isAdmin && !resizingMemberId}
                  onDragStart={(e) => isAdmin && !resizingMemberId && handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => isAdmin && handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => isAdmin && handleDrop(e, index)}
                  className={`relative transition-all duration-200 ${getColSpanClass(member.width)} ${
                    isAdmin && !resizingMemberId ? 'cursor-grab active:cursor-grabbing' : ''
                  } ${
                    dragOverIndex === index 
                      ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-dark-900 scale-[1.02]' 
                      : ''
                  } ${
                    draggedIndex === index ? 'opacity-50' : ''
                  } ${
                    resizingMemberId === member.memberId ? 'ring-2 ring-primary-500' : ''
                  }`}
                >
                  <motion.div
                    whileHover={{ y: isAdmin ? 0 : -5 }}
                    className="card text-center relative w-full h-full"
                  >
                    {/* Admin Actions */}
                    {isAdmin && (
                      <div className="absolute top-4 right-4 flex gap-2 z-10">
                        <button
                          onClick={() => handleEdit(member)}
                          className="p-2 rounded-lg bg-dark-800 hover:bg-primary-600 transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(member)}
                          className="p-2 rounded-lg bg-dark-800 hover:bg-red-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}

                    {/* Resize Handle - Right Edge */}
                    {isAdmin && (
                      <div
                        onMouseDown={(e) => handleResizeStart(e, member.memberId, member.width)}
                        className="absolute top-0 right-0 w-3 h-full cursor-ew-resize z-20 group"
                      >
                        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-16 bg-dark-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}

                    {/* Width Indicator - Admin Only */}
                    {isAdmin && (
                      <div className="absolute top-4 left-4 px-2 py-1 bg-dark-800 rounded text-xs text-dark-400 z-10">
                        {member.width === 'full' ? '100%' : member.width === 'large' ? '66%' : member.width === 'medium' ? '50%' : '33%'}
                      </div>
                    )}

                    {/* Profile Image */}
                    <div className={`mx-auto mb-4 rounded-full bg-dark-800 overflow-hidden ${
                      member.width === 'full' || member.width === 'large' 
                        ? 'w-40 h-40' 
                        : member.width === 'medium' 
                          ? 'w-36 h-36' 
                          : 'w-32 h-32'
                    }`}>
                      {member.imageUrl ? (
                        <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-900/20 to-dark-900 flex items-center justify-center">
                          <span className={member.width === 'full' || member.width === 'large' ? 'text-6xl' : 'text-5xl'}>👤</span>
                        </div>
                      )}
                    </div>

                    <h3 className={`font-bold mb-1 ${
                      member.width === 'full' || member.width === 'large' ? 'text-2xl' : 'text-xl'
                    }`}>{member.name}</h3>
                    <p className={`text-primary-400 mb-3 ${
                      member.width === 'full' || member.width === 'large' ? 'text-lg' : ''
                    }`}>{member.role}</p>
                    <p className="text-dark-400 mb-4">{member.bio}</p>

                    {/* Social Links */}
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      {Object.entries(member.socials).map(([platform, url]) => {
                        if (!url) return null
                        const detectedPlatform = detectPlatform(url)
                        return (
                          <a
                            key={platform}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-dark-800 hover:bg-primary-600 transition-colors"
                          >
                            {getSocialIcon(detectedPlatform)}
                          </a>
                        )
                      })}
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <TeamMemberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadTeam}
        member={selectedMember}
        mode={modalMode}
      />
    </div>
  )
}
