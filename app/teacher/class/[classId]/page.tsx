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
import { ArrowLeft, Search, Mail, Download, BookOpen, Users, CalendarDays, Map, ClipboardCheck } from "lucide-react"
import { storage } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { User, Class } from "@/lib/types"

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
        const teacherName = currentUser.user?.displayName || (currentUser.user as any)?.name
        const teacherId = currentUser.user?.uid || (currentUser.user as any)?.id
        
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
          <Button variant="outline" size="sm" asChild>
            <Link href={`/teacher/class/${classId}/attendance`}>
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Attendance
            </Link>
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
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Meeting Day</h3>
                  <p className="text-lg">{classData?.meeting_day || "—"}</p>
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
                      rel="noopener noreferrer" 
                      className="text-blue-500 hover:underline flex items-center"
                    >
                      <Map className="w-4 h-4 mr-2" />
                      {classData.virtualLink}
                    </a>
                  </div>
                )}
                {classData?.teacherJoinLink && (
                  <div className="col-span-1 md:col-span-2 lg:col-span-3">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Teacher Join Link</h3>
                    <a 
                      href={classData.teacherJoinLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-500 hover:underline flex items-center break-all"
                    >
                      <Map className="w-4 h-4 mr-2" />
                      {classData.teacherJoinLink}
                    </a>
                  </div>
                )}
                {classData?.studentJoinLink && (
                  <div className="col-span-1 md:col-span-2 lg:col-span-3">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Student Join Link</h3>
                    <a 
                      href={classData.studentJoinLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-500 hover:underline flex items-center break-all"
                    >
                      <Map className="w-4 h-4 mr-2" />
                      {classData.studentJoinLink}
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
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
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
                            <AvatarImage src={undefined} />
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
      </Tabs>
    </div>
  )
} 