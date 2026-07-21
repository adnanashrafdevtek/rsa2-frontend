import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { HeartHandshake, Mail } from 'lucide-react';
import backend from '../api/backendClient';

export default function VolunteersTab() {
  const { data: volunteersData } = useQuery(['volunteers'], () => backend.list('volunteers'));
  
  const volunteers = Array.isArray(volunteersData?.mysqlResult) 
    ? volunteersData.mysqlResult 
    : (Array.isArray(volunteersData) ? volunteersData : []);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-6 text-slate-800">All Volunteers</h3>
      
      {volunteers.length === 0 ? (
        <p className="text-sm text-slate-500">No volunteers found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {volunteers.map((vol, idx) => (
            <div key={vol.id || idx} className="p-4 border border-slate-100 rounded-lg bg-white flex items-start gap-3">
              <div className="p-2 bg-amber-50 rounded-full"><HeartHandshake className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="font-semibold text-slate-900">{vol.name || `${vol.first_name || 'Volunteer'} ${vol.last_name || ''}`}</p>
                <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                  <Mail className="h-3 w-3" /> {vol.email || vol.email_address || 'No email'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}