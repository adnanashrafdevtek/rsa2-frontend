import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import backend from '../api/backendClient'

function getRows(payload) {
  if (Array.isArray(payload)) return payload
  return (payload && payload.mysqlResult) || []
}

export default function ProfilePage() {
  const [currentUserId, setCurrentUserId] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('planner-current-user-id') || ''
  })

  const { data: userOptionsData } = useQuery(['backend', 'profile-users'], () => backend.list('users'), { staleTime: 1000 * 30 })
  const { data: roleOptionsData } = useQuery(['backend', 'profile-roles'], () => backend.list('roles'), { staleTime: 1000 * 30 })

  const userOptions = useMemo(() => getRows(userOptionsData), [userOptionsData])
  const roleOptions = useMemo(() => getRows(roleOptionsData), [roleOptionsData])

  const currentUser = useMemo(() => {
    if (!currentUserId) return userOptions[0] || null
    return userOptions.find((user) => String(user.id) === String(currentUserId)) || userOptions[0] || null
  }, [currentUserId, userOptions])

  const roleMap = useMemo(() => Object.fromEntries(roleOptions.map((role) => [String(role.id), role.name])), [roleOptions])
  const currentUserRoleName = useMemo(() => {
    if (!currentUser) return 'Unassigned'
    return roleMap[String(currentUser.role_id)] || `Role ${currentUser.role_id}`
  }, [currentUser, roleMap])

  useEffect(() => {
    if (!userOptions.length) return
    if (!currentUserId) {
      setCurrentUserId(String(userOptions[0].id))
    }
  }, [currentUserId, userOptions])

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
            <p className="mt-1 text-sm text-slate-500">Viewing the currently selected account details.</p>
          </div>
          <label className="w-full max-w-sm space-y-1 text-sm text-slate-600">
            <span className="font-medium">Signed in as</span>
            <select
              value={currentUserId}
              onChange={(event) => setCurrentUserId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {userOptions.map((user) => (
                <option key={user.id} value={user.id}>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email_address || `User ${user.id}`}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Name</div>
            <div className="mt-1 font-medium text-slate-900">{currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : '—'}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Email</div>
            <div className="mt-1 font-medium text-slate-900">{currentUser?.email_address || '—'}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Role</div>
            <div className="mt-1 font-medium text-slate-900">{currentUserRoleName}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
