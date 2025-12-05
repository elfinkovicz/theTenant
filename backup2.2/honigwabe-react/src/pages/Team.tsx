import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Twitter, Instagram, Youtube, Twitch, Plus, Edit, Trash2, Facebook, Linkedin } from 'lucide-react'
import { teamService, TeamMember } from '../services/team.service'
import { TeamMemberModal } from '../components/TeamMemberModal'
import { useAdmin } from '../hooks/useAdmin'

export const Team = () => {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const { isAdmin } = useAdmin()

  useEffect(() => {
    loadTeam()
  }, [])

  const loadTeam = async () => {
    try {
      const members = await teamService.getTeamMembers()
      setTeam(members)
    } catch (error) {
      console.error('Failed to load team:', error)
      // Fallback zu statischen Daten wenn API nicht verfügbar
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
      loadTeam()
    } catch (error) {
      console.error('Failed to delete member:', error)
      alert('Fehler beim Löschen')
    }
  }

  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case 'twitter': return <Twitter size={18} />
      case 'instagram': return <Instagram size={18} />
      case 'youtube': return <Youtube size={18} />
      case 'twitch': return <Twitch size={18} />
      case 'facebook': return <Facebook size={18} />
      case 'linkedin': return <Linkedin size={18} />
      default: return null
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-12 overflow-hidden bg-gradient-to-br from-primary-900/20 via-dark-950 to-dark-950">
        <div className="container mx-auto px-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              <span className="glow-text">Unser Team</span>
            </h1>
            <p className="text-dark-400 text-lg">
              Meet the people behind your brand
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        {/* Admin Controls */}
        {isAdmin && (
          <div className="mb-6 flex justify-end">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {team.map((member) => (
              <motion.div
                key={member.memberId}
                whileHover={{ y: -5 }}
                className="card text-center relative"
              >
                {/* Admin Actions */}
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-2">
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

                {/* Profile Image */}
                <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-dark-800 overflow-hidden">
                  {member.imageUrl ? (
                    <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-900/20 to-dark-900 flex items-center justify-center">
                      <span className="text-5xl">👤</span>
                    </div>
                  )}
                </div>

                <h3 className="text-xl font-bold mb-1">{member.name}</h3>
                <p className="text-primary-400 mb-3">{member.role}</p>
                <p className="text-dark-400 mb-4">{member.bio}</p>

                {/* Social Links */}
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {Object.entries(member.socials).map(([platform, url]) => (
                    url && (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-dark-800 hover:bg-primary-600 transition-colors"
                      >
                        {getSocialIcon(platform)}
                      </a>
                    )
                  ))}
                </div>
              </motion.div>
            ))}
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
