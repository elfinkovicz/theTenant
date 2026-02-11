import { useNavigate } from 'react-router-dom'
import { XCircle, ShoppingCart, ArrowLeft } from 'lucide-react'

export const ShopCancel = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle size={48} className="text-red-500" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Zahlung abgebrochen</h1>
        <p className="text-dark-400 mb-6">
          Die Zahlung wurde abgebrochen. Dein Warenkorb wurde nicht geleert.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => navigate('/cart')}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <ShoppingCart size={20} />
            Zurück zum Warenkorb
          </button>
          <button
            onClick={() => navigate('/shop')}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft size={20} />
            Weiter einkaufen
          </button>
        </div>
      </div>
    </div>
  )
}
