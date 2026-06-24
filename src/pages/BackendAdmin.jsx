import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import backend from '../api/backendClient'

const RESOURCES = ['roles','user','class','rooms','messages','schedules','student_classes','clubs','events','club_has_event']

function useList(res) {
  return useQuery(['backend', res], () => backend.list(res), { staleTime: 1000 * 30 })
}

export default function BackendAdmin(){
  const [resource, setResource] = useState(RESOURCES[0])
  const { data, isLoading, error, refetch } = useList(resource)
  const rows = Array.isArray(data) ? data : (data && data.mysqlResult) || []

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
        {isLoading && <div className="muted">Loading...</div>}
        {error && <div className="muted">Error: {String(error.message)}</div>}

        {!isLoading && !error && (
          rows.length === 0 ? (
            <div className="muted">No rows returned.</div>
          ) : (
            <div style={{overflow:'auto'}}>
              <table>
                <thead>
                  <tr>
                    {Object.keys(rows[0]).map(col => <th key={col}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {Object.keys(rows[0]).map(col => <td key={col}>{String(r[col] ?? '')}</td>)}
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
