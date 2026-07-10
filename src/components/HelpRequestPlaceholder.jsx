import React from 'react'
import { HelpCircle } from 'lucide-react'

export default function HelpRequestPlaceholder() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8">
      <div className="flex flex-col items-center justify-center text-center">
        <HelpCircle className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Request Help</h3>
        <p className="text-slate-500">Request support or assistance for your classroom</p>
      </div>
    </div>
  )
}
