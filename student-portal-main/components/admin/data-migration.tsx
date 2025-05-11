"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { persistentStorage } from "@/lib/persistentStorage"
import { db } from "@/lib/firebase"
import { collection, addDoc, getDocs, query, where } from "firebase/firestore"
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth"

export function DataMigration() {
  const [isMigrating, setIsMigrating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleMigration = async () => {
    setIsMigrating(true)
    setProgress(0)
    setStatus("Starting migration...")
    setError("")
    setSuccess(false)

    try {
      // Step 1: Migrate users
      setStatus("Migrating users...")
      setProgress(10)

      const users = persistentStorage.getAllUsers()
      let userCount = 0

      for (const user of users) {
        try {
          // Check if user already exists in Firebase
          const usersRef = collection(db, "users")
          const q = query(usersRef, where("email", "==", user.email))
          const querySnapshot = await getDocs(q)

          if (!querySnapshot.empty) {
            // User already exists, skip
            continue
          }

          // Create user in Firebase Auth
          const auth = getAuth()
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            user.email,
            user.password || "password123" // Default password if none exists
          )

          // Create user profile in Firestore
          await addDoc(collection(db, "users"), {
            id: userCredential.user.uid,
            email: user.email,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
            status: user.status,
          })

          userCount++
        } catch (err) {
          console.error(`Error migrating user ${user.email}:`, err)
        }
      }

      setStatus(`Migrated ${userCount} users`)
      setProgress(30)

      // Step 2: Migrate classes and get all classes for later use
      setStatus("Migrating classes...")
      const allClasses = persistentStorage.getAllClasses()
      let classCount = 0

      for (const cls of allClasses) {
        try {
          // Find the teacher's Firebase ID
          const usersRef = collection(db, "users")
          const q = query(usersRef, where("name", "==", cls.teacher))
          const querySnapshot = await getDocs(q)

          if (querySnapshot.empty) {
            console.error(`Teacher not found for class ${cls.name}`)
            continue
          }

          const teacherId = querySnapshot.docs[0].id

          // Check if class already exists
          const classesRef = collection(db, "classes")
          const classQuery = query(classesRef, where("name", "==", cls.name))
          const classSnapshot = await getDocs(classQuery)

          if (!classSnapshot.empty) {
            // Class already exists, skip
            continue
          }

          // Create class in Firestore
          await addDoc(collection(db, "classes"), {
            name: cls.name,
            teacher: cls.teacher,
            teacher_id: teacherId,
            location: cls.location || "",
            meetingDates: cls.meetingDates || "",
            startDate: cls.startDate || "",
            endDate: cls.endDate || "",
            startTime: cls.startTime || "",
            endTime: cls.endTime || "",
            virtualLink: cls.virtualLink || "",
            status: cls.status || "active",
            students: cls.students || 0,
            enrolledStudents: cls.enrolledStudents || [],
            subject: cls.subject || "",
            meeting_day: cls.meeting_day || "",
          })

          classCount++
        } catch (err) {
          console.error(`Error migrating class ${cls.name}:`, err)
        }
      }

      setStatus(`Migrated ${classCount} classes`)
      setProgress(60)

      // Step 3: Migrate curriculum
      setStatus("Migrating curriculum...")
      let curriculumCount = 0

      // Use the allClasses variable from Step 2
      for (const cls of allClasses) {
        try {
          const curriculum = await persistentStorage.getCurriculum(cls.id)
          if (!curriculum) continue

          // Check if curriculum already exists
          const curriculumRef = collection(db, "curriculum")
          const q = query(curriculumRef, where("classId", "==", cls.id))
          const querySnapshot = await getDocs(q)

          if (!querySnapshot.empty) {
            // Curriculum already exists, skip
            continue
          }

          // Create curriculum in Firestore
          await addDoc(collection(db, "curriculum"), {
            classId: cls.id,
            content: curriculum,
            lastUpdated: new Date().toISOString(),
          })

          curriculumCount++
        } catch (err) {
          console.error(`Error migrating curriculum for class ${cls.id}:`, err)
        }
      }

      setStatus(`Migrated ${curriculumCount} curriculum items`)
      setProgress(90)

      // Step 4: Migrate submissions
      setStatus("Migrating submissions...")
      // Note: Since there's no getAllSubmissions method, we'll skip this step for now
      setStatus("Submissions migration skipped - not implemented in persistent storage")
      setProgress(100)
      setSuccess(true)
    } catch (err) {
      console.error("Migration failed:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsMigrating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Migration</CardTitle>
        <CardDescription>Migrate data from local storage to Firebase</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>Data migration completed successfully!</AlertDescription>
          </Alert>
        )}
        <div className="space-y-4">
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleMigration} disabled={isMigrating}>
          {isMigrating ? "Migrating..." : "Start Migration"}
        </Button>
      </CardFooter>
    </Card>
  )
}
