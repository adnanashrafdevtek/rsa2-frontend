import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users2, Send, Sparkles } from 'lucide-react'
import backend from '../api/backendClient'

export default function VolunteersPlaceholder() {
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusError, setStatusError] = useState('')

  const teacherId = typeof window !== 'undefined'
    ? window.localStorage.getItem('planner-current-user-id')
    : null

  const { data: usersData } = useQuery(
    ['all-users'],
    () => backend.list('users'),
    { staleTime: 1000 * 30, retry: false }
  )

  const { data: requestsData, isLoading: requestsLoading, refetch: refetchRequests } = useQuery(
    ['teacher-volunteer-requests', teacherId],
    () => (teacherId ? backend.list('volunteer-requests', { teacher_id: teacherId }) : Promise.resolve([])),
    { staleTime: 1000 * 30, retry: false, enabled: !!teacherId }
  )

  const students = useMemo(() => {
    const rows = Array.isArray(usersData) ? usersData : (usersData && usersData.mysqlResult) || []
    return rows.filter((user) => {
      const roleName = String(user.role_name || user.roleName || user.role || '').toLowerCase()
      return roleName.includes('student') || roleName.includes('learner')
    })
  }, [usersData])

  const requests = useMemo(() => {
    const rows = Array.isArray(requestsData) ? requestsData : (requestsData && requestsData.mysqlResult) || []
    return rows
  }, [requestsData])

  function toggleStudent(studentId) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!teacherId) {
      setStatusError('Teacher identity is not available. Please sign in again.')
      return
    }
    if (!selectedStudentIds.length) {
      setStatusError('Select at least one student to request.')
      return
    }

    setLoading(true)
    setStatusError('')
    setStatusMessage('')

    try {
      await backend.create('volunteer-requests', {
        teacher_id: Number(teacherId),
        student_ids: selectedStudentIds,
        message
      })
      await refetchRequests()
      setStatusMessage('Volunteer requests sent to the admin for approval.')
      setSelectedStudentIds([])
      setMessage('')
    } catch (err) {
      setStatusError(err?.message || 'Unable to send volunteer requests right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-teal-50 p-2 text-teal-600">
          <Users2 className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Request student volunteers</h3>
          <p className="text-sm text-slate-500">Choose students, add a note for the admin, and send the request for approval or decline.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <Sparkles className="h-4 w-4 text-teal-600" />
            Select students
          </div>
          {students.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {students.map((student) => {
                const studentId = student.id ?? student.user_id ?? student.userId
                const selected = selectedStudentIds.includes(Number(studentId))
                const label = `${student.first_name || student.firstName || ''} ${student.last_name || student.lastName || ''}`.trim() || student.email_address || student.emailAddress || `Student ${studentId}`

                return (
                  <button
                    key={studentId}
                    type="button"
                    onClick={() => toggleStudent(Number(studentId))}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${selected ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No student list is available yet. The request form will still work once students are loaded.</p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Message for admin</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows="4"
            placeholder="Example: Please approve this volunteer request for the next class activity."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
          >
            <Send className="h-4 w-4" />
            {loading ? 'Sending...' : 'Send request'}
          </button>
          <span className="text-sm text-slate-500">Selected: {selectedStudentIds.length}</span>
        </div>

        {statusMessage ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{statusMessage}</div> : null}
        {statusError ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{statusError}</div> : null}
      </form>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 text-sm font-medium text-slate-700">Pending requests</div>
        {requestsLoading ? (
          <p className="text-sm text-slate-500">Loading requests...</p>
        ) : requests.length ? (
          <div className="space-y-2">
            {requests.map((request) => (
              <div key={request.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Student #{request.student_id}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${request.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : request.status === 'declined' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    {request.status || 'pending'}
                  </span>
                </div>
                {request.message ? <p className="mt-1 text-slate-500">{request.message}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No volunteer requests yet.</p>
        )}
      </div>
    </div>
  )
}
