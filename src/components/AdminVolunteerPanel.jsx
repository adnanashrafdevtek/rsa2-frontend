import React, { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HeartHandshake, LogIn, LogOut, Search } from 'lucide-react'
import backend from '../api/backendClient'

function getRows(payload) {
  if (Array.isArray(payload)) return payload
  return (payload && payload.mysqlResult) || []
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

const AVAILABLE_VOLUNTEER_STATUSES = new Set(['available', 'active', '', 'null', 'undefined'])
const CURRENT_VOLUNTEER_STATUSES = new Set([
  'requesting_confirmation',
  'requesting confirmation',
  'pending arrival',
  'pending_arrival',
  'checked_in',
  'checked in',
  'currently volunteering',
  'returning_confirmation',
  'returning confirmation',
  'pending return',
  'requesting return',
])

const PERIOD_FILTER_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8']
const DAY_FILTER_OPTIONS = [
  { value: 'all', label: 'All A-Day/B-day' },
  { value: 'A-day', label: 'A-day' },
  { value: 'B-day', label: 'B-day' },
]

function getVolunteerName(volunteer) {
  return volunteer.name || `${volunteer.first_name || ''} ${volunteer.last_name || ''}`.trim() || volunteer.email_address || `Volunteer ${volunteer.id}`
}

function getVolunteerStatus(volunteer) {
  return normalizeText(volunteer?.status || 'available')
}

function getVolunteerHours(volunteer, nowMs) {
  const baseHours = Number(volunteer?.total_hours) || 0
  const status = getVolunteerStatus(volunteer)
  const checkInMs = volunteer?.check_in ? new Date(volunteer.check_in).getTime() : NaN
  const checkOutMs = volunteer?.check_out ? new Date(volunteer.check_out).getTime() : NaN

  if (status === 'checked_in' && Number.isFinite(checkInMs)) {
    const elapsedHours = Math.max((nowMs - checkInMs) / (1000 * 60 * 60), 0)
    return (baseHours + elapsedHours).toFixed(2)
  }

  if (status === 'returning_confirmation' && Number.isFinite(checkInMs) && Number.isFinite(checkOutMs)) {
    const elapsedHours = Math.max((checkOutMs - checkInMs) / (1000 * 60 * 60), 0)
    return (baseHours + elapsedHours).toFixed(2)
  }

  return baseHours.toFixed(2)
}

const formatStatusLabel = (status) => {
  const normalized = normalizeText(status)
  if (!normalized || normalized === 'available' || normalized === 'active') return 'Available'
  if (normalized === 'requesting_confirmation' || normalized === 'pending arrival' || normalized === 'pending_arrival') return 'Pending Check-In'
  if (normalized === 'checked_in' || normalized === 'checked in' || normalized === 'currently volunteering') return 'Currently Volunteering'
  if (normalized === 'returning_confirmation' || normalized === 'returning confirmation' || normalized === 'pending return' || normalized === 'requesting return') return 'Pending Return'
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function AdminVolunteerPanel() {
  const queryClient = useQueryClient()
  const [nowMs, setNowMs] = useState(Date.now())
  const [selectedTeacherScheduleId, setSelectedTeacherScheduleId] = useState('')
  const [teacherScheduleMessage, setTeacherScheduleMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')
  const [roomFilter, setRoomFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')
  const [dayFilter, setDayFilter] = useState('all')
  const [volunteerFilter, setVolunteerFilter] = useState('all')

  const [selectedClassSelections, setSelectedClassSelections] = useState({})

  const { data: usersData } = useQuery(['users'], () => backend.list('users'), { refetchInterval: 5000 })
  const { data: classesData } = useQuery(['classes'], () => backend.list('classes'), { refetchInterval: 5000 })
  const { data: volunteersData } = useQuery(['volunteers'], () => backend.list('volunteers'), { refetchInterval: 5000 })

  const users = useMemo(() => getRows(usersData), [usersData])
  const classes = useMemo(() => getRows(classesData), [classesData])
  const volunteers = useMemo(() => getRows(volunteersData), [volunteersData])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 30000)
    return () => window.clearInterval(intervalId)
  }, [])

  const teacherUsers = useMemo(
    () => users.filter((user) => Number(user.role_id) === 1 || Number(user.role_id) === 2),
    [users]
  )

  const teacherById = useMemo(() => {
    return new Map(teacherUsers.map((teacher) => [String(teacher.id), teacher]))
  }, [teacherUsers])

  const volunteerCountByClassId = useMemo(() => {
    const counts = new Map()
    volunteers.forEach((volunteer) => {
      const classId = volunteer.assigned_class_id || volunteer.class_id
      if (!classId) return
      counts.set(String(classId), (counts.get(String(classId)) || 0) + 1)
    })
    return counts
  }, [volunteers])

  const scheduleRows = useMemo(() => {
    const search = normalizeText(searchTerm)

    return classes
      .map((classItem) => {
        const teacher = teacherById.get(String(classItem.teacher_id)) || null
        const teacherName = teacher
          ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || `Teacher ${teacher.id}`
          : `Teacher ${classItem.teacher_id || '—'}`
        const className = classItem.name || classItem.class_name || '—'
        const room = classItem.room || classItem.room_name || classItem.room_id || '—'
        const period = classItem.period || '—'
        const time = classItem.time || '—'
        const day = classItem.a_b_day || classItem.day || classItem.period || '—'
        const volunteersAssigned = Number(volunteerCountByClassId.get(String(classItem.id)) || 0)

        return {
          id: classItem.id,
          teacherName,
          className,
          room,
          period,
          time,
          day,
          volunteersAssigned,
          searchText: normalizeText([teacherName, className, room, period, time, day, volunteersAssigned].join(' ')),
        }
      })
      .filter((row) => {
        if (search && !row.searchText.includes(search)) return false
        if (teacherFilter !== 'all' && normalizeText(row.teacherName) !== normalizeText(teacherFilter)) return false
        if (classFilter !== 'all' && normalizeText(row.className) !== normalizeText(classFilter)) return false
        if (roomFilter !== 'all' && normalizeText(row.room) !== normalizeText(roomFilter)) return false
        if (periodFilter !== 'all' && normalizeText(row.period) !== normalizeText(periodFilter)) return false
        if (timeFilter !== 'all' && normalizeText(row.time) !== normalizeText(timeFilter)) return false
        if (dayFilter !== 'all' && normalizeText(row.day) !== normalizeText(dayFilter)) return false
        if (volunteerFilter !== 'all' && String(row.volunteersAssigned) !== String(volunteerFilter)) return false
        return true
      })
      .sort((left, right) => left.teacherName.localeCompare(right.teacherName) || left.className.localeCompare(right.className))
  }, [classes, teacherById, volunteerCountByClassId, searchTerm, teacherFilter, classFilter, roomFilter, periodFilter, timeFilter, dayFilter, volunteerFilter])

  const volunteerRows = useMemo(() => {
    const search = normalizeText(searchTerm)

    return volunteers
      .filter((volunteer) => normalizeText(volunteer.status) !== 'inactive')
      .map((volunteer) => {
        const status = getVolunteerStatus(volunteer)
        const fullName = getVolunteerName(volunteer)
        const classId = volunteer.assigned_class_id || volunteer.class_id || ''
        const classItem = classId ? classes.find((entry) => String(entry.id) === String(classId)) : null
        const teacher = classItem ? teacherById.get(String(classItem.teacher_id)) : null
        const teacherId = classItem?.teacher_id ? String(classItem.teacher_id) : (volunteer.assigned_teacher_id ? String(volunteer.assigned_teacher_id) : '')
        const isAvailable = AVAILABLE_VOLUNTEER_STATUSES.has(status)
        const isCurrent = CURRENT_VOLUNTEER_STATUSES.has(status)

        return {
          id: volunteer.id,
          studentId: Number(volunteer.student_id) || Number(volunteer.id),
          fullName,
          totalHours: getVolunteerHours(volunteer, nowMs),
          status: volunteer.status || 'available',
          className: classItem?.name || classItem?.class_name || '—',
          teacherName: teacher ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || '—' : '—',
          room: classItem?.room || classItem?.room_name || '—',
          period: classItem?.period || '—',
          classId: classId ? String(classId) : '',
          teacherId,
          searchText: normalizeText([fullName, volunteer.status, classItem?.name, classItem?.room, classItem?.period, teacher?.first_name, teacher?.last_name].filter(Boolean).join(' ')),
          isAvailable,
          isCurrent,
          isRequestingConfirmation: status === 'requesting_confirmation' || status === 'requesting confirmation' || status === 'pending arrival' || status === 'pending_arrival',
          isReturningConfirmation: status === 'returning_confirmation' || status === 'returning confirmation' || status === 'pending return' || status === 'requesting return',
          isCheckedIn: status === 'checked_in' || status === 'checked in' || status === 'currently volunteering',
        }
      })
      .filter((row) => !search || row.searchText.includes(search))
  }, [classes, teacherById, volunteers, searchTerm, nowMs])

  const availableVolunteers = useMemo(
    () => volunteerRows.filter((volunteer) => volunteer.isAvailable),
    [volunteerRows]
  )

  const currentVolunteers = useMemo(
    () => volunteerRows.filter((volunteer) => volunteer.isCurrent),
    [volunteerRows]
  )

  const filterOptions = useMemo(() => {
    const uniqueValues = (key) => Array.from(new Set(scheduleRows.map((row) => String(row[key] || '').trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right))
    return {
      teacherName: uniqueValues('teacherName'),
      className: uniqueValues('className'),
      room: uniqueValues('room'),
      period: PERIOD_FILTER_OPTIONS,
      time: uniqueValues('time'),
      day: DAY_FILTER_OPTIONS,
      volunteersAssigned: Array.from(new Set(scheduleRows.map((row) => String(row.volunteersAssigned)).filter(Boolean))).sort((left, right) => Number(left) - Number(right)),
    }
  }, [scheduleRows])

  const handleTeacherScheduleUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!selectedTeacherScheduleId) {
      setTeacherScheduleMessage('Select a teacher before uploading a schedule.')
      event.target.value = ''
      return
    }

    try {
      const fileContent = await file.text()
      await backend.create('user_schedules', {
        user_id: Number(selectedTeacherScheduleId),
        user_type: 'teacher',
        file_name: file.name,
        file_content: fileContent,
      })
      setTeacherScheduleMessage('Teacher schedule uploaded successfully.')
      await queryClient.invalidateQueries(['schedules'])
    } catch (error) {
      setTeacherScheduleMessage(error?.message || 'Failed to upload teacher schedule.')
    } finally {
      event.target.value = ''
    }
  }

  const handleAdminConfirmReturn = async (studentId) => {
    try {
      await backend.adminConfirmReturn(studentId)
      await queryClient.invalidateQueries(['volunteers'])
      await queryClient.invalidateQueries(['volunteer_hours'])
    } catch (error) {
      console.error('Failed to confirm return:', error)
      alert(error?.message || 'Failed to confirm return.')
    }
  }

  const handleSendBackToTeacher = async (studentId) => {
    try {
      await backend.returnVolunteerFromTeacher(studentId)
      await queryClient.invalidateQueries(['volunteers'])
      await queryClient.invalidateQueries(['volunteer_hours'])
    } catch (error) {
      console.error('Failed to send volunteer back:', error)
      alert(error?.message || 'Failed to send volunteer back.')
    }
  }

  const handleSendToTeacher = async (studentId, teacherId, classId, rowId) => {
    const selectedClassId = selectedClassSelections[rowId] || classId
    const targetClassObj = selectedClassId ? classes.find(c => String(c.id) === String(selectedClassId)) : null

    const safeTeacherId = Number(targetClassObj?.teacher_id || teacherId) || null
    const safeClassId = selectedClassId ? Number(selectedClassId) : null

    if (!safeTeacherId || !safeClassId) {
      alert('Please select a target class and teacher from the dropdown before sending the volunteer.')
      return
    }

    try {
      await backend.sendVolunteerToTeacher(Number(studentId), Number(safeTeacherId), Number(safeClassId))
      await queryClient.invalidateQueries(['volunteers'])
      await queryClient.invalidateQueries(['volunteer_hours'])
    } catch (error) {
      console.error('Failed to send volunteer to teacher:', error)
      alert(error?.message || 'Failed to send volunteer to teacher.')
    }
  }

  const resetFilters = () => {
    setSearchTerm('')
    setTeacherFilter('all')
    setClassFilter('all')
    setRoomFilter('all')
    setPeriodFilter('all')
    setTimeFilter('all')
    setDayFilter('all')
    setVolunteerFilter('all')
  }

  return (
    <div className="mx-auto my-6 max-w-6xl rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm md:p-5">
      <div className="space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Volunteer Management</p>
              <h3 className="mt-1 text-2xl font-medium text-slate-900">Upload teacher schedules</h3>
              <p className="mt-1 text-sm text-slate-500">Choose a teacher, then upload a CSV schedule file.</p>
            </div>

            <div className="grid w-full gap-2 lg:w-auto lg:min-w-[420px] lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-end">
              <label className="space-y-1 text-sm text-slate-600">
                <span className="ml-1 font-medium text-slate-700">Teacher</span>
                <select
                  value={selectedTeacherScheduleId}
                  onChange={(event) => setSelectedTeacherScheduleId(event.target.value)}
                  className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="">Select teacher</option>
                  {teacherUsers.map((teacher) => {
                    const teacherLabel = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || `Teacher ${teacher.id}`
                    return <option key={teacher.id} value={teacher.id}>{teacherLabel}</option>
                  })}
                </select>
              </label>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                Upload CSV
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleTeacherScheduleUpload} />
              </label>
            </div>
          </div>

          {teacherScheduleMessage && (
            <div className="mt-3 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-teal-700">
              {teacherScheduleMessage}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Search schedules</div>
                  <div className="text-xs text-slate-500">Filter the combined teacher schedule table below.</div>
                </div>
                <button type="button" onClick={resetFilters} className="rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-semibold text-teal-700 transition hover:bg-teal-50">
                  Reset filters
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Teacher</span>
                  <select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
                    <option value="all">All teacher</option>
                    {filterOptions.teacherName.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Class Name</span>
                  <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
                    <option value="all">All class name</option>
                    {filterOptions.className.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Room</span>
                  <select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)} className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
                    <option value="all">All room</option>
                    {filterOptions.room.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Period</span>
                  <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
                    <option value="all">All period</option>
                    {PERIOD_FILTER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Time</span>
                  <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)} className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
                    <option value="all">All time</option>
                    {filterOptions.time.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">A-day/B-day</span>
                  <select value={dayFilter} onChange={(event) => setDayFilter(event.target.value)} className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
                    {DAY_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Volunteers</span>
                  <select value={volunteerFilter} onChange={(event) => setVolunteerFilter(event.target.value)} className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100">
                    <option value="all">All volunteers</option>
                    {filterOptions.volunteersAssigned.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button type="button" className="rounded-full bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700">
                  Apply filters
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Combined teacher schedules</div>
                  <div className="text-xs text-slate-500">All uploaded teacher schedules are shown together below.</div>
                </div>
                <div className="text-xs text-slate-500">{scheduleRows.length} row{scheduleRows.length === 1 ? '' : 's'}</div>
              </div>

              <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
                <div className="grid grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr_0.9fr_0.9fr_0.8fr] gap-3 border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                  <span>Teacher</span>
                  <span>Class Name</span>
                  <span>Room</span>
                  <span>Period</span>
                  <span>Time</span>
                  <span>A-Day/B-Day</span>
                  <span>Volunteers</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {scheduleRows.length ? scheduleRows.map((row) => (
                    <div key={row.id} className="grid grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr_0.9fr_0.9fr_0.8fr] gap-3 px-4 py-3 text-sm text-slate-700">
                      <span className="truncate">{row.teacherName}</span>
                      <span className="truncate">{row.className}</span>
                      <span className="truncate">{row.room}</span>
                      <span className="truncate">{row.period}</span>
                      <span className="truncate">{row.time}</span>
                      <span className="truncate">{row.day}</span>
                      <span className="truncate">{row.volunteersAssigned || '—'}</span>
                    </div>
                  )) : (
                    <div className="px-4 py-10 text-center text-sm text-slate-400">No schedule rows match the selected filters.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div className="mb-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Volunteer Management</p>
              <h4 className="text-lg font-medium text-slate-900">Available and current volunteers</h4>
              <p className="text-xs text-slate-500">Available volunteers can be assigned. Current volunteers are already on an active or pending assignment.</p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Available volunteers</div>
                  <div className="text-xs text-slate-500">Students not currently volunteering but able to be assigned.</div>
                </div>
                <div className="text-xs text-slate-500">{availableVolunteers.length} student{availableVolunteers.length === 1 ? '' : 's'}</div>
              </div>

              <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
                <div className="grid grid-cols-[1.05fr_0.75fr_1.1fr_0.9fr_0.85fr] gap-3 border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                  <span>Name</span>
                  <span>Total Hours</span>
                  <span>Assign Class / Teacher</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {availableVolunteers.length ? availableVolunteers.map((volunteer) => {
                    const selectedClassId = selectedClassSelections[volunteer.id] || volunteer.classId || ''
                    const isAvailable = true

                    return (
                      <div key={volunteer.id} className="grid grid-cols-[1.05fr_0.75fr_1.1fr_0.9fr_0.85fr] gap-3 px-4 py-3 text-sm text-slate-700">
                        <div>
                          <p className="font-semibold text-slate-900">{volunteer.fullName}</p>
                          <p className="text-xs text-slate-500">{volunteer.className !== '—' ? `${volunteer.className} • ${volunteer.teacherName}` : 'No current assignment'}</p>
                        </div>
                        <span className="truncate">{volunteer.totalHours} hrs</span>
                        <div className="min-w-0">
                          <select
                            value={selectedClassId}
                            onChange={(e) => {
                              const newClassId = e.target.value
                              setSelectedClassSelections((prev) => ({
                                ...prev,
                                [volunteer.id]: newClassId,
                              }))
                            }}
                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs shadow-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                          >
                            <option value="">Select class & teacher...</option>
                            {classes.map((cls) => {
                              const teacherObj = teacherById.get(String(cls.teacher_id))
                              const teacherName = teacherObj
                                ? `${teacherObj.first_name || ''} ${teacherObj.last_name || ''}`.trim() || teacherObj.email_address
                                : 'Unknown Teacher'
                              const className = cls.name || cls.class_name || 'Unnamed Class'
                              const roomNum = cls.room || cls.room_name || '—'
                              return (
                                <option key={cls.id} value={cls.id}>
                                  {className} — {teacherName} (Rm: {roomNum})
                                </option>
                              )
                            })}
                          </select>
                        </div>
                        <span className="truncate text-xs font-semibold text-emerald-700">{formatStatusLabel(volunteer.status)}</span>
                        <button
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => handleSendToTeacher(volunteer.studentId, volunteer.teacherId, volunteer.classId, volunteer.id)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 cursor-pointer"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Send
                        </button>
                      </div>
                    )
                  }) : (
                    <div className="px-4 py-10 text-center text-sm text-slate-400">No available volunteers right now.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Current volunteers</div>
                  <div className="text-xs text-slate-500">Students pending check-in, actively volunteering, or pending return confirmation.</div>
                </div>
                <div className="text-xs text-slate-500">{currentVolunteers.length} student{currentVolunteers.length === 1 ? '' : 's'}</div>
              </div>

              <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white">
                <div className="grid grid-cols-[1.05fr_0.9fr_0.8fr_0.75fr_1fr] gap-3 border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                  <span>Name</span>
                  <span>Assignment</span>
                  <span>Hours</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {currentVolunteers.length ? currentVolunteers.map((volunteer) => (
                    <div key={volunteer.id} className="grid grid-cols-[1.05fr_0.9fr_0.8fr_0.75fr_1fr] gap-3 px-4 py-3 text-sm text-slate-700">
                      <div>
                        <p className="font-semibold text-slate-900">{volunteer.fullName}</p>
                        <p className="text-xs text-slate-500">{volunteer.className !== '—' ? `${volunteer.className} • ${volunteer.teacherName}` : 'No class linked'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-slate-700">{volunteer.className}</p>
                        <p className="truncate text-xs text-slate-500">{volunteer.room} • {volunteer.period}</p>
                      </div>
                      <span className="truncate font-semibold text-slate-900">{volunteer.totalHours} hrs</span>
                      <span className="truncate text-xs font-semibold text-amber-700">{formatStatusLabel(volunteer.status)}</span>
                      <div className="flex flex-wrap gap-2">
                        {volunteer.isCheckedIn && (
                          <button
                            type="button"
                            onClick={() => handleSendBackToTeacher(volunteer.studentId)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            Send back
                          </button>
                        )}

                        {volunteer.isReturningConfirmation && (
                          <button
                            type="button"
                            onClick={() => handleAdminConfirmReturn(volunteer.studentId)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                          >
                            <LogIn className="h-3.5 w-3.5" />
                            Confirm return
                          </button>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="px-4 py-10 text-center text-sm text-slate-400">No current volunteers right now.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}