import { useState } from 'react'
import { motion } from 'framer-motion'
import { Crown, Video, Image, FileText, Lock, DollarSign } from 'lucide-react'
import { useAuthStore } from '@store/authStore'
import { Navigate } from 'react-router-dom'
import { useAdmin } from '@hooks/useAdmin'
import { BillingManagement } from '@components/BillingManagement'

export const Exclusive = () => {
  const { isAuthenticated, user } = useAuthStore()
  const { isAdmin } = useAdmin()
  const [activeTab, setActiveTab] = useState<'content' | 'billing'>('content')

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  const exclusiveContent = [
    {
      id: '1',
      type: 'video',
      title: 'Behind the Scenes - Stream Setup',
      description: 'Exklusiver Einblick in mein Setup',
      icon: <Video size={32} />
    },
    {
      id: '2',
      type: 'image',
      title: 'Exclusive Wallpapers',
      description: 'Premium Wallpaper Collection',
      icon: <Image size={32} />
    },
    {
      id: '3',
      type: 'document',
      title: 'Community Updates',
      description: 'Früher Zugang zu News',
      icon: <FileText size={32} />
    },
  ]

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Crown size={40} className="text-yellow-500" />
            <h1 className="text-4xl md:text-5xl font-bold">
              <span className="glow-text">Exklusiver Bereich</span>
            </h1>
          </div>
          <p className="text-dark-400 text-lg">
            Willkommen zurück, {user?.email}! 👋
          </p>
        </div>

        {/* Tabs (nur für Admins) */}
        {isAdmin && (
          <div className="flex gap-2 mb-6 border-b border-dark-700">
            <button
              onClick={() => setActiveTab('content')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'content'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              Exklusiver Content
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
                activeTab === 'billing'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              <DollarSign size={18} />
              Rechnungen
            </button>
          </div>
        )}

        {/* Content Tab */}
        {activeTab === 'content' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exclusiveContent.map((content) => (
              <motion.div
                key={content.id}
                whileHover={{ y: -5 }}
                className="card group cursor-pointer"
              >
                <div className="text-primary-500 mb-4 group-hover:scale-110 transition-transform">
                  {content.icon}
                </div>
                <h3 className="text-xl font-bold mb-2">{content.title}</h3>
                <p className="text-dark-400 mb-4">{content.description}</p>
                <button className="btn-secondary w-full flex items-center justify-center gap-2">
                  <Lock size={16} />
                  Ansehen
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Billing Tab (nur für Admins) */}
        {activeTab === 'billing' && isAdmin && (
          <BillingManagement />
        )}
      </div>
    </div>
  )
}
