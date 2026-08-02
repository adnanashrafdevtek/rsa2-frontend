import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeartHandshake, LogIn, LogOut, Clock, X } from 'lucide-react';
import backend from '../api/backendClient';
import ScheduleTable from './ScheduleTable';

function parseCSV(text) {
  const normalizedText = String(text || '').replace(/\r/g, '')
  const lines = normalizedText.split('\n').filter((line) => line.trim() !== '')

  if (!lines.length) {
    return { headers: [], rows: [] }
  }

  const parseLine = (line) => {
    const cells = []
    let current = ''
    let inQuotes = false

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index]

      if (character === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"'
          index += 1
        } else {
          inQuotes = !inQuotes
        }
        continue
      }

      if (character === ',' && !inQuotes) {
        cells.push(current)
        current = ''
        continue
      }

      current += character
    }

    cells.push(current)
    return cells.map((cell) => cell.trim())
  }

  const headers = parseLine(lines[0]).map((header) => header.trim()).filter(Boolean)
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line)
    return headers.reduce((accumulator, header, index) => {
      accumulator[header] = cells[index] ?? ''
      return accumulator
    }, {})
  }).filter((row) => Object.values(row).some((value) => String(value).trim() !== ''))

  return { headers, rows }
}

function titleize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeDayLabel(value) {
  const normalized = normalizeValue(value)
  if (!normalized) return ''
  if (normalized === 'a-day' || normalized === 'a day') return 'A-day'
  if (normalized === 'b-day' || normalized === 'b day') return 'B-day'
  return ''
}

function buildClassKey(row) {
  return [row.class_name, row.teacher, row.room, row.period, row.time]
    .map(normalizeValue)
    .filter(Boolean)
    .join('|')
}

function parseTimeToMinutes(value) {
  const text = String(value || '').trim()
  if (!text) return null

  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = Number(match[2] || '0')
  const meridiem = match[3]?.toLowerCase() || ''

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

  if (meridiem === 'pm' && hours < 12) hours += 12
  if (meridiem === 'am' && hours === 12) hours = 0

  return (hours * 60) + minutes
}

function parseTimeRange(value) {
  const text = String(value || '').trim()
  if (!text) return null

  const normalized = text.replace(/\s+/g, '')
  const rangeMatch = normalized.match(/^(.*?)\s*[-–]\s*(.*)$/)
  if (!rangeMatch) {
    const singleTime = parseTimeToMinutes(normalized)
    return singleTime === null ? null : { start: singleTime, end: singleTime }
  }

  const start = parseTimeToMinutes(rangeMatch[1])
  const end = parseTimeToMinutes(rangeMatch[2])
  if (start === null || end === null) return null

  return { start, end }
}

function isTimeWithinRange(currentMinutes, rangeText) {
  const range = parseTimeRange(rangeText)
  if (!range) return false

  if (range.start <= range.end) {
    return currentMinutes >= range.start && currentMinutes <= range.end
  }

  return currentMinutes >= range.start || currentMinutes <= range.end
}

const TEACHER_SCHEDULE_COLUMNS = [
  { key: 'Teacher', label: 'Teacher' },
  { key: 'Class Name', label: 'Class Name' },
  { key: 'Room', label: 'Room' },
  { key: 'Period', label: 'Period' },
  { key: 'Time', label: 'Time' },
  { key: 'A-Day/B-Day', label: 'A-Day/B-Day' },
  { key: 'Volunteers', label: 'Volunteers' },
]

export default function VolunteersTab({ role = 'teacher' }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [loadingId, setLoadingId] = useState(null);
  const [selectedTeacherScheduleId, setSelectedTeacherScheduleId] = useState('');
  const [teacherScheduleMessage, setTeacherScheduleMessage] = useState('');
  const [teacherScheduleFilters, setTeacherScheduleFilters] = useState({
    teacher: '',
    className: '',
    room: '',
    period: '',
    time: '',
    day: '',
    volunteers: '',
  });
  const [appliedTeacherScheduleFilters, setAppliedTeacherScheduleFilters] = useState({
    teacher: '',
    className: '',
    room: '',
    period: '',
    time: '',
    day: '',
    volunteers: '',
  });
  
  // Modal state for class selection when assigning volunteers.
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [modalActionEndpoint, setModalActionEndpoint] = useState(null);

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

  // Fetch users for teacher schedule uploads.
  const { data: usersData } = useQuery(['users'], () => backend.list('users'));
  const { data: classesData } = useQuery(['classes-for-volunteer-assignment'], () => backend.list('classes'));
  const { data: schedulesData } = useQuery(['schedules-for-volunteer-list'], () => backend.list('schedules'));
  const { data: teacherSchedulesData } = useQuery(['teacher-schedules'], () => backend.list('user_schedules'));

function formatDuration(startValue, endValue) {
  if (!startValue) return '—'
  const start = new Date(String(startValue).replace(' ', 'T'))
  const end = endValue ? new Date(String(endValue).replace(' ', 'T')) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—'
  const minutes = Math.max(Math.round((end - start) / 60000), 0)
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return `${hours}h ${String(remaining).padStart(2, '0')}m`
}

export default function VolunteersTab() {
  const queryClient = useQueryClient()
  const teacherId = typeof window !== 'undefined' ? Number(window.localStorage.getItem('planner-current-user-id') || 0) : 0
  const [loadingId, setLoadingId] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const { data: classesData, isLoading: classesLoading, error: classesError } = useQuery(
    ['teacher-volunteer-classes', teacherId],
    () => (teacherId ? backend.list('classes', { teacher_id: teacherId }) : Promise.resolve([])),
    { enabled: !!teacherId, refetchInterval: 5000 }
  )

  const teacherSchedulesList = Array.isArray(teacherSchedulesData?.mysqlResult)
    ? teacherSchedulesData.mysqlResult
    : (Array.isArray(teacherSchedulesData) ? teacherSchedulesData : []);

  const schedulesList = Array.isArray(schedulesData?.mysqlResult)
    ? schedulesData.mysqlResult
    : (Array.isArray(schedulesData) ? schedulesData : []);

  // Some environments use role_id 1 for Teacher, others use 2.
  const teachersList = usersList.filter(user => {
    const roleId = Number(user.role_id);
    return roleId === 1 || roleId === 2;
  });

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(timerId);
  }, []);

  const uploadedTeacherSchedules = useMemo(() => {
    const classLookup = new Map()
    const classNameLookup = new Map()

    classesList.forEach((classItem) => {
      const teacher = teachersList.find((user) => String(user.id) === String(classItem.teacher_id))
      const teacherLabel = teacher ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address : ''
      const room = classItem.room_name || classItem.room || classItem.room_id
      const compositeKey = [classItem.name, teacherLabel, room, classItem.period, classItem.time]
        .map(normalizeValue)
        .filter(Boolean)
        .join('|')

      if (compositeKey) {
        classLookup.set(compositeKey, classItem)
      }

      const nameKey = normalizeValue(classItem.name)
      if (nameKey && !classNameLookup.has(nameKey)) {
        classNameLookup.set(nameKey, classItem)
      }
    })

    const volunteersByClass = new Map()
    volunteers.forEach((volunteer) => {
      const classId = volunteer.assigned_class_id
      if (!classId) return

      if (!volunteersByClass.has(String(classId))) {
        volunteersByClass.set(String(classId), [])
      }

      const volunteerName = volunteer.name || `${volunteer.first_name || 'Volunteer'} ${volunteer.last_name || ''}`.trim() || `Volunteer ${volunteer.id}`
      volunteersByClass.get(String(classId)).push(volunteerName)
    })

    return teacherSchedulesList
      .filter((schedule) => String(schedule.user_type || '').toLowerCase() === 'teacher')
      .map((schedule) => {
        const teacherId = schedule.user_id;
        const teacher = teachersList.find((user) => String(user.id) === String(teacherId));
        const teacherName = teacher
          ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || `Teacher ${teacherId}`
          : `Teacher ${teacherId}`;
        const parsedSchedule = parseCSV(schedule.file_content || '')

        const rows = parsedSchedule.rows.map((row) => {
          const classKey = buildClassKey(row)
          const matchedClass = classLookup.get(classKey) || classNameLookup.get(normalizeValue(row.class_name))
          const rowVolunteers = matchedClass
            ? (volunteersByClass.get(String(matchedClass.id)) || [])
            : []

          const studentId = row.student_id || row.studentId || ''
          const studentName = row.student_name || row.studentName || ''
          const className = row.class_name || matchedClass?.name || ''
          const room = row.room || matchedClass?.room || matchedClass?.room_name || ''
          const period = row.period || matchedClass?.period || ''
          const time = row.time || matchedClass?.time || ''
          const day = normalizeDayLabel(row['A-Day/B-Day'] || period || '')
          const volunteersLabel = rowVolunteers.length > 0 ? rowVolunteers.join(', ') : '—'

          return {
            'Student ID': studentId,
            'Student Name': studentName,
            Teacher: teacherName,
            'Class Name': className,
            Room: room,
            Period: period,
            Time: time,
            'A-Day/B-Day': day,
            Volunteers: volunteersLabel,
          }
        })

        return {
          id: schedule.id,
          teacherId,
          teacherName,
          fileName: schedule.file_name || 'Teacher schedule',
          uploadedAt: schedule.created_at || schedule.updated_at || '',
          columns: TEACHER_SCHEDULE_COLUMNS,
          rows,
          rowCount: rows.length || Number(schedule.imported_count || schedule.row_count || schedule.total_rows || 0),
        };
      })
      .sort((left, right) => String(right.uploadedAt || '').localeCompare(String(left.uploadedAt || '')));
  }, [teacherSchedulesList, teachersList, classesList, volunteers]);

  const combinedTeacherScheduleRows = useMemo(() => {
    return uploadedTeacherSchedules.flatMap((schedule) =>
      schedule.rows.map((row) => ({
        ...row,
        __scheduleId: schedule.id,
        __teacherName: schedule.teacherName,
        __uploadedAt: schedule.uploadedAt,
      }))
    )
  }, [uploadedTeacherSchedules])

  const availableVolunteers = useMemo(() => {
    const currentMinutes = (now.getHours() * 60) + now.getMinutes()
    const studentsById = new Map()

    schedulesList.forEach((row) => {
      const className = normalizeValue(row.class_name || row.className)
      if (className !== 'volunteering') return

      if (!isTimeWithinRange(currentMinutes, row.time)) return

      const studentId = String(row.student_id || row.studentId || '').trim()
      const studentName = String(row.student_name || row.studentName || '').trim()
      const key = studentId || normalizeValue(studentName)
      if (!key || studentsById.has(key)) return

      studentsById.set(key, {
        id: studentId || undefined,
        student_id: studentId || undefined,
        name: studentName || (studentId ? `Student ${studentId}` : 'Volunteer'),
        first_name: studentName || '',
        last_name: '',
        status: 'available',
        total_hours: '0.00',
      })
    })

    return Array.from(studentsById.values())
  }, [schedulesList, now])

  const teacherScheduleFilterOptions = useMemo(() => {
    const uniqueValues = (key) => {
      const values = new Set()
      combinedTeacherScheduleRows.forEach((row) => {
        const value = String(row[key] || '').trim()
        if (value && value !== '—') {
          values.add(value)
        }
      })
      return Array.from(values).sort((left, right) => left.localeCompare(right))
    }

    return {
      teacher: uniqueValues('Teacher'),
      className: uniqueValues('Class Name'),
      room: uniqueValues('Room'),
      period: uniqueValues('Period'),
      time: uniqueValues('Time'),
      day: ['A-day', 'B-day'],
      volunteers: uniqueValues('Volunteers'),
    }
  }, [combinedTeacherScheduleRows])

  const filteredTeacherScheduleRows = useMemo(() => {
    const matches = (value, selected) => {
      if (!selected) return true
      return normalizeValue(value) === normalizeValue(selected)
    }

    return combinedTeacherScheduleRows.filter((row) => {
      const volunteersValue = String(row.Volunteers || '').trim()
      return (
        matches(row.Teacher, appliedTeacherScheduleFilters.teacher) &&
        matches(row['Class Name'], appliedTeacherScheduleFilters.className) &&
        matches(row.Room, appliedTeacherScheduleFilters.room) &&
        matches(row.Period, appliedTeacherScheduleFilters.period) &&
        matches(row.Time, appliedTeacherScheduleFilters.time) &&
        matches(normalizeDayLabel(row['A-Day/B-Day']), appliedTeacherScheduleFilters.day) &&
        matches(volunteersValue, appliedTeacherScheduleFilters.volunteers)
      )
    })
  }, [combinedTeacherScheduleRows, appliedTeacherScheduleFilters])

  const setTeacherScheduleFilter = (key, value) => {
    setTeacherScheduleFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const applyTeacherScheduleFilters = () => {
    setAppliedTeacherScheduleFilters(teacherScheduleFilters)
  }

  const resetTeacherScheduleFilters = () => {
    const emptyFilters = {
      teacher: '',
      className: '',
      room: '',
      period: '',
      time: '',
      day: '',
      volunteers: '',
    }

    setTeacherScheduleFilters(emptyFilters)
    setAppliedTeacherScheduleFilters(emptyFilters)
  }

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
              {role === 'admin' && (
                <div className="mb-4 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Teacher schedules</p>
                      <p className="text-sm font-semibold text-slate-900">Uploaded files</p>
                    </div>
                    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                      {uploadedTeacherSchedules.length} uploaded
                    </span>
                  </div>

                  {uploadedTeacherSchedules.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      Upload a teacher schedule to show it here.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Search schedules</div>
                            <div className="text-xs text-slate-500">Filter the combined teacher schedule table below.</div>
                          </div>
                          <button
                            type="button"
                            onClick={resetTeacherScheduleFilters}
                            className="rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                          >
                            Reset filters
                          </button>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                          {[
                            ['teacher', 'Teacher'],
                            ['className', 'Class Name'],
                            ['room', 'Room'],
                            ['period', 'Period'],
                            ['time', 'Time'],
                            ['day', 'A-day/B-day'],
                            ['volunteers', 'Volunteers'],
                          ].map(([key, label]) => (
                            <label key={key} className="space-y-1 text-sm text-slate-600">
                              <span className="font-medium">{label}</span>
                              <select
                                value={teacherScheduleFilters[key]}
                                onChange={(event) => setTeacherScheduleFilter(key, event.target.value)}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                              >
                                <option value="">All {label.toLowerCase()}</option>
                                {teacherScheduleFilterOptions[key].map((option) => (
                                  <option key={`${key}-${option}`} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={applyTeacherScheduleFilters}
                            className="rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
                          >
                            Apply filters
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Combined teacher schedules</div>
                            <div className="text-xs text-slate-500">All uploaded teacher schedules are shown together below.</div>
                          </div>
                          <div className="text-xs text-slate-500">
                            {filteredTeacherScheduleRows.length} row{filteredTeacherScheduleRows.length === 1 ? '' : 's'}
                          </div>
                        </div>

                        <ScheduleTable
                          columns={TEACHER_SCHEDULE_COLUMNS}
                          rows={filteredTeacherScheduleRows}
                          emptyMessage="No schedule rows match the selected filters."
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="p-4 lg:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Available volunteers</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">Volunteer list</h3>
                  <p className="text-xs text-slate-500">Students currently in the Volunteering class appear here.</p>
                </div>
              </div>

              {availableVolunteers.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-400">
                  <HeartHandshake className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  <p className="text-sm font-medium">No students are currently in Volunteering.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableVolunteers.map((vol, idx) => {
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
                                disabled={isLoading || !canCheckIn || !studentId}
                                className="flex items-center justify-center gap-1 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <LogIn className="h-3.5 w-3.5" />
                                {role === 'admin' ? 'Confirm return' : 'Check in'}
                              </button>
                              <button
                                onClick={() => handleActionClick(vol, 'check-out')}
                                disabled={isLoading || !canCheckOut || !studentId}
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

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4" />
          {errorMessage || error.message || 'Unable to load volunteer data.'}
        </div>
      )}

      {errorMessage && !error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4" />
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Assigned</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{assignedTeacherCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Now</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{activeAssignmentCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Completed</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{completedSessionCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current Volunteer</p>
          <p className="mt-2 text-xl font-bold text-slate-900 truncate">{currentVolunteer ? currentVolunteer.studentName : 'None'}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-base font-semibold text-slate-900">Assigned Volunteers</h4>
          <p className="text-xs text-slate-500">Cards update in real time when admin assignments, check-ins, or check-outs change.</p>
        </div>

        {teacherAssignments.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teacherAssignments.map((item) => {
              const isChecking = loadingId === item.studentId
              const canCheckIn = item.status === 'requesting_confirmation'
              const canCheckOut = item.status === 'checked_in'
              const waitingOnAdmin = item.status === 'returning_confirmation'

              return (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                      <HeartHandshake className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate">{item.studentName}</p>
                      <p className="text-sm text-slate-500">{item.className} · {item.room} · Period {item.period}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'checked_in' ? 'bg-emerald-100 text-emerald-700' : item.status === 'requesting_confirmation' ? 'bg-amber-100 text-amber-700' : item.status === 'returning_confirmation' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                      {item.status === 'checked_in' ? 'Checked In' : item.status === 'requesting_confirmation' ? 'Waiting to Check In' : item.status === 'returning_confirmation' ? 'Waiting on Admin' : 'Assigned'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {item.totalHours || '0.00'} hrs
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>Check In</span>
                      <span className="font-medium text-slate-800">{formatTime(item.checkIn)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Check Out</span>
                      <span className="font-medium text-slate-800">{formatTime(item.checkOut)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Duration</span>
                      <span className="font-medium text-slate-800">{formatDuration(item.checkIn, item.checkOut)}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      disabled={!canCheckIn || isChecking}
                      onClick={() => handleCheckInOut.mutate({ volunteerId: item.studentId, endpoint: 'check-in' })}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <LogIn className="h-4 w-4" />
                      {isChecking && canCheckIn ? 'Checking in...' : 'Check In'}
                    </button>
                    <button
                      disabled={!canCheckOut || isChecking}
                      onClick={() => handleCheckInOut.mutate({ volunteerId: item.studentId, endpoint: 'check-out' })}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <LogOut className="h-4 w-4" />
                      {isChecking && canCheckOut ? 'Checking out...' : 'Check Out'}
                    </button>
                  </div>

                  {waitingOnAdmin && (
                    <p className="mt-3 text-xs text-purple-600">Waiting for admin confirmation to finalize hours.</p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-slate-400">
            <HeartHandshake className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">No volunteers assigned to your classrooms yet.</p>
          </div>
        )}
      </div>

      {completedVolunteers.length > 0 && (
        <div className="space-y-3">
          <div>
            <h4 className="text-base font-semibold text-slate-900">Completed Sessions</h4>
            <p className="text-xs text-slate-500">Recent completed sessions stay synced from Volunteer_Hours.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {completedVolunteers.slice(0, 6).map((session) => (
              <div key={session.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{session.studentName}</p>
                    <p className="text-xs text-slate-500">{session.className} · {session.room} · Period {session.period}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${normalizeText(session.status) === 'approved' ? 'bg-emerald-100 text-emerald-700' : normalizeText(session.status) === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    {session.status}
                  </span>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-slate-600">
                  <div className="flex justify-between gap-3"><span>Check In</span><span>{formatTime(session.checkIn)}</span></div>
                  <div className="flex justify-between gap-3"><span>Check Out</span><span>{formatTime(session.checkOut)}</span></div>
                  <div className="flex justify-between gap-3"><span>Total Hours</span><span>{session.total_hours || '0.00'}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}