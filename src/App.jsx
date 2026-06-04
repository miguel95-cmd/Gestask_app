import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import AdminLayout from './layouts/AdminLayout'
import StudentLayout from './layouts/StudentLayout'
import Dashboard from './pages/admin/Dashboard'
import Projects from './pages/admin/Projects'
import ProjectDetail from './pages/admin/ProjectDetail'
import Kanban from './pages/admin/Kanban'
import Reports from './pages/admin/Reports'
import MyTasks from './pages/student/MyTasks'

const Spinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-surface text-on-surface">
    Cargando...
  </div>
)

function ProtectedRoute({ children, allowedRole }) {
  const { user, profile, loading, profileLoading } = useAuth()

  // 1. Todavía resolviendo la sesión inicial
  if (loading) return <Spinner />

  // 2. Sesión confirmada pero el perfil aún no llegó de Supabase
  //    → esperar en lugar de evaluar el rol con profile === null
  if (user && profileLoading) return <Spinner />

  // 3. Sin sesión → login
  if (!user) return <Navigate to="/login" replace />

  // 4. Rol incorrecto → login
  if (allowedRole && profile?.role !== allowedRole) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/admin"
          element={(
            <ProtectedRoute allowedRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          )}
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="projects/:id/kanban" element={<Kanban />} />
          <Route path="reports" element={<Reports />} />
        </Route>

        <Route
          path="/student"
          element={(
            <ProtectedRoute allowedRole="student">
              <StudentLayout />
            </ProtectedRoute>
          )}
        >
          <Route index element={<Navigate to="tasks" replace />} />
          <Route path="tasks" element={<MyTasks />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
