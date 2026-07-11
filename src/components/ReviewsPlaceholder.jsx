import React from 'react'
import { Star } from 'lucide-react'

export default function ReviewsPlaceholder() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8">
      <div className="flex flex-col items-center justify-center text-center">
        <Star className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Student Reviews</h3>
        <p className="text-slate-500">Write and view reviews for students — not visible to students</p>
      </div>
    </div>
  )
}
