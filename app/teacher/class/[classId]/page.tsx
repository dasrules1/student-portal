"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Search, Mail, Download, BookOpen, Users, CalendarDays, Map, Activity } from "lucide-react"
import { storage } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { User, Class } from "@/lib/storage"
import { RealTimeMonitor } from "@/components/teacher/real-time-monitor"

export default function ClassPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const classId = params.classId as string
  
  const [classData, setClassData] = useState<Class | null>(null)
  const [students, setStudents] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("details")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is a teacher
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

    // Load class data
    const loadData = async () => {
      try {
        const foundClass = await storage.getClassById(classId)
        if (!foundClass) {
          toast({
            title: "Class not found",
            description: "The requested class could not be found",
            variant: "destructive",
          })
          router.push("/teacher/dashboard")
          return
        }

        // Check if this teacher is assigned to this class
        const teacherName = currentUser.user?.displayName || currentUser.user?.name
        const teacherId = currentUser.user?.uid || currentUser.user?.id
        
        if (foundClass.teacher !== teacherName && foundClass.teacher_id !== teacherId) {
          toast({
            title: "Access denied",
            description: "You are not assigned to this class",
            variant: "destructive",
          })
          router.push("/teacher/dashboard")
          return
        }

        setClassData(foundClass)

        // Get students enrolled in this class
        const allUsers = await storage.getUsers()
        const classStudents = allUsers.filter(
          (user) =>
            user.role === "student" &&
            (user.classes?.includes(classId) ||
              (foundClass.enrolledStudents && foundClass.enrolledStudents.includes(user.id)))
        )
        
        setStudents(classStudents)
        setLoading(false)
      } catch (error) {
        console.error("Error loading class data:", error)
        toast({
          title: "Error loading data",
          description: "There was a problem loading the class data",
          variant: "destructive",
        })
        router.push("/teacher/dashboard")
      }
    }
    
    loadData()
  }, [classId, router, toast])

  // Filter students based on search term
  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleEmailStudent = (email: string) => {
    window.open(`mailto:${email}`)
  }

  const handleExportRoster = () => {
    // Create CSV content
    const headers = ["Name", "Email", "Status"]
    const rows = filteredStudents.map((student) => [
      student.name,
      student.email,
      student.status || "Active"
    ])
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n")
    
    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${classData?.name.replace(/\s+/g, "_")}_students.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast({
      title: "Roster exported",
      description: "Student roster has been exported as CSV",
    })
  }

  const handleViewCurriculum = () => {
    router.push(`/teacher/curriculum/${classId}`)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/teacher/dashboard?tab=classes">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{classData?.name}</h1>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handleExportRoster}>
            <Download className="w-4 h-4 mr-2" />
            Export Roster
          </Button>
          <Button size="sm" onClick={handleViewCurriculum}>
            <BookOpen className="w-4 h-4 mr-2" />
            Curriculum
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">
            <CalendarDays className="w-4 h-4 mr-2" />
            Class Details
          </TabsTrigger>
          <TabsTrigger value="students">
            <Users className="w-4 h-4 mr-2" />
            Students ({students.length})
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            Live Activity
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Class Information</CardTitle>
              <CardDescription>Details about the class schedule and location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-10">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Subject</h3>
                  <p className="text-lg">{classData?.subject || "Not specified"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Meeting Day</h3>
                  <p className="text-lg">{classData?.meeting_day || "Not specified"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Time</h3>
                  <p className="text-lg">
                    {classData?.startTime && classData?.endTime 
                      ? `${classData.startTime} - ${classData.endTime}` 
                      : "Not specified"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Start Date</h3>
                  <p className="text-lg">{classData?.startDate || "Not specified"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">End Date</h3>
                  <p className="text-lg">{classData?.endDate || "Not specified"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Location</h3>
                  <p className="text-lg">{classData?.location || "Not specified"}</p>
                </div>
                {classData?.virtualLink && (
                  <div className="col-span-1 md:col-span-2 lg:col-span-3">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Virtual Meeting Link</h3>
                    <a 
                      href={classData.virtualLink} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-blue-500 hover:underline flex items-center"
                    >
                      <Map className="w-4 h-4 mr-2" />
                      {classData.virtualLink}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                Teacher: {classData?.teacher}
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="students" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
              prefix={<Search className="w-4 h-4 mr-2 opacity-50" />}
            />
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Enrolled Students</CardTitle>
              <CardDescription>Students currently enrolled in this class</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredStudents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="flex items-center space-x-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={student.profileImageUrl || ""} />
                            <AvatarFallback>
                              {student.name ? student.name.charAt(0).toUpperCase() : "S"}
                            </AvatarFallback>
                          </Avatar>
                          <span>{student.name}</span>
                        </TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>
                          <Badge>Active</Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEmailStudent(student.email)}
                          >
                            <Mail className="w-4 h-4 mr-2" />
                            Contact
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Users className="w-12 h-12 mb-2 text-muted-foreground" />
                  <p>No students found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {searchTerm ? "Try a different search term" : "Add students to this class to see them here"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="activity" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
            <RealTimeMonitor classId={classId} recentOnly={true} />
            
            <Card>
              <CardHeader>
                <CardTitle>Active Assignments</CardTitle>
                <CardDescription>Monitor specific assignments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {classData?.curriculum?.lessons?.filter(lesson => 
                    lesson.contents?.some(content => 
                      content.type === 'assignment' || 
                      content.type === 'quiz')
                  ).map((lesson) => (
                    <div key={lesson.id} className="space-y-2">
                      <h3 className="font-medium">{lesson.title}</h3>
                      <div className="space-y-2">
                        {lesson.contents?.filter(content => 
                          content.type === 'assignment' || 
                          content.type === 'quiz'
                        ).map((content) => (
                          <div key={content.id} className="flex justify-between items-center p-2 border rounded">
                            <div>
                              <p className="text-sm">{content.title}</p>
                              <span className="text-xs text-muted-foreground">
                                {content.type.charAt(0).toUpperCase() + content.type.slice(1)}
                              </span>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setActiveTab(`activity-${content.id}`)}
                            >
                              Monitor
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {!classData?.curriculum?.lessons?.some(lesson => 
                    lesson.contents?.some(content => 
                      content.type === 'assignment' || 
                      content.type === 'quiz')
                  ) && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <BookOpen className="w-12 h-12 mb-2 text-muted-foreground" />
                      <p>No assignments available</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Create assignments in the curriculum editor
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Dynamically created tabs for specific assignment monitoring */}
        {classData?.curriculum?.lessons?.flatMap(lesson => 
          lesson.contents?.filter(content => 
            content.type === 'assignment' || 
            content.type === 'quiz'
          ).map(content => (
            <TabsContent key={`activity-${content.id}`} value={`activity-${content.id}`} className="space-y-4">
              <div className="flex items-center mb-4 space-x-2">
                <Button variant="outline" size="sm" onClick={() => setActiveTab("activity")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to All Activities
                </Button>
                <h2 className="text-xl font-semibold">{content.title}</h2>
              </div>
              
              <RealTimeMonitor classId={classId} contentId={content.id} />
            </TabsContent>
          ))
        )}
      </Tabs>
    </div>
  )
} 