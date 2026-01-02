"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell, ChevronDown, LogOut, User, Settings, FileText, Users, School, Calendar, BookOpen } from "lucide-react"
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

    // Properly set teacher data with user object from currentUser
    setTeacherData(currentUser.user || currentUser);

    // Safely load teacher's classes using our new safe method
    const loadData = async () => {
      try {
        // Use our new safe method that guarantees an array
        const allClasses = await storage.getSafeClasses();
        console.log("Loaded classes:", allClasses);
        
        // Get user info for better matching
        const teacherEmail = currentUser.user?.email || currentUser.email;
        const teacherName = currentUser.user?.displayName || currentUser.name;
        const teacherId = currentUser.user?.uid || currentUser.id;
        
        console.log("Teacher info for filtering:", { teacherEmail, teacherName, teacherId });
        
        // Filter teacher's classes - fix property names and add more matching options
        const teacherClasses = Array.isArray(allClasses) 
          ? allClasses.filter(classItem => {
              // Match on multiple potential teacher identifiers 
              return (
                (classItem.teacher && classItem.teacher.toLowerCase() === teacherName?.toLowerCase()) ||
                (classItem.teacher_id && classItem.teacher_id === teacherId) ||
                (classItem.teacherId && classItem.teacherId === teacherId) ||
                (classItem.teacher_email && classItem.teacher_email === teacherEmail)
              );
            })
          : [];
        
        console.log("Filtered teacher classes:", teacherClasses);
        setClasses(teacherClasses);

        // Get all students
        try {
          const allUsers = await storage.getUsers();
          console.log("Loaded users:", allUsers);
          
          if (Array.isArray(allUsers) && Array.isArray(teacherClasses)) {
            // Fix student filtering to properly find enrolled students
            const classStudents = allUsers.filter(user => {
              // Only include students
              if (user.role !== "student") return false;
              
              // Check if student is in any of teacher's classes
              return teacherClasses.some(cls => {
                // Check if student is in class.enrolledStudents
                if (cls.enrolledStudents && Array.isArray(cls.enrolledStudents)) {
                  if (cls.enrolledStudents.includes(user.id)) return true;
                }
                
                // Check if class.id is in student.classes
                if (user.classes && Array.isArray(user.classes)) {
                  if (user.classes.includes(cls.id)) return true;
                }
                
                return false;
              });
            });
            
            console.log("Filtered students:", classStudents);
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
    console.log("Navigating to class view for students:", classId)
    router.push(`/teacher/class/${classId}`)
  }

  const handleViewCurriculum = (classId: string) => {
    console.log("Navigating to curriculum for class:", classId)
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

  // Add logic to handle profile button
  const handleProfile = () => {
    router.push('/teacher/profile');
  }

  if (!teacherData) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="flex-1">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white border-b dark:bg-slate-900 dark:border-slate-800">
        <h1 className="text-xl font-bold md:text-2xl">Teacher Dashboard</h1>
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 md:p-6">
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Classes</CardTitle>
                </CardHeader>
                <CardContent>
                  {classes.length === 0 ? (
                    <p className="text-muted-foreground">No classes assigned yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {classes.slice(0, 5).map((cls) => (
                        <li key={cls.id} className="flex items-center justify-between p-2 border rounded hover:bg-slate-50 dark:hover:bg-slate-800">
                          <span>{cls.name}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleViewClass(cls.id)}>View</Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Student Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {students.length === 0 ? (
                    <p className="text-muted-foreground">No student activity yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {students.slice(0, 5).map((student) => (
                        <li key={student.id} className="flex items-center justify-between p-2 border rounded hover:bg-slate-50 dark:hover:bg-slate-800">
                          <div className="flex items-center space-x-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback>{student.avatar || student.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>{student.name}</span>
                          </div>
                          <Badge variant="outline">{student.classes.length} Classes</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="classes" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">No classes assigned yet.</p>
                  </CardContent>
                </Card>
              ) : (
                classes.map((cls) => (
                  <Card key={cls.id}>
                    <CardHeader>
                      <CardTitle>{cls.name}</CardTitle>
                      <CardDescription>
                        Teacher: {cls.teacher}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {/* Show all class details */}
                        <div className="grid grid-cols-2 text-sm gap-y-1">
                          {cls.meetingDates && (
                            <>
                              <span className="text-muted-foreground">Meeting Days:</span>
                              <span>{cls.meetingDates}</span>
                            </>
                          )}
                          
                          <span className="text-muted-foreground">Time:</span>
                          <span>
                            {cls.startTime && cls.endTime 
                              ? `${cls.startTime} - ${cls.endTime}` 
                              : "Not specified"}
                          </span>
                          
                          <span className="text-muted-foreground">Start Date:</span>
                          <span>{cls.startDate || "Not specified"}</span>
                          
                          <span className="text-muted-foreground">End Date:</span>
                          <span>{cls.endDate || "Not specified"}</span>
                          
                          <span className="text-muted-foreground">Location:</span>
                          <span>{cls.location || "Not specified"}</span>
                          
                          {cls.teacherJoinLink && (
                            <>
                              <span className="text-muted-foreground">Teacher Join Link:</span>
                              <a href={cls.teacherJoinLink?.startsWith('http') ? cls.teacherJoinLink : `https://${cls.teacherJoinLink}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline break-all">
                                Join Class
                              </a>
                            </>
                          )}
                          
                          <span className="text-muted-foreground">Students:</span>
                          <span>{countEnrolledStudents(cls.id)}</span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button variant="outline" size="sm" onClick={() => handleViewClass(cls.id)}>
                        <Users className="w-4 h-4 mr-2" />
                        View Students
                      </Button>
                      <Button size="sm" onClick={() => handleViewCurriculum(cls.id)}>
                        <BookOpen className="w-4 h-4 mr-2" />
                        Curriculum
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <div className="space-y-4">
              {students.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">No students enrolled yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {students.map((student) => (
                    <Card key={student.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center space-x-2">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback>{student.avatar || student.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-lg">{student.name}</CardTitle>
                            <CardDescription>{student.email}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant={student.status === "active" ? "default" : "secondary"}>
                              {student.status || "Active"}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Classes:</span>
                            <span>{student.classes.length}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            {classes.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">You have no classes assigned. Content is organized by class.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {classes.map((cls) => (
                  <Card key={cls.id}>
                    <CardHeader>
                      <CardTitle>{cls.name}</CardTitle>
                      <CardDescription>Teacher: {cls.teacher}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={() => handleViewCurriculum(cls.id)} className="w-full">
                        Manage Curriculum
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
