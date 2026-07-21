import React, { useState, useEffect } from 'react';

export default function AttendanceTab() {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(false);

  // 1. Fetch classes and users mapping on component load
  useEffect(() => {
    fetch('/classes')
      .then(res => res.json())
      .then(data => {
        const classList = data.mysqlResult || data.data || data;
        if (Array.isArray(classList)) {
          setClasses(classList);
          if (classList.length > 0) {
            setSelectedClassId(prevId => prevId || classList[0].id);
          }
        }
      })
      .catch(err => console.error('Error fetching classes:', err));

    // Fetch users so we can map user_iduser to actual first/last names
    fetch('/users')
      .then(res => res.json())
      .then(data => {
        const userList = data.mysqlResult || data.data || data;
        if (Array.isArray(userList)) {
          const map = {};
          userList.forEach(u => {
            map[u.id] = u;
          });
          setUsersMap(map);
        }
      })
      .catch(err => console.error('Error fetching users:', err));
  }, []);

  // 2. Fetch students whenever selectedClassId changes
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    
    setLoading(true);
    fetch(`/student_classes?class_idclass=${selectedClassId}`)
      .then(res => res.json())
      .then(data => {
        const studentList = data.mysqlResult || data.data || data;
        setStudents(Array.isArray(studentList) ? studentList : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching students:', err);
        setLoading(false);
      });
  }, [selectedClassId]);

  return (
    <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm">
      <h3 className="font-semibold text-lg mb-4 text-slate-800">Select Class</h3>
      
      <select 
        value={selectedClassId} 
        onChange={(e) => setSelectedClassId(e.target.value)}
        className="w-full p-2 border border-slate-300 rounded-md mb-6"
      >
        <option value="">-- Choose a Class --</option>
        {classes.map(cls => (
          <option key={cls.id} value={cls.id}>
            {cls.name || cls.class_name || `Class #${cls.id}`}
          </option>
        ))}
      </select>

      <div className="space-y-2">
        <h4 className="font-medium text-slate-700 text-sm mb-3">Student Roster</h4>
        {loading ? (
          <p className="text-slate-500 text-sm">Loading students...</p>
        ) : students.length === 0 ? (
          <p className="text-slate-500 italic text-sm">No students found for this class.</p>
        ) : (
          students.map(student => {
            const userInfo = usersMap[student.user_iduser] || {};
            const fullName = userInfo.first_name || userInfo.last_name 
              ? `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim() 
              : `Student ID: ${student.user_iduser}`;

            return (
              <div key={student.id || student.user_iduser} className="p-3 border border-slate-100 rounded-md bg-slate-50/50 flex justify-between items-center">
                <span className="font-medium text-slate-900">
                  {fullName}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}