import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Settings, FileText, Shield, ScrollText } from 'lucide-react'
import { LegalDocument, legalService } from '../services/legal.service'
import { LegalManagementModal } from '../components/LegalManagementModal'
import { useAdmin } from '../hooks/useAdmin'

export const Legal = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [legalDocs, setLegalDocs] = useState<LegalDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'impressum')
  const { isAdmin } = useAdmin()

  useEffect(() => {
    loadLegalDocs()
  }, [])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const loadLegalDocs = async () => {
    try {
      const data = await legalService.getLegalDocs()
      setLegalDocs(data)
    } catch (error) {
      console.error('Failed to load legal docs:', error)
      // Fallback to defaults
      setLegalDocs([
        { id: 'impressum', title: 'Impressum', content: 'Impressum wird geladen...', lastUpdated: new Date().toISOString() },
        { id: 'datenschutz', title: 'Datenschutzerklärung', content: 'Datenschutzerklärung wird geladen...', lastUpdated: new Date().toISOString() },
        { id: 'agb', title: 'AGB', content: 'AGB werden geladen...', lastUpdated: new Date().toISOString() }
      ])
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (docId: string) => {
    switch (docId) {
      case 'impressum': return <FileText size={24} />
      case 'datenschutz': return <Shield size={24} />
      case 'agb': return <ScrollText size={24} />
      default: return <FileText size={24} />
    }
  }

  const activeDoc = legalDocs.find(doc => doc.id === activeTab)

  // Simple markdown-like formatting
  const formatContent = (content: string) => {
    return content
      .split('\n')
      .map(line => {
        // Headers
        if (line.startsWith('# ')) {
          return `<h1 class="text-3xl font-bold mb-4 mt-6 text-white">${line.substring(2)}</h1>`
        }
        if (line.startsWith('## ')) {
          return `<h2 class="text-2xl font-bold mb-3 mt-6 text-white">${line.substring(3)}</h2>`
        }
        if (line.startsWith('### ')) {
          return `<h3 class="text-xl font-semibold mb-2 mt-4 text-white">${line.substring(4)}</h3>`
        }
        // Bold text
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
        // Links
        line = line.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-primary-400 hover:text-primary-300 underline" target="_blank" rel="noopener noreferrer">$1</a>')
        // Empty lines
        if (line.trim() === '') {
          return '<br />'
        }
        // Regular paragraphs
        return `<p class="mb-4 text-dark-300 leading-relaxed">${line}</p>`
      })
      .join('')
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-12 overflow-hidden bg-gradient-to-br from-primary-900/20 via-dark-950 to-dark-950">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                <span className="glow-text">Rechtliches</span>
              </h1>
              <p className="text-dark-400 text-lg">
                Impressum, Datenschutz und Allgemeine Geschäftsbedingungen
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Settings size={20} />
                Optionen
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-8">
              {legalDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => {
                    setActiveTab(doc.id)
                    setSearchParams({ tab: doc.id })
                  }}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all ${
                    activeTab === doc.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                  }`}
                >
                  {getIcon(doc.id)}
                  {doc.title}
                </button>
              ))}
            </div>

            {/* Content */}
            {activeDoc && (
              <div className="card">
                <div className="prose prose-invert max-w-none">
                  <div 
                    className="legal-content"
                    dangerouslySetInnerHTML={{ 
                      __html: formatContent(activeDoc.content) 
                    }}
                  />
                </div>

                <div className="mt-8 pt-6 border-t border-dark-700 text-sm text-dark-500">
                  Zuletzt aktualisiert: {new Date(activeDoc.lastUpdated).toLocaleDateString('de-DE', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      <LegalManagementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadLegalDocs}
        legalDocs={legalDocs}
      />
    </div>
  )
}
