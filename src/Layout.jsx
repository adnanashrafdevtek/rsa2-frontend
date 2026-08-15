import React, { useState } from 'react'
import { LayoutDashboard, CalendarDays, Bell, BookOpen, User, Menu, X, GraduationCap, Upload, LogOut } from "lucide-react"

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  
  // Check role ID (1 = Admin, 2 = Teacher) or fallback to planner-role string
  const storedRoleId = typeof window !== 'undefined' ? window.localStorage.getItem('planner-current-role-id') : null;
  const isActualAdmin = storedRoleId ? Number(storedRoleId) === 1 : false;

  // Define navigation items with strict separation flags
  const allNavItems = [
    { label: "Dashboard", icon: LayoutDashboard, id: "dashboard", href: "/", adminOnly: true },
    { label: "Teacher Dashboard", icon: BookOpen, id: "teacher-dashboard", href: "/teacher-dashboard", teacherOnly: true },
    { label: "Import Users", icon: Upload, id: "upload-excel", href: "/admin/upload-excel", adminOnly: true },
    { label: "Schedules", icon: CalendarDays, id: "schedules", href: "/schedules", adminOnly: false },
    { label: "Announcements", icon: Bell, id: "announcements", href: "/events", adminOnly: false },
    { label: "Profile", icon: User, id: "profile", href: "/profile", adminOnly: false },
  ]

  // Filter navigation items strictly based on role
  const nav = allNavItems.filter(item => {
    if (isActualAdmin) {
      return !item.teacherOnly; // Admins see everything except teacher-only views
    }
    return !item.adminOnly; // Teachers see everything except admin-only views
  });

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
              <p className="text-[10px] font-medium text-teal-600 uppercase tracking-wider">
                {isActualAdmin ? 'ADMIN' : 'TEACHER'}
              </p>
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
              </div>
            )
          })}
        </nav>

        {/* Logout Section */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => {
              window.localStorage.clear();
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
            {nav.map(item => {
              const Icon = item.icon
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-600 hover:bg-slate-50"
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="w-4 h-4 text-slate-400" />
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