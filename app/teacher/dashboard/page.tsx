"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell, ChevronDown, LogOut, User, Settings, FileText, Users, School, Calendar } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { storage } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { useToast } from "@/hooks/use-toast"

export default function TeacherDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const [teacherData, setTeacherData] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState("overview")

  // Get tab from URL parameters
  const searchParams = useSearchParams()

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && ["overview", "classes", "students", "content"].includes(tab)) {
      // Set the active tab based on URL parameter
      setActiveTab(tab)
    }
  }, [searchParams])

  // Set activeTab based on URL params when component mounts
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && ["overview", "classes", "students", "content"].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  useEffect(() => {
    // Get current teacher data
    const currentUser = sessionManager.getCurrentUser()
    if (!currentUser || currentUser.role !== "teacher") {
      toast({
        title: "Access denied",
        description: "You must be logged in as a teacher to view this page",
        variant: "destructive",
      })
      router.push("/staff-portal")
      return
    }

    setTeacherData(currentUser)

    // Safely load teacher's classes using our new safe method
    const loadData = async () => {
      try {
        // Use our new safe method that guarantees an array
        const allClasses = await storage.getSafeClasses();
        console.log("Loaded classes:", allClasses);
        
        // Filter teacher's classes
        const teacherClasses = Array.isArray(allClasses) 
          ? allClasses.filter(classItem => 
              classItem.teacher === currentUser.name || 
              classItem.teacherId === currentUser.id)
          : [];
        
        setClasses(teacherClasses);

        // Get all students
        try {
          const allUsers = await storage.getUsers();
          
          if (Array.isArray(allUsers) && Array.isArray(teacherClasses)) {
            const classStudents = allUsers.filter((user) => {
              return (
                user.role === "student" &&
                teacherClasses.some(
                  (cls) => 
                    (user.classes && Array.isArray(user.classes) && user.classes.includes(cls.id)) || 
                    (cls.enrolledStudents && Array.isArray(cls.enrolledStudents) && cls.enrolledStudents.includes(user.id))
                )
              );
            });
            setStudents(classStudents);
          } else {
            setStudents([]);
          }
        } catch (userError) {
          console.error("Error loading users:", userError);
          setStudents([]);
        }

        // Get assignments for this teacher's classes
        const allAssignments: any[] = [];
        if (Array.isArray(teacherClasses)) {
          teacherClasses.forEach((classItem) => {
            if (classItem.curriculum && classItem.curriculum.lessons) {
              classItem.curriculum.lessons.forEach((lesson: any) => {
                if (lesson.contents) {
                  lesson.contents.forEach((content: any) => {
                    if (content.isPublished) {
                      allAssignments.push({
                        ...content,
                        classId: classItem.id,
                        className: classItem.name,
                        lessonId: lesson.id,
                        lessonTitle: lesson.title,
                      });
                    }
                  });
                }
              });
            }
          });
        }
        setAssignments(allAssignments);
      } catch (error) {
        console.error("Error loading data:", error);
        toast({
          title: "Error loading data",
          description: "There was a problem loading your dashboard data.",
          variant: "destructive",
        });
        // Set default empty arrays
        setClasses([]);
        setStudents([]);
        setAssignments([]);
      }
    };

    loadData();
  }, [router, toast, searchParams])

  const handleViewClass = (classId: string) => {
    router.push(`/teacher/class/${classId}/students`)
  }

  const handleViewCurriculum = (classId: string) => {
    router.push(`/teacher/curriculum/${classId}`)
  }

  const handleLogout = () => {
    sessionManager.clearCurrentUser()
    router.push("/staff-portal")
  }

  const countEnrolledStudents = (classId: string) => {
    const classData = storage.getClassById(classId)
    return classData && classData.enrolledStudents ? classData.enrolledStudents.length : 0
  }

  if (!teacherData) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <div className="hidden w-64 p-4 bg-white border-r md:block dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center mb-8 space-x-2">
          <School className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold">Education More</span>
        </div>
        <nav className="space-y-1">
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/dashboard">
              <FileText className="w-5 h-5 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/classes">
              <School className="w-5 h-5 mr-2" />
              Classes
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/students">
              <Users className="w-5 h-5 mr-2" />
              Students
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/calendar">
              <Calendar className="w-5 h-5 mr-2" />
              Calendar
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/profile">
              <User className="w-5 h-5 mr-2" />
              Profile
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/settings">
              <Settings className="w-5 h-5 mr-2" />
              Settings
            </Link>
          </Button>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1">
        {/* Header */}
        <header className="flex items-center justify-between p-4 bg-white border-b dark:bg-slate-900 dark:border-slate-800">
          <h1 className="text-xl font-bold md:text-2xl">Teacher Dashboard</h1>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src="/placeholder.svg" alt="Teacher" />
                    <AvatarFallback>{teacherData.avatar}</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline-block">{teacherData.name}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/teacher/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/teacher/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 md:p-6">
          <h1 className="text-3xl font-bold mb-6">Teacher Dashboard</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Classes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{classes.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Students</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{students.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Published Content</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{assignments.length}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="classes">Classes</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Classes</CardTitle>
                    <CardDescription>Your assigned classes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {classes.slice(0, 3).map((classItem) => (
                        <div key={classItem.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{classItem.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {classItem.meetingDay} {classItem.startTime}-{classItem.endTime}
                            </p>
                          </div>
                          <Badge variant={classItem.status === "active" ? "default" : "secondary"}>
                            {classItem.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  {/* Update the "View All" buttons to use Link components instead of state changes: */}
                  <CardFooter>
                    <Button variant="outline" className="w-full" onClick={() => setActiveTab("classes")}>
                      View All Classes
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Content</CardTitle>
                    <CardDescription>Recently published content</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {assignments.slice(0, 3).map((assignment, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{assignment.title}</p>
                            <p className="text-sm text-muted-foreground">{assignment.className}</p>
                          </div>
                          <Badge>{assignment.type}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  {/* Update the "View All" buttons to use Link components instead of state changes: */}
                  <CardFooter>
                    <Button variant="outline" className="w-full" onClick={() => setActiveTab("content")}>
                      View All Content
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="classes">
              <h2 className="text-2xl font-semibold mb-4">Your Classes</h2>
              <div className="space-y-4">
                {classes.length > 0 ? (
                  classes.map((classItem) => (
                    <Card key={classItem.id}>
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between">
                          <div className="mb-4 md:mb-0">
                            <h3 className="text-xl font-semibold">{classItem.name}</h3>
                            <p className="text-muted-foreground">{classItem.subject}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="outline">
                                {classItem.meetingDay} {classItem.startTime}-{classItem.endTime}
                              </Badge>
                              <Badge variant="outline">{classItem.location}</Badge>
                              <Badge variant={classItem.status === "active" ? "default" : "secondary"}>
                                {classItem.status === "active" ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button variant="outline" onClick={() => handleViewClass(classItem.id)}>
                              Students ({countEnrolledStudents(classItem.id)})
                            </Button>
                            <Button onClick={() => handleViewCurriculum(classItem.id)}>Curriculum</Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-center text-gray-500">No classes assigned yet.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="content">
              <h2 className="text-2xl font-semibold mb-4">Published Content</h2>
              <div className="space-y-4">
                {assignments.length > 0 ? (
                  assignments.map((assignment, index) => (
                    <Card key={`${assignment.classId}-${assignment.lessonId}-${index}`}>
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">{assignment.title}</h3>
                            <p className="text-muted-foreground">
                              {assignment.className} - {assignment.lessonTitle}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Badge>{assignment.type}</Badge>
                              {assignment.isPublished && (
                                <Badge
                                  variant="outline"
                                  className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                >
                                  Published
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            className="mt-4 md:mt-0"
                            onClick={() => handleViewCurriculum(assignment.classId)}
                          >
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-center text-gray-500">No content published yet.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="students">
              <h2 className="text-2xl font-semibold mb-4">Your Students</h2>
              <div className="space-y-4">
                {students.length > 0 ? (
                  students.map((student) => (
                    <Card key={student.id}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Avatar className="w-10 h-10 mr-4">
                              <AvatarFallback>{student.avatar}</AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold">{student.name}</h3>
                              <p className="text-sm text-muted-foreground">{student.email}</p>
                            </div>
                          </div>
                          <Badge variant={student.status === "active" ? "default" : "secondary"}>
                            {student.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-center text-gray-500">No students enrolled in your classes.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
