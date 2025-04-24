"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Book,
  Calendar,
  CheckSquare,
  Cog,
  File,
  LayoutDashboard,
  Users,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { storage } from "@/lib/storage"
import { User, Class } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"

export default function StudentAssignments() {
  const router = useRouter()
  const { user: authUser, role: authRole } = useAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [studentClasses, setStudentClasses] = useState<Class[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        
        // Try to get user from multiple sources
        const sessionUser = sessionManager.getCurrentUser()
        
        // Try local storage as a fallback
        let authData = null
        try {
          const storedAuth = localStorage.getItem('authUser')
          if (storedAuth) {
            authData = JSON.parse(storedAuth)
          }
        } catch (e) {
          console.error('Error reading auth from localStorage:', e)
        }
        
        // Get user ID from available sources
        const userId = authUser?.uid || sessionUser?.user?.uid || authData?.uid
        
        if (!userId) {
          console.error("No user ID found")
          setAuthError("You need to log in to access this page")
          return
        }
        
        // Get user data
        let userData = null
        
        // Try storage first
        try {
          userData = storage.getUserById(userId)
        } catch (storageErr) {
          console.error("Error getting user from storage:", storageErr)
        }
        
        // If no user data, try using auth data directly
        if (!userData && authUser) {
          userData = {
            id: authUser.uid,
            name: authUser.displayName || "Student",
            email: authUser.email,
            role: authRole || "student"
          }
        }
        
        // Last attempt using local storage data
        if (!userData && authData) {
          userData = {
            id: authData.uid,
            email: authData.email,
            role: authData.role,
            name: "Student"
          }
        }
        
        if (!userData) {
          console.error("No user data found")
          setAuthError("Unable to retrieve your user information")
          setLoading(false)
          return
        }
        
        setCurrentUser(userData)
        
        // Check if the current user is a student
        if (userData.role !== "student") {
          console.error("User is not a student")
          setAuthError("This page is only available to student accounts")
          setLoading(false)
          return
        }
        
        // Load all classes
        const allClasses = await storage.getClasses()
        console.log("Loaded classes:", allClasses?.length || 0)
        
        // Additional null check and validation for classes
        if (!allClasses || !Array.isArray(allClasses)) {
          console.error("No classes found or invalid classes data")
          setStudentClasses([])
          setAssignments([])
          setLoading(false)
          return
        }
        
        // Filter classes to only include those the student is enrolled in
        const enrolledClasses = allClasses.filter((cls: Class) => 
          cls && cls.enrolledStudents && Array.isArray(cls.enrolledStudents) && 
          cls.enrolledStudents.includes(userData.id)
        )
        console.log("Enrolled classes found:", enrolledClasses.length)
        
        setStudentClasses(enrolledClasses)
        
        // Find all assignments for the enrolled classes
        let allAssignments = []
        
        for (const cls of enrolledClasses) {
          if (!cls || !cls.id) continue;
          
          console.log(`Loading assignments for class: ${cls.name} (${cls.id})`)
          
          try {
            // 1. First try to load curriculum directly using dedicated API
            const curriculum = await storage.getCurriculum(cls.id)
            console.log(`Curriculum loaded for class ${cls.id}:`, curriculum ? "Success" : "Not found")
            
            // 2. If API-loaded curriculum is not available, try class.curriculum
            const curriculumData = curriculum || (cls.curriculum || null)
            
            if (curriculumData && curriculumData.lessons && Array.isArray(curriculumData.lessons)) {
              // Find all published assignments across lessons
              const classAssignments = curriculumData.lessons.flatMap(lesson => {
                if (!lesson || !lesson.contents || !Array.isArray(lesson.contents)) return []
                
                return lesson.contents
                  .filter(content => 
                    content && content.isPublished === true && 
                    (content.type === 'assignment' || content.type === 'quiz')
                  )
                  .map(content => ({
                    ...content,
                    lessonTitle: lesson.title || 'Unnamed Lesson',
                    lessonId: lesson.id,
                    classId: cls.id,
                    className: cls.name || 'Unnamed Class',
                    teacher: cls.teacher || 'Unnamed Teacher'
                  }))
              })
              
              console.log(`Found ${classAssignments.length} published assignments in class ${cls.name}`)
              allAssignments.push(...classAssignments)
            } else {
              console.log(`No curriculum or lessons found for class ${cls.name}`)
            }
            
            // 3. Last resort: Check in localStorage for published curriculum specifically
            if (typeof window !== "undefined") {
              try {
                const publishedCurriculumKey = `published-curriculum-${cls.id}`
                const publishedData = localStorage.getItem(publishedCurriculumKey)
                
                if (publishedData) {
                  console.log(`Found published curriculum data in localStorage for class ${cls.id}`)
                  const publishedCurriculum = JSON.parse(publishedData)
                  
                  // Extract assignments from the published curriculum object
                  if (publishedCurriculum && typeof publishedCurriculum === 'object') {
                    Object.entries(publishedCurriculum).forEach(([lessonIndex, lessonContents]) => {
                      if (lessonContents && typeof lessonContents === 'object') {
                        Object.values(lessonContents).forEach((content: any) => {
                          if (content && content.isPublished && 
                              (content.type === 'assignment' || content.type === 'quiz')) {
                            
                            // Check if this assignment is already in the list
                            const exists = allAssignments.some(a => 
                              a.id === content.id && 
                              a.classId === cls.id
                            )
                            
                            if (!exists) {
                              const lessonTitle = curriculumData && 
                                curriculumData.lessons && 
                                curriculumData.lessons[parseInt(lessonIndex)]?.title || 'Unnamed Lesson'
                              
                              allAssignments.push({
                                ...content,
                                lessonTitle,
                                lessonId: content.lessonId || `lesson-${lessonIndex}`,
                                classId: cls.id,
                                className: cls.name || 'Unnamed Class',
                                teacher: cls.teacher || 'Unnamed Teacher'
                              })
                            }
                          }
                        })
                      }
                    })
                  }
                }
              } catch (localStorageError) {
                console.error(`Error checking localStorage for published curriculum:`, localStorageError)
              }
            }
            
          } catch (error) {
            console.error(`Error loading curriculum for class ${cls.id}:`, error)
          }
        }

        // Sort assignments by due date
        const sortedAssignments = allAssignments.sort((a, b) => 
          new Date(a.dueDate || Date.now()).getTime() - new Date(b.dueDate || Date.now()).getTime()
        )
        
        console.log(`Total assignments found: ${sortedAssignments.length}`)
        setAssignments(sortedAssignments)
      } catch (error) {
        console.error("Error loading student assignments:", error)
        setAuthError("There was a problem loading your assignments")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [authUser, authRole])

  const navigation = [
    {
      title: "Dashboard",
      href: "/student/dashboard",
      icon: LayoutDashboard,
      current: false,
    },
    {
      title: "Classes",
      href: "/student/classes",
      icon: Book,
      current: false,
    },
    {
      title: "Assignments",
      href: "/student/assignments",
      icon: CheckSquare,
      current: true,
    },
    {
      title: "Calendar",
      href: "/student/calendar",
      icon: Calendar,
      current: false,
    },
    {
      title: "Grades",
      href: "/student/grades",
      icon: File,
      current: false,
    },
    {
      title: "Settings",
      href: "/student/settings",
      icon: Cog,
      current: false,
    },
  ]

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar navigation={navigation} user={currentUser || undefined} />
        <div className="flex items-center justify-center flex-1">
          <p>Loading assignments...</p>
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="flex min-h-screen">
        <Sidebar navigation={navigation} user={currentUser || undefined} />
        <div className="flex items-center justify-center flex-1">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Authentication Error</CardTitle>
              <CardDescription>
                {authError}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => router.push("/login?role=student")}>
                Go to Login
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  if (!currentUser || currentUser.role !== "student") {
    return (
      <div className="flex min-h-screen">
        <Sidebar navigation={navigation} user={currentUser || undefined} />
        <div className="flex items-center justify-center flex-1">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                This page is only available to student accounts.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => router.push("/")}>
                Return to Home
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  // Filter assignments by status
  const pendingAssignments = assignments.filter(
    assignment => !assignment.completed && new Date(assignment.dueDate) > new Date()
  )
  
  const completedAssignments = assignments.filter(
    assignment => assignment.completed
  )
  
  const overdueAssignments = assignments.filter(
    assignment => !assignment.completed && new Date(assignment.dueDate) < new Date()
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar navigation={navigation} user={currentUser} />
      <div className="flex-1 p-8 pt-6 overflow-y-auto max-h-screen">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img src="/logo.png" alt="Education More" className="h-8" />
              <h2 className="text-lg font-semibold">Education More</h2>
            </div>
            <h1 className="text-3xl font-bold">Assignments</h1>
            <p className="text-muted-foreground">
              View and track your assignments
            </p>
          </div>
        </div>

        {/* Pending Assignments */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Pending Assignments</h2>
          <div className="space-y-4">
            {pendingAssignments.length > 0 ? (
              pendingAssignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{assignment.title}</CardTitle>
                        <CardDescription>
                          {assignment.className} • Due: {new Date(assignment.dueDate).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge>{assignment.type === 'quiz' ? 'Quiz' : 'Assignment'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{assignment.description || "No description provided"}</p>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      asChild 
                      className="w-full"
                    >
                      <Link href={`/student/curriculum/${assignment.classId}?lesson=${assignment.lessonId}&content=${assignment.id}`}>
                        Start Assignment
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckSquare className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No pending assignments</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* Overdue Assignments */}
        {overdueAssignments.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Overdue Assignments</h2>
            <div className="space-y-4">
              {overdueAssignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{assignment.title}</CardTitle>
                        <CardDescription>
                          {assignment.className} • Due: {new Date(assignment.dueDate).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="destructive">{assignment.type === 'quiz' ? 'Quiz' : 'Assignment'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{assignment.description || "No description provided"}</p>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      asChild 
                      className="w-full"
                      variant="outline"
                    >
                      <Link href={`/student/curriculum/${assignment.classId}?lesson=${assignment.lessonId}&content=${assignment.id}`}>
                        Submit Late
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Completed Assignments */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Completed Assignments</h2>
          <div className="space-y-4">
            {completedAssignments.length > 0 ? (
              completedAssignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{assignment.title}</CardTitle>
                        <CardDescription>
                          {assignment.className} • Completed on: {new Date(assignment.completedAt || Date.now()).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{assignment.type === 'quiz' ? 'Quiz' : 'Assignment'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{assignment.description || "No description provided"}</p>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      asChild 
                      className="w-full"
                      variant="secondary"
                    >
                      <Link href={`/student/curriculum/${assignment.classId}?lesson=${assignment.lessonId}&content=${assignment.id}`}>
                        View Submission
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckSquare className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No completed assignments</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  )
} 