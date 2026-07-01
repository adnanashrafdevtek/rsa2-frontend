import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import backend from '../api/backendClient'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Users, GraduationCap, MapPin, Calendar, MessageSquare, BookOpen, Users2, Building2, CalendarCheck, Search } from 'lucide-react'

const RESOURCES = [
  { id: 'users', label: 'Users', icon: Users, fields: [
    { key: 'id', label: 'ID' },
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email_address', label: 'Email' },
    { key: 'role_id', label: 'Role ID' },
  ]},
  { id: 'roles', label: 'Roles', icon: Users2, fields: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
  ]},
  { id: 'classes', label: 'Classes', icon: BookOpen, fields: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'teacher_id', label: 'Teacher ID' },
    { key: 'room_id', label: 'Room ID' },
  ]},
  { id: 'rooms', label: 'Rooms', icon: MapPin, fields: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'event_id', label: 'Event ID' },
  ]},
  { id: 'messages', label: 'Messages', icon: MessageSquare, fields: [
    { key: 'id', label: 'ID' },
    { key: 'sender_id', label: 'Sender ID' },
    { key: 'receiver_id', label: 'Receiver ID' },
    { key: 'message', label: 'Message' },
  ]},
  { id: 'schedules', label: 'Schedules', icon: Calendar, fields: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'decription', label: 'Description' },
    { key: 'event_id', label: 'Event ID' },
  ]},
  { id: 'student_classes', label: 'Student Classes', icon: GraduationCap, fields: [
    { key: 'id', label: 'ID' },
    { key: 'grade_level', label: 'Grade Level' },
    { key: 'user_iduser', label: 'User ID' },
    { key: 'class_idclass', label: 'Class ID' },
  ]},
  { id: 'clubs', label: 'Clubs', icon: Building2, fields: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
  ]},
  { id: 'events', label: 'Events', icon: CalendarCheck, fields: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
  ]},
  { id: 'club_has_event', label: 'Club Events', icon: CalendarCheck, fields: [
    { key: 'club_id', label: 'Club ID' },
    { key: 'event_id', label: 'Event ID' },
  ]},
]

function ResourcePanel({ resource, resourceMeta }) {
  const [filters, setFilters] = useState({})
  const [draftValues, setDraftValues] = useState({})
  const [selectedRow, setSelectedRow] = useState(null)
  const [adminMode, setAdminMode] = useState(() => {
    if (typeof window === 'undefined') return 'Student'
    return window.localStorage.getItem('planner-role') || 'Student'
  })
  const [classForm, setClassForm] = useState({ name: '', teacher_id: '', room_id: '', grade_level: '' })
  const [roomForm, setRoomForm] = useState({ name: '', event_id: '', class_id: '', period: '' })
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [actionMessage, setActionMessage] = useState('')
  const [adminAction, setAdminAction] = useState(null)

  const { data, isLoading, error, refetch } = useQuery(
    ['backend', resource, filters],
    () => backend.list(resource, filters),
    { staleTime: 1000 * 30 }
  )

  const { data: teacherOptionsData } = useQuery(['backend', 'teachers'], () => backend.list('users', { role_id: 1 }), { staleTime: 1000 * 30 })
  const { data: studentOptionsData } = useQuery(['backend', 'students'], () => backend.list('users', { role_id: 3 }), { staleTime: 1000 * 30 })
  const { data: roomOptionsData } = useQuery(['backend', 'room-options'], () => backend.list('rooms'), { staleTime: 1000 * 30 })
  const { data: classOptionsData } = useQuery(['backend', 'class-options'], () => backend.list('classes'), { staleTime: 1000 * 30 })
  const { data: eventOptionsData } = useQuery(['backend', 'event-options'], () => backend.list('events'), { staleTime: 1000 * 30 })

  useEffect(() => {
    setFilters({})
    setDraftValues({})
    setSelectedRow(null)
    setActionMessage('')
    setSelectedStudentIds([])
    setAdminAction(null)
  }, [resource])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('planner-role', adminMode)
    }
  }, [adminMode])

  const rows = useMemo(() => {
    if (Array.isArray(data)) return data
    return (data && data.mysqlResult) || []
  }, [data])

  const teacherOptions = useMemo(() => {
    if (Array.isArray(teacherOptionsData)) return teacherOptionsData
    return (teacherOptionsData && teacherOptionsData.mysqlResult) || []
  }, [teacherOptionsData])

  const studentOptions = useMemo(() => {
    if (Array.isArray(studentOptionsData)) return studentOptionsData
    return (studentOptionsData && studentOptionsData.mysqlResult) || []
  }, [studentOptionsData])

  const roomOptions = useMemo(() => {
    if (Array.isArray(roomOptionsData)) return roomOptionsData
    return (roomOptionsData && roomOptionsData.mysqlResult) || []
  }, [roomOptionsData])

  const classOptions = useMemo(() => {
    if (Array.isArray(classOptionsData)) return classOptionsData
    return (classOptionsData && classOptionsData.mysqlResult) || []
  }, [classOptionsData])

  const eventOptions = useMemo(() => {
    if (Array.isArray(eventOptionsData)) return eventOptionsData
    return (eventOptionsData && eventOptionsData.mysqlResult) || []
  }, [eventOptionsData])

  const roomScheduleCards = useMemo(() => {
    if (!Array.isArray(rows)) return []

    if (resource === 'rooms') {
      return rows.map((row) => ({
        key: `room-${row.id}`,
        title: row.name,
        className: classOptions.find((entry) => entry.id === row.class_id)?.name || 'Unassigned',
        period: row.period || 'Not set'
      }))
    }

    if (resource === 'classes') {
      return rows.map((row) => ({
        key: `class-${row.id}`,
        title: row.name,
        className: row.name,
        period: roomOptions.find((entry) => entry.id === row.room_id)?.period || 'Not set'
      }))
    }

    return []
  }, [rows, resource, classOptions, roomOptions])

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextFilters = {}
    resourceMeta.fields.forEach((field) => {
      const value = draftValues[field.key]
      if (value !== undefined && value !== null && value !== '') {
        nextFilters[field.key] = value
      }
    })
    setFilters(nextFilters)
    setSelectedRow(null)
  }

  const clearFilters = () => {
    setDraftValues({})
    setFilters({})
    setSelectedRow(null)
  }

  const isAdmin = adminMode === 'Admin'

  const handleCreateClass = async (event) => {
    event.preventDefault()
    if (!isAdmin) {
      setActionMessage('Only admin users can create classes.')
      return
    }

    try {
      const payload = {
        name: classForm.name.trim(),
        teacher_id: Number(classForm.teacher_id),
        room_id: Number(classForm.room_id),
        student_ids: selectedStudentIds.map((value) => Number(value)).filter(Boolean),
        grade_level: classForm.grade_level.trim() || null
      }

      await backend.create('classes', payload)
      setActionMessage('Class created successfully.')
      setClassForm({ name: '', teacher_id: '', room_id: '', grade_level: '' })
      setSelectedStudentIds([])
      await refetch()
    } catch (submissionError) {
      setActionMessage(submissionError.message)
    }
  }

  const handleCreateRoom = async (event) => {
    event.preventDefault()
    if (!isAdmin) {
      setActionMessage('Only admin users can create rooms.')
      return
    }

    try {
      const payload = {
        name: roomForm.name.trim(),
        event_id: Number(roomForm.event_id),
        class_id: roomForm.class_id ? Number(roomForm.class_id) : null,
        period: roomForm.period.trim()
      }

      await backend.create('rooms', payload)
      setActionMessage('Room created successfully.')
      setRoomForm({ name: '', event_id: '', class_id: '', period: '' })
      await refetch()
    } catch (submissionError) {
      setActionMessage(submissionError.message)
    }
  }

  const handleStudentSelection = (event) => {
    const values = Array.from(event.target.selectedOptions, (option) => option.value)
    setSelectedStudentIds(values)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {resourceMeta.fields.map((field) => (
            <label key={field.key} className="space-y-1 text-sm text-slate-600">
              <span className="font-medium">{field.label}</span>
              <input
                value={draftValues[field.key] ?? ''}
                onChange={(event) => setDraftValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-teal-500"
                placeholder={field.label}
              />
            </label>
          ))}
          <div className="flex items-end gap-2">
            <button type="submit" className="flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
              <Search className="h-4 w-4" /> Search
            </button>
            <button type="button" onClick={clearFilters} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Clear
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">Admin management</h3>
              <p className="text-sm text-slate-500">Use admin mode to create classes, assign students, and add rooms for specific periods.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setAdminMode('Admin')} className={`rounded-lg px-3 py-2 text-sm font-medium ${isAdmin ? 'bg-teal-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                Admin mode
              </button>
              <button type="button" onClick={() => setAdminMode('Student')} className={`rounded-lg px-3 py-2 text-sm font-medium ${!isAdmin ? 'bg-slate-800 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                Student mode
              </button>
            </div>
          </div>

          {actionMessage && (
            <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
              {actionMessage}
            </div>
          )}

          {!isAdmin ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              Switch to admin mode to create classes and rooms.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setAdminAction('classes')} className={`rounded-lg px-3 py-2 text-sm font-medium ${adminAction === 'classes' ? 'bg-teal-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                  Create Classes
                </button>
                <button type="button" onClick={() => setAdminAction('rooms')} className={`rounded-lg px-3 py-2 text-sm font-medium ${adminAction === 'rooms' ? 'bg-teal-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                  Create Rooms
                </button>
              </div>

              {adminAction === 'classes' && (
                <form onSubmit={handleCreateClass} className="rounded-xl border border-slate-200 p-4">
                  <h4 className="font-semibold text-slate-900">Create class</h4>
                  <p className="mt-1 text-sm text-slate-500">Create a class and assign students to it in one step.</p>
                  <div className="mt-4 space-y-3">
                    <input value={classForm.name} onChange={(event) => setClassForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Class name" required />
                    <select value={classForm.teacher_id} onChange={(event) => setClassForm((prev) => ({ ...prev, teacher_id: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required>
                      <option value="">Select teacher</option>
                      {teacherOptions.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>{`${teacher.first_name} ${teacher.last_name}`}</option>
                      ))}
                    </select>
                    <select value={classForm.room_id} onChange={(event) => setClassForm((prev) => ({ ...prev, room_id: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required>
                      <option value="">Select room</option>
                      {roomOptions.map((room) => (
                        <option key={room.id} value={room.id}>{room.name}</option>
                      ))}
                    </select>
                    <select multiple value={selectedStudentIds} onChange={handleStudentSelection} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" size="4">
                      {studentOptions.map((student) => (
                        <option key={student.id} value={student.id}>{`${student.first_name} ${student.last_name}`}</option>
                      ))}
                    </select>
                    <input value={classForm.grade_level} onChange={(event) => setClassForm((prev) => ({ ...prev, grade_level: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Grade level" />
                  </div>
                  <button type="submit" className="mt-4 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">Create class</button>
                </form>
              )}

              {adminAction === 'rooms' && (
                <form onSubmit={handleCreateRoom} className="rounded-xl border border-slate-200 p-4">
                  <h4 className="font-semibold text-slate-900">Create room</h4>
                  <p className="mt-1 text-sm text-slate-500">Add a room and reserve it for a class at a specific period.</p>
                  <div className="mt-4 space-y-3">
                    <input value={roomForm.name} onChange={(event) => setRoomForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Room name" required />
                    <select value={roomForm.event_id} onChange={(event) => setRoomForm((prev) => ({ ...prev, event_id: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required>
                      <option value="">Select event</option>
                      {eventOptions.map((event) => (
                        <option key={event.id} value={event.id}>{event.name}</option>
                      ))}
                    </select>
                    <select value={roomForm.class_id} onChange={(event) => setRoomForm((prev) => ({ ...prev, class_id: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="">No class assigned</option>
                      {classOptions.map((classItem) => (
                        <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                      ))}
                    </select>
                    <input value={roomForm.period} onChange={(event) => setRoomForm((prev) => ({ ...prev, period: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Period / time" />
                  </div>
                  <button type="submit" className="mt-4 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">Create room</button>
                </form>
              )}
            </div>
          )}
        </div>

      {(resource === 'rooms' || resource === 'classes') && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Classroom timetable</h3>
              <p className="text-sm text-slate-500">A quick view of room allocations and periods.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {roomScheduleCards.length > 0 ? roomScheduleCards.map((item) => (
              <div key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="font-semibold text-slate-900">{item.title}</div>
                <div className="mt-1 text-sm text-slate-600">Class: {item.className}</div>
                <div className="text-sm text-slate-600">Period: {item.period}</div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">No timetable entries yet.</div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="font-semibold text-slate-900">{resourceMeta.label}</h3>
              <p className="text-sm text-slate-500">Browse records and filter by any supported field.</p>
            </div>
            <button onClick={() => refetch()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="p-6 text-slate-500">Loading...</div>
          ) : error ? (
            <div className="p-6 text-red-600">Error: {String(error.message)}</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No rows found for this resource.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-700">
                  <tr>
                    {Object.keys(rows[0]).map((col) => (
                      <th key={col} className="whitespace-nowrap px-3 py-3 font-medium">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={`${resource}-${index}`}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${selectedRow === row ? 'bg-teal-50/60' : 'bg-white'}`}
                      onClick={() => setSelectedRow(row)}
                    >
                      {Object.keys(rows[0]).map((col) => (
                        <td key={`${resource}-${col}-${index}`} className="max-w-xs whitespace-nowrap px-3 py-3 text-slate-600">
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm">
          <h3 className="text-lg font-semibold">Selected record</h3>
          <p className="mt-1 text-sm text-slate-300">Click a row to inspect its values.</p>

          {selectedRow ? (
            <div className="mt-4 space-y-3">
              {Object.entries(selectedRow).map(([key, value]) => (
                <div key={key} className="rounded-lg bg-white/10 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">{key}</div>
                  <div className="mt-1 break-words text-sm text-white">{String(value ?? '')}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">
              No record selected yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [activeResource, setActiveResource] = useState('users')
  const activeMeta = RESOURCES.find((resource) => resource.id === activeResource) || RESOURCES[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Backend Explorer</h1>
          <p className="mt-1 text-slate-500">Browse every backend table, filter by supported fields, and inspect individual rows.</p>
        </div>

        <Tabs value={activeResource} onValueChange={setActiveResource} className="space-y-6">
          <TabsList className="flex-wrap justify-start">
            {RESOURCES.map((resource) => {
              const Icon = resource.icon
              return (
                <TabsTrigger key={resource.id} value={resource.id} className="gap-2">
                  <Icon className="h-4 w-4" /> {resource.label}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {RESOURCES.map((resource) => (
            <TabsContent key={resource.id} value={resource.id}>
              <ResourcePanel resource={resource.id} resourceMeta={resource} />
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-sm text-teal-800">
          <strong>Tip:</strong> The filters map directly to the backend API fields, so you can query by ID or any other supported column in the selected table.
        </div>
      </div>
    </div>
  )
}
