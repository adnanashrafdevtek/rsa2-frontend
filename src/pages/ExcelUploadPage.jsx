import React, { useState } from 'react'
import backend from '../api/backendClient'

export default function ExcelUploadPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedFile) {
      setError('Please choose an Excel file first.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      const result = await backend.uploadExcelFile(base64, selectedFile.name)
      setMessage(`Imported ${result.insertedCount || 0} users successfully.`)
      if (result.errors?.length) {
        setError(result.errors.map((item) => `Row ${item.index}: ${item.message}`).join(' | '))
      }
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Upload Excel Users</h1>
          <p className="text-slate-500 mt-1">Import users into the database from an Excel spreadsheet.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Excel or CSV file</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-teal-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-teal-700"
              />
            </div>

            <div className="text-sm text-slate-500">
              Expected columns: <span className="font-medium">first_name, last_name, email_address, and optionally role_name</span>. CSV and Excel files are both supported.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
            >
              {loading ? 'Uploading...' : 'Upload and Import'}
            </button>
          </form>

          {message ? <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
          {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        </div>
      </div>
    </div>
  )
}
