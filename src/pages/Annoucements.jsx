import React, { useEffect, useState } from 'react'
import { Bell, Calendar, MapPin, Megaphone, AlertCircle } from 'lucide-react'

export default function Annoucements() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        setLoading(true)
        // Fetch from your announcements endpoint
        const res = await fetch('/announcements')
        if (!res.ok) throw new Error('Failed to fetch announcements')
        
        const data = await res.json()
        // Handle standard backend JSON format (array or wrapper object)
        const list = Array.isArray(data) ? data : (data.mysqlResult || data.data || [])
        setAnnouncements(list)
        setLoading(false)
      } catch (err) {
        console.error('Error loading announcements:', err)
        setError('Could not load announcements from the server.')
        setLoading(false)
      }
    }

    fetchAnnouncements()
  }, [])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm font-medium text-slate-500 animate-pulse">Loading announcements...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Announcements & Events</h1>
            <p className="text-xs text-slate-500">Stay up to date with school notices, orientations, and upcoming events.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Announcements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {announcements.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-white">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No announcements available right now.</p>
          </div>
        ) : (
          announcements.map((item) => (
            <div 
              key={item.id} 
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                    Notice #{item.id}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-800">{item.name}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {item.description || 'No additional description provided.'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  <span>{item.date ? new Date(item.date).toLocaleDateString() : 'Date TBD'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                  <span>{item.room || 'Location TBD'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}