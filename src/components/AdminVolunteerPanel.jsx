import React, { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HeartHandshake, Search, Clock, LogIn, LogOut, X, Filter, AlertCircle } from 'lucide-react'
import backend from '../api/backendClient'

function getRows(payload) {
  if (Array.isArray(payload)) return payload
  return (payload && payload.mysqlResult) || []
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function formatTime(value) {
  if (!value) return '—'
  const text = String(value).trim()
  const date = new Date(text.replace(' ', 'T'))
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleString([], { hour: '2-digit', minute: '2-digit' })
  }
  return text
}

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

function parseClockToMinutes(input) {
  const text = normalizeText(input).replace(/[–—]/g, '-').replace(/\s+/g, ' ')
  const match = text.match(/(\d{1,2}):(\d{2})(?:\s*([ap]m))?/) 
  if (!match) return null
  let hours = Number(match[1])
  const minutes = Number(match[2])
  const suffix = match[3]
  if (suffix === 'pm' && hours !== 12) hours += 12
  if (suffix === 'am' && hours === 12) hours = 0
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

function parseTimeRange(value) {
  const text = String(value || '').replace(/[–—]/g, '-').replace(/to/i, '-').trim()
  if (!text.includes('-')) return null
  const [startText, endText] = text.split('-').map((item) => item.trim())
  const start = parseClockToMinutes(startText)
  const end = parseClockToMinutes(endText)
  if (start === null || end === null) return null
  return { start, end }
}

function isIndependentSchedule(scheduleRow) {
  const text = normalizeText([
    scheduleRow?.name,
    scheduleRow?.class_name,
    scheduleRow?.period,
    scheduleRow?.teacher,
    scheduleRow?.room,
    scheduleRow?.description,
    scheduleRow?.decription
  ].filter(Boolean).join(' '))

  return text.includes('independent period') || text.includes('study hall')
}

function buildStudentIndex(student, volunteerRow, currentSchedule, activeAssignment, latestHour) {
  const scheduleType = currentSchedule
    ? (isIndependentSchedule(currentSchedule) ? 'independent' : 'regular')
    : 'none'

  const volunteerStatus = normalizeText(volunteerRow?.status)
  const assignmentStatus = normalizeText(activeAssignment?.status)
  const approvalStatus = normalizeText(latestHour?.approval_status)
  const assignedClassId = volunteerRow?.assigned_class_id || activeAssignment?.class_id || latestHour?.class_id || null
  const assignedTeacherId = volunteerRow?.assigned_teacher_id || activeAssignment?.teacher_id || null
  const classPeriod = currentSchedule?.period || activeAssignment?.period || volunteerRow?.period || '—'
  const className = currentSchedule?.class_name || activeAssignment?.class_name || volunteerRow?.class_name || '—'
  const teacherName = currentSchedule?.teacher || activeAssignment?.teacher_name || volunteerRow?.teacher_name || '—'
  const room = currentSchedule?.room || activeAssignment?.room || volunteerRow?.room || '—'
  const subject = currentSchedule?.class_name || currentSchedule?.name || className

  let status = 'Not Scheduled'
  if (scheduleType === 'regular') {
    status = 'Currently in Class'
  }

  if (scheduleType !== 'regular') {
    if (volunteerStatus === 'checked_in') {
      status = 'Checked In'
    } else if (volunteerStatus === 'returning_confirmation' || volunteerStatus === 'checked_out' || approvalStatus === 'rejected') {
      status = 'Checked Out'
    } else if (volunteerStatus === 'requesting_confirmation' || assignmentStatus === 'requested' || assignmentStatus === 'en_route' || assignmentStatus === 'arrived' || approvalStatus === 'pending') {
      status = 'Assigned'
    } else if (scheduleType === 'independent') {
      status = 'Available'
    }
  }

  const currentlyVolunteering = ['requesting_confirmation', 'checked_in', 'returning_confirmation'].includes(volunteerStatus) || ['requested', 'en_route', 'arrived'].includes(assignmentStatus)
  const alreadyAssigned = Boolean(assignedClassId) && status !== 'Available' && status !== 'Not Scheduled'
  const independentPeriod = scheduleType === 'independent'
  const availableNow = status === 'Available' && independentPeriod
  const searchText = normalizeText([
    student.full_name,
    student.email,
    classPeriod,
    subject,
    teacherName,
    className,
    room,
    status,
    currentSchedule?.period,
    currentSchedule?.class_name,
    currentSchedule?.teacher,
    currentSchedule?.room
  ].filter(Boolean).join(' '))

  return {
    id: student.id,
    student,
    volunteerRow,
    currentSchedule,
    activeAssignment,
    latestHour,
    scheduleType,
    status,
    currentPeriod: classPeriod,
    subject,
    teacherName,
    className,
    room,
    volunteerCountClassId: assignedClassId,
    assignedClassId,
    assignedTeacherId,
    currentlyVolunteering,
    alreadyAssigned,
    independentPeriod,
    availableNow,
    searchText
  }
}

export default function AdminVolunteerPanel() {
  const queryClient = useQueryClient()
  const currentUserId = typeof window !== 'undefined' ? Number(window.localStorage.getItem('planner-current-user-id') || 1) : 1
  const [selectedTeacherScheduleId, setSelectedTeacherScheduleId] = useState('')
  const [teacherScheduleMessage, setTeacherScheduleMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')
  const [onlyCurrentlyVolunteering, setOnlyCurrentlyVolunteering] = useState(false)
  const [onlyAlreadyAssigned, setOnlyAlreadyAssigned] = useState(false)
  const [onlyIndependentPeriod, setOnlyIndependentPeriod] = useState(false)
  const [selectedVolunteer, setSelectedVolunteer] = useState(null)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  })

  const { data: volunteersData } = useQuery(['volunteers'], () => backend.list('volunteers'), { refetchInterval: 5000 })
  const { data: usersData } = useQuery(['users'], () => backend.list('users'), { refetchInterval: 5000 })
  const { data: classesData } = useQuery(['classes'], () => backend.list('classes'), { refetchInterval: 5000 })
  const { data: schedulesData } = useQuery(['schedules'], () => backend.list('schedules'), { refetchInterval: 5000 })
  const { data: requestsData } = useQuery(['volunteer-requests'], () => backend.list('volunteer-requests'), { refetchInterval: 5000 })
  const { data: assignmentsData } = useQuery(['volunteer-assignments'], () => backend.list('volunteer-assignments'), { refetchInterval: 5000 })
  const { data: hoursData } = useQuery(['volunteer-hours'], () => backend.list('volunteerHours'), { refetchInterval: 5000 })

  const volunteers = useMemo(() => getRows(volunteersData), [volunteersData])
  const users = useMemo(() => getRows(usersData), [usersData])
  const classes = useMemo(() => getRows(classesData), [classesData])
  const schedules = useMemo(() => getRows(schedulesData), [schedulesData])
  const requests = useMemo(() => getRows(requestsData), [requestsData])
  const assignments = useMemo(() => getRows(assignmentsData), [assignmentsData])
  const hours = useMemo(() => getRows(hoursData), [hoursData])

  const teacherUsers = useMemo(
    () => users.filter((user) => Number(user.role_id) === 1 || Number(user.role_id) === 2),
    [users]
  )

  const studentUsers = useMemo(
    () => users.filter((user) => Number(user.role_id) === 3 || normalizeText(user.role_name).includes('student')),
    [users]
  )

  const teacherById = useMemo(() => {
    return new Map(teacherUsers.map((teacher) => [String(teacher.id), teacher]))
  }, [teacherUsers])

  const classById = useMemo(() => {
    return new Map(classes.map((classItem) => [String(classItem.id), classItem]))
  }, [classes])

  const volunteerByStudentKey = useMemo(() => {
    const map = new Map()
    volunteers.forEach((volunteer) => {
      if (volunteer.student_id) map.set(`id:${volunteer.student_id}`, volunteer)
      if (volunteer.email_address) map.set(`email:${normalizeText(volunteer.email_address)}`, volunteer)
      map.set(`id:${volunteer.id}`, volunteer)
    })
    return map
  }, [volunteers])

  const latestAssignmentByStudent = useMemo(() => {
    const map = new Map()
    assignments.slice().sort((left, right) => Number(right.id) - Number(left.id)).forEach((assignment) => {
      if (!map.has(String(assignment.student_id))) {
        map.set(String(assignment.student_id), assignment)
      }
    })
    return map
  }, [assignments])

  const latestHourByStudent = useMemo(() => {
    const map = new Map()
    hours.slice().sort((left, right) => Number(right.id) - Number(left.id)).forEach((hour) => {
      if (!map.has(String(hour.student_id))) {
        map.set(String(hour.student_id), hour)
      }
    })
    return map
  }, [hours])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date()
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes())
    }, 60000)

    return () => window.clearInterval(timer)
  }, [])

  const currentScheduleByStudent = useMemo(() => {
    const map = new Map()
    studentUsers.forEach((student) => {
      const studentSchedules = schedules.filter((schedule) => String(schedule.student_id) === String(student.id))
      const currentSchedule = studentSchedules.find((schedule) => {
        const range = parseTimeRange(schedule.time)
        return range ? currentMinutes >= range.start && currentMinutes <= range.end : false
      }) || null
      map.set(String(student.id), currentSchedule)
    })
    return map
  }, [schedules, studentUsers, currentMinutes])

  const roster = useMemo(() => {
    return studentUsers.map((student) => {
      const volunteerRow = volunteerByStudentKey.get(`id:${student.id}`) || volunteerByStudentKey.get(`email:${normalizeText(student.email_address)}`) || null
      const currentSchedule = currentScheduleByStudent.get(String(student.id)) || null
      const activeAssignment = latestAssignmentByStudent.get(String(student.id)) || null
      const latestHour = latestHourByStudent.get(String(student.id)) || null
      return buildStudentIndex(
        {
          ...student,
          full_name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.email_address || `Student ${student.id}`,
          email: student.email_address || ''
        },
        volunteerRow,
        currentSchedule,
        activeAssignment,
        latestHour
      )
    })
  }, [studentUsers, volunteerByStudentKey, currentScheduleByStudent, latestAssignmentByStudent, latestHourByStudent])

  const currentVolunteerCountByClassId = useMemo(() => {
    const counts = new Map()
    volunteers.forEach((volunteer) => {
      const status = normalizeText(volunteer.status)
      const active = ['requesting_confirmation', 'checked_in', 'returning_confirmation'].includes(status)
      const classId = volunteer.assigned_class_id
      if (active && classId) {
        const key = String(classId)
        counts.set(key, (counts.get(key) || 0) + 1)
      }
    })
    return counts
  }, [volunteers])

  const currentVolunteerRows = useMemo(() => {
    return roster.filter((row) => ['Assigned', 'Checked In', 'Checked Out'].includes(row.status))
  }, [roster])

  const activeSessionRows = useMemo(() => {
    return hours
      .filter((hour) => String(hour.check_in || '').trim() || String(hour.check_out || '').trim())
      .map((hour) => {
        const student = studentUsers.find((entry) => String(entry.id) === String(hour.student_id))
        const classItem = classById.get(String(hour.class_id)) || null
        const teacher = classItem ? teacherById.get(String(classItem.teacher_id)) : null
        return {
          ...hour,
          student_name: student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() : `Student ${hour.student_id}`,
          teacher_name: teacher ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() : classItem?.teacher_id ? `Teacher ${classItem.teacher_id}` : '—',
          room: classItem?.room || '—',
          class_name: classItem?.name || '—',
          period: classItem?.period || '—',
          status_label: normalizeText(hour.approval_status) === 'approved' ? 'Approved' : normalizeText(hour.approval_status) === 'rejected' ? 'Rejected' : 'Pending Review'
        }
      })
      .sort((left, right) => Number(right.id) - Number(left.id))
  }, [hours, studentUsers, classById, teacherById])

  const completedSessions = useMemo(() => {
    return activeSessionRows.filter((session) => session.check_out)
  }, [activeSessionRows])

  const availabilityOptions = ['available', 'assigned', 'checked in', 'checked out', 'currently in class']
  const periodOptions = useMemo(() => Array.from(new Set(roster.map((row) => row.currentPeriod).filter(Boolean))).sort(), [roster])
  const teacherOptions = useMemo(() => Array.from(new Set(roster.map((row) => row.teacherName).filter((value) => value && value !== '—'))).sort(), [roster])
  const classOptions = useMemo(() => Array.from(new Set(roster.map((row) => row.className).filter((value) => value && value !== '—'))).sort(), [roster])

  const filteredRoster = useMemo(() => {
    return roster.filter((row) => {
      const search = normalizeText(searchTerm)
      if (search && !row.searchText.includes(search)) return false
      if (availabilityFilter !== 'all' && normalizeText(row.status) !== normalizeText(availabilityFilter)) return false
      if (periodFilter !== 'all' && normalizeText(row.currentPeriod) !== normalizeText(periodFilter)) return false
      if (teacherFilter !== 'all' && normalizeText(row.teacherName) !== normalizeText(teacherFilter)) return false
      if (classFilter !== 'all' && normalizeText(row.className) !== normalizeText(classFilter)) return false
      if (onlyCurrentlyVolunteering && !row.currentlyVolunteering) return false
      if (onlyAlreadyAssigned && !row.alreadyAssigned) return false
      if (onlyIndependentPeriod && !row.independentPeriod) return false
      return true
    })
  }, [roster, searchTerm, availabilityFilter, periodFilter, teacherFilter, classFilter, onlyCurrentlyVolunteering, onlyAlreadyAssigned, onlyIndependentPeriod])

  const availableVolunteers = useMemo(() => filteredRoster.filter((row) => row.availableNow), [filteredRoster])

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
        file_content: fileContent
      })
      setTeacherScheduleMessage('Teacher schedule uploaded successfully.')
      await queryClient.invalidateQueries(['schedules'])
    } catch (err) {
      setTeacherScheduleMessage(err?.message || 'Failed to upload teacher schedule.')
    } finally {
      event.target.value = ''
    }
  }

  const assignMutation = useMutation(
    async () => {
      if (!selectedVolunteer) return null
      const studentId = selectedVolunteer.id
      return backend.create('volunteerHours/check-out', {
        student_id: studentId,
        class_id: Number(selectedClassId),
        user_id: currentUserId
      })
    },
    {
      onSuccess: async () => {
        setSelectedVolunteer(null)
        setSelectedClassId('')
        await queryClient.invalidateQueries(['volunteers'])
        await queryClient.invalidateQueries(['volunteer-assignments'])
        await queryClient.invalidateQueries(['volunteer-hours'])
        await queryClient.invalidateQueries(['volunteer-requests'])
      }
    }
  )

  const statusMutation = useMutation(
    async ({ studentId, endpoint }) => {
      const route = endpoint === 'check-out' ? 'volunteerHours/check-out' : 'volunteerHours/check-in'
      return backend.create(route, { student_id: studentId, user_id: currentUserId })
    },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries(['volunteers'])
        await queryClient.invalidateQueries(['volunteer-assignments'])
        await queryClient.invalidateQueries(['volunteer-hours'])
      }
    }
  )

  const handleApproval = async (session, approvalStatus) => {
    await backend.update('volunteerHours', session.id, {
      approval_status: approvalStatus,
      approved: approvalStatus === 'approved' ? 1 : 0,
      approved_by: currentUserId
    }, { userRole: 'Admin' })
    await queryClient.invalidateQueries(['volunteer-hours'])
    await queryClient.invalidateQueries(['volunteers'])
    await queryClient.invalidateQueries(['volunteer-assignments'])
  }

  const selectedClass = selectedVolunteer ? classes.find((classItem) => String(classItem.id) === String(selectedClassId)) : null
  const selectedClassTeacher = selectedClass ? teacherById.get(String(selectedClass.teacher_id)) : null
  const selectedClassCount = selectedClass ? Number(currentVolunteerCountByClassId.get(String(selectedClass.id)) || 0) : 0

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm max-w-7xl mx-auto my-6 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                {teacherUsers.map((teacher) => {
                  const teacherLabel = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || `Teacher ${teacher.id}`
                  return (
                    <option key={teacher.id} value={teacher.id}>{teacherLabel}</option>
                  )
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-teal-50 p-2 text-teal-600">
            <Filter className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Volunteer Search & Filters</h3>
            <p className="text-sm text-slate-500">Search students and combine filters to narrow by schedule, teacher, class, and volunteer state.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1 text-sm text-slate-600 md:col-span-2 xl:col-span-3">
            <span className="font-medium">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Student name, current period, subject, teacher, class, availability"
                className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-teal-500"
              />
            </div>
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium">Availability</span>
            <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All</option>
              {availabilityOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium">Current Period</span>
            <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All</option>
              {periodOptions.map((period) => (
                <option key={period} value={period}>{period}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium">Teacher</span>
            <select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All</option>
              {teacherOptions.map((teacher) => (
                <option key={teacher} value={teacher}>{teacher}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium">Class</span>
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All</option>
              {classOptions.map((className) => (
                <option key={className} value={className}>{className}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={onlyCurrentlyVolunteering} onChange={(event) => setOnlyCurrentlyVolunteering(event.target.checked)} />
            Currently Volunteering
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={onlyAlreadyAssigned} onChange={(event) => setOnlyAlreadyAssigned(event.target.checked)} />
            Already Assigned
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={onlyIndependentPeriod} onChange={(event) => setOnlyIndependentPeriod(event.target.checked)} />
            Independent Period
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Available</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{availableVolunteers.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current Volunteers</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{currentVolunteerRows.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pending Reviews</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{completedSessions.filter((session) => normalizeText(session.approval_status) === 'pending').length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Approved Hours</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{completedSessions.filter((session) => normalizeText(session.approval_status) === 'approved').length}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Available Volunteers</h3>
            <p className="text-xs text-slate-500">Only students in Independent Period or Study Hall during the current period appear here.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{availableVolunteers.length}</span>
        </div>

        {availableVolunteers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-slate-400">
            <HeartHandshake className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">No available volunteers right now.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availableVolunteers.map((row) => {
              const teacherLabel = row.teacherName || '—'
              const classCount = Number(currentVolunteerCountByClassId.get(String(row.assignedClassId || row.currentSchedule?.class_id || row.id)) || 0)
              return (
                <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                      <HeartHandshake className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">{row.student.full_name}</p>
                      <div className="text-xs text-slate-500 space-y-1">
                        <div>Period: <span className="font-medium text-slate-700">{row.currentPeriod}</span></div>
                        <div>Class: <span className="font-medium text-slate-700">{row.className}</span></div>
                        <div>Teacher: <span className="font-medium text-slate-700">{teacherLabel}</span></div>
                        <div>Room: <span className="font-medium text-slate-700">{row.room}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span>Total Hours: <strong className="text-slate-700">{row.volunteerRow?.total_hours || '0.00'}</strong></span>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">Available</span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedVolunteer(row)
                      setSelectedClassId('')
                    }}
                    disabled={!classes.length}
                    className="w-full rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Assign To Class
                  </button>

                  {classCount > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">Already has volunteer</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Current Volunteers</h3>
          <p className="text-xs text-slate-500">Live status updates for every active volunteer session.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Teacher</th>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Check In Time</th>
                <th className="px-4 py-3 font-medium">Current Duration</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {currentVolunteerRows.length ? currentVolunteerRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{row.student.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.teacherName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.room}</td>
                  <td className="px-4 py-3 text-slate-600">{row.className}</td>
                  <td className="px-4 py-3 text-slate-600">{row.currentPeriod}</td>
                  <td className="px-4 py-3 text-slate-600">{formatTime(row.volunteerRow?.check_in || row.latestHour?.check_in)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDuration(row.volunteerRow?.check_in || row.latestHour?.check_in, row.volunteerRow?.check_out || row.latestHour?.check_out)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'Checked In' ? 'bg-emerald-100 text-emerald-700' : row.status === 'Checked Out' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={8}>No active volunteers.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedVolunteer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <button onClick={() => setSelectedVolunteer(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>

            <div>
              <h4 className="text-base font-bold text-slate-900">Assign Volunteer</h4>
              <p className="text-xs text-slate-500">Choose the target class for {selectedVolunteer.student.full_name}.</p>
            </div>

            <label className="space-y-1 text-sm text-slate-600">
              <span className="font-medium">Class</span>
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">-- Select a class --</option>
                {classes.map((classItem) => {
                  const teacher = teacherById.get(String(classItem.teacher_id))
                  const teacherLabel = teacher ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || `Teacher ${teacher.id}` : `Teacher ${classItem.teacher_id}`
                  const currentCount = Number(currentVolunteerCountByClassId.get(String(classItem.id)) || 0)
                  const alreadyHasVolunteer = currentCount > 0
                  return (
                    <option key={classItem.id} value={classItem.id}>
                      {`${classItem.name || `Class #${classItem.id}`} - ${teacherLabel} (${classItem.room || 'No room'} | ${classItem.period || 'No period'} | ${currentCount} volunteer${currentCount === 1 ? '' : 's'})${alreadyHasVolunteer ? ' - Already has volunteer' : ''}`}
                    </option>
                  )
                })}
              </select>
            </label>

            {selectedClass && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{selectedClass.name || `Class #${selectedClass.id}`}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${selectedClassCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {selectedClassCount > 0 ? 'Already has volunteer' : 'No volunteer yet'}
                  </span>
                </div>
                <div>Teacher: {selectedClassTeacher ? `${selectedClassTeacher.first_name || ''} ${selectedClassTeacher.last_name || ''}`.trim() : `Teacher ${selectedClass.teacher_id}`}</div>
                <div>Room: {selectedClass.room || '—'}</div>
                <div>Period: {selectedClass.period || '—'}</div>
                <div>Current volunteer count: {selectedClassCount}</div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setSelectedVolunteer(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">Cancel</button>
              <button
                onClick={() => assignMutation.mutate()}
                disabled={!selectedClassId || assignMutation.isPending}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {assignMutation.isPending ? 'Assigning...' : 'Assign Volunteer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
