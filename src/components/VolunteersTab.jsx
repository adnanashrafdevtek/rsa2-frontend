import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeartHandshake, LogIn, LogOut, Clock, X } from 'lucide-react';
import backend from '../api/backendClient';

export default function VolunteersTab({ role = 'teacher' }) {
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState(null);
  const [selectedTeacherScheduleId, setSelectedTeacherScheduleId] = useState('');
  const [teacherScheduleMessage, setTeacherScheduleMessage] = useState('');
  
  // Modal state for class selection when assigning volunteers.
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [modalActionEndpoint, setModalActionEndpoint] = useState(null);

  // Fetch volunteers
  const { data: volunteersData } = useQuery(['volunteers'], () => backend.list('volunteers'), {
    refetchInterval: 5000,
  });

  // Fetch users for teacher schedule uploads.
  const { data: usersData } = useQuery(['users'], () => backend.list('users'));
  const { data: classesData } = useQuery(['classes-for-volunteer-assignment'], () => backend.list('classes'));

  const volunteers = Array.isArray(volunteersData?.mysqlResult)
    ? volunteersData.mysqlResult
    : (Array.isArray(volunteersData) ? volunteersData : []);

  const usersList = Array.isArray(usersData?.mysqlResult)
    ? usersData.mysqlResult
    : (Array.isArray(usersData) ? usersData : []);

  const classesList = Array.isArray(classesData?.mysqlResult)
    ? classesData.mysqlResult
    : (Array.isArray(classesData) ? classesData : []);

  // Some environments use role_id 1 for Teacher, others use 2.
  const teachersList = usersList.filter(user => {
    const roleId = Number(user.role_id);
    return roleId === 1 || roleId === 2;
  });

  const availableVolunteers = volunteers.filter((vol) => {
    const status = String(vol.status || '').toLowerCase();
    return !status || status === 'available' || status === 'checked_out';
  });

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
    // The modal should only open when admin assigns an available volunteer to a class.
    if (role === 'admin' && endpoint === 'check-out') {
      setSelectedVolunteer(student);
      setModalActionEndpoint(endpoint);
      setSelectedClassId('');
    } else {
      // Teacher check-in/send-back and admin return confirmations execute instantly.
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
    setSelectedClassId('');
  };

  const handleConfirmAction = () => {
    if (!selectedVolunteer) return;
    const studentId = selectedVolunteer.id || selectedVolunteer.student_id;
    setLoadingId(studentId);
    
    updateStatusMutation.mutate({ 
      studentId, 
      endpoint: modalActionEndpoint, 
      teacherId: selectedClassId 
    });
  };

  const handleTeacherScheduleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedTeacherScheduleId) {
      setTeacherScheduleMessage('Select a teacher before uploading a schedule.');
      event.target.value = '';
      return;
    }

    try {
      const fileContent = await file.text();
      const result = await backend.create('user_schedules', {
        user_id: Number(selectedTeacherScheduleId),
        user_type: 'teacher',
        file_name: file.name,
        file_content: fileContent,
      });

      const importedCount = Number(result?.importedCount || 0);
      const importedMessage = importedCount > 0
        ? ` Imported ${importedCount} row${importedCount === 1 ? '' : 's'} into schedules.`
        : '';
      setTeacherScheduleMessage(`Teacher schedule uploaded successfully.${importedMessage}`);
    } catch (uploadError) {
      setTeacherScheduleMessage(uploadError.message || 'Failed to upload teacher schedule.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm max-w-6xl mx-auto my-6">
      {role === 'admin' && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Upload Teacher Schedules</h4>
              <p className="text-xs text-slate-500">Choose a teacher, then upload a CSV schedule file.</p>
            </div>
            <div className="grid w-full gap-2 md:w-auto md:grid-cols-[minmax(220px,1fr)_auto] md:items-end">
              <label className="space-y-1 text-sm text-slate-600">
                <span className="font-medium">Teacher</span>
                <select
                  value={selectedTeacherScheduleId}
                  onChange={(event) => setSelectedTeacherScheduleId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select teacher</option>
                  {teachersList.map((teacher) => {
                    const teacherId = teacher.id || teacher.user_id;
                    const teacherLabel = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || `Teacher ${teacherId}`;
                    return (
                      <option key={teacherId} value={teacherId}>{teacherLabel}</option>
                    );
                  })}
                </select>
              </label>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={handleTeacherScheduleUpload}
                />
              </label>
            </div>
          </div>

          {teacherScheduleMessage && (
            <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
              {teacherScheduleMessage}
            </div>
          )}
        </div>
      )}

      {role === 'admin' && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Available Student Volunteers</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{availableVolunteers.length}</span>
          </div>

          {availableVolunteers.length === 0 ? (
            <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
              <HeartHandshake className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No available volunteers right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableVolunteers.map((vol, idx) => {
                const studentId = vol.id || vol.student_id;
                const isLoading = loadingId === studentId;
                const volunteerName = vol.name || `${vol.first_name || 'Volunteer'} ${vol.last_name || ''}`;

                return (
                  <div key={`available-${studentId || idx}`} className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                        <HeartHandshake className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-slate-900">{volunteerName}</p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Clock className="h-3.5 w-3.5 text-amber-600" />
                          <span>Total Hours: <strong className="text-slate-700">{vol.total_hours || '0.00'}</strong> hrs</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleActionClick(vol, 'check-out')}
                      disabled={isLoading || classesList.length === 0}
                      className="w-full rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Assign To Class
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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

      {/* Class selection modal for admin assignment. */}
      {selectedVolunteer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            
            <h4 className="text-base font-bold text-slate-900">Select Target Class</h4>
            <p className="text-xs text-slate-500">
              Choose the class you want to assign <strong>{selectedVolunteer.name || selectedVolunteer.first_name}</strong> to:
            </p>

            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- Select a Class --</option>
              {classesList.map((classItem) => {
                const classIdValue = classItem.id;
                const classLabel = classItem.name || `Class #${classIdValue}`;
                const teacher = teachersList.find((teacherItem) => String(teacherItem.id) === String(classItem.teacher_id));
                const teacherLabel = teacher
                  ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || `Teacher ${teacher.id}`
                  : (classItem.teacher_id ? `Teacher ${classItem.teacher_id}` : 'Unassigned teacher');
                const details = [classItem.period, classItem.room].filter(Boolean).join(' | ');
                return (
                  <option key={classIdValue} value={classIdValue}>
                    {`${classLabel} - ${teacherLabel}${details ? ` (${details})` : ''}`}
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
                disabled={!selectedClassId}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Assign Volunteer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}