import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { LegalDocument, legalService } from '../services/legal.service'

interface LegalManagementModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  legalDocs: LegalDocument[]
}

export const LegalManagementModal = ({ isOpen, onClose, onSuccess, legalDocs }: LegalManagementModalProps) => {
  const [editedDocs, setEditedDocs] = useState<LegalDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setEditedDocs(JSON.parse(JSON.stringify(legalDocs)))
      setError('')
    }
  }, [isOpen, legalDocs])

  const handleChange = (docId: string, field: 'title' | 'content', value: string) => {
    setEditedDocs(prev =>
      prev.map(doc =>
        doc.id === docId ? { ...doc, [field]: value } : doc
      )
    )
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')

    try {
      await legalService.updateLegalDocs(editedDocs)
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to update legal docs:', err)
      setError(err.response?.data?.error || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <h2 className="text-2xl font-bold">Rechtliche Dokumente verwalten</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {editedDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-6 bg-dark-800 rounded-lg border border-dark-700"
              >
                {/* Title Input */}
                <div className="mb-4">
                  <label className="block text-sm text-dark-400 mb-2">
                    Titel
                  </label>
                  <input
                    type="text"
                    value={doc.title}
                    onChange={(e) => handleChange(doc.id, 'title', e.target.value)}
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-lg font-semibold"
                    placeholder="Dokumenttitel"
                  />
                </div>

                {/* Content Textarea */}
                <div>
                  <label className="block text-sm text-dark-400 mb-2">
                    Inhalt (Markdown unterstützt)
                  </label>
                  <textarea
                    value={doc.content}
                    onChange={(e) => handleChange(doc.id, 'content', e.target.value)}
                    className="w-full px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 resize-none font-mono text-sm"
                    rows={15}
                    placeholder="Dokumentinhalt..."
                  />
                  <p className="mt-2 text-xs text-dark-500">
                    Tipp: Verwende Markdown-Syntax für Formatierung (# für Überschriften, ** für fett, etc.)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-dark-700">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex items-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Speichern...
              </>
            ) : (
              <>
                <Save size={20} />
                Speichern
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
