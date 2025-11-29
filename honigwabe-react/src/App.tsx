import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout } from '@components/layout/Layout'
import { Home } from '@pages/Home'
import { Live } from '@pages/Live'
import { Videos } from '@pages/Videos'
import { Shop } from '@pages/Shop'
import { Events } from '@pages/Events'
import { Channels } from '@pages/Channels'
import { Team } from '@pages/Team'
import { Contact } from '@pages/Contact'
import { Login } from '@pages/Login'
import { Register } from '@pages/Register'
import { ConfirmEmail } from '@pages/ConfirmEmail'
import { Exclusive } from '@pages/Exclusive'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live" element={<Live />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/events" element={<Events />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/team" element={<Team />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/confirm-email" element={<ConfirmEmail />} />
          <Route path="/exclusive" element={<Exclusive />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
