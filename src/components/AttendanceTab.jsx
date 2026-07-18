import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '../api/backendClient';

export default function AttendanceTab({ classes, teacherId }) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [attendance, setAttendance] = useState({});
  const queryClient = useQueryClient();

  const { data: studentClasses, isLoading } = useQuery(
    ['class-students', selectedClassId],
    () => backend.list('student_classes', { class_idclass: selectedClassId }),
    { enabled: !!selectedClassId }
  );

  // Safely extract the array regardless of response structure
  const students = studentClasses?.mysqlResult || (Array.isArray(studentClasses) ? studentClasses : []);

  const saveAttendance = useMutation(
    (records) => backend.post('attendance/bulk', { records }),
    { onSuccess: () => alert('Attendance saved successfully!') }
  );

  const handleStatusChange = (studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = () => {
    const records = students.map(sc => ({
      student_id: sc.user_iduser,
      class_id: selectedClassId,
      teacher_id: teacherId,
      date: new Date().toISOString().split('T')[0],
      status: attendance[sc.user_iduser] || 'present',
      marked_by: 'Teacher'
    }));
    saveAttendance.mutate(records);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">Select Class</label>
        <select 
          className="w-full p-2 border border-slate-300 rounded-md"
          value={selectedClassId} 
          onChange={(e) => setSelectedClassId(e.target.value)}
        >
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p>Loading students...</p>
      ) : (
        <div className="space-y-2">
          {students.length > 0 ? (
            students.map(sc => (
              <div key={sc.id} className="flex items-center justify-between p-3 border-b border-slate-100">
                <span className="font-medium text-slate-700">Student ID: {sc.user_iduser}</span>
                <div className="flex gap-2">
                  {['present', 'absent', 'tardy'].map(status => (
                    <button 
                      key={status} 
                      className={`px-3 py-1 text-sm rounded ${attendance[sc.user_iduser] === status ? 'bg-teal-600 text-white' : 'bg-slate-100 hover:bg-teal-100'}`}
                      onClick={() => handleStatusChange(sc.user_iduser, status)}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-slate-500 italic">No students are currently enrolled in this class.</p>
          )}

          {students.length > 0 && (
            <button onClick={handleSave} className="mt-6 w-full bg-teal-600 text-white font-semibold py-2 rounded-md hover:bg-teal-700 transition-colors">
              Save Attendance
            </button>
          )}
        </div>
      )}
    </div>
  );
}