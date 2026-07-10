import React from 'react'
import { Users2 } from 'lucide-react'

export default function VolunteersPlaceholder() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8">
      <div className="flex flex-col items-center justify-center text-center">
        <Users2 className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Request Volunteers</h3>
        <p className="text-slate-500">Click student cards to select, then assign them to your room</p>
      </div>
    </div>
  )
}
