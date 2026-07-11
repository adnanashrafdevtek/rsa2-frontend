import React, { useState, useMemo } from 'react'
import { CalendarDays, BookOpen, Users, ClipboardCheck, HelpCircle, Users2, Star, Bell, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import backend from '../api/backendClient'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import StatsCard from '../components/StatsCard'
import AttendancePlaceholder from '../components/AttendancePlaceholder'
import MyClassesPlaceholder from '../components/StudentsPlaceholder'
import HelpRequestPlaceholder from '../components/HelpRequestPlaceholder'
import VolunteersPlaceholder from '../components/VolunteersPlaceholder'
import ReviewsPlaceholder from '../components/ReviewsPlaceholder'
import AnnouncementsPlaceholder from '../components/AnnouncementsPlaceholder'

function getRows(payload) {
  if (Array.isArray(payload)) return payload
  return (payload && payload.mysqlResult) || []
}

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState('attendance')
  
  // Get current teacher ID from localStorage
  const teacherId = typeof window !== 'undefined' 
    ? window.localStorage.getItem('planner-current-user-id')
    : null
  
  const teacherName = typeof window !== 'undefined'
    ? window.localStorage.getItem('planner-current-user-name') || 'Teacher'
    : 'Teacher'
  
  const firstName = teacherName?.split(' ')[0] || 'Teacher'
  
  // Get current date
  const currentDate = new Date()
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Fetch classes where teacher_id = teacherId
  const { data: classesData, isLoading: classesLoading, error: classesError } = useQuery(
    ['teacher-classes', teacherId],
    () => teacherId ? backend.list('classes', { teacher_id: teacherId }) : Promise.resolve([]),
    { staleTime: 1000 * 30, enabled: !!teacherId }
  )

  // Fetch all student_classes to count students (with error fallback)
  const { data: studentClassesData, isLoading: studentClassesLoading, error: studentClassesError } = useQuery(
    ['all-student-classes'],
    () => backend.list('student_classes'),
    { staleTime: 1000 * 30, retry: false }
  )

  // Fetch all schedules
  const { data: schedulesData, isLoading: schedulesLoading } = useQuery(
    ['all-schedules'],
    () => backend.list('schedules'),
    { staleTime: 1000 * 30, retry: false }
  )

  // Fetch all events (announcements)
  const { data: eventsData, isLoading: eventsLoading, error: eventsError } = useQuery(
    ['all-events'],
    () => backend.list('events'),
    { staleTime: 1000 * 30, retry: false }
  )

  // Process data
  const classes = useMemo(() => getRows(classesData), [classesData])
  const studentClasses = useMemo(() => {
    // Return empty array if there's an error, otherwise get rows
    if (studentClassesError) return []
    return getRows(studentClassesData)
  }, [studentClassesData, studentClassesError])
  const schedules = useMemo(() => {
    // Return empty array if there's an error, otherwise get rows
    if (schedulesData?.error) return []
    return getRows(schedulesData)
  }, [schedulesData])
  const events = useMemo(() => {
    // Return empty array if there's an error, otherwise get rows
    if (eventsError) return []
    return getRows(eventsData)
  }, [eventsData, eventsError])

  // Calculate stats
  const classIds = useMemo(() => classes.map(c => c.id), [classes])
  
  const studentCount = useMemo(() => {
    if (!classIds.length || !studentClasses.length) return 0
    const uniqueStudents = new Set()
    studentClasses.forEach(sc => {
      if (classIds.includes(sc.class_idclass)) {
        uniqueStudents.add(sc.user_iduser)
      }
    })
    return uniqueStudents.size
  }, [classIds, studentClasses])

  const stats = {
    myClasses: classes.length,
    students: studentCount,
    todaysSchedule: schedules.length,
    announcements: events.length
  }

  const isLoading = classesLoading && !classes.length && !classesError

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Welcome, {firstName}</h1>
          <div className="mt-2 flex items-center gap-2 text-slate-500">
            <CalendarDays className="h-4 w-4" />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Error Message */}
        {(classesError || studentClassesError || eventsError) && (
          <div className="mb-8 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-900">Some data unavailable</p>
              <p className="text-sm text-amber-700">
                {classesError?.message || studentClassesError?.message || eventsError?.message || 'Database tables may not be initialized'}
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className={isLoading ? 'opacity-50 pointer-events-none' : ''}>
            <StatsCard 
              title="My Classes" 
              value={stats.myClasses} 
              icon={BookOpen} 
              color="bg-teal-500"
            />
          </div>
          <div className={isLoading ? 'opacity-50 pointer-events-none' : ''}>
            <StatsCard 
              title="Students" 
              value={stats.students} 
              icon={Users} 
              color="bg-blue-500"
            />
          </div>
          <div className={isLoading ? 'opacity-50 pointer-events-none' : ''}>
            <StatsCard 
              title="Today's Schedule" 
              value={stats.todaysSchedule} 
              icon={ClipboardCheck} 
              color="bg-purple-500"
            />
          </div>
          <div className={isLoading ? 'opacity-50 pointer-events-none' : ''}>
            <StatsCard 
              title="Announcements" 
              value={stats.announcements} 
              icon={Bell} 
              color="bg-amber-500"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="inline-block mb-4">
                <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
              </div>
              <p className="text-slate-600">Loading dashboard...</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        {!isLoading && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="flex flex-wrap justify-start gap-1 bg-white border border-slate-200 p-1 shadow-sm">
              <TabsTrigger value="attendance" className="gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Attendance
              </TabsTrigger>
              <TabsTrigger value="classes" className="gap-2">
                <BookOpen className="h-4 w-4" />
                My Classes
              </TabsTrigger>
              <TabsTrigger value="students" className="gap-2">
                <Users className="h-4 w-4" />
                Students
              </TabsTrigger>
              <TabsTrigger value="help" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                Request Help
              </TabsTrigger>
              <TabsTrigger value="volunteers" className="gap-2">
                <Users2 className="h-4 w-4" />
                Volunteers
              </TabsTrigger>
              <TabsTrigger value="reviews" className="gap-2">
                <Star className="h-4 w-4" />
                Reviews
              </TabsTrigger>
              <TabsTrigger value="announcements" className="gap-2">
                <Bell className="h-4 w-4" />
                Announcements
              </TabsTrigger>
            </TabsList>

            <TabsContent value="attendance">
              <AttendancePlaceholder />
            </TabsContent>

            <TabsContent value="classes">
              {classes.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {classes.map(cls => (
                    <div key={cls.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start gap-3">
                        <div className="w-1 h-12 bg-teal-500 rounded-sm" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-800">{cls.name}</h3>
                          <p className="text-sm text-slate-500 mt-1">Room {cls.room_id}</p>
                          {cls.grade_level && <p className="text-sm text-slate-500">Grade: {cls.grade_level}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <MyClassesPlaceholder />
              )}
            </TabsContent>

            <TabsContent value="students">
              <div className="rounded-lg border border-slate-200 bg-white p-8">
                <div className="flex flex-col items-center justify-center text-center">
                  <Users className="h-12 w-12 text-slate-300 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Students</h3>
                  <p className="text-slate-500">Total of {stats.students} student{stats.students !== 1 ? 's' : ''} across your classes</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="help">
              <HelpRequestPlaceholder />
            </TabsContent>

            <TabsContent value="volunteers">
              <VolunteersPlaceholder />
            </TabsContent>

            <TabsContent value="reviews">
              <ReviewsPlaceholder />
            </TabsContent>

            <TabsContent value="announcements">
              {events.length > 0 ? (
                <div className="space-y-3">
                  {events.map(event => (
                    <div key={event.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <h3 className="font-semibold text-slate-800">{event.name}</h3>
                      {event.description && <p className="text-sm text-slate-600 mt-1">{event.description}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <AnnouncementsPlaceholder />
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
