import React, { useMemo, useState } from 'react';
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
  const { data: schedulesData } = useQuery(['schedules-for-volunteer-dropdown'], () => backend.list('schedules'));

  const volunteers = Array.isArray(volunteersData?.mysqlResult)
    ? volunteersData.mysqlResult
    : (Array.isArray(volunteersData) ? volunteersData : []);

  const usersList = Array.isArray(usersData?.mysqlResult)
    ? usersData.mysqlResult
    : (Array.isArray(usersData) ? usersData : []);

  const classesList = Array.isArray(classesData?.mysqlResult)
    ? classesData.mysqlResult
    : (Array.isArray(classesData) ? classesData : []);

  const schedulesList = Array.isArray(schedulesData?.mysqlResult)
    ? schedulesData.mysqlResult
    : (Array.isArray(schedulesData) ? schedulesData : []);

  // Some environments use role_id 1 for Teacher, others use 2.
  const teachersList = usersList.filter(user => {
    const roleId = Number(user.role_id);
    return roleId === 1 || roleId === 2;
  });

  const availableVolunteers = volunteers.filter((vol) => {
    const status = String(vol.status || '').toLowerCase();
    return !status || status === 'available' || status === 'checked_out';
  });

  const volunteeringStudentsByPeriod = useMemo(() => {
    const grouped = new Map();

    schedulesList.forEach((schedule) => {
      const className = String(schedule.class_name || '').trim().toLowerCase();
      if (className !== 'volunteering') return;

      const timeLabel = String(schedule.time || schedule.period || '').trim() || 'Unscheduled';
      const studentId = schedule.student_id ?? schedule.user_id ?? schedule.id;
      const studentName = String(schedule.student_name || schedule.name || '').trim() || `Student ${studentId || ''}`.trim();

      if (!grouped.has(timeLabel)) {
        grouped.set(timeLabel, []);
      }

      const bucket = grouped.get(timeLabel);
      if (!bucket.some((entry) => String(entry.studentId) === String(studentId) && entry.studentName === studentName)) {
        bucket.push({ studentId, studentName, timeLabel });
      }
    });

    return Array.from(grouped.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([timeLabel, students]) => ({
        timeLabel,
        students: students.sort((left, right) => left.studentName.localeCompare(right.studentName)),
      }));
  }, [schedulesList]);

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
    <div className="mx-auto my-6 max-w-6xl rounded-[28px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm md:p-6">
      <div className="space-y-4">
        {role === 'admin' && (
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Volunteer management</p>
                <h4 className="mt-1 text-xl font-semibold text-slate-900">Upload teacher schedules</h4>
                <p className="mt-1 text-sm text-slate-500">Choose a teacher, then upload a CSV schedule file.</p>
              </div>
              <div className="grid w-full gap-2 lg:w-auto lg:min-w-[420px] lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-end">
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium">Teacher</span>
                  <select
                    value={selectedTeacherScheduleId}
                    onChange={(event) => setSelectedTeacherScheduleId(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
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
                <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
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
              <div className="mt-3 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-teal-700">
                {teacherScheduleMessage}
              </div>
            )}
          </div>
        )}

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="border-b border-slate-200 bg-slate-50/80 p-4 lg:border-b-0 lg:border-r lg:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Available</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">Student volunteers</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{availableVolunteers.length}</span>
              </div>

              {role === 'admin' && (
                <div className="mb-4 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Volunteering schedule</p>
                      <p className="text-sm font-semibold text-slate-900">Students by time</p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      {volunteeringStudentsByPeriod.reduce((total, group) => total + group.students.length, 0)} students
                    </span>
                  </div>

                  {volunteeringStudentsByPeriod.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      No students are assigned to the Volunteering class in the schedules table yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {volunteeringStudentsByPeriod.map((group) => (
                        <label key={group.timeLabel} className="block space-y-1 text-sm text-slate-600">
                          <span className="font-medium text-slate-700">{group.timeLabel}</span>
                          <select className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100">
                            <option value="">Select student</option>
                            {group.students.map((student) => (
                              <option key={`${group.timeLabel}-${student.studentId}-${student.studentName}`} value={String(student.studentId || student.studentName)}>
                                {student.studentName}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {availableVolunteers.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-slate-200 bg-white py-10 text-center text-slate-400">
                  <HeartHandshake className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  <p className="text-sm font-medium">No available volunteers right now.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableVolunteers.map((vol, idx) => {
                    const studentId = vol.id || vol.student_id;
                    const isLoading = loadingId === studentId;
                    const volunteerName = vol.name || `${vol.first_name || 'Volunteer'} ${vol.last_name || ''}`;

                    return (
                      <div key={`available-${studentId || idx}`} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl bg-amber-50 p-2.5 text-amber-600">
                            <HeartHandshake className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="truncate font-semibold text-slate-900">{volunteerName}</p>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                              <Clock className="h-3.5 w-3.5 text-amber-600" />
                              <span>Total Hours: <strong className="text-slate-700">{vol.total_hours || '0.00'}</strong> hrs</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleActionClick(vol, 'check-out')}
                          disabled={isLoading || classesList.length === 0}
                          className="mt-3 w-full rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Assign to class
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="p-4 lg:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">All records</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">Volunteer roster</h3>
                  <p className="text-xs text-slate-500">Manage teacher assignments, check-ins, and return confirmations.</p>
                </div>
              </div>

              {volunteers.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-400">
                  <HeartHandshake className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  <p className="text-sm font-medium">No volunteers found.</p>
                </div>
              ) : (
                <div className="space-y-3">
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
                      <div key={studentId || idx} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl bg-amber-50 p-2.5 text-amber-600">
                            <HeartHandshake className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-1">
                                <p className="font-semibold text-slate-900">
                                  {vol.name || `${vol.first_name || 'Volunteer'} ${vol.last_name || ''}`}
                                </p>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                                  <span>Total Hours: <strong className="text-slate-700">{vol.total_hours || '0.00'}</strong> hrs</span>
                                </div>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColor}`}>
                                {statusText}
                              </span>
                            </div>

                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <button
                                onClick={() => handleActionClick(vol, 'check-in')}
                                disabled={isLoading || !canCheckIn}
                                className="flex items-center justify-center gap-1 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <LogIn className="h-3.5 w-3.5" />
                                {role === 'admin' ? 'Confirm return' : 'Check in'}
                              </button>
                              <button
                                onClick={() => handleActionClick(vol, 'check-out')}
                                disabled={isLoading || !canCheckOut}
                                className="flex items-center justify-center gap-1 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <LogOut className="h-3.5 w-3.5" />
                                {role === 'admin' ? 'Send to teacher' : 'Send back'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

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