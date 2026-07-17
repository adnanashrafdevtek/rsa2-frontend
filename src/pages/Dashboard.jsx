import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import backend from '../api/backendClient'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Users, GraduationCap, MapPin, MessageSquare, BookOpen, Building2, CalendarCheck, Search, CalendarDays, Trash2, Plus, Pencil, Upload } from 'lucide-react'

function getRows(payload) {
  if (Array.isArray(payload)) return payload
  return (payload && payload.mysqlResult) || []
}

const RESOURCES = [
  { id: 'users', label: 'Users', icon: Users, fields: [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email_address', label: 'Email' },
    { key: 'role_id', label: 'Role' },
  ]},
  { id: 'classes', label: 'Classes', icon: BookOpen, fields: [
    { key: 'name', label: 'Class Name' },
    { key: 'teacher_id', label: 'Teacher Name' },
    { key: 'room_id', label: 'Room Name' },
    { key: 'grade_level', label: 'Grade Level' },
  ]},
  { id: 'rooms', label: 'Rooms', icon: MapPin, fields: [
    { key: 'name', label: 'Room' },
  ]},
  { id: 'messages', label: 'Messages', icon: MessageSquare, fields: [
    { key: 'sender_name', label: 'Sender Name' },
    { key: 'receiver_name', label: 'Receiver Name' },
    { key: 'message', label: 'Message' },
  ]},
  { id: 'schedules', label: 'Schedules', icon: CalendarDays, fields: [
    { key: 'student_id', label: 'Student ID' },
    { key: 'student_name', label: 'Student Name' },
    { key: 'time', label: 'Time' },
    { key: 'period', label: 'Period' },
    { key: 'teacher', label: 'Teacher' },
    { key: 'room', label: 'Room' },
    { key: 'class_name', label: 'Class Name' },
  ]},
  { id: 'clubs', label: 'Clubs', icon: Building2, fields: [
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
  ]},
  { id: 'events', label: 'Events', icon: CalendarCheck, fields: [
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'room', label: 'Room' },
    { key: 'date', label: 'Date' },
  ]},
]

function formatEventDateTime(value) {
  if (!value) return ''
  const normalized = String(value).replace(' ', 'T')
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return String(value)

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function normalizeEventDateTime(value) {
  if (!value) return ''
  const text = String(value).trim().replace('T', ' ')
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text)) {
    return `${text}:00`
  }
  return text
}

function ResourcePanel({ resource, resourceMeta }) {
  const [filters, setFilters] = useState({})
  const [draftValues, setDraftValues] = useState({})
  const [currentUserId, setCurrentUserId] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('planner-current-user-id') || ''
  })
  const [adminMode, setAdminMode] = useState(() => {
    if (typeof window === 'undefined') return 'Teacher'
    return window.localStorage.getItem('planner-role') || 'Teacher'
  })
  const [classForm, setClassForm] = useState({ name: '', teacher_id: '', room_id: '', grade_level: '' })
  const [roomForm, setRoomForm] = useState({ name: '', class_id: '', period: '' })
  const [editingClassId, setEditingClassId] = useState(null)
  const [showClassForm, setShowClassForm] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState(null)
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [actionMessage, setActionMessage] = useState('')
  const [eventForm, setEventForm] = useState({ name: '', description: '', room: '', date: '' })
  const [messageForm, setMessageForm] = useState({ receiver_id: '', message: '' })
  const [scheduleUploadMessage, setScheduleUploadMessage] = useState('')
  const [scheduleImportMessage, setScheduleImportMessage] = useState('')
  const [selectedTeacherScheduleId, setSelectedTeacherScheduleId] = useState('')
  const [selectedStudentScheduleId, setSelectedStudentScheduleId] = useState('')
  const [showEventForm, setShowEventForm] = useState(false)
  const [showMessageForm, setShowMessageForm] = useState(false)
  const [adminAction, setAdminAction] = useState(() => {
    if (typeof window === 'undefined') return 'classes'
    return window.localStorage.getItem('planner-admin-action') || 'classes'
  })

  const queryFilters = useMemo(() => {
    return filters
  }, [filters])

  const { data, isLoading, error, refetch } = useQuery(
    ['backend', resource, queryFilters],
    () => backend.list(resource, queryFilters),
    { staleTime: 1000 * 30 }
  )

  const { data: userOptionsData, refetch: refetchUsers } = useQuery(['backend', 'profile-users'], () => backend.list('users'), { staleTime: 1000 * 30 })
  const { data: roleOptionsData, refetch: refetchRoles } = useQuery(['backend', 'profile-roles'], () => backend.list('roles'), { staleTime: 1000 * 30 })
  const { data: teacherOptionsData } = useQuery(['backend', 'teachers'], () => backend.list('users', { role_id: 1 }), { staleTime: 1000 * 30 })
  const { data: studentOptionsData } = useQuery(['backend', 'students'], () => backend.list('users', { role_id: 3 }), { staleTime: 1000 * 30 })
  const { data: userSchedulesData, refetch: refetchSchedules } = useQuery(['backend', 'user-schedules'], () => backend.list('user_schedules'), { staleTime: 1000 * 30 })
  const { data: roomOptionsData } = useQuery(['backend', 'room-options'], () => backend.list('rooms'), { staleTime: 1000 * 30 })
  const { data: classOptionsData } = useQuery(['backend', 'class-options'], () => backend.list('classes'), { staleTime: 1000 * 30 })
  const { data: eventOptionsData } = useQuery(['backend', 'event-options'], () => backend.list('events'), { staleTime: 1000 * 30 })

  useEffect(() => {
    setFilters({})
    setDraftValues({})
    setActionMessage('')
    setSelectedStudentIds([])
    setEditingClassId(null)
    setShowClassForm(false)
    setEditingRoomId(null)
    setShowRoomForm(false)
    setScheduleImportMessage('')
    setSelectedTeacherScheduleId('')
    setSelectedStudentScheduleId('')
    setEventForm({ name: '', description: '', room: '', date: '' })
    setShowEventForm(false)
    setAdminAction(resource === 'classes' ? 'classes' : resource === 'rooms' ? 'rooms' : null)
  }, [resource])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('planner-role', adminMode)
      window.localStorage.setItem('planner-admin-action', adminAction)
      window.dispatchEvent(new Event('planner-admin-state-changed'))
    }
  }, [adminMode, adminAction])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncAdminState = () => {
      const storedMode = window.localStorage.getItem('planner-role') || 'Teacher'
      const storedAction = window.localStorage.getItem('planner-admin-action') || 'classes'
      setAdminMode(storedMode)
      setAdminAction(storedAction)
    }

    syncAdminState()
    window.addEventListener('planner-admin-state-changed', syncAdminState)
    return () => window.removeEventListener('planner-admin-state-changed', syncAdminState)
  }, [])

  const rows = useMemo(() => getRows(data), [data])
  const userOptions = useMemo(() => getRows(userOptionsData), [userOptionsData])
  const userSchedules = useMemo(() => getRows(userSchedulesData), [userSchedulesData])
  const visibleRows = useMemo(() => {
    if (resource === 'events') {
      const now = new Date()
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      return [...rows]
        .filter((row) => String(row?.date || '').slice(0, 7) === currentMonthKey)
        .sort((left, right) => {
          const leftDate = String(left?.date || '')
          const rightDate = String(right?.date || '')
          if (leftDate !== rightDate) {
            return rightDate.localeCompare(leftDate)
          }

          const leftId = Number(left?.id)
          const rightId = Number(right?.id)
          if (!Number.isNaN(leftId) && !Number.isNaN(rightId)) {
            return rightId - leftId
          }

          return String(right?.name || '').localeCompare(String(left?.name || ''))
        })
    }

    if (resource === 'messages') {
      const nameFilters = Object.entries(filters || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
      if (!nameFilters.length) return rows

      return rows.filter((row) => {
        const senderName = `${userOptions.find((user) => String(user.id) === String(row.sender_id))?.first_name || ''} ${userOptions.find((user) => String(user.id) === String(row.sender_id))?.last_name || ''}`.trim().toLowerCase()
        const receiverName = `${userOptions.find((user) => String(user.id) === String(row.receiver_id))?.first_name || ''} ${userOptions.find((user) => String(user.id) === String(row.receiver_id))?.last_name || ''}`.trim().toLowerCase()
        const messageText = String(row.message || '').toLowerCase()

        return nameFilters.every(([key, value]) => {
          const normalizedValue = String(value).trim().toLowerCase()
          if (!normalizedValue) return true
          if (key === 'sender_name') return senderName.includes(normalizedValue)
          if (key === 'receiver_name') return receiverName.includes(normalizedValue)
          if (key === 'message') return messageText.includes(normalizedValue)
          return true
        })
      })
    }

    return rows
  }, [resource, rows, filters, userOptions])
  const roleOptions = useMemo(() => getRows(roleOptionsData), [roleOptionsData])

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

  const scheduleLookup = useMemo(() => {
    return new Map(userSchedules.map((entry) => [`${entry.user_type}:${entry.user_id}`, entry]))
  }, [userSchedules])

  const currentUser = useMemo(() => {
    if (!userOptions.length) return null
    if (currentUserId) {
      const match = userOptions.find((user) => String(user.id) === String(currentUserId))
      if (match) return match
    }
    return userOptions[0]
  }, [currentUserId, userOptions])

  const currentUserRoleName = useMemo(() => {
    const roleMap = Object.fromEntries(roleOptions.map((role) => [String(role.id), role.name]))
    return currentUser ? roleMap[String(currentUser.role_id)] || currentUser.role_name || `Role ${currentUser.role_id}` : 'Unassigned'
  }, [currentUser, roleOptions])

  useEffect(() => {
    if (!userOptions.length) return

    if (typeof window === 'undefined') return

    const storedUserId = window.localStorage.getItem('planner-current-user-id')
    if (storedUserId && userOptions.some((user) => String(user.id) === storedUserId)) {
      setCurrentUserId(storedUserId)
      return
    }

    const fallbackUserId = String(userOptions[0].id)
    setCurrentUserId(fallbackUserId)
  }, [userOptions])

  useEffect(() => {
    if (!currentUser || typeof window === 'undefined') return

    window.localStorage.setItem('planner-current-user-id', String(currentUser.id))
    window.localStorage.setItem('planner-current-user-name', `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim())
    window.localStorage.setItem('planner-current-user-email', currentUser.email_address || '')
    window.localStorage.setItem('planner-current-user-role', currentUserRoleName)
  }, [currentUser, currentUserRoleName])

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

  const resetClassForm = () => {
    setClassForm({ name: '', teacher_id: '', room_id: '', grade_level: '' })
    setSelectedStudentIds([])
    setEditingClassId(null)
    setShowClassForm(false)
  }

  const openCreateClassForm = () => {
    setEditingClassId(null)
    setClassForm({ name: '', teacher_id: '', room_id: '', grade_level: '' })
    setSelectedStudentIds([])
    setShowClassForm(true)
    setAdminAction('classes')
  }

  const resetRoomForm = () => {
    setRoomForm({ name: '', class_id: '', period: '' })
    setEditingRoomId(null)
    setShowRoomForm(false)
  }

  const openCreateRoomForm = () => {
    setEditingRoomId(null)
    setRoomForm({ name: '', class_id: '', period: '' })
    setShowRoomForm(true)
    setAdminAction('rooms')
  }

  const handleCreateOrUpdateClass = async (event) => {
    event.preventDefault()
    if (!isAdmin) {
      setActionMessage('Only admin users can manage classes.')
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

      if (editingClassId) {
        await backend.update('classes', editingClassId, payload)
        setActionMessage('Class updated successfully.')
      } else {
        await backend.create('classes', payload)
        setActionMessage('Class created successfully.')
      }

      resetClassForm()
      await refetch()
    } catch (submissionError) {
      setActionMessage(submissionError.message)
    }
  }

  const handleCreateOrUpdateRoom = async (event) => {
    event.preventDefault()
    if (!isAdmin) {
      setActionMessage('Only admin users can manage rooms.')
      return
    }

    try {
      const payload = {
        name: roomForm.name.trim(),
        class_id: roomForm.class_id ? Number(roomForm.class_id) : null,
        period: roomForm.period.trim()
      }

      if (editingRoomId) {
        await backend.update('rooms', editingRoomId, payload)
        setActionMessage('Room updated successfully.')
      } else {
        await backend.create('rooms', payload)
        setActionMessage('Room created successfully.')
      }

      resetRoomForm()
      await refetch()
    } catch (submissionError) {
      setActionMessage(submissionError.message)
    }
  }

  const handleEditClass = (classItem) => {
    setEditingClassId(classItem.id)
    setClassForm({
      name: classItem.name || '',
      teacher_id: classItem.teacher_id || '',
      room_id: classItem.room_id || '',
      grade_level: classItem.grade_level || ''
    })
    setSelectedStudentIds([])
    setShowClassForm(true)
    setAdminAction('classes')
  }

  const handleDeleteClass = async (classId) => {
    if (!window.confirm('Delete this class?')) return
    try {
      await backend.remove('classes', classId)
      setActionMessage('Class deleted successfully.')
      if (selectedRow?.id === classId) setSelectedRow(null)
      await refetch()
    } catch (submissionError) {
      setActionMessage(submissionError.message)
    }
  }

  const handleEditRoom = (roomItem) => {
    setEditingRoomId(roomItem.id)
    setRoomForm({
      name: roomItem.name || '',
      class_id: roomItem.class_id || '',
      period: roomItem.period || ''
    })
    setShowRoomForm(true)
    setAdminAction('rooms')
  }

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Delete this room?')) return
    try {
      await backend.remove('rooms', roomId)
      setActionMessage('Room deleted successfully.')
      if (selectedRow?.id === roomId) setSelectedRow(null)
      await refetch()
    } catch (submissionError) {
      setActionMessage(submissionError.message)
    }
  }

  const handleCreateEvent = async (event) => {
    event.preventDefault()
    if (!isAdmin) {
      setActionMessage('Only admin users can create events.')
      return
    }

    try {
      await backend.create('events', {
        name: eventForm.name.trim(),
        description: eventForm.description.trim(),
        room: eventForm.room.trim(),
        date: normalizeEventDateTime(eventForm.date)
      })
      setActionMessage('Event created successfully.')
      setEventForm({ name: '', description: '', room: '', date: '' })
      setShowEventForm(false)
      await refetch()
    } catch (submissionError) {
      setActionMessage(submissionError.message)
    }
  }

  const handleCreateMessage = async (event) => {
    event.preventDefault()
    if (!isAdmin) {
      setActionMessage('Only admin users can create messages.')
      return
    }

    const loggedInUserId = typeof window !== 'undefined' ? window.localStorage.getItem('planner-current-user-id') : ''
    if (!loggedInUserId) {
      setActionMessage('No logged-in user is available to send the message.')
      return
    }

    try {
      await backend.create('messages', {
        sender_id: Number(loggedInUserId),
        receiver_id: Number(messageForm.receiver_id),
        message: messageForm.message.trim()
      })
      setActionMessage('Message created successfully.')
      setMessageForm({ receiver_id: '', message: '' })
      setShowMessageForm(false)
      await refetch()
    } catch (submissionError) {
      setActionMessage(submissionError.message)
    }
  }

  const handleScheduleUpload = async (event, userId, userType) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isAdmin) {
      setScheduleUploadMessage('Only admin users can upload schedules.')
      return
    }

    try {
      const content = await file.text()
      const result = await backend.create('user_schedules', {
        user_id: Number(userId),
        user_type: userType,
        file_name: file.name,
        file_content: content
      })
      const importedCount = Number(result?.importedCount || 0)
      const importedMessage = importedCount > 0 ? ` and saved ${importedCount} schedule row${importedCount === 1 ? '' : 's'}` : ''
      setScheduleUploadMessage(`Uploaded schedule for ${file.name}${importedMessage}.`)
      await refetchSchedules()
    } catch (submissionError) {
      setScheduleUploadMessage(submissionError.message)
    } finally {
      event.target.value = ''
    }
  }

  const handleScheduleSpreadsheetUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isAdmin) {
      setScheduleImportMessage('Only admin users can import schedules.')
      return
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      const result = await backend.uploadScheduleFile(base64, file.name)
      const messagePrefix = `Imported ${result.insertedCount || 0} schedule rows successfully.`
      const rowErrors = result.errors?.length
        ? ` ${result.errors.map((item) => `Row ${item.index}: ${item.message}`).join(' | ')}`
        : ''
      setScheduleImportMessage(`${messagePrefix}${rowErrors}`)
      await refetch()
    } catch (submissionError) {
      setScheduleImportMessage(submissionError.message)
    } finally {
      event.target.value = ''
    }
  }

  const handleStudentSelection = (event) => {
    const values = Array.from(event.target.selectedOptions, (option) => option.value)
    setSelectedStudentIds(values)
  }

  const handleAssignRole = async (roleId) => {
    if (!currentUserId) {
      setActionMessage('Select a user before assigning a role.')
      return
    }

    const targetUser = userOptions.find((user) => String(user.id) === String(currentUserId))
    const selectedRole = roleOptions.find((role) => String(role.id) === String(roleId))

    if (!selectedRole) {
      setActionMessage('Select a valid role.')
      return
    }

    try {
      await backend.update('users', currentUserId, { role_id: Number(roleId) }, { userRole: 'Admin' })
      setActionMessage(`Assigned ${selectedRole.name} role to ${targetUser ? `${targetUser.first_name} ${targetUser.last_name}` : 'the selected user'}.`)
      await Promise.all([refetchUsers(), refetchRoles(), refetch()])
    } catch (submissionError) {
      setActionMessage(submissionError.message)
    }
  }

  const handleChangeUserRole = async (user, roleId) => {
    const selectedRole = roleOptions.find((role) => String(role.id) === String(roleId))

    if (!selectedRole) {
      setActionMessage('Select a valid role.')
      return
    }

    try {
      await backend.update('users', user.id, { role_id: Number(roleId) }, { userRole: 'Admin' })
      setActionMessage(`Updated ${user.first_name || 'User'}'s role to ${selectedRole.name}.`)
      await Promise.all([refetchUsers(), refetchRoles(), refetch()])
    } catch (submissionError) {
      setActionMessage(submissionError.message)
    }
  }

  const handleDeleteUser = async (user) => {
    const label = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email_address || `User ${user.id}`
    if (!window.confirm(`Completely remove ${label} from the system?`)) return

    try {
      await backend.remove('users', user.id, { userRole: 'Admin' })
      setActionMessage(`Removed ${label} completely.`)
      await Promise.all([refetchUsers(), refetchRoles(), refetch()])
    } catch (submissionError) {
      setActionMessage(submissionError.message)
    }
  }

  return (
    <div className="space-y-6">
      {resource === 'events' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Events</h3>
              <p className="mt-1 text-sm text-slate-500">Create events for the current month and keep the schedule current.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowEventForm((prev) => !prev)}
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
              disabled={!isAdmin}
            >
              {showEventForm ? 'Cancel' : 'Add event'}
            </button>
          </div>

          {showEventForm && (
            <form onSubmit={handleCreateEvent} className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium">Name</span>
                  <input value={eventForm.name} onChange={(event) => setEventForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Event name" required />
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium">Room</span>
                  <input value={eventForm.room} onChange={(event) => setEventForm((prev) => ({ ...prev, room: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Room name" required />
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium">Date</span>
                  <input type="datetime-local" value={eventForm.date} onChange={(event) => setEventForm((prev) => ({ ...prev, date: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
                </label>
                <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
                  <span className="font-medium">Description</span>
                  <textarea value={eventForm.description} onChange={(event) => setEventForm((prev) => ({ ...prev, description: event.target.value }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Event description" required />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">Add event</button>
              </div>
            </form>
          )}

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Showing events for the current month from the Events table.
          </div>
        </div>
      )}

      {resource === 'messages' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Messages</h3>
              <p className="mt-1 text-sm text-slate-500">Create new messages and keep conversations organized for the admin team.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowMessageForm((prev) => !prev)}
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
              disabled={!isAdmin}
            >
              {showMessageForm ? 'Cancel' : 'Create message'}
            </button>
          </div>

          {showMessageForm && (
            <form onSubmit={handleCreateMessage} className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium">Receiver</span>
                  <select value={messageForm.receiver_id} onChange={(event) => setMessageForm((prev) => ({ ...prev, receiver_id: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required>
                    <option value="">Select receiver</option>
                    {userOptions.map((user) => (
                      <option key={user.id} value={user.id}>
                        {`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email_address || `User ${user.id}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
                  <span className="font-medium">Message</span>
                  <textarea value={messageForm.message} onChange={(event) => setMessageForm((prev) => ({ ...prev, message: event.target.value }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Write the message" required />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">Send message</button>
              </div>
            </form>
          )}
        </div>
      )}

      {resource === 'schedules' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Schedule management</h3>
              <p className="mt-1 text-sm text-slate-500">Import spreadsheet rows and review the full schedule table from one place.</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="font-semibold text-slate-900">Import schedule spreadsheet</h4>
                <p className="text-sm text-slate-500">Expected columns: student_id, student_name, time, period, teacher, room, class_name.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
                <Upload className="h-4 w-4" />
                Upload spreadsheet
                <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={handleScheduleSpreadsheetUpload} />
              </label>
            </div>
            {scheduleImportMessage && (
              <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
                {scheduleImportMessage}
              </div>
            )}
          </div>

          {scheduleUploadMessage && (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
              {scheduleUploadMessage}
            </div>
          )}

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900">Teachers</h4>
                  <p className="text-sm text-slate-500">Choose one teacher and upload a CSV for that schedule.</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">{teacherOptions.length}</span>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <label className="space-y-1 text-sm text-slate-600">
                    <span className="font-medium">Teacher name</span>
                    <select
                      value={selectedTeacherScheduleId}
                      onChange={(event) => setSelectedTeacherScheduleId(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select teacher</option>
                      {teacherOptions.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {`${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || `Teacher ${teacher.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <span>Upload CSV</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      disabled={!selectedTeacherScheduleId}
                      onChange={(event) => handleScheduleUpload(event, selectedTeacherScheduleId, 'teacher')}
                    />
                  </label>
                </div>
                {teacherOptions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">No teachers found.</div>
                ) : selectedTeacherScheduleId ? (() => {
                  const teacher = teacherOptions.find((entry) => String(entry.id) === String(selectedTeacherScheduleId))
                  const uploadedSchedule = scheduleLookup.get(`teacher:${selectedTeacherScheduleId}`)
                  return (
                    <div className="mt-3 text-sm text-slate-600">
                      <div className="font-medium text-slate-900">{`${teacher?.first_name || ''} ${teacher?.last_name || ''}`.trim() || teacher?.email_address || `Teacher ${selectedTeacherScheduleId}`}</div>
                      <div>{teacher?.email_address || 'No email available'}</div>
                      <div className="mt-1">{uploadedSchedule ? `Uploaded: ${uploadedSchedule.file_name}` : 'No schedule uploaded yet'}</div>
                    </div>
                  )
                })() : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">Select a teacher to view the uploaded schedule.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900">Students</h4>
                  <p className="text-sm text-slate-500">Choose one student and upload a CSV for that schedule.</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">{studentOptions.length}</span>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <label className="space-y-1 text-sm text-slate-600">
                    <span className="font-medium">Student name</span>
                    <select
                      value={selectedStudentScheduleId}
                      onChange={(event) => setSelectedStudentScheduleId(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select student</option>
                      {studentOptions.map((student) => (
                        <option key={student.id} value={student.id}>
                          {`${student.first_name || ''} ${student.last_name || ''}`.trim() || student.email_address || `Student ${student.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <span>Upload CSV</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      disabled={!selectedStudentScheduleId}
                      onChange={(event) => handleScheduleUpload(event, selectedStudentScheduleId, 'student')}
                    />
                  </label>
                </div>
                {studentOptions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">No students found.</div>
                ) : selectedStudentScheduleId ? (() => {
                  const student = studentOptions.find((entry) => String(entry.id) === String(selectedStudentScheduleId))
                  const uploadedSchedule = scheduleLookup.get(`student:${selectedStudentScheduleId}`)
                  return (
                    <div className="mt-3 text-sm text-slate-600">
                      <div className="font-medium text-slate-900">{`${student?.first_name || ''} ${student?.last_name || ''}`.trim() || student?.email_address || `Student ${selectedStudentScheduleId}`}</div>
                      <div>{student?.email_address || 'No email available'}</div>
                      <div className="mt-1">{uploadedSchedule ? `Uploaded: ${uploadedSchedule.file_name}` : 'No schedule uploaded yet'}</div>
                    </div>
                  )
                })() : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">Select a student to view the uploaded schedule.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {resourceMeta.fields.map((field) => (
            <label key={field.key} className="space-y-1 text-sm text-slate-600">
              <span className="font-medium">{field.label}</span>
              {resource === 'events' && field.key === 'date' ? (
                <input
                  type="datetime-local"
                  value={draftValues[field.key] ?? ''}
                  onChange={(event) => setDraftValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-teal-500"
                />
              ) : resource === 'users' && field.key === 'role_id' ? (
                <select
                  value={draftValues[field.key] ?? ''}
                  onChange={(event) => setDraftValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-teal-500"
                >
                  <option value="">Select role</option>
                  {roleOptions.map((role) => (
                    <option key={role.id} value={String(role.id)}>
                      {role.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={draftValues[field.key] ?? ''}
                  onChange={(event) => setDraftValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-teal-500"
                  placeholder={field.label}
                />
              )}
            </label>
          ))}
          <div className="flex items-end gap-2">
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
              <Search className="h-4 w-4" />
              Search
            </button>
            <button type="button" onClick={clearFilters} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Clear
            </button>
          </div>
        </form>
      </div>


      {resource === 'classes' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Classes</h3>
              <p className="mt-1 text-sm text-slate-500">Create, edit, and manage classes from this panel.</p>
            </div>
            <button type="button" onClick={openCreateClassForm} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700" disabled={!isAdmin}>
              <Plus className="h-4 w-4" />
              Create class
            </button>
          </div>

          {actionMessage && (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
              {actionMessage}
            </div>
          )}

          {showClassForm && (
            <form onSubmit={handleCreateOrUpdateClass} className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium">Class name</span>
                  <input value={classForm.name} onChange={(event) => setClassForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Algebra 1" required />
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium">Teacher</span>
                  <select value={classForm.teacher_id} onChange={(event) => setClassForm((prev) => ({ ...prev, teacher_id: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Select teacher</option>
                    {teacherOptions.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {`${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || `Teacher ${teacher.id}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium">Room</span>
                  <select value={classForm.room_id} onChange={(event) => setClassForm((prev) => ({ ...prev, room_id: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Select room</option>
                    {roomOptions.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name || `Room ${room.id}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-600 md:col-span-3">
                  <span className="font-medium">Grade level</span>
                  <input value={classForm.grade_level} onChange={(event) => setClassForm((prev) => ({ ...prev, grade_level: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. 10" />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
                  {editingClassId ? 'Save changes' : 'Create class'}
                </button>
                {editingClassId && (
                  <button type="button" onClick={resetClassForm} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleRows.length > 0 ? visibleRows.map((row) => {
              const teacherName = teacherOptions.find((entry) => String(entry.id) === String(row.teacher_id))?.first_name || teacherOptions.find((entry) => String(entry.id) === String(row.teacher_id))?.last_name
                ? `${teacherOptions.find((entry) => String(entry.id) === String(row.teacher_id))?.first_name || ''} ${teacherOptions.find((entry) => String(entry.id) === String(row.teacher_id))?.last_name || ''}`.trim()
                : row.teacher_id || '—'
              const roomName = roomOptions.find((entry) => String(entry.id) === String(row.room_id))?.name || row.room_id || '—'

              return (
                <div key={`class-${row.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{row.name || 'Untitled class'}</div>
                      <div className="mt-1 text-sm text-slate-600">Teacher: {teacherName}</div>
                      <div className="text-sm text-slate-600">Room: {roomName}</div>
                      <div className="text-sm text-slate-600">Grade: {row.grade_level || '—'}</div>
                    </div>
                  <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditClass(row)}
                        className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-50"
                        aria-label={`Edit ${row.name || 'class'}`}
                        disabled={!isAdmin}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(row.id)}
                        className="rounded-lg border border-red-200 p-2 text-red-600 transition hover:bg-red-50"
                        aria-label={`Delete ${row.name || 'class'}`}
                        disabled={!isAdmin}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            }) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 md:col-span-2 xl:col-span-3">No classes found.</div>
            )}
          </div>
        </div>
      )}

      {resource === 'rooms' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Rooms</h3>
              <p className="mt-1 text-sm text-slate-500">Add rooms, search by room name, and manage the room list.</p>
            </div>
            <button type="button" onClick={openCreateRoomForm} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700" disabled={!isAdmin}>
              <Plus className="h-4 w-4" />
              Add room
            </button>
          </div>

          {actionMessage && (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
              {actionMessage}
            </div>
          )}

          {showRoomForm && (
            <form onSubmit={handleCreateOrUpdateRoom} className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
                  <span className="font-medium">Room</span>
                  <input
                    value={roomForm.name}
                    onChange={(event) => setRoomForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. Room 101"
                    required
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium">Class</span>
                  <select
                    value={roomForm.class_id}
                    onChange={(event) => setRoomForm((prev) => ({ ...prev, class_id: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select class</option>
                    {classOptions.map((classItem) => (
                      <option key={classItem.id} value={classItem.id}>
                        {classItem.name || `Class ${classItem.id}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-600 md:col-span-3">
                  <span className="font-medium">Period</span>
                  <input
                    value={roomForm.period}
                    onChange={(event) => setRoomForm((prev) => ({ ...prev, period: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. Period 2"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
                  {editingRoomId ? 'Save changes' : 'Create room'}
                </button>
                {editingRoomId && (
                  <button type="button" onClick={resetRoomForm} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleRows.length > 0 ? visibleRows.map((row) => {
              const linkedClass = classOptions.find((entry) => String(entry.id) === String(row.class_id))
              return (
                <div key={`room-${row.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{row.name || 'Untitled room'}</div>
                      <div className="mt-1 text-sm text-slate-600">Class: {linkedClass?.name || row.class_id || '—'}</div>
                      <div className="text-sm text-slate-600">Period: {row.period || '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditRoom(row)}
                        className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-50"
                        aria-label={`Edit ${row.name || 'room'}`}
                        disabled={!isAdmin}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoom(row.id)}
                        className="rounded-lg border border-red-200 p-2 text-red-600 transition hover:bg-red-50"
                        aria-label={`Delete ${row.name || 'room'}`}
                        disabled={!isAdmin}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            }) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 md:col-span-2 xl:col-span-3">No rooms found.</div>
            )}
          </div>
        </div>
      )}

      {resource !== 'classes' && resource !== 'rooms' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
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
        ) : visibleRows.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No rows found for this resource.</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-700">
                <tr>
                  {resource === 'users' ? (
                    <>
                      <th className="whitespace-nowrap px-3 py-3 font-medium">First Name</th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium">Last Name</th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium">Email</th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium">Role</th>
                      <th className="whitespace-nowrap px-3 py-3 font-medium">Delete</th>
                    </>
                  ) : resource === 'events' ? (
                    <>
                      <th className="whitespace-nowrap px-3 py-3 font-medium">ID</th>
                      {resourceMeta.fields.map((field) => (
                        <th key={field.key} className="whitespace-nowrap px-3 py-3 font-medium">{field.label}</th>
                      ))}
                    </>
                  ) : resource === 'schedules' ? (
                    resourceMeta.fields.map((field) => (
                      <th key={field.key} className="whitespace-nowrap px-3 py-3 font-medium">{field.label}</th>
                    ))
                  ) : (
                    Object.keys(visibleRows[0]).filter((col) => col !== 'id').map((col) => (
                      <th key={col} className="whitespace-nowrap px-3 py-3 font-medium">{col === 'role_id' ? 'Role' : col === 'sender_id' ? 'Sender' : col === 'receiver_id' ? 'Receiver' : col}</th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr
                    key={`${resource}-${row.id ?? index}`}
                    className="border-t border-slate-100 bg-white hover:bg-slate-50"
                  >
                    {resource === 'users' ? (
                      <>
                        <td className="max-w-xs whitespace-nowrap px-3 py-3 text-slate-600">{row.first_name ?? ''}</td>
                        <td className="max-w-xs whitespace-nowrap px-3 py-3 text-slate-600">{row.last_name ?? ''}</td>
                        <td className="max-w-xs whitespace-nowrap px-3 py-3 text-slate-600">{row.email_address ?? ''}</td>
                        <td className="max-w-xs whitespace-nowrap px-3 py-3 text-slate-600">
                          <select
                            value={row.role_id ? String(row.role_id) : ''}
                            onChange={(event) => handleChangeUserRole(row, event.target.value)}
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-teal-500"
                          >
                            <option value="">Select role</option>
                            {roleOptions.map((role) => (
                              <option key={role.id} value={String(role.id)}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="max-w-xs whitespace-nowrap px-3 py-3 text-slate-600">
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(row)}
                            className="rounded-lg border border-red-200 p-2 text-red-600 transition hover:bg-red-50"
                            aria-label={`Delete ${row.first_name || 'user'}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </>
                    ) : resource === 'events' ? (
                      <>
                        <td className="max-w-xs whitespace-nowrap px-3 py-3 text-slate-600">{row.id ?? ''}</td>
                        {resourceMeta.fields.map((field) => (
                          <td key={`${resource}-${field.key}-${index}`} className="max-w-xs whitespace-nowrap px-3 py-3 text-slate-600">
                            {field.key === 'date' ? formatEventDateTime(row[field.key]) : String(row[field.key] ?? '')}
                          </td>
                        ))}
                      </>
                    ) : resource === 'schedules' ? (
                      resourceMeta.fields.map((field) => (
                        <td key={`${resource}-${field.key}-${index}`} className="max-w-xs whitespace-nowrap px-3 py-3 text-slate-600">
                          {String(row[field.key] ?? '')}
                        </td>
                      ))
                    ) : (
                      Object.keys(visibleRows[0]).filter((col) => col !== 'id').map((col) => {
                        if (resource === 'messages' && (col === 'sender_id' || col === 'receiver_id')) {
                          const user = userOptions.find((entry) => String(entry.id) === String(row[col]))
                          const label = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email_address || `User ${row[col]}`
                          return (
                            <td key={`${resource}-${col}-${index}`} className="max-w-xs whitespace-nowrap px-3 py-3 text-slate-600">
                              {label}
                            </td>
                          )
                        }

                        return (
                          <td key={`${resource}-${col}-${index}`} className="max-w-xs whitespace-nowrap px-3 py-3 text-slate-600">
                            {String(row[col] ?? '')}
                          </td>
                        )
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

export default function Dashboard({ initialResource = 'users' }) {
  const [activeResource, setActiveResource] = useState(initialResource)
  const activeMeta = RESOURCES.find((resource) => resource.id === activeResource) || RESOURCES[0]

  useEffect(() => {
    setActiveResource(initialResource)
  }, [initialResource])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Backend Explorer</h1>
          <p className="mt-1 text-slate-500">Browse every backend table, filter by supported fields, and inspect individual rows.</p>
        </div>

        <Tabs value={activeResource} onValueChange={setActiveResource} className="space-y-6">
          <TabsList className="justify-start">
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
