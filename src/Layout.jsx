import React, { useEffect, useState } from 'react'
import { LayoutDashboard, CalendarDays, Bell, BookOpen, User, Menu, X, GraduationCap, Upload, ShieldCheck, Settings2, LogOut } from "lucide-react"

function AdminPanel({ adminMode, setAdminMode, adminAction, setAdminAction, isAdmin }) {
  const handleAdminAction = (nextAction) => {
    setAdminMode('Admin')
    setAdminAction(nextAction)
    if (typeof window !== 'undefined') {
      const targetPath = nextAction === 'rooms' ? '/rooms' : '/classes'
      window.location.href = targetPath
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <ShieldCheck className="h-4 w-4 text-teal-600" />
        Admin management
      </div>
      <p className="mt-1 text-xs text-slate-500">Switch modes and jump to class or room tools from here.</p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setAdminMode('Admin')}
          className={`flex-1 rounded-lg px-2.5 py-2 text-xs font-medium ${isAdmin ? 'bg-teal-600 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          Admin
        </button>
        <button
          type="button"
          onClick={() => setAdminMode('Teacher')}
          className={`flex-1 rounded-lg px-2.5 py-2 text-xs font-medium ${!isAdmin ? 'bg-slate-800 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          Teacher
        </button>
      </div>

      {isAdmin && (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => handleAdminAction('classes')}
            className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs font-medium ${adminAction === 'classes' ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            <span>Manage classes</span>
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleAdminAction('rooms')}
            className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs font-medium ${adminAction === 'rooms' ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            <span>Manage rooms</span>
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [adminMode, setAdminMode] = useState(() => {
    if (typeof window === 'undefined') return 'Teacher'
    return window.localStorage.getItem('planner-role') || 'Teacher'
  })
  const [adminAction, setAdminAction] = useState(() => {
    if (typeof window === 'undefined') return 'classes'
    return window.localStorage.getItem('planner-admin-action') || 'classes'
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('planner-role', adminMode)
      window.localStorage.setItem('planner-admin-action', adminAction)
      window.dispatchEvent(new Event('planner-admin-state-changed'))
    }
  }, [adminMode, adminAction])

  const nav = [
    { label: "Dashboard", icon: LayoutDashboard, id: "dashboard", href: "/" },
    { label: "Teacher Dashboard", icon: BookOpen, id: "teacher-dashboard", href: "/teacher-dashboard" },
    { label: "Upload Excel", icon: Upload, id: "upload-excel", href: "/admin/upload-excel" },
    { label: "Schedules", icon: CalendarDays, id: "schedules", href: "/schedules" },
    { label: "Announcements", icon: Bell, id: "announcements", href: "/events" },
    { label: "Profile", icon: User, id: "profile", href: "/profile" },
  ]

  const isAdmin = adminMode === 'Admin'

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-slate-200">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-tight">Frontend</h1>
              <p className="text-[10px] font-medium text-teal-600 uppercase tracking-wider">ADMIN</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {nav.map(item => {
            const Icon = item.icon
            return (
              <div key={item.id}>
                <a
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                >
                  <Icon className="w-4.5 h-4.5 text-slate-400" />
                  {item.label}
                </a>
                {item.id === 'profile' && (
                  <div className="mt-4 px-1">
                    <AdminPanel
                      adminMode={adminMode}
                      setAdminMode={setAdminMode}
                      adminAction={adminAction}
                      setAdminAction={setAdminAction}
                      isAdmin={isAdmin}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Logout Section */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => {
              window.localStorage.removeItem('user');
              window.localStorage.removeItem('planner-role');
              window.localStorage.removeItem('planner-admin-action');
              window.location.href = '/login';
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-all"
          >
            <LogOut className="w-4.5 h-4.5" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 w-full">
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-slate-800">Frontend</h1>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <nav className="lg:hidden bg-white border-b border-slate-200 p-3 space-y-1">
            <div className="mb-3">
              <AdminPanel
                adminMode={adminMode}
                setAdminMode={setAdminMode}
                adminAction={adminAction}
                setAdminAction={setAdminAction}
                isAdmin={isAdmin}
              />
            </div>
            {nav.map(item => {
              const Icon = item.icon
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-600 hover:bg-slate-50"
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="w-4 h-4 text-slatee-400" />
                  {item.label}
                </a>
              )
            })}
          </nav>
        )}
        {children}
      </main>
    </div>
  )
}