import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HeartHandshake, LogIn, LogOut, Clock, AlertCircle, Loader2 } from 'lucide-react'
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
  const parsed = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString([], { hour: '2-digit', minute: '2-digit' })
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

  const { data: volunteersData, isLoading: volunteersLoading, error: volunteersError } = useQuery(
    ['teacher-volunteers', teacherId],
    () => backend.list('volunteers'),
    { refetchInterval: 5000 }
  )

  const { data: assignmentsData, isLoading: assignmentsLoading, error: assignmentsError } = useQuery(
    ['teacher-volunteer-assignments', teacherId],
    () => backend.list('volunteer-assignments', { teacher_id: teacherId }),
    { enabled: !!teacherId, refetchInterval: 5000 }
  )

  const { data: hoursData, isLoading: hoursLoading, error: hoursError } = useQuery(
    ['teacher-volunteer-hours', teacherId],
    () => backend.list('volunteerHours'),
    { refetchInterval: 5000 }
  )

  const classes = useMemo(() => getRows(classesData), [classesData])
  const volunteers = useMemo(() => getRows(volunteersData), [volunteersData])
  const assignments = useMemo(() => getRows(assignmentsData), [assignmentsData])
  const hours = useMemo(() => getRows(hoursData), [hoursData])

  const teacherClassIds = useMemo(() => new Set(classes.map((classItem) => String(classItem.id))), [classes])

  const classById = useMemo(() => {
    const map = new Map()
    classes.forEach((classItem) => map.set(String(classItem.id), classItem))
    return map
  }, [classes])

  const volunteerByStudentId = useMemo(() => {
    const map = new Map()
    volunteers.forEach((volunteer) => {
      const key = String(volunteer.student_id || volunteer.id)
      map.set(key, volunteer)
    })
    return map
  }, [volunteers])

  const teacherAssignments = useMemo(() => {
    return assignments
      .filter((assignment) => String(assignment.teacher_id) === String(teacherId))
      .map((assignment) => {
        const volunteer = volunteerByStudentId.get(String(assignment.student_id)) || null
        const classItem = classById.get(String(assignment.class_id)) || null
        const status = normalizeText(volunteer?.status || assignment.status)
        const checkIn = volunteer?.check_in || assignment.check_in || null
        const checkOut = volunteer?.check_out || assignment.check_out || null

        return {
          id: assignment.id,
          studentId: assignment.student_id,
          studentName: volunteer ? `${volunteer.first_name || ''} ${volunteer.last_name || ''}`.trim() || volunteer.email_address || `Student ${assignment.student_id}` : `Student ${assignment.student_id}`,
          classId: assignment.class_id,
          className: classItem?.name || `Class ${assignment.class_id}`,
          room: classItem?.room || '—',
          period: classItem?.period || '—',
          teacherName: 'Your classroom',
          status,
          checkIn,
          checkOut,
          totalHours: volunteer?.total_hours || assignment.total_hours || '0.00',
          volunteer,
          assignment,
          active: ['requesting_confirmation', 'checked_in', 'returning_confirmation'].includes(status) || ['requested', 'en_route', 'arrived'].includes(normalizeText(assignment.status))
        }
      })
  }, [assignments, volunteerByStudentId, classById, teacherId])

  const currentVolunteer = useMemo(() => {
    return teacherAssignments.find((item) => item.status === 'checked_in') || teacherAssignments.find((item) => item.status === 'requesting_confirmation') || null
  }, [teacherAssignments])

  const checkedInVolunteers = useMemo(() => {
    return teacherAssignments.filter((item) => item.status === 'checked_in')
  }, [teacherAssignments])

  const completedVolunteers = useMemo(() => {
    return hours
      .filter((hour) => teacherClassIds.has(String(hour.class_id)) && String(hour.check_out || '').trim())
      .map((hour) => {
        const volunteer = volunteerByStudentId.get(String(hour.student_id)) || null
        const classItem = classById.get(String(hour.class_id)) || null
        const checkIn = hour.check_in || volunteer?.check_in || null
        const checkOut = hour.check_out || volunteer?.check_out || null

        return {
          ...hour,
          studentName: volunteer ? `${volunteer.first_name || ''} ${volunteer.last_name || ''}`.trim() || volunteer.email_address || `Student ${hour.student_id}` : `Student ${hour.student_id}`,
          className: classItem?.name || `Class ${hour.class_id}`,
          room: classItem?.room || '—',
          period: classItem?.period || '—',
          checkIn,
          checkOut,
          status: normalizeText(hour.approval_status) === 'approved' ? 'approved' : normalizeText(hour.approval_status) === 'rejected' ? 'rejected' : 'pending'
        }
      })
  }, [hours, teacherClassIds, volunteerByStudentId, classById])

  const handleCheckInOut = useMutation(
    async ({ volunteerId, endpoint }) => {
      if (!volunteerId) throw new Error('Missing volunteer ID')
      setErrorMessage('')
      setLoadingId(volunteerId)
      const route = endpoint === 'check-out' ? 'volunteerHours/check-out' : 'volunteerHours/check-in'
      return backend.create(route, { student_id: volunteerId, user_id: teacherId })
    },
    {
      onSuccess: async () => {
        setLoadingId(null)
        await queryClient.invalidateQueries(['teacher-volunteers', teacherId])
        await queryClient.invalidateQueries(['teacher-volunteer-assignments', teacherId])
        await queryClient.invalidateQueries(['teacher-volunteer-hours', teacherId])
      },
      onError: (error) => {
        setLoadingId(null)
        setErrorMessage(error?.message || 'Unable to update volunteer status.')
      }
    }
  )

  const loading = classesLoading || volunteersLoading || assignmentsLoading || hoursLoading
  const error = classesError || volunteersError || assignmentsError || hoursError

  const assignedTeacherCount = teacherAssignments.length
  const activeAssignmentCount = teacherAssignments.filter((item) => ['requesting_confirmation', 'checked_in', 'returning_confirmation'].includes(item.status)).length
  const completedSessionCount = completedVolunteers.length

  return (
    <div className="max-w-6xl mx-auto my-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="rounded-2xl bg-gradient-to-r from-teal-50 via-white to-slate-50 p-5 border border-slate-200">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-teal-600 p-2 text-white shadow-sm">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900">Volunteer Check In / Check Out</h3>
            <p className="text-sm text-slate-600">Manage only the volunteers assigned to your classes. Status changes stay synced with the admin side automatically.</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your assigned volunteers...
        </div>
      )}

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