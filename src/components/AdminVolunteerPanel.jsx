import React, { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HeartHandshake, LogIn, LogOut } from 'lucide-react'
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

  const volunteerRows = useMemo(() => {
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
  }, [classes, teacherById, volunteers, nowMs])
  const availableVolunteers = useMemo(
    () => volunteerRows.filter((volunteer) => volunteer.isAvailable),
    [volunteerRows]
  )

  const currentVolunteers = useMemo(
    () => volunteerRows.filter((volunteer) => volunteer.isCurrent),
    [volunteerRows]
  )

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
    
  )
}