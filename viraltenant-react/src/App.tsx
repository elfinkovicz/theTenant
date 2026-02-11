import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@components/layout/Layout'
import { useTheme } from '@hooks/useTheme'
import { TenantProvider } from './providers/TenantProvider'
import { SuspendedTenantGuard } from './components/SuspendedTenantGuard'
import { ToastContainer } from './components/Toast'
import { useToastStore } from './hooks/useToast'
import { setupFetchInterceptor, checkTokenOnStartup } from './utils/api'
import { prefetchService } from './services/prefetch.service'
import { tenantService } from './services/tenant.service'
import './utils/toast-alert'

// Setup fetch interceptor once on module load
setupFetchInterceptor()

// Export for services that need to wait for tenant resolution
export const waitForTenantInit = () => tenantService.waitForResolution()

// Alle Seiten direkt importieren für schnelle Navigation
import { Home } from '@pages/Home'
import { Live } from '@pages/Live'
import { Videos } from '@pages/Videos'
import { Shop } from '@pages/Shop'
import { Cart } from '@pages/Cart'
import { OrderConfirmation } from '@pages/OrderConfirmation'
import { ShopSuccess } from '@pages/ShopSuccess'
import { ShopCancel } from '@pages/ShopCancel'
import { Events } from '@pages/Events'
import { Newsfeed } from '@pages/Newsfeed'
import { Channels } from '@pages/Channels'
import { Team } from '@pages/Team'
import { Podcasts } from '@pages/Podcasts'
import { Contact } from '@pages/Contact'
import { Legal } from '@pages/Legal'
import { Login } from '@pages/Login'
import { Register } from '@pages/Register'
import { ConfirmEmail } from '@pages/ConfirmEmail'
import { ForgotPassword } from '@pages/ForgotPassword'
import { Tenant } from '@pages/Tenant'
import { TenantRegistration } from '@pages/TenantRegistration'
import { PlatformPricing } from '@pages/PlatformPricing'
import { PlatformHome } from '@pages/PlatformHome'
import { LinkedInCallback } from '@pages/LinkedInCallback'
import { MetaCallback } from '@pages/MetaCallback'
import { TwitchCallback } from '@pages/TwitchCallback'
import { YouTubeCallback } from '@pages/YouTubeCallback'
import { YouTubeOAuthCallback } from '@pages/YouTubeOAuthCallback'
import { TikTokCallback } from '@pages/TikTokCallback'
import { SnapchatCallback } from '@pages/SnapchatCallback'
import { MollieCallback } from '@pages/MollieCallback'
import { MollieConnectCallback } from '@pages/MollieConnectCallback'
import { CustomPage } from '@pages/CustomPage'

function App() {
  useTheme()
  const { toasts, removeToast } = useToastStore()
  
  useEffect(() => {
    checkTokenOnStartup()
    // Start prefetching all page data in background after tenant is resolved
    tenantService.waitForResolution().then(() => {
      prefetchService.startPrefetch()
    })
  }, [])
  
  return (
    <TenantProvider>
      <Router>
        <SuspendedTenantGuard>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/live" element={<Live />} />
              <Route path="/videos" element={<Videos />} />
              <Route path="/podcasts" element={<Podcasts />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/success" element={<ShopSuccess />} />
              <Route path="/shop/cancel" element={<ShopCancel />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/order-confirmation" element={<OrderConfirmation />} />
              <Route path="/events" element={<Events />} />
              <Route path="/newsfeed" element={<Newsfeed />} />
              <Route path="/channels" element={<Channels />} />
              <Route path="/team" element={<Team />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/legal" element={<Legal />} />
              <Route path="/legal/:section" element={<Legal />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/confirm-email" element={<ConfirmEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/tenant" element={<Tenant />} />
              <Route path="/tenant-registration" element={<TenantRegistration />} />
              <Route path="/pricing" element={<PlatformPricing />} />
              <Route path="/landing" element={<PlatformHome />} />
              <Route path="/linkedin-callback" element={<LinkedInCallback />} />
              <Route path="/meta-callback" element={<MetaCallback />} />
              <Route path="/twitch-callback" element={<TwitchCallback />} />
              <Route path="/youtube-callback" element={<YouTubeCallback />} />
              <Route path="/youtube/oauth/callback" element={<YouTubeOAuthCallback />} />
              <Route path="/tiktok-callback" element={<TikTokCallback />} />
              <Route path="/snapchat-callback" element={<SnapchatCallback />} />
              <Route path="/billing/mollie-callback" element={<MollieCallback />} />
              <Route path="/mollie-callback" element={<MollieConnectCallback />} />
              <Route path="/page/:slug" element={<CustomPage />} />
              <Route path="/exclusive" element={<Navigate to="/tenant" replace />} />
            </Routes>
          </Layout>
        </SuspendedTenantGuard>
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </Router>
    </TenantProvider>
  )
}

export default App
