import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import backend from '../api/backendClient'

const RESOURCES = ['roles','user','class','rooms','messages','schedules','clubs','events','club_has_event','volunteer-requests']

function useList(res) {
  return useQuery(['backend', res], () => backend.list(res), { staleTime: 1000 * 30 })
}

export default function BackendAdmin(){
  const [resource, setResource] = useState('volunteer-requests')
  const [actioningId, setActioningId] = useState(null)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [decisionNote, setDecisionNote] = useState('')
  const { data, isLoading, error, refetch } = useList(resource)
  const rows = Array.isArray(data) ? data : (data && data.mysqlResult) || []

  const adminId = typeof window !== 'undefined'
    ? window.localStorage.getItem('planner-current-user-id')
    : null

  useEffect(() => {
    if (resource !== 'volunteer-requests' && resource !== 'messages') return undefined
    const interval = window.setInterval(() => {
      refetch()
    }, 5000)
    return () => window.clearInterval(interval)
  }, [resource, refetch])

  async function handleVolunteerDecision(id, status) {
    try {
      setActioningId(id)
      setActionError('')
      setActionMessage('')
      await backend.update('volunteer-requests', id, {
        status,
        admin_id: Number(adminId || 1),
        message: decisionNote || (status === 'approved' ? 'Your volunteer request has been accepted.' : 'Your volunteer request has been declined.')
      })
      setActionMessage(`Volunteer request ${status}. A message was sent to the teacher.`)
      setDecisionNote('')
      await refetch()
    } catch (err) {
      setActionError(err?.message || 'Unable to update the volunteer request.')
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div className="container">
      <h1>Backend Explorer</h1>
      <div className="toolbar">
        {RESOURCES.map(r => (
          <button key={r} className={`btn ${r===resource ? 'primary':''}`} onClick={()=>setResource(r)}>{r}</button>
        ))}
        <button className="btn" onClick={()=>refetch()}>Refresh</button>
      </div>

      <div className="card">
        {resource === 'volunteer-requests' && (
          <div className="muted" style={{marginBottom:'12px'}}>
            Volunteer requests appear here automatically. Pending requests are refreshed every few seconds.
          </div>
        )}
        {isLoading && <div className="muted">Loading...</div>}
        {error && <div className="muted">Error: {String(error.message)}</div>}
        {actionMessage && <div className="muted">{actionMessage}</div>}
        {actionError && <div className="muted">{actionError}</div>}

        {!isLoading && !error && (
          rows.length === 0 ? (
            <div className="muted">No rows returned.</div>
          ) : (
            <div style={{overflow:'auto'}}>
              {resource === 'volunteer-requests' && (
                <div style={{marginBottom:'12px'}}>
                  <label style={{display:'block', marginBottom:'6px'}}>Decision message for teacher</label>
                  <textarea
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    rows="3"
                    placeholder="Optional message to send with the approval or decline"
                    style={{width:'100%', maxWidth:'480px', padding:'8px'}}
                  />
                </div>
              )}
              <table>
                <thead>
                  <tr>
                    {resource === 'schedules'
                      ? ['student_id', 'student_name', 'time', 'period', 'teacher', 'room', 'class_name'].map((col) => <th key={col}>{col}</th>)
                      : Object.keys(rows[0]).map(col => <th key={col}>{col}</th>)}
                    {resource === 'volunteer-requests' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {resource === 'schedules'
                        ? ['student_id', 'student_name', 'time', 'period', 'teacher', 'room', 'class_name'].map((col) => <td key={col}>{String(r[col] ?? '')}</td>)
                        : Object.keys(rows[0]).map(col => <td key={col}>{String(r[col] ?? '')}</td>)}
                      {resource === 'volunteer-requests' && (
                        <td>
                          {r.status === 'pending' ? (
                            <>
                              <button className="btn primary" disabled={actioningId === r.id} onClick={() => handleVolunteerDecision(r.id, 'approved')}>Approve</button>
                              <button className="btn" disabled={actioningId === r.id} onClick={() => handleVolunteerDecision(r.id, 'declined')}>Decline</button>
                            </>
                          ) : (
                            <span>{String(r.status ?? '')}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
