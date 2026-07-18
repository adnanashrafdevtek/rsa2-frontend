import React from 'react';
import { Users } from 'lucide-react';

export default function MyClassesTab({ classes, studentClasses }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {classes.map(cls => (
        <div key={cls.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">{cls.name}</h3>
          <p className="text-sm text-slate-500">Room {cls.room_id} | Grade {cls.grade_level}</p>
          
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Enrolled Students</h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {studentClasses
                .filter(sc => sc.class_idclass === cls.id)
                .map(sc => (
                  <div key={sc.id} className="text-sm text-slate-600 flex items-center gap-2">
                    <Users className="h-3 w-3" /> Student ID: {sc.user_iduser}
                  </div>
                ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}