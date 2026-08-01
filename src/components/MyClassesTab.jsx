import React, { useState, useEffect } from 'react';

export default function MyClassesTab() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query classes filtered by the teacher ID just like the dashboard expects
    fetch('/classes?teacher_id=2')
      .then(res => res.json())
      .then(data => {
        const classList = data.mysqlResult || data.data || data;
        setClasses(Array.isArray(classList) ? classList : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching classes:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm">
      <h3 className="font-semibold text-lg mb-4 text-slate-800">My Classes</h3>
      {loading ? (
        <p className="text-slate-500 text-sm">Loading classes...</p>
      ) : classes.length === 0 ? (
        <p className="text-slate-500 italic text-sm">No classes assigned yet.</p>
      ) : (
        <div className="grid gap-4">
          {classes.map(cls => (
            <div key={cls.id} className="p-4 border border-slate-100 rounded-md bg-slate-50/50">
              <h4 className="font-medium text-slate-900">{cls.name}</h4>
              <p className="text-sm text-slate-500 mt-1">Grade Level: {cls.grade_level}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}