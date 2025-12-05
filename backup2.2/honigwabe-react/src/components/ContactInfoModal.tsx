import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { ContactInfo, contactInfoService } from '../services/contactInfo.service'

interface ContactInfoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  contactInfo: ContactInfo[]
}

export const ContactInfoModal = ({ isOpen, onClose, onSuccess, contactInfo }: ContactInfoModalProps) => {
  const [editedInfo, setEditedInfo] = useState<ContactInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setEditedInfo(JSON.parse(JSON.stringify(contactInfo)))
      setError('')
    }
  }, [isOpen, contactInfo])

  const handleToggle = (infoId: string) => {
    setEditedInfo(prev =>
      prev.map(info =>
        info.id === infoId ? { ...info, enabled: !info.enabled } : info
      )
    )
  }

  const handleChange = (infoId: string, field: 'title' | 'value', value: string) => {
    setEditedInfo(prev =>
      prev.map(info =>
        info.id === infoId ? { ...info, [field]: value } : info
      )
    )
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')

    try {
      await contactInfoService.updateContactInfo(editedInfo)
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to update contact info:', err)
      setError(err.response?.data?.error || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-dark-900 rounded-xl border border-dark-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <h2 className="text-2xl font-bold">Kontaktinformationen verwalten</h2>
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

          <div className="space-y-4">
            {editedInfo.map((info) => (
              <div
                key={info.id}
                className="p-4 bg-dark-800 rounded-lg border border-dark-700"
              >
                <div className="flex items-start gap-4">
                  {/* Toggle Switch */}
                  <div className="flex-shrink-0 pt-1">
                    <button
                      onClick={() => handleToggle(info.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        info.enabled ? 'bg-primary-600' : 'bg-dark-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          info.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Info Fields */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold capitalize">{info.type}</span>
                    </div>

                    {/* Title Input */}
                    <div>
                      <label className="block text-sm text-dark-400 mb-1">
                        Titel
                      </label>
                      <input
                        type="text"
                        value={info.title}
                        onChange={(e) => handleChange(info.id, 'title', e.target.value)}
                        className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                        placeholder="Titel"
                      />
                    </div>

                    {/* Value Input */}
                    <div>
                      <label className="block text-sm text-dark-400 mb-1">
                        {info.type === 'address' ? 'Adresse' : 'Wert'}
                      </label>
                      {info.type === 'address' ? (
                        <textarea
                          value={info.value}
                          onChange={(e) => handleChange(info.id, 'value', e.target.value)}
                          className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 resize-none"
                          rows={3}
                          placeholder="Straße&#10;PLZ Stadt&#10;Land"
                        />
                      ) : (
                        <input
                          type="text"
                          value={info.value}
                          onChange={(e) => handleChange(info.id, 'value', e.target.value)}
                          className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                          placeholder={info.type === 'email' ? 'email@example.com' : '+49 123 456789'}
                        />
                      )}
                    </div>
                  </div>
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
