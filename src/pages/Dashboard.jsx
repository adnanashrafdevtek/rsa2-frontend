import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import backend from '../api/backendClient'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Users, GraduationCap, MapPin, MessageSquare, BookOpen, Building2, CalendarCheck, Search, CalendarDays, Trash2, Plus, Pencil, Upload, HeartHandshake, Bell } from 'lucide-react'
import AdminVolunteerPanel from '../components/AdminVolunteerPanel'
import ReviewsTab from '../components/ReviewsTab'
import ScheduleTable from '../components/ScheduleTable'

function getRows(payload) {
  if (Array.isArray(payload)) return payload
  return (payload && payload.mysqlResult) || []
}

const USER_ROLE_OPTIONS = ['Admin', 'Teacher', 'Student']

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
    { key: 'room', label: 'Room' },
    { key: 'period', label: 'Period' },
    { key: 'time', label: 'Time' },
    { key: 'grade_level', label: 'Grade Level' },
  ]},
  { id: 'announcements', label: 'Announcements', icon: Bell, fields: [
    { key: 'title', label: 'Title' },
    { key: 'content', label: 'Content' },
    { key: 'created_by', label: 'Created By' },
    { key: 'created_at', label: 'Time' },
  ]},
  { id: 'schedules', label: 'Schedules', icon: CalendarDays, fields: [
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
  { id: 'volunteers', label: 'Volunteers', icon: HeartHandshake, fields: [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email_address', label: 'Email' },
    { key: 'status', label: 'Status' },
  ]},
  { id: 'reviews', label: 'Reviews', icon: MessageSquare, fields: [
    { key: 'user_id', label: 'User ID' },
    { key: 'rating', label: 'Rating' },
    { key: 'comment', label: 'Comment' },
    { key: 'created_at', label: 'Created At' },
  ]},
]

const CLASS_DAY_OPTIONS = ['A-day', 'B-day']
const CLASS_TIME_OPTIONS = ['7:50-8:10', '8:15-8:55', '8:55-9:40', '9:40-10:25', '10:25-11:15', '11:15-11:55', '11:55-12:15', '12:15-1:00', '1:00-2:00', '2:00-2:10', '2:10-2:50', '2:50-3:25']

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

function formatUserName(user) {
  if (!user) return ''
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email_address || `User ${user.id}`
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
  const [classForm, setClassForm] = useState({ name: '', teacher_id: '', room: '', period: '', time: '', grade_level: '' })
  const [editingClassId, setEditingClassId] = useState(null)
  const [showClassForm, setShowClassForm] = useState(false)
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [actionMessage, setActionMessage] = useState('')
  const [eventForm, setEventForm] = useState({ name: '', description: '', room: '', date: '' })
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '' })
  const [announcementRecipientIds, setAnnouncementRecipientIds] = useState([])
  const [selectAllTeachers, setSelectAllTeachers] = useState(false)
  const [scheduleUploadMessage, setScheduleUploadMessage] = useState('')
  const [scheduleImportMessage, setScheduleImportMessage] = useState('')
  const [selectedStudentScheduleId, setSelectedStudentScheduleId] = useState('')
  const [showEventForm, setShowEventForm] = useState(false)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
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
  const { data: classOptionsData } = useQuery(['backend', 'class-options'], () => backend.list('classes'), { staleTime: 1000 * 30 })
  const { data: eventOptionsData } = useQuery(['backend', 'event-options'], () => backend.list('events'), { staleTime: 1000 * 30 })

  useEffect(() => {
    setFilters({})
    setDraftValues({})
    setActionMessage('')
    setSelectedStudentIds([])
    setEditingClassId(null)
    setShowClassForm(false)
    setScheduleImportMessage('')
    setSelectedStudentScheduleId('')
    setAnnouncementForm({ title: '', content: '' })
    setAnnouncementRecipientIds([])
    setSelectAllTeachers(false)
    setEventForm({ name: '', description: '', room: '', date: '' })
    setShowEventForm(false)
    setAdminAction(resource === 'classes' ? 'classes' : null)
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
      setAdminAction(storedAction === 'classes' ? 'classes' : null)
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

    return rows
  }, [resource, rows, filters, userOptions])
  const roleOptions = useMemo(() => getRows(roleOptionsData), [roleOptionsData])
  const roleNameById = useMemo(() => Object.fromEntries(roleOptions.map((role) => [String(role.id), String(role.name || '').trim()])), [roleOptions])

  const teacherOptions = useMemo(() => {
    if (Array.isArray(teacherOptionsData)) return teacherOptionsData
    return (teacherOptionsData && teacherOptionsData.mysqlResult) || []
  }, [teacherOptionsData])

  const studentOptions = useMemo(() => {
    if (Array.isArray(studentOptionsData)) return studentOptionsData
    return (studentOptionsData && studentOptionsData.mysqlResult) || []
  }, [studentOptionsData])

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
    return currentUser ? roleNameById[String(currentUser.role_id)] || currentUser.role_name || `Role ${currentUser.role_id}` : 'Unassigned'
  }, [currentUser, roleNameById])

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
    setClassForm({ name: '', teacher_id: '', room: '', period: '', time: '', grade_level: '' })
    setSelectedStudentIds([])
    setEditingClassId(null)
    setShowClassForm(false)
  }

  const openCreateClassForm = () => {
    setEditingClassId(null)
    setClassForm({ name: '', teacher_id: '', room: '', period: '', time: '', grade_level: '' })
    setSelectedStudentIds([])
    setShowClassForm(true)
    setAdminAction('classes')
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
        room: classForm.room.trim(),
        period: classForm.period.trim(),
        time: classForm.time.trim(),
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

  const handleEditClass = (classItem) => {
    setEditingClassId(classItem.id)
    setClassForm({
      name: classItem.name || '',
      teacher_id: classItem.teacher_id || '',
      room: classItem.room || '',
      period: classItem.period || '',
      time: classItem.time || '',
      grade_level: classItem.grade_level || ''
    })
    setSelectedStudentIds([])
    setShowClassForm(true)
    setAdminAction('classes')
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

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault()
    if (!isAdmin) {
      setActionMessage('Only admin users can create announcements.')
      return
    }

    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      setActionMessage('Title and content are required.')
      return
    }

    if (!selectAllTeachers && announcementRecipientIds.length === 0) {
      setActionMessage('Select at least one teacher or choose Select all teachers.')
      return
    }

    try {
      await backend.create('announcements', {
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        created_by: Number(currentUserId || 1),
        target_all: selectAllTeachers ? 1 : 0,
        teacher_ids: selectAllTeachers ? [] : announcementRecipientIds.map((id) => Number(id))
      })
      setActionMessage('Announcement created successfully.')
      setAnnouncementForm({ title: '', content: '' })
      setAnnouncementRecipientIds([])
      setSelectAllTeachers(false)
      setShowAnnouncementForm(false)
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

  const handleChangeUserRole = async (user, nextRoleName) => {
    if (!nextRoleName) return

    if (!isAdmin) {
      setActionMessage('Only admin users can change roles.')
      return
    }

    try {
      await backend.update('users', user.id, { role_name: nextRoleName }, { userRole: 'Admin' })
      setActionMessage(`Updated ${formatUserName(user)} to ${nextRoleName}.`)
      await Promise.all([refetchUsers(), refetchRoles(), refetch()])
    } catch (submissionError) {
      setActionMessage(submissionError.message)
    }
  }

  const getUserRoleLabel = (user) => {
    const rawRoleName = roleNameById[String(user.role_id)] || String(user.role_name || '').trim()
    const matchedRole = USER_ROLE_OPTIONS.find((option) => option.toLowerCase() === rawRoleName.toLowerCase())
    return matchedRole || rawRoleName || 'Unassigned'
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

  // Volunteers gets its own dedicated UI for admin management.
  if (resource === 'volunteers') {
    return <AdminVolunteerPanel />
  }
  if (resource === 'reviews') {
    return <ReviewsTab />
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

      {resource === 'announcements' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Announcements</h3>
              <p className="mt-1 text-sm text-slate-500">Send announcements to selected teachers or to all teachers.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAnnouncementForm((prev) => !prev)}
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
              disabled={!isAdmin}
            >
              {showAnnouncementForm ? 'Cancel' : 'Create announcement'}
            </button>
          </div>

          {showAnnouncementForm && (
            <form onSubmit={handleCreateAnnouncement} className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium">Title</span>
                  <input value={announcementForm.title} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, title: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Announcement title" required />
                </label>
                <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
                  <span className="font-medium">Content</span>
                  <textarea value={announcementForm.content} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, content: event.target.value }))} className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Write the announcement" required />
                </label>
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-medium text-slate-700">Recipients</span>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectAllTeachers}
                        onChange={(event) => {
                          const checked = event.target.checked
                          setSelectAllTeachers(checked)
                          setAnnouncementRecipientIds(checked ? teacherOptions.map((teacher) => String(teacher.id)) : [])
                        }}
                      />
                      Select all teachers
                    </label>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {teacherOptions.map((teacher) => {
                      const teacherId = String(teacher.id)
                      const teacherName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email_address || `Teacher ${teacher.id}`
                      const checked = selectAllTeachers || announcementRecipientIds.includes(teacherId)

                      return (
                        <label key={teacher.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const isChecked = event.target.checked
                              setAnnouncementRecipientIds((prev) => {
                                const next = new Set(prev)
                                if (isChecked) {
                                  next.add(teacherId)
                                } else {
                                  next.delete(teacherId)
                                }
                                const nextList = Array.from(next)
                                setSelectAllTeachers(teacherOptions.length > 0 && nextList.length === teacherOptions.length)
                                return nextList
                              })
                            }}
                            disabled={selectAllTeachers}
                          />
                          <span>{teacherName}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">Send announcement</button>
              </div>
            </form>
          )}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Announcements are stored for teacher delivery and shown on the teacher dashboard.
          </div>
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

          <div className="mt-6 grid gap-6">
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
                  <input value={classForm.room} onChange={(event) => setClassForm((prev) => ({ ...prev, room: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Room 101" required />
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium">A-day/B-day</span>
                  <select value={classForm.period} onChange={(event) => setClassForm((prev) => ({ ...prev, period: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required>
                    <option value="">Select day</option>
                    {CLASS_DAY_OPTIONS.map((dayOption) => (
                      <option key={dayOption} value={dayOption}>{dayOption}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span className="font-medium">Time</span>
                  <select value={classForm.time} onChange={(event) => setClassForm((prev) => ({ ...prev, time: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required>
                    <option value="">Select time</option>
                    {CLASS_TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-600 md:col-span-2 xl:col-span-3">
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
              const roomName = row.room || '—'
              const periodName = row.period || '—'
              const timeName = row.time || '—'

              return (
                <div key={`class-${row.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{row.name || 'Untitled class'}</div>
                      <div className="mt-1 text-sm text-slate-600">Teacher: {teacherName}</div>
                      <div className="text-sm text-slate-600">Room: {roomName}</div>
                      <div className="text-sm text-slate-600">Period: {periodName}</div>
                      <div className="text-sm text-slate-600">Time: {timeName}</div>
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

      {resource !== 'classes' && (
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
          <ScheduleTable
            columns={resourceMeta.fields}
            rows={visibleRows}
            emptyMessage="No rows found for this resource."
            renderCell={resource === 'users' ? (row, column) => {
              if (column.key !== 'role_id') {
                return null
              }

              const currentRoleName = getUserRoleLabel(row)

              return (
                <select
                  value={USER_ROLE_OPTIONS.includes(currentRoleName) ? currentRoleName : ''}
                  onChange={(event) => handleChangeUserRole(row, event.target.value)}
                  className="min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-0 focus:border-teal-500"
                  disabled={!isAdmin}
                >
                  <option value="">Select role</option>
                  {USER_ROLE_OPTIONS.map((roleName) => (
                    <option key={roleName} value={roleName}>
                      {roleName}
                    </option>
                  ))}
                </select>
              )
            } : undefined}
          />
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