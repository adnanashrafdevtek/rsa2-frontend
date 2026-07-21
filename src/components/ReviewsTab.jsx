import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';

export default function ReviewsTab() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/reviews')
      .then(res => res.json())
      .then(data => {
        // Handle your backend table response wrapper (mysqlResult)
        setReviews(data.mysqlResult || data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching reviews:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-6 text-slate-500">Loading reviews...</div>;
  }

  return (
    <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm">
      <h3 className="font-semibold text-lg mb-6 text-slate-800">Student Reviews</h3>
      <div className="grid gap-4">
        {reviews.length === 0 ? (
          <p className="text-slate-500 text-sm">No reviews found.</p>
        ) : (
          reviews.map(review => (
            <div key={review.id} className="p-4 border border-slate-100 rounded-lg shadow-sm">
              <div className="flex justify-between items-start">
                <p className="font-semibold text-slate-900">
                  {/* Fallback to user_id or display name depending on your SQL schema */}
                  {review.student_name || `User #${review.user_id}`}
                </p>
                <div className="flex text-amber-400">
                  {[...Array(review.rating || 0)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
              </div>
              <p className="text-slate-600 mt-2 text-sm italic">"{review.comment}"</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}