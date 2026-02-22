import { ConfigProvider } from 'antd'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ErrorBoundary } from './components/ErrorBoundary'
import Login from './pages/Login'
import Register from './pages/Register'
import InvitePage from './pages/InvitePage'
import AdminPage from './pages/AdminPage'
import HomePage from './pages/HomePage'
import AgentDashboard from './pages/AgentDashboard'
import ClientDashboard from './pages/ClientDashboard'
import ClientView from './pages/ClientView'
import Playground from './pages/Playground'

function ProtectedRoute({ children, requireAgent }: { children: React.ReactNode; requireAgent?: boolean }) {
  const { user, loading } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-500">{t('common.loading')}</div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (requireAgent) {
    const role = (user.user_metadata?.role as string) || 'agent'
    if (role === 'client') return <Navigate to="/home/user" replace />
  }
  return <>{children}</>
}

function ProtectedClientRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-500">{t('common.loading')}</div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  const role = (user.user_metadata?.role as string) || 'agent'
  if (role === 'agent') return <Navigate to="/home/agent" replace />
  return <>{children}</>
}

function App() {
  return (
    <ConfigProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/invite" element={<ProtectedRoute><InvitePage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/home/agent" element={<ProtectedRoute requireAgent><AgentDashboard /></ProtectedRoute>} />
            <Route path="/home/user" element={<ProtectedClientRoute><ClientDashboard /></ProtectedClientRoute>} />
            <Route path="/view/:token" element={<ErrorBoundary><ClientView /></ErrorBoundary>} />
            <Route path="/playground" element={<Playground />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  )
}

export default App
