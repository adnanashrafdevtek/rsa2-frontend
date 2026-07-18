import React from 'react';
import { Star } from 'lucide-react';

export default function ReviewsTab() {
  // Mock data for now until we define the backend table
  const reviews = [
    { id: 1, student: 'Alex P.', comment: 'Great class, very helpful!', rating: 5 },
    { id: 2, student: 'Jordan M.', comment: 'I learned a lot, thanks!', rating: 4 },
  ];

  return (
    <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm">
      <h3 className="font-semibold text-lg mb-6 text-slate-800">Student Reviews</h3>
      <div className="grid gap-4">
        {reviews.map(review => (
          <div key={review.id} className="p-4 border border-slate-100 rounded-lg shadow-sm">
            <div className="flex justify-between items-start">
              <p className="font-semibold text-slate-900">{review.student}</p>
              <div className="flex text-amber-400">
                {[...Array(review.rating)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
            </div>
            <p className="text-slate-600 mt-2 text-sm italic">"{review.comment}"</p>
          </div>
        ))}
      </div>
    </div>
  );
}