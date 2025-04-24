"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { persistentStorage } from "@/lib/persistentStorage" // Use persistentStorage instead of storage
import { storage } from "@/lib/storage" // Add storage import

export default function ClassEnrollment() {
  const params = useParams()
  const router = useRouter()
  const classId = params.classId as string

  const [classData, setClassData] = useState<any>(null)
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([])
  const [unenrolledStudents, setUnenrolledStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get class data
    async function fetchData() {
      try {
        console.log("Loading class data for ID:", classId)
        
        // Try multiple sources to find the class
        let currentClass = null;
        
        // Try storage first (Firebase/main storage)
        try {
          currentClass = await storage.getClassById(classId);
          console.log("Class found in main storage:", currentClass);
        } catch (storageErr) {
          console.log("Class not found in main storage, trying persistentStorage");
        }
        
        // If not found, try persistentStorage
        if (!currentClass) {
          currentClass = persistentStorage.getClassById(classId);
          console.log("Class from persistentStorage:", currentClass);
        }
        
        // If still not found, try getting all classes and finding by ID
        if (!currentClass) {
          console.log("Trying to find class in all classes list");
          const allClasses = await storage.getClasses();
          currentClass = allClasses.find((c: any) => c.id === classId);
          console.log("Class from all classes:", currentClass);
        }

        if (!currentClass) {
          console.error("Class not found:", classId)
          setError("Class not found")
          setLoading(false)
          return
        }

        console.log("Class data loaded:", currentClass)
        setClassData(currentClass)

        // Get all students - try both sources
        let students = [];
        try {
          students = await storage.getUsers();
          students = students.filter((user: any) => user.role === "student");
        } catch (err) {
          console.log("Error getting students from main storage, using persistentStorage");
          students = persistentStorage.getAllUsers().filter((user: any) => user.role === "student");
        }
        
        console.log("All students:", students.length)
        setAllStudents(students)

        // Get enrolled students
        const enrolled = students.filter(
          (student: any) =>
            student.classes?.includes(classId) ||
            (currentClass.enrolledStudents && currentClass.enrolledStudents.includes(student.id)),
        )
        console.log("Enrolled students:", enrolled.length)
        setEnrolledStudents(enrolled)

        // Get unenrolled students
        const unenrolled = students.filter(
          (student: any) =>
            !student.classes?.includes(classId) &&
            (!currentClass.enrolledStudents || !currentClass.enrolledStudents.includes(student.id)),
        )
        console.log("Unenrolled students:", unenrolled.length)
        setUnenrolledStudents(unenrolled)

        setLoading(false)
      } catch (err) {
        console.error("Error loading enrollment data:", err)
        setError("Failed to load enrollment data")
        setLoading(false)
      }
    }
    
    fetchData();
  }, [classId])

  const handleEnrollStudent = async (studentId: string) => {
    try {
      // Use the dedicated enrollment method instead of manual updates
      const success = await storage.enrollStudent(classId, studentId);
      
      if (!success) {
        throw new Error("Enrollment failed");
      }
      
      // Update UI
      const studentToEnroll = unenrolledStudents.find((s) => s.id === studentId);
      if (studentToEnroll) {
        setEnrolledStudents([...enrolledStudents, studentToEnroll]);
        setUnenrolledStudents(unenrolledStudents.filter((s) => s.id !== studentId));
      }
      
      // Update local class data
      if (classData) {
        // Fetch updated class data to ensure it's in sync
        const updatedClass = persistentStorage.getClassById(classId);
        if (updatedClass) {
          setClassData(updatedClass);
        }
      }
    } catch (err) {
      console.error("Error enrolling student:", err)
      setError("Failed to enroll student")
    }
  }

  const handleUnenrollStudent = async (studentId: string) => {
    try {
      // Use the dedicated unenrollment method instead of manual updates
      const success = await storage.unenrollStudent(classId, studentId);
      
      if (!success) {
        throw new Error("Unenrollment failed");
      }
      
      // Update UI
      const studentToUnenroll = enrolledStudents.find((s) => s.id === studentId);
      if (studentToUnenroll) {
        setUnenrolledStudents([...unenrolledStudents, studentToUnenroll]);
        setEnrolledStudents(enrolledStudents.filter((s) => s.id !== studentId));
      }
      
      // Update local class data
      if (classData) {
        // Fetch updated class data to ensure it's in sync
        const updatedClass = persistentStorage.getClassById(classId);
        if (updatedClass) {
          setClassData(updatedClass);
        }
      }
    } catch (err) {
      console.error("Error unenrolling student:", err)
      setError("Failed to unenroll student")
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center h-64">
          <p className="text-lg">Loading enrollment data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <p className="text-lg text-red-500 mb-4">{error}</p>
            <Button variant="outline" onClick={() => router.push("/admin/dashboard?tab=classes")}>
              Back to Classes
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!classData) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <p className="text-lg mb-4">Class not found</p>
            <Button variant="outline" onClick={() => router.push("/admin/dashboard?tab=classes")}>
              Back to Classes
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Class Enrollment: {classData.name}</h1>
        <Button variant="outline" onClick={() => router.push("/admin/dashboard?tab=classes")}>
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Enrolled Students ({enrolledStudents.length})</h2>
          {enrolledStudents.length > 0 ? (
            <div className="space-y-4">
              {enrolledStudents.map((student) => (
                <Card key={student.id}>
                  <CardHeader className="pb-2">
                    <CardTitle>{student.name}</CardTitle>
                    <CardDescription>{student.email}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" onClick={() => handleUnenrollStudent(student.id)}>
                      Unenroll
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No students enrolled yet.</p>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">Available Students ({unenrolledStudents.length})</h2>
          {unenrolledStudents.length > 0 ? (
            <div className="space-y-4">
              {unenrolledStudents.map((student) => (
                <Card key={student.id}>
                  <CardHeader className="pb-2">
                    <CardTitle>{student.name}</CardTitle>
                    <CardDescription>{student.email}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" onClick={() => handleEnrollStudent(student.id)}>
                      Enroll
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No available students to enroll.</p>
          )}
        </div>
      </div>
    </div>
  )
}
