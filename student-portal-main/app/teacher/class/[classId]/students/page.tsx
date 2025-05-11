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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Mail, Download } from "lucide-react"
import { storage } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { User, Class } from "@/lib/storage"

export default function ClassStudentsPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const classId = params.classId as string
  
  const [classData, setClassData] = useState<Class | null>(null)
  const [students, setStudents] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState("")
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
            (user.classes.includes(classId) ||
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
              Back to Classes
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{classData?.name}</h1>
        </div>
        <Button onClick={handleExportRoster} size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export Roster
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle>Class Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium">Subject</p>
              <p className="text-muted-foreground">{classData?.subject || "Not specified"}</p>
            </div>
            <div>
              <p className="font-medium">Meeting Day</p>
              <p className="text-muted-foreground">{classData?.meeting_day || "Not specified"}</p>
            </div>
            <div>
              <p className="font-medium">Time</p>
              <p className="text-muted-foreground">
                {classData?.startTime && classData?.endTime 
                  ? `${classData.startTime} - ${classData.endTime}` 
                  : "Not specified"}
              </p>
            </div>
            <div>
              <p className="font-medium">Location</p>
              <p className="text-muted-foreground">{classData?.location || "Not specified"}</p>
            </div>
            <div>
              <p className="font-medium">Duration</p>
              <p className="text-muted-foreground">
                {classData?.startDate && classData?.endDate 
                  ? `${classData.startDate} to ${classData.endDate}` 
                  : "Not specified"}
              </p>
            </div>
            <div>
              <p className="font-medium">Students Enrolled</p>
              <p className="text-muted-foreground">{students.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Students</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        {filteredStudents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <p className="text-muted-foreground mb-2">
                {students.length === 0 
                  ? "No students enrolled in this class yet." 
                  : "No students match your search criteria."}
              </p>
              {searchTerm && (
                <Button variant="outline" onClick={() => setSearchTerm("")}>
                  Clear Search
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{student.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>
                        <Badge variant={student.status === "active" ? "default" : "secondary"}>
                          {student.status || "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEmailStudent(student.email)}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 