import { ConfigProvider } from 'antd'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FullPageSkeleton } from './components/Skeleton'
import Login from './pages/Login'
import Register from './pages/Register'
import InvitePage from './pages/InvitePage'
import AdminPage from './pages/AdminPage'
import HomePage from './pages/HomePage'
import AgentDashboard from './pages/AgentDashboard'
import ClientDashboard from './pages/ClientDashboard'
import ClientView from './pages/ClientView'
import AgentPublicPage from './pages/AgentPublicPage'
import Playground from './pages/Playground'

function ProtectedRoute({ children, requireAgent }: { children: React.ReactNode; requireAgent?: boolean }) {
  const { user, loading } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()
  if (loading) return <FullPageSkeleton message={t('common.loading')} />
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
  if (loading) return <FullPageSkeleton message={t('common.loading')} />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  const role = (user.user_metadata?.role as string) || 'agent'
  if (role === 'agent') return <Navigate to="/home/agent" replace />
  return <>{children}</>
}

const zenTheme = {
  token: {
    colorPrimary: '#53868e',
    borderRadius: 12,
    colorText: '#2b5843',
  },
  components: {
    Popover: {
      colorBgElevated: '#f6f3f1',
      colorBorderSecondary: 'rgba(83, 134, 142, 0.25)',
    },
  },
}

function App() {
  return (
    <ConfigProvider theme={zenTheme}>
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
            <Route path="/agent/:inviteCode" element={<ErrorBoundary><AgentPublicPage /></ErrorBoundary>} />
            <Route path="/playground" element={<Playground />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  )
}

export default App
