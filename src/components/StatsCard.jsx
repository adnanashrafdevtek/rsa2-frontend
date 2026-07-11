import React from 'react'

export default function StatsCard({ title, value, icon: Icon, color = 'bg-blue-500' }) {
  const textColor = color.replace('bg-', 'text-')
  
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 group">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          <div className={`${color} bg-opacity-10 p-2.5 rounded-lg`}>
            <Icon className={`w-4 h-4 ${textColor}`} />
          </div>
        </div>
        <div>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${color} opacity-40 group-hover:opacity-80 transition-opacity`} />
    </div>
  )
}
