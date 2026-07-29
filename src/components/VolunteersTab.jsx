import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeartHandshake, LogIn, LogOut, Clock, X } from 'lucide-react';
import backend from '../api/backendClient';

export default function VolunteersTab({ role = 'teacher' }) {
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState(null);
  
  // Modal State for Teacher Selection
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [modalActionEndpoint, setModalActionEndpoint] = useState(null);

  // Fetch volunteers
  const { data: volunteersData } = useQuery(['volunteers'], () => backend.list('volunteers'), {
    refetchInterval: 5000,
  });

  // Fetch users to filter teachers (role_id === 2)
  const { data: usersData } = useQuery(['users'], () => backend.list('users'));

  const volunteers = Array.isArray(volunteersData?.mysqlResult)
    ? volunteersData.mysqlResult
    : (Array.isArray(volunteersData) ? volunteersData : []);

  const usersList = Array.isArray(usersData?.mysqlResult)
    ? usersData.mysqlResult
    : (Array.isArray(usersData) ? usersData : []);

  // Filter users who have role_id === 2 (Teachers)
  const teachersList = usersList.filter(user => Number(user.role_id) === 2);

  const updateStatusMutation = useMutation(
    async ({ studentId, endpoint, teacherId }) => {
      const currentUserId = typeof window !== 'undefined'
        ? window.localStorage.getItem('planner-current-user-id')
        : 1;

      let payload = { 
        student_id: studentId,
        class_id: teacherId ? Number(teacherId) : undefined, 
        user_id: Number(currentUserId) 
      };

      const route = endpoint === 'check-out' ? 'volunteerHours/check-out' : 'volunteerHours/check-in';
      
      return await backend.create(route, payload);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['volunteers']);
        setLoadingId(null);
        closeModal();
      },
      onError: (err) => {
        console.error('Action error:', err);
        setLoadingId(null);
      }
    }
  );

  const handleActionClick = (student, endpoint) => {
    // The modal should ONLY open when the admin is sending an available volunteer TO a teacher ('check-out' action).
    if (role === 'admin' && endpoint === 'check-out') {
      setSelectedVolunteer(student);
      setModalActionEndpoint(endpoint);
      setSelectedTeacherId('');
    } else {
      // Teacher Check-in, Teacher Send Back, and Admin Confirm Return all skip the modal and execute instantly.
      const studentId = student.id || student.student_id;
      setLoadingId(studentId);
      updateStatusMutation.mutate({ 
        studentId, 
        endpoint, 
        teacherId: undefined 
      });
    }
  };

  const closeModal = () => {
    setSelectedVolunteer(null);
    setModalActionEndpoint(null);
    setSelectedTeacherId('');
  };

  const handleConfirmAction = () => {
    if (!selectedVolunteer) return;
    const studentId = selectedVolunteer.id || selectedVolunteer.student_id;
    setLoadingId(studentId);
    
    updateStatusMutation.mutate({ 
      studentId, 
      endpoint: modalActionEndpoint, 
      teacherId: selectedTeacherId 
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm max-w-6xl mx-auto my-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">All Volunteers</h3>
          <p className="text-xs text-slate-500">Manage teacher assignments, check-ins, and return confirmations.</p>
        </div>
      </div>

      {volunteers.length === 0 ? (
        <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
          <HeartHandshake className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No volunteers found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {volunteers.map((vol, idx) => {
            const studentId = vol.id || vol.student_id;
            const isLoading = loadingId === studentId;
            const status = vol.status || 'available';

            let statusText = 'Available';
            let statusColor = 'bg-slate-100 text-slate-600';

            if (status === 'requesting_confirmation' || status === 'pending') {
              statusText = 'Pending Confirmation';
              statusColor = 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse';
            } else if (status === 'checked_in') {
              statusText = 'Checked In';
              statusColor = 'bg-emerald-50 text-emerald-700';
            } else if (status === 'returning_confirmation') {
              statusText = 'Returning Confirmation';
              statusColor = 'bg-purple-50 text-purple-700 border border-purple-200';
            } else if (status === 'checked_out' || status === 'available') {
              statusText = 'Available';
              statusColor = 'bg-slate-100 text-slate-600';
            }

            let canCheckIn = false;
            let canCheckOut = false;

            if (role === 'admin') {
              canCheckOut = status === 'available' || status === 'checked_out';
              canCheckIn = status === 'returning_confirmation';
            } else {
              canCheckIn = status === 'available' || status === 'requesting_confirmation' || status === 'pending';
              canCheckOut = status === 'checked_in';
            }

            return (
              <div key={studentId || idx} className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col justify-between space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                    <HeartHandshake className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">
                      {vol.name || `${vol.first_name || 'Volunteer'} ${vol.last_name || ''}`}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                      <span>Total Hours: <strong className="text-slate-700">{vol.total_hours || '0.00'}</strong> hrs</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Status:</span>
                    <span className={`font-semibold px-2.5 py-1 rounded-full text-[11px] ${statusColor}`}>
                      {statusText}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleActionClick(vol, 'check-in')}
                      disabled={isLoading || !canCheckIn}
                      className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      {role === 'admin' ? 'Confirm Return' : 'Check In'}
                    </button>
                    <button
                      onClick={() => handleActionClick(vol, 'check-out')}
                      disabled={isLoading || !canCheckOut}
                      className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {role === 'admin' ? 'Send to Teacher' : 'Send Back'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Teacher Selection Modal (Admin Send to Teacher Only) */}
      {selectedVolunteer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            
            <h4 className="text-base font-bold text-slate-900">Select Target Teacher</h4>
            <p className="text-xs text-slate-500">
              Choose the teacher you want to assign <strong>{selectedVolunteer.name || selectedVolunteer.first_name}</strong> to:
            </p>

            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- Select a Teacher --</option>
              {teachersList.map((teacher) => {
                const teacherIdValue = teacher.id || teacher.user_id;
                const teacherNameLabel = teacher.name || `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || `Teacher #${teacherIdValue}`;
                return (
                  <option key={teacherIdValue} value={teacherIdValue}>
                    {teacherNameLabel}
                  </option>
                );
              })}
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={closeModal}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmAction}
                disabled={!selectedTeacherId}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send / Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}