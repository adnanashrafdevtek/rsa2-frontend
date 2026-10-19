import React, { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HeartHandshake, LogIn, LogOut, X } from 'lucide-react'
import backend, { BASE } from '../api/backendClient'

function getRows(payload) {
  if (Array.isArray(payload)) return payload
  return (payload && payload.mysqlResult) || []
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

// "8:15" -> minutes since midnight. Hours 1-6 are treated as PM (school day is ~7:50 AM - 3:30 PM).
function parseClockToMinutes(text) {
  const match = String(text || '').trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return NaN
  let hour = Number(match[1])
  const minute = Number(match[2])
  if (hour >= 1 && hour <= 6) hour += 12
  return hour * 60 + minute
}

// timeRange like "8:15-8:55". True when `now` falls inside it.
function isClassInSession(timeRange, now) {
  const parts = String(timeRange || '').split(/\s*[-–—]\s*/)
  if (parts.length !== 2) return false
  const start = parseClockToMinutes(parts[0])
  const end = parseClockToMinutes(parts[1])
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false
  const current = now.getHours() * 60 + now.getMinutes()
  return current >= start && current < end
}

const CUSTOM_OPTION_VALUE = '__custom__'

// Names compare with spaces collapsed and case ignored
function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
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

  const [selectedClassSelections, setSelectedClassSelections] = useState({})
  const [manualVolunteerId, setManualVolunteerId] = useState('')
  const [manualHours, setManualHours] = useState('')
  const [manualOperation, setManualOperation] = useState('add')
  const [manualNote, setManualNote] = useState('')
  const [manualAdjustmentMessage, setManualAdjustmentMessage] = useState('')

  // Custom assignment modal: { rowId, studentId } while open, otherwise null
  const [customModal, setCustomModal] = useState(null)
  const [customForm, setCustomForm] = useState({ teacher: '', where: '' })
  const [customSending, setCustomSending] = useState(false)
  const [customError, setCustomError] = useState('')

  // Ask the server which schedule is in effect (Ramadan-aware).
  const { data: scheduleNowData } = useQuery(
    ['schedule-now'],
    () => backend.scheduleNow(),
    { refetchInterval: 60000, staleTime: 60000, retry: 0 }
  )

  const scheduleDayParam = useMemo(() => {
    const dt = scheduleNowData?.dayType
    // Weekend falls back to mon-thu; on weekend the in-session filter hides everything anyway.
    return dt === 'fri' ? 'fri' : 'mon-thu'
  }, [scheduleNowData])

  // Teacher is role_id 1 in the role table
  // Role IDs differ between databases, so look the teacher role up by name.
const { data: rolesData } = useQuery(['roles'], () => backend.list('roles'), { staleTime: 1000 * 60 })
const teacherRoleId = useMemo(() => {
  const match = getRows(rolesData).find((role) => normalizeText(role.name) === 'teacher')
  return match ? match.id : null
}, [rolesData])

const adminRoleId = useMemo(() => {
  const match = getRows(rolesData).find((role) => normalizeText(role.name) === 'admin')
  return match ? match.id : null
}, [rolesData])

const { data: teachersData } = useQuery(
  ['teachers', teacherRoleId],
  () => backend.list('users', { role_id: teacherRoleId }),
  { refetchInterval: 5000, enabled: teacherRoleId !== null }
)
const { data: adminsData } = useQuery(
  ['admins', adminRoleId],
  () => backend.list('users', { role_id: adminRoleId }),
  { refetchInterval: 5000, enabled: adminRoleId !== null }
)
  const { data: classesData } = useQuery(
    ['classes', scheduleDayParam],
    () => backend.list('classes', { schedule_days: scheduleDayParam }),
    { refetchInterval: 5000 }
  )
  const { data: volunteersData } = useQuery(['volunteers'], () => backend.list('volunteers'), { refetchInterval: 5000 })

  const teacherUsers = useMemo(() => getRows(teachersData), [teachersData])
  const adminUsers = useMemo(() => getRows(adminsData), [adminsData])
  const classes = useMemo(() => getRows(classesData), [classesData])
  const volunteers = useMemo(() => getRows(volunteersData), [volunteersData])

  // Ticks every 30s so the "in session" list stays current
  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 30000)
    return () => window.clearInterval(intervalId)
  }, [])

  const teacherById = useMemo(() => {
    return new Map(teacherUsers.map((teacher) => [String(teacher.id), teacher]))
  }, [teacherUsers])

  const adminById = useMemo(() => {
    return new Map(adminUsers.map((admin) => [String(admin.id), admin]))
  }, [adminUsers])

  // Exact teacher names offered as suggestions in the custom box
  const teacherFullNames = useMemo(() => {
    return teacherUsers
      .map((teacher) => `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
  }, [teacherUsers])

  // Only classes that are happening right now, grouped by teacher.
  // Teachers with no class in session are not listed.
  const teacherOptions = useMemo(() => {
    const options = []
    const classesByTeacherId = new Map()
    const now = new Date(nowMs)
    classes
      .filter((classItem) => isClassInSession(classItem.time, now))
      .forEach((classItem) => {
        const teacherId = String(classItem.teacher_id || '')
        if (!teacherId) return
        const teacherClasses = classesByTeacherId.get(teacherId) || []
        teacherClasses.push(classItem)
        classesByTeacherId.set(teacherId, teacherClasses)
      })

    teacherUsers.forEach((teacher) => {
      const teacherId = String(teacher.id)
      const teacherName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || `Teacher ${teacher.id}`
      const teacherClasses = classesByTeacherId.get(teacherId) || []

      if (!teacherClasses.length) return

      teacherClasses.forEach((classItem) => {
        const className = classItem.name || classItem.class_name || 'Unnamed Class'
        const roomNum = classItem.room || classItem.room_name || '—'
        options.push({
          value: String(classItem.id),
          label: `${className} — ${teacherName} (Rm: ${roomNum})`,
          teacherId,
          classId: String(classItem.id),
        })
      })
    })

    return options
  }, [classes, teacherUsers, nowMs])

  const volunteerRows = useMemo(() => {
    return volunteers
      .filter((volunteer) => normalizeText(volunteer.status) !== 'inactive')
      .map((volunteer) => {
        const status = getVolunteerStatus(volunteer)
        const fullName = getVolunteerName(volunteer)
        const classId = volunteer.assigned_class_id || volunteer.class_id || ''
        const classItem = classId ? classes.find((entry) => String(entry.id) === String(classId)) : null
        const teacher = classItem ? teacherById.get(String(classItem.teacher_id)) : null
        const assignedAdmin = adminById.get(String(volunteer.assigned_teacher_id)) || null
        const teacherId = classItem?.teacher_id ? String(classItem.teacher_id) : (volunteer.assigned_teacher_id ? String(volunteer.assigned_teacher_id) : '')
        const isAvailable = AVAILABLE_VOLUNTEER_STATUSES.has(status)
        const isCurrent = CURRENT_VOLUNTEER_STATUSES.has(status)

        const customTeacher = String(volunteer.custom_teacher || '').trim()
        const customLocation = String(volunteer.custom_location || '').trim()
        const isCustomAssignment = !classItem && (customTeacher || customLocation)

        return {
          id: volunteer.id,
          studentId: Number(volunteer.student_id) || Number(volunteer.id),
          fullName,
          totalHours: getVolunteerHours(volunteer, nowMs),
          status: volunteer.status || 'available',
          className: classItem?.name || classItem?.class_name || (isCustomAssignment ? 'Custom' : '—'),
          teacherName: assignedAdmin
            ? `${assignedAdmin.first_name || ''} ${assignedAdmin.last_name || ''}`.trim() || assignedAdmin.email_address || '—'
            : teacher
              ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || '—'
              : (customTeacher || '—'),
          room: classItem?.room || classItem?.room_name || customLocation || '—',
          period: classItem?.period || '—',
          classId: classId ? String(classId) : '',
          teacherId,
          assignedTeacherId: volunteer.assigned_teacher_id ? String(volunteer.assigned_teacher_id) : '',
          isCustomAssignment: Boolean(isCustomAssignment),
          searchText: normalizeText([fullName, volunteer.status, classItem?.name, classItem?.room, classItem?.period, teacher?.first_name, teacher?.last_name, customTeacher, customLocation].filter(Boolean).join(' ')),
          isAvailable,
          isCurrent,
          isRequestingConfirmation: status === 'requesting_confirmation' || status === 'requesting confirmation' || status === 'pending arrival' || status === 'pending_arrival',
          isReturningConfirmation: status === 'returning_confirmation' || status === 'returning confirmation' || status === 'pending return' || status === 'requesting return',
          isCheckedIn: status === 'checked_in' || status === 'checked in' || status === 'currently volunteering',
        }
      })
  }, [adminById, classes, teacherById, volunteers, nowMs])

  const availableVolunteers = useMemo(
    () => volunteerRows.filter((volunteer) => volunteer.isAvailable),
    [volunteerRows]
  )

  const currentVolunteers = useMemo(
    () => volunteerRows.filter((volunteer) => volunteer.isCurrent),
    [volunteerRows]
  )

  const adminAssignedVolunteers = useMemo(
    () => volunteerRows.filter((volunteer) => adminById.has(String(volunteer.assignedTeacherId))),
    [adminById, volunteerRows]
  )

  const refreshVolunteers = async () => {
    await queryClient.invalidateQueries(['volunteers'])
    await queryClient.invalidateQueries(['volunteer_hours'])
  }

  const handleAdminConfirmReturn = async (studentId) => {
    try {
      await backend.adminConfirmReturn(studentId)
      await refreshVolunteers()
    } catch (error) {
      console.error('Failed to confirm return:', error)
      alert(error?.message || 'Failed to confirm return.')
    }
  }

  const handleSendBackToTeacher = async (studentId) => {
    try {
      await backend.returnVolunteerFromTeacher(studentId)
      await refreshVolunteers()
    } catch (error) {
      console.error('Failed to send volunteer back:', error)
      alert(error?.message || 'Failed to send volunteer back.')
    }
  }

  const handleCancelTeacherHandoff = async (studentId) => {
    try {
      await backend.cancelVolunteerAssignment(studentId)
      await refreshVolunteers()
    } catch (error) {
      console.error('Failed to cancel volunteer assignment:', error)
      alert(error?.message || 'Failed to cancel volunteer assignment.')
    }
  }

  const handleManualHoursAdjustment = async (event) => {
    event.preventDefault()
    const hours = Number(manualHours)

    if (!manualVolunteerId || !Number.isFinite(hours) || hours <= 0) {
      setManualAdjustmentMessage('Select a volunteer and enter a positive number of hours.')
      return
    }

    try {
      await backend.adjustVolunteerHours(manualVolunteerId, hours, manualOperation, manualNote)
      await refreshVolunteers()
      setManualHours('')
      setManualNote('')
      setManualAdjustmentMessage('Hours updated successfully.')
    } catch (error) {
      console.error('Failed to adjust volunteer hours:', error)
      setManualAdjustmentMessage(error?.message || 'Failed to adjust volunteer hours.')
    }
  }

  const handleSendToTeacher = async (studentId, teacherId, classId, rowId) => {
    const selectedValue = selectedClassSelections[rowId] || classId
    const selectedOption = teacherOptions.find((option) => option.value === selectedValue)
    const selectedClassId = selectedOption?.classId || (String(selectedValue).startsWith('teacher:') ? '' : selectedValue)
    const targetClassObj = selectedClassId ? classes.find((c) => String(c.id) === String(selectedClassId)) : null

    const safeTeacherId = Number(targetClassObj?.teacher_id || selectedOption?.teacherId || teacherId) || null
    const safeClassId = selectedClassId ? Number(selectedClassId) : null

    if (!safeTeacherId || !safeClassId) {
      alert('Please select a target class and teacher from the dropdown before sending the volunteer.')
      return
    }

    try {
      await backend.sendVolunteerToTeacher(Number(studentId), Number(safeTeacherId), Number(safeClassId))
      await refreshVolunteers()
    } catch (error) {
      console.error('Failed to send volunteer to teacher:', error)
      alert(error?.message || 'Failed to send volunteer to teacher.')
    }
  }

  const handleAdminCheckIn = async (studentId) => {
    try {
      await backend.confirmVolunteerArrival(studentId)
      await refreshVolunteers()
    } catch (error) {
      console.error('Failed to check in volunteer:', error)
      alert(error?.message || 'Failed to check in volunteer.')
    }
  }

  const handleAdminCheckOut = async (studentId) => {
    try {
      await backend.returnVolunteerFromTeacher(studentId)
      await refreshVolunteers()
    } catch (error) {
      console.error('Failed to check out volunteer:', error)
      alert(error?.message || 'Failed to check out volunteer.')
    }
  }

  const closeCustomModal = () => {
    setCustomModal(null)
    setCustomForm({ teacher: '', where: '' })
    setCustomError('')
  }

  // Custom reason: free-text teacher + location. Not checked against the user table.
  const handleSendCustom = async (event) => {
    event.preventDefault()
    const teacher = customForm.teacher.trim()
    const where = customForm.where.trim()

    if (!teacher || !where) {
      setCustomError('Enter which teacher and where.')
      return
    }

    if (teacher.split(/\s+/).length < 2) {
      setCustomError("Enter the teacher's first and last name.")
      return
    }

    // Must be an exact teacher name (case does not matter)
    const wanted = normalizeName(teacher)
    const matches = teacherUsers.filter(
      (entry) => normalizeName(`${entry.first_name || ''} ${entry.last_name || ''}`) === wanted
    )
    if (!matches.length) {
      setCustomError(`No teacher named "${teacher}" was found. Enter the exact first and last name.`)
      return
    }
    if (matches.length > 1) {
      setCustomError(`More than one teacher is named "${teacher}". Use the class dropdown instead.`)
      return
    }

    setCustomError('')
    setCustomSending(true)
    try {
      const response = await fetch(`${BASE}/volunteerHours/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: Number(customModal.studentId),
          custom_teacher: teacher,
          custom_location: where,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.status === 'error') {
        throw new Error(result.message || 'Failed to send volunteer.')
      }

      await refreshVolunteers()
      closeCustomModal()
    } catch (error) {
      console.error('Failed to send volunteer (custom):', error)
      setCustomError(error?.message || 'Failed to send volunteer.')
    } finally {
      setCustomSending(false)
    }
  }

  return (
    <div className="mx-auto my-6 max-w-6xl rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm md:p-5">
      <div className="space-y-4">
        <div className="space-y-4 pt-4">
          <div className="mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Volunteer Management</p>
            <h4 className="text-lg font-medium text-slate-900">Available and current volunteers</h4>
            <p className="text-xs text-slate-500">Available volunteers can be assigned. Current volunteers are already on an active or pending assignment.</p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-3">
            <div className="mb-3">
              <div className="text-sm font-semibold text-slate-900">Admin volunteer check-in</div>
              <div className="text-xs text-slate-500">Check in and check out students assigned to this admin.</div>
            </div>

            <div className="space-y-3">
              {adminAssignedVolunteers.length ? adminAssignedVolunteers.map((volunteer) => (
                <div key={`admin-assigned-${volunteer.id}`} className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{volunteer.fullName}</p>
                    <p className="text-xs text-slate-500">To: {volunteer.teacherName} • {volunteer.totalHours} hrs</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Status:</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{formatStatusLabel(volunteer.status)}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!volunteer.isRequestingConfirmation}
                      onClick={() => handleAdminCheckIn(volunteer.studentId)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${volunteer.isRequestingConfirmation ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'cursor-not-allowed bg-slate-100 text-slate-400'}`}
                    >
                      <LogIn className="h-4 w-4" /> Check In
                    </button>
                    <button
                      type="button"
                      disabled={!volunteer.isCheckedIn}
                      onClick={() => handleAdminCheckOut(volunteer.studentId)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${volunteer.isCheckedIn ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'cursor-not-allowed bg-slate-100 text-slate-400'}`}
                    >
                      <LogOut className="h-4 w-4" /> Check Out
                    </button>
                  </div>
                </div>
              )) : <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">No volunteers are currently assigned to this admin.</div>}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">Available volunteers</div>
                <div className="text-xs text-slate-500">Students not currently volunteering but able to be assigned. The dropdown shows classes in session right now.</div>
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
                            const newValue = e.target.value
                            if (newValue === CUSTOM_OPTION_VALUE) {
                              setCustomModal({ rowId: volunteer.id, studentId: volunteer.studentId })
                              return
                            }
                            setSelectedClassSelections((prev) => ({
                              ...prev,
                              [volunteer.id]: newValue,
                            }))
                          }}
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs shadow-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                        >
                          <option value="">Select class & teacher...</option>
                          {teacherOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                          <option value={CUSTOM_OPTION_VALUE}>Custom reason…</option>
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
                      <p className="truncate text-xs text-slate-500">{volunteer.isCustomAssignment ? volunteer.room : `${volunteer.room} • ${volunteer.period}`}</p>
                    </div>
                    <span className="truncate font-semibold text-slate-900">{volunteer.totalHours} hrs</span>
                    <span className="truncate text-xs font-semibold text-amber-700">{formatStatusLabel(volunteer.status)}</span>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.isRequestingConfirmation && (
                        <button
                          type="button"
                          onClick={() => handleCancelTeacherHandoff(volunteer.studentId)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                      )}

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

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-3">
            <div className="mb-3">
              <div className="text-sm font-semibold text-slate-900">Manual hour adjustment</div>
              <div className="text-xs text-slate-500">Add or remove hours without changing automatically calculated check-in hours.</div>
            </div>

            <form onSubmit={handleManualHoursAdjustment} className="grid gap-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_1.4fr_auto] md:items-end">
              <label className="block text-xs font-semibold text-slate-600">
                Volunteer
                <select
                  value={manualVolunteerId}
                  onChange={(event) => setManualVolunteerId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  required
                >
                  <option value="">Select volunteer...</option>
                  {volunteers.map((volunteer) => (
                    <option key={volunteer.student_id || volunteer.id} value={volunteer.student_id || volunteer.id}>
                      {volunteer.fullName || getVolunteerName(volunteer)} ({Number(volunteer.total_hours || 0).toFixed(2)} hrs)
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-600">
                Action
                <select
                  value={manualOperation}
                  onChange={(event) => setManualOperation(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="add">Add hours</option>
                  <option value="remove">Remove hours</option>
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-600">
                Hours
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={manualHours}
                  onChange={(event) => setManualHours(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  required
                />
              </label>

              <label className="block text-xs font-semibold text-slate-600">
                Note
                <input
                  type="text"
                  maxLength="255"
                  value={manualNote}
                  onChange={(event) => setManualNote(event.target.value)}
                  placeholder="Optional reason"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </label>

              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
              >
                Apply
              </button>
            </form>
            {manualAdjustmentMessage && (
              <p className="mt-3 text-xs font-medium text-slate-600">{manualAdjustmentMessage}</p>
            )}
          </div>
        </div>
      </div>

      {customModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleSendCustom} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-900">Custom assignment</h4>
              <button
                type="button"
                onClick={closeCustomModal}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mb-3 block text-xs font-semibold text-slate-600">
              Which teacher
              <input
                value={customForm.teacher}
                onChange={(e) => setCustomForm((prev) => ({ ...prev, teacher: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                placeholder="First and last name"
                maxLength={255}
                list="custom-teacher-names"
                autoComplete="off"
                required
                autoFocus
              />
              <datalist id="custom-teacher-names">
                {teacherFullNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>

            <label className="mb-4 block text-xs font-semibold text-slate-600">
              Where
              <input
                value={customForm.where}
                onChange={(e) => setCustomForm((prev) => ({ ...prev, where: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                placeholder="e.g. Library"
                maxLength={255}
                required
              />
            </label>

            {customError && (
              <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {customError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCustomModal}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={customSending}
                className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
              >
                {customSending ? 'Sending…' : 'Send volunteer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}