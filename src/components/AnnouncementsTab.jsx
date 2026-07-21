import React, { useState, useEffect } from 'react';
import { Bell, Calendar } from 'lucide-react';

export default function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/announcements')
      .then(res => res.json())
      .then(data => {
        setAnnouncements(data.mysqlResult || data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching announcements:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-6 text-slate-500">Loading announcements...</div>;
  }

  return (
    <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm">
      <h3 className="font-semibold text-lg mb-6 text-slate-800">Recent Announcements</h3>
      
      {announcements.length > 0 ? (
        <div className="space-y-4">
          {announcements.map(announcement => (
            <div key={announcement.id} className="p-4 border-l-4 border-amber-500 bg-amber-50/50 rounded-r-lg shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="h-4 w-4 text-amber-600" />
                <h4 className="font-semibold text-slate-900">{announcement.title || 'Untitled Announcement'}</h4>
              </div>
              <p className="text-slate-600 text-sm">{announcement.content}</p>
              {announcement.created_at && (
                <div className="flex items-center gap-1 mt-3 text-xs text-slate-400">
                  <Calendar className="h-3 w-3" /> {new Date(announcement.created_at).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 italic">No announcements at this time.</p>
      )}
    </div>
  );
}