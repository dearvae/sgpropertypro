import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ErrorBoundary } from './components/ErrorBoundary'
import Login from './pages/Login'
import AgentDashboard from './pages/AgentDashboard'
import ClientView from './pages/ClientView'
import ClientLanding from './pages/ClientLanding'

function ProtectedRoute({ children, clientRedirect }: { children: React.ReactNode; clientRedirect?: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-500">加载中...</div>
  if (!user) return <Navigate to="/login" replace />
  const role = (user.user_metadata?.role as string) || 'agent'
  if (role === 'client' && clientRedirect) return <>{clientRedirect}</>
  return <>{children}</>
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute clientRedirect={<ClientLanding />}><AgentDashboard /></ProtectedRoute>} />
          <Route path="/view/:token" element={<ErrorBoundary><ClientView /></ErrorBoundary>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
