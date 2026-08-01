import React, { useState, useEffect } from 'react';
import { Star, Plus, X } from 'lucide-react';

export default function ReviewsTab() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form states for creating a review
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = () => {
    fetch('http://localhost:3000/reviews')
      .then(res => res.json())
      .then(data => {
        setReviews(data.mysqlResult || data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching reviews:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleCreateReview = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const currentUserId = localStorage.getItem('planner-current-user-id') || 1;

    try {
      const response = await fetch('http://localhost:3000/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          rating: Number(rating),
          comment: comment
        })
      });

      if (response.ok) {
        setComment('');
        setRating(5);
        setIsModalOpen(false);
        fetchReviews(); // Refresh review list
      } else {
        alert('Failed to submit review');
      }
    } catch (err) {
      console.error('Error submitting review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-500">Loading reviews...</div>;
  }

  return (
    <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-lg text-slate-800">Student Reviews</h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-teal-700 transition-all"
        >
          <Plus className="h-4 w-4" />
          Create Review
        </button>
      </div>

      <div className="grid gap-4">
        {reviews.length === 0 ? (
          <p className="text-slate-500 text-sm">No reviews found.</p>
        ) : (
          reviews.map(review => (
            <div key={review.id} className="p-4 border border-slate-100 rounded-lg shadow-sm">
              <div className="flex justify-between items-start">
                <p className="font-semibold text-slate-900">
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

      {/* Modal Popup for Creating Review */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-lg text-slate-800">Write a Review</h4>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReview} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Rating (1–5 Stars)
                </label>
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="5">5 - Excellent</option>
                  <option value="4">4 - Good</option>
                  <option value="3">3 - Average</option>
                  <option value="2">2 - Poor</option>
                  <option value="1">1 - Terrible</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Comment
                </label>
                <textarea
                  rows="4"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your feedback..."
                  required
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="border border-slate-300 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-teal-700 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Post Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}