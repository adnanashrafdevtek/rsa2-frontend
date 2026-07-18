import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, Mail } from 'lucide-react';
import backend from '../api/backendClient';

export default function StudentsTab({ studentClasses }) {
  const { data: usersData } = useQuery(['users'], () => backend.list('users'));
  const users = usersData?.mysqlResult || [];

  // DEBUG: Let's see what we actually have
  console.log("Student Classes:", studentClasses);
  console.log("Users List:", users);

  const students = studentClasses.map(sc => {
    // Check if user ID is a string vs number or if the field name is different
    const userInfo = users.find(u => Number(u.id) === Number(sc.user_iduser));
    
    return {
      ...sc,
      first_name: userInfo?.first_name || 'Not Found',
      last_name: userInfo?.last_name || '',
      email: userInfo?.email_address || 'No email'
    };
  });

  const uniqueStudents = Array.from(new Map(students.map(s => [s.user_iduser, s])).values());

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-6 text-slate-800">All Enrolled Students</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {uniqueStudents.map(s => (
          <div key={s.user_iduser} className="p-4 border border-slate-100 rounded-lg shadow-sm flex items-start gap-3 bg-white">
            <div className="p-2 bg-blue-50 rounded-full"><User className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="font-semibold text-slate-900">{s.first_name} {s.last_name}</p>
              <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                <Mail className="h-3 w-3" /> {s.email}
              </div>
              <p className="text-xs text-slate-400 mt-2">ID: {s.user_iduser}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}