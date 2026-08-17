import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import backend from '../api/backendClient'

const RESOURCES = ['roles','user','class','rooms','messages','schedules','clubs','events','club_has_event']

function useList(res) {
  return useQuery(['backend', res], () => backend.list(res), { staleTime: 1000 * 30 })
}

export default function BackendAdmin(){
  const [resource, setResource] = useState('roles')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  
  const { data, isLoading, error, refetch } = useList(resource)
  const rows = Array.isArray(data) ? data : (data && data.mysqlResult) || []

  useEffect(() => {
    if (resource !== 'messages') return undefined
    const interval = window.setInterval(() => {
      refetch()
    }, 5000)
    return () => window.clearInterval(interval)
  }, [resource, refetch])

  return (
    <div className="container">
      <h1>RSA Management</h1>
      <div className="toolbar">
        {RESOURCES.map(r => (
          <button key={r} className={`btn ${r===resource ? 'primary':''}`} onClick={()=>setResource(r)}>
            {r}
          </button>
        ))}
        <button className="btn" onClick={()=>refetch()}>Refresh</button>
      </div>

      <div className="card">
        <>
          {isLoading && <div className="muted">Loading...</div>}
          {error && <div className="muted">Error: {String(error.message)}</div>}
          {actionMessage && <div className="muted">{actionMessage}</div>}
          {actionError && <div className="muted">{actionError}</div>}

          {!isLoading && !error && (
            rows.length === 0 ? (
              <div className="muted">No rows returned.</div>
            ) : (
              <div style={{overflow:'auto'}}>
                <table>
                  <thead>
                    <tr>
                      {resource === 'schedules'
                        ? ['student_id', 'student_name', 'time', 'period', 'teacher', 'room', 'class_name'].map((col) => <th key={col}>{col}</th>)
                        : Object.keys(rows[0] || {}).map(col => <th key={col}>{col}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        {resource === 'schedules'
                          ? ['student_id', 'student_name', 'time', 'period', 'teacher', 'room', 'class_name'].map((col) => <td key={col}>{String(r[col] ?? '')}</td>)
                          : Object.keys(rows[0] || {}).map(col => <td key={col}>{String(r[col] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      </div>
    </div>
  )
}