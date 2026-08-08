import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HeartHandshake, LogIn, LogOut, CheckCircle2, RotateCcw, UserCheck } from 'lucide-react'
import backend from '../api/backendClient'

function getRows(payload) {
  if (Array.isArray(payload)) return payload
  return (payload && payload.mysqlResult) || []
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

const formatStatusLabel = (status) => {
  if (!status) return 'Available'
  const normalized = status.replace(/[_]/g, ' ').toLowerCase()
  if (normalized === 'checked in' || normalized === 'currently volunteering' || normalized === 'active') {
    return 'Currently Volunteering'
  }
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function VolunteersTab({ currentTeacherId }) {
  const queryClient = useQueryClient()
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

  const availableVolunteers = useMemo(() => {
    const search = normalizeText(searchTerm)

    return volunteers
      .filter((volunteer) => normalizeText(volunteer.status) !== 'inactive')
      .map((volunteer) => {
        const fullName = volunteer.name || `${volunteer.first_name || ''} ${volunteer.last_name || ''}`.trim() || volunteer.email_address || `Volunteer ${volunteer.id}`
        
        const rawStatus = (volunteer.status || 'available').toLowerCase()
        const isPendingReturn = rawStatus === 'requesting_confirmation' || rawStatus === 'pending return' || rawStatus === 'requesting return'

        let classId = ''
        if (isPendingReturn) {
          classId = volunteer.assigned_class_id || volunteer.class_id || ''
        } else {
          const selectedClassId = selectedClassSelections[volunteer.id]
          classId = selectedClassId !== undefined ? selectedClassId : (volunteer.assigned_class_id || volunteer.class_id || '')
        }
        
        const classItem = classId ? classes.find((entry) => String(entry.id) === String(classId)) : null
        const teacher = classItem ? teacherById.get(String(classItem.teacher_id)) : null

        return {
          id: volunteer.id,
          fullName,
          totalHours: volunteer.total_hours || '0.00',
          status: volunteer.status || 'available',
          isPendingReturn,
          className: classItem?.name || classItem?.class_name || '—',
          teacherName: teacher ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || '—' : '—',
          room: classItem?.room || classItem?.room_name || '—',
          period: classItem?.period || '—',
          classId: classId ? String(classId) : '',
          teacherId: classItem?.teacher_id ? String(classItem.teacher_id) : (volunteer.teacher_id ? String(volunteer.teacher_id) : (volunteer.assigned_teacher_id ? String(volunteer.assigned_teacher_id) : '')),
          searchText: normalizeText([fullName, volunteer.status, classItem?.name, classItem?.room, classItem?.period].filter(Boolean).join(' ')),
        }
      })
      .filter((row) => !search || row.searchText.includes(search))
      .slice(0, 8)
  }, [classes, teacherById, volunteers, searchTerm, selectedClassSelections])

  const teacherClassIds = useMemo(() => {
    if (!currentTeacherId) return new Set()
    return new Set(
      classes
        .filter((c) => String(c.teacher_id) === String(currentTeacherId))
        .map((c) => String(c.id))
    )
  }, [classes, currentTeacherId])

  const assignedVolunteers = useMemo(() => {
    const teacherScopedStatuses = new Set([
      'requesting_confirmation',
      'pending arrival',
      'pending_arrival',
      'checked_in',
      'checked in',
      'currently volunteering',
      'returning_confirmation',
      'pending return',
      'requesting return',
    ])

    if (!currentTeacherId) {
      return volunteers.filter((v) => teacherScopedStatuses.has(normalizeText(v.status || '')))
    }

    return volunteers.filter((v) => {
      const normalizedStatus = normalizeText(v.status || '')
      const assignedClass = String(v.assigned_class_id || v.class_id || '')
      const assignedTeacher = String(v.teacher_id || v.assigned_teacher_id || '')
      return teacherClassIds.has(assignedClass) || assignedTeacher === String(currentTeacherId) || teacherScopedStatuses.has(normalizedStatus)
    })
  }, [volunteers, teacherClassIds, currentTeacherId])

  const filterOptions = useMemo(() => {
    const uniqueValues = (key) => Array.from(new Set(scheduleRows.map((row) => String(row[key] || '').trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right))
    return {
      teacherName: uniqueValues('teacherName'),
      className: uniqueValues('className'),
      room: uniqueValues('room'),
      period: uniqueValues('period'),
      time: uniqueValues('time'),
      day: uniqueValues('day'),
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

  const handleAdminConfirmReturn = async (volunteerId) => {
    try {
      await backend.adminConfirmReturn(volunteerId)
      await queryClient.invalidateQueries(['volunteers'])
    } catch (error) {
      console.error('Failed to confirm arrival:', error)
      alert(error?.message || 'Failed to confirm arrival.')
    }
  }

  const handleSendToTeacher = async (volunteerId, teacherId, classId) => {
    const selectedClassId = selectedClassSelections[volunteerId] || classId
    const targetClassObj = selectedClassId ? classes.find(c => String(c.id) === String(selectedClassId)) : null

    const safeTeacherId = Number(targetClassObj?.teacher_id || teacherId) || null
    const safeClassId = selectedClassId ? Number(selectedClassId) : null

    if (!safeTeacherId || !safeClassId) {
      alert('Please select a target class and teacher from the dropdown before sending the volunteer.')
      return
    }

    try {
      await backend.sendVolunteerToTeacher({
        student_id: Number(volunteerId),
        teacher_id: Number(safeTeacherId),
        class_id: Number(safeClassId)
      })
      await queryClient.invalidateQueries(['volunteers'])
    } catch (error) {
      console.error('Failed to send volunteer to teacher:', error)
      alert(error?.message || 'Failed to send volunteer to teacher.')
    }
  }

  const handleConfirmArrival = async (volunteerId) => {
    try {
      await backend.confirmVolunteerArrival(volunteerId)
      await queryClient.invalidateQueries(['volunteers'])
    } catch (error) {
      console.error('Failed to confirm arrival:', error)
      alert(error?.message || 'Failed to confirm arrival.')
    }
  }

  const handleReturnFromTeacher = async (volunteerId) => {
    try {
      await backend.returnVolunteerFromTeacher(volunteerId)
      await queryClient.invalidateQueries(['volunteers'])
    } catch (error) {
      console.error('Failed to return volunteer:', error)
      alert(error?.message || 'Failed to return volunteer.')
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
        {currentTeacherId && (
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4">
              <h3 className="text-3xl font-semibold text-slate-900">All Volunteers</h3>
              <p className="text-sm text-slate-500">Manage teacher assignments, check-ins, and return confirmations.</p>
            </div>

            {assignedVolunteers.length ? (
              <div className="grid gap-3 lg:grid-cols-3">
                {assignedVolunteers.map((volunteer) => {
                  const rawStatus = (volunteer.status || '').toLowerCase()
                  const isRequestingConfirmation = rawStatus === 'requesting_confirmation' || rawStatus === 'pending arrival' || rawStatus === 'pending_arrival'
                  const isCurrentlyVolunteering = rawStatus === 'currently volunteering' || rawStatus === 'active' || rawStatus === 'checked_in' || rawStatus === 'checked in'

                  const fullName = volunteer.name || `${volunteer.first_name || ''} ${volunteer.last_name || ''}`.trim() || `Volunteer ${volunteer.id}`

                  return (
                    <div key={volunteer.id} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                          <HeartHandshake className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[30px] font-semibold leading-none text-slate-900">{fullName}</p>
                          <p className="mt-1 text-sm font-medium text-slate-500">Total Hours: {Number(volunteer.total_hours || 0).toFixed(2)} hrs</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Status:</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isRequestingConfirmation
                            ? 'bg-amber-100 text-amber-700'
                            : isCurrentlyVolunteering
                              ? 'bg-teal-100 text-teal-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isRequestingConfirmation ? 'Pending Confirmation' : formatStatusLabel(volunteer.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={!isRequestingConfirmation}
                          onClick={() => handleConfirmArrival(volunteer.id)}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                            isRequestingConfirmation
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Check In
                        </button>

                        <button
                          type="button"
                          disabled={!isCurrentlyVolunteering}
                          onClick={() => handleReturnFromTeacher(volunteer.id)}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                            isCurrentlyVolunteering
                              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Send Back
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-[20px] border border-dashed border-slate-200 py-8 text-center text-slate-400 bg-slate-50/50">
                <UserCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">No volunteers currently assigned to your classes.</p>
              </div>
            )}
          </div>
        )}

        {/* ADMIN ONLY SECTIONS */}
        {!currentTeacherId && (
          <>
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

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
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
                        {filterOptions.period.map((option) => <option key={option} value={option}>{option}</option>)}
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
                        <option value="all">All a-day/b-day</option>
                        {filterOptions.day.map((option) => <option key={option} value={option}>{option}</option>)}
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

              <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <div className="mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Available Volunteers</p>
                  <h4 className="text-lg font-medium text-slate-900">Volunteer list</h4>
                  <p className="text-xs text-slate-500">Select a class/teacher and manage status below.</p>
                </div>

                {availableVolunteers.length ? (
                  <div className="space-y-3">
                    {availableVolunteers.map((volunteer) => {
                      const rawStatus = (volunteer.status || 'available').toLowerCase()
                      const isAvailable = rawStatus === 'available'
                      const isPendingReturn = rawStatus === 'requesting_confirmation' || rawStatus === 'pending return' || rawStatus === 'requesting return'
                      
                      const hasSelectedClass = Boolean(volunteer.classId)
                      const canSend = isAvailable && hasSelectedClass

                      return (
                        <div key={volunteer.id} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{volunteer.fullName}</p>
                              <p className="mt-0.5 text-xs text-slate-500">Total Hours: {volunteer.totalHours} hrs</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                              {formatStatusLabel(volunteer.status)}
                            </span>
                          </div>

                          <div className="space-y-1 pt-1">
                            <label className="text-[11px] font-medium text-slate-600">
                              {isPendingReturn ? 'Assigned Class / Teacher (Locked)' : 'Assign Class / Teacher'}
                            </label>
                            <select
                              disabled={isPendingReturn}
                              value={volunteer.classId}
                              onChange={(e) => {
                                const newClassId = e.target.value
                                setSelectedClassSelections((prev) => ({
                                  ...prev,
                                  [volunteer.id]: newClassId,
                                }))
                              }}
                              className={`w-full rounded-xl border border-slate-300 px-3 py-2 text-xs shadow-sm outline-none transition ${
                                isPendingReturn 
                                  ? 'bg-slate-100 text-slate-500 cursor-not-allowed opacity-80 select-none' 
                                  : 'bg-slate-50 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100'
                              }`}
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

                          <div className="flex gap-2 pt-1">
                            {isPendingReturn ? (
                              <button 
                                type="button"
                                onClick={() => handleAdminConfirmReturn(volunteer.id)}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm cursor-pointer"
                              >
                                <LogIn className="h-3.5 w-3.5" />
                                Confirm return
                              </button>
                            ) : rawStatus === 'currently volunteering' || rawStatus === 'active' || rawStatus === 'checked_in' || rawStatus === 'checked in' ? (
                              <button 
                                type="button"
                                onClick={() => handleReturnFromTeacher(volunteer.id)}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition bg-amber-500 text-white hover:bg-amber-600 shadow-sm cursor-pointer"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Send back to admin
                              </button>
                            ) : (
                              <button 
                                type="button"
                                disabled={!canSend}
                                onClick={() => handleSendToTeacher(volunteer.id, volunteer.teacherId, volunteer.classId)}
                                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                  canSend 
                                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 shadow-sm cursor-pointer' 
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                                }`}
                              >
                                <LogOut className="h-3.5 w-3.5" />
                                Send to teacher
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-200 py-8 text-center text-slate-400">
                    <p className="text-sm">No available volunteers found.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}