import React from 'react'
import { useQuery } from '@tanstack/react-query'
import backend from '../api/backendClient'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Users, GraduationCap, MapPin, Calendar, MessageSquare, BookOpen, Users2, Building2, CalendarCheck } from "lucide-react"

const RESOURCES = [
  { id: 'user', label: 'Users', icon: Users },
  { id: 'roles', label: 'Roles', icon: Users2 },
  { id: 'class', label: 'Classes', icon: BookOpen },
  { id: 'rooms', label: 'Rooms', icon: MapPin },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'schedules', label: 'Schedules', icon: Calendar },
  { id: 'student_classes', label: 'Student Classes', icon: GraduationCap },
  { id: 'clubs', label: 'Clubs', icon: Building2 },
  { id: 'events', label: 'Events', icon: CalendarCheck },
]

function useList(resource) {
  return useQuery(['backend', resource], () => backend.list(resource), { staleTime: 1000 * 30 })
}

function ResourceTable({ resource }) {
  const { data, isLoading, error } = useList(resource)
  const rows = Array.isArray(data) ? data : (data && data.mysqlResult) || []

  if (isLoading) return <div className="p-6 text-slate-500">Loading...</div>
  if (error) return <div className="p-6 text-red-600">Error: {String(error.message)}</div>

  if (rows.length === 0) {
    return <div className="p-6 text-center text-slate-500">No rows found</div>
  }

  return (
    <div className="border rounded-lg overflow-auto bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 border-b">
          <tr>
            {Object.keys(rows[0]).map(col => (
              <th key={col} className="p-3 text-left font-medium text-slate-700">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              {Object.keys(rows[0]).map(col => (
                <td key={col} className="p-3 text-slate-600 break-words max-w-xs">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Dashboard(){
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">Manage backend resources</p>
        </div>

        <Tabs defaultValue="user" className="space-y-6">
          <TabsList className="flex-wrap w-full justify-start">
            {RESOURCES.map(r => {
              const Icon = r.icon
              return (
                <TabsTrigger key={r.id} value={r.id} className="gap-2">
                  <Icon className="w-4 h-4" /> {r.label}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {RESOURCES.map(r => (
            <TabsContent key={r.id} value={r.id}>
              <ResourceTable resource={r.id} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
