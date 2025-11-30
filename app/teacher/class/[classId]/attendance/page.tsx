"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Calendar, CheckCircle, Clock, XCircle, Save } from "lucide-react"
import { storage } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { collection, doc, getDoc, setDoc, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"

type AttendanceStatus = "present" | "tardy" | "absent"

interface AttendanceRecord {
  studentId: string
  studentName: string
  status: AttendanceStatus
  date: string
  lessonId?: string
  lessonTitle?: string
}

export default function AttendancePage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const classId = params.classId as string
  
  const [classData, setClassData] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [lessons, setLessons] = useState<any[]>([])
  const [selectedLesson, setSelectedLesson] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
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

    const loadData = async () => {
      try {
        // Load class data
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
        setClassData(foundClass)

        // Load students
        const allUsers = await storage.getUsers()
        const classStudents = allUsers.filter(
          (user) =>
            user.role === "student" &&
            (user.classes?.includes(classId) ||
              (foundClass.enrolledStudents && foundClass.enrolledStudents.includes(user.id)))
        )
        setStudents(classStudents)

        // Load curriculum to get lessons
        const curriculum = await storage.getCurriculum(classId)
        if (curriculum) {
          const formattedCurriculum = curriculum.content || curriculum
          if (formattedCurriculum.lessons && Array.isArray(formattedCurriculum.lessons)) {
            setLessons(formattedCurriculum.lessons)
            if (formattedCurriculum.lessons.length > 0) {
              setSelectedLesson(formattedCurriculum.lessons[0].id)
            }
          }
        }

        // Load existing attendance for the selected date and lesson
        await loadAttendance()

        setLoading(false)
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: "Error loading data",
          description: "There was a problem loading the attendance data",
          variant: "destructive",
        })
        setLoading(false)
      }
    }

    loadData()
  }, [classId, router, toast])

  useEffect(() => {
    // Reload attendance when date or lesson changes
    if (selectedDate && selectedLesson) {
      loadAttendance()
    }
  }, [selectedDate, selectedLesson])

  const loadAttendance = async () => {
    if (!selectedDate || !selectedLesson) return

    try {
      const attendanceRef = collection(db, "attendance")
      const q = query(
        attendanceRef,
        where("classId", "==", classId),
        where("date", "==", selectedDate),
        where("lessonId", "==", selectedLesson)
      )
      const snapshot = await getDocs(q)
      
      const attendanceMap: Record<string, AttendanceStatus> = {}
      snapshot.forEach((doc) => {
        const data = doc.data()
        attendanceMap[data.studentId] = data.status as AttendanceStatus
      })

      // Initialize with "present" for students without records
      students.forEach((student) => {
        if (!attendanceMap[student.id]) {
          attendanceMap[student.id] = "present"
        }
      })

      setAttendance(attendanceMap)
    } catch (error) {
      console.error("Error loading attendance:", error)
    }
  }

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: status,
    }))
  }

  const handleSaveAttendance = async () => {
    if (!selectedDate || !selectedLesson) {
      toast({
        title: "Missing information",
        description: "Please select a date and lesson",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const batch = students.map(async (student) => {
        const status = attendance[student.id] || "present"
        const attendanceDoc = {
          classId,
          studentId: student.id,
          studentName: student.name,
          lessonId: selectedLesson,
          lessonTitle: lessons.find((l) => l.id === selectedLesson)?.title || "Unknown Lesson",
          date: selectedDate,
          status,
          timestamp: new Date().toISOString(),
        }

        // Create a unique document ID
        const docId = `${classId}_${student.id}_${selectedDate}_${selectedLesson}`
        const docRef = doc(db, "attendance", docId)
        await setDoc(docRef, attendanceDoc)
      })

      await Promise.all(batch)

      toast({
        title: "Attendance saved",
        description: `Attendance for ${selectedDate} has been saved successfully`,
      })
    } catch (error: any) {
      console.error("Error saving attendance:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save attendance",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case "present":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "tardy":
        return <Clock className="w-4 h-4 text-yellow-500" />
      case "absent":
        return <XCircle className="w-4 h-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case "present":
        return <Badge className="bg-green-500">Present</Badge>
      case "tardy":
        return <Badge className="bg-yellow-500">Tardy</Badge>
      case "absent":
        return <Badge className="bg-red-500">Absent</Badge>
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/teacher/class/${classId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Class
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Attendance - {classData?.name}</h1>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Date and Lesson</CardTitle>
          <CardDescription>Choose the date and lesson for attendance tracking</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson">Lesson</Label>
              <Select value={selectedLesson} onValueChange={setSelectedLesson}>
                <SelectTrigger id="lesson">
                  <SelectValue placeholder="Select a lesson" />
                </SelectTrigger>
                <SelectContent>
                  {lessons.map((lesson) => (
                    <SelectItem key={lesson.id} value={lesson.id}>
                      {lesson.title || `Lesson ${lesson.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedDate && selectedLesson && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mark Attendance</CardTitle>
                <CardDescription>
                  {new Date(selectedDate).toLocaleDateString()} - {lessons.find((l) => l.id === selectedLesson)?.title || "Unknown Lesson"}
                </CardDescription>
              </div>
              <Button onClick={handleSaveAttendance} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Attendance"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => {
                  const currentStatus = attendance[student.id] || "present"
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(currentStatus)}
                          {getStatusBadge(currentStatus)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant={currentStatus === "present" ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleStatusChange(student.id, "present")}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Present
                          </Button>
                          <Button
                            variant={currentStatus === "tardy" ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleStatusChange(student.id, "tardy")}
                          >
                            <Clock className="w-4 h-4 mr-1" />
                            Tardy
                          </Button>
                          <Button
                            variant={currentStatus === "absent" ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleStatusChange(student.id, "absent")}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Absent
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

