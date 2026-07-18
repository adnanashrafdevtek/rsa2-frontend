import React, { useState, useMemo } from 'react'
import { CalendarDays, BookOpen, Users, ClipboardCheck, HelpCircle, Users2, Star, Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import backend from '../api/backendClient'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import StatsCard from '../components/StatsCard'

// Components
import AttendanceTab from '../components/AttendanceTab'
import MyClassesTab from '../components/MyClassesTab'
import StudentsTab from '../components/StudentsTab'
import RequestHelpTab from '../components/RequestHelpTab'
import VolunteersTab from '../components/VolunteersTab'
import ReviewsTab from '../components/ReviewsTab'
import AnnouncementsTab from '../components/AnnouncementsTab'

// Placeholders
import MyClassesPlaceholder from '../components/StudentsPlaceholder'
import VolunteersPlaceholder from '../components/VolunteersPlaceholder'
import ReviewsPlaceholder from '../components/ReviewsPlaceholder'
import AnnouncementsPlaceholder from '../components/AnnouncementsPlaceholder'

function getRows(payload) {
  if (Array.isArray(payload)) return payload
  return (payload && payload.mysqlResult) || []
}

export default function TeacherDashboard() {
  // Access Guard: Only allow role_id '1' (Teacher)
 

  const [activeTab, setActiveTab] = useState('attendance')
  
  const teacherId = typeof window !== 'undefined' ? window.localStorage.getItem('planner-current-user-id') : null
  const teacherName = typeof window !== 'undefined' ? window.localStorage.getItem('planner-current-user-name') || 'Teacher' : 'Teacher'
  const firstName = teacherName?.split(' ')[0] || 'Teacher'
  
  const currentDate = new Date()
  const formattedDate = currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // Data Fetching
  const { data: classesData, isLoading: classesLoading, error: classesError } = useQuery(['teacher-classes', teacherId], () => teacherId ? backend.list('classes', { teacher_id: teacherId }) : Promise.resolve([]), { staleTime: 1000 * 30, enabled: !!teacherId })
  const { data: studentClassesData, error: studentClassesError } = useQuery(['all-student-classes'], () => backend.list('student_classes'), { staleTime: 1000 * 30 })
  const { data: schedulesData } = useQuery(['all-schedules'], () => backend.list('schedules'), { staleTime: 1000 * 30 })
  const { data: eventsData, error: eventsError } = useQuery(['all-events'], () => backend.list('events'), { staleTime: 1000 * 30 })

  // Processing
  const classes = useMemo(() => getRows(classesData), [classesData])
  const studentClasses = useMemo(() => studentClassesError ? [] : getRows(studentClassesData), [studentClassesData, studentClassesError])
  const schedules = useMemo(() => getRows(schedulesData), [schedulesData])
  const events = useMemo(() => eventsError ? [] : getRows(eventsData), [eventsData, eventsError])

  const classIds = useMemo(() => classes.map(c => c.id), [classes])
  const studentCount = useMemo(() => {
    if (!classIds.length || !studentClasses.length) return 0
    const uniqueStudents = new Set()
    studentClasses.forEach(sc => { if (classIds.includes(sc.class_idclass)) uniqueStudents.add(sc.user_iduser) })
    return uniqueStudents.size
  }, [classIds, studentClasses])

  const isLoading = classesLoading && !classes.length && !classesError

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Welcome, {firstName}</h1>
          <div className="mt-2 flex items-center gap-2 text-slate-500"><CalendarDays className="h-4 w-4" /><span>{formattedDate}</span></div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard title="My Classes" value={classes.length} icon={BookOpen} color="bg-teal-500" />
          <StatsCard title="Students" value={studentCount} icon={Users} color="bg-blue-500" />
          <StatsCard title="Today's Schedule" value={schedules.length} icon={ClipboardCheck} color="bg-purple-500" />
          <StatsCard title="Announcements" value={events.length} icon={Bell} color="bg-amber-500" />
        </div>

        {!isLoading && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="flex flex-wrap justify-start gap-1 bg-white border border-slate-200 p-1 shadow-sm">
              <TabsTrigger value="attendance" className="gap-2"><ClipboardCheck className="h-4 w-4" />Attendance</TabsTrigger>
              <TabsTrigger value="classes" className="gap-2"><BookOpen className="h-4 w-4" />My Classes</TabsTrigger>
              <TabsTrigger value="students" className="gap-2"><Users className="h-4 w-4" />Students</TabsTrigger>
              <TabsTrigger value="help" className="gap-2"><HelpCircle className="h-4 w-4" />Request Help</TabsTrigger>
              <TabsTrigger value="volunteers" className="gap-2"><Users2 className="h-4 w-4" />Volunteers</TabsTrigger>
              <TabsTrigger value="reviews" className="gap-2"><Star className="h-4 w-4" />Reviews</TabsTrigger>
              <TabsTrigger value="announcements" className="gap-2"><Bell className="h-4 w-4" />Announcements</TabsTrigger>
            </TabsList>

            <TabsContent value="attendance"><AttendanceTab classes={classes} teacherId={teacherId} /></TabsContent>
            <TabsContent value="classes">
              {classes.length > 0 ? <MyClassesTab classes={classes} studentClasses={studentClasses} /> : <MyClassesPlaceholder />}
            </TabsContent>
            <TabsContent value="students">
                <StudentsTab />
            </TabsContent>
            <TabsContent value="help"><RequestHelpTab teacherId={teacherId} /></TabsContent>
            <TabsContent value="volunteers"><VolunteersTab /></TabsContent>
            <TabsContent value="reviews"><ReviewsTab /></TabsContent>
            <TabsContent value="announcements"><AnnouncementsTab announcements={events} /></TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}