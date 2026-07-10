import React from 'react'
import { BookOpen } from 'lucide-react'

export default function MyClassesPlaceholder() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8">
      <div className="flex flex-col items-center justify-center text-center">
        <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 mb-2">My Classes</h3>
        <p className="text-slate-500">No classes assigned yet</p>
      </div>
    </div>
  )
}
