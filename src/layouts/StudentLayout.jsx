import { Outlet } from 'react-router-dom'
import Topbar from '../components/layout/Topbar'

export default function StudentLayout() {
  return (
    <div className="min-h-screen bg-background text-on-background">
      <Topbar title="GesTask — Estudiante" />
      <main className="flex-1 overflow-auto p-margin-mobile md:p-margin-desktop">
        <Outlet />
      </main>
    </div>
  )
}