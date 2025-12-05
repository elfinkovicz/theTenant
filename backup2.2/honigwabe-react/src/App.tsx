import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout } from '@components/layout/Layout'
import { Home } from '@pages/Home'
import { Live } from '@pages/Live'
import { Videos } from '@pages/Videos'
import { Shop } from '@pages/Shop'
import { Cart } from '@pages/Cart'
import { OrderConfirmation } from '@pages/OrderConfirmation'
import { Events } from '@pages/Events'
import { Newsfeed } from '@pages/Newsfeed'
import { Channels } from '@pages/Channels'
import { Team } from '@pages/Team'
import { Contact } from '@pages/Contact'
import { Legal } from '@pages/Legal'
import { Login } from '@pages/Login'
import { Register } from '@pages/Register'
import { ConfirmEmail } from '@pages/ConfirmEmail'
import { ForgotPassword } from '@pages/ForgotPassword'
import { Exclusive } from '@pages/Exclusive'
import { useTheme } from '@hooks/useTheme'

function App() {
  useTheme()
  
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live" element={<Live />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/shop" element={<Shop />} />
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
          <Route path="/exclusive" element={<Exclusive />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
