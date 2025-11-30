"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { storageService } from "@/lib/storage"
import { db } from "@/lib/firebase"
import { collection, addDoc, getDocs } from "firebase/firestore"

const REQUIRED_PASSWORD = "4Y1lun7ea.C£"

export default function InitializeDbPage() {
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [password, setPassword] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const router = useRouter()

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    
    if (password === REQUIRED_PASSWORD) {
      setIsAuthenticated(true)
      setPassword("")
    } else {
      setPasswordError("Incorrect password. Access denied.")
      setPassword("")
    }
  }

  const initializeDatabase = async () => {
    if (!isAuthenticated) {
      setError("You must authenticate first")
      return
    }
    
    setIsInitializing(true)
    setError(null)
    setSuccess(false)

    try {
      // Initialize users collection
      const usersRef = collection(db, 'users')
      const initialUsers = [
        {
          name: "Dylan Sood",
          email: "dylan.sood@educationmore.org",
          password: "admin123",
          role: "admin",
          status: "active",
          avatar: "DS",
          classes: [],
        },
        {
          name: "Jane Doe",
          email: "jane.doe@example.com",
          password: "password",
          role: "teacher",
          status: "active",
          avatar: "JD",
          classes: [],
        },
        {
          name: "John Smith",
          email: "student@example.com",
          password: "password",
          role: "student",
          status: "active",
          avatar: "JS",
          classes: [],
        }
      ]

      for (const user of initialUsers) {
        await addDoc(usersRef, user)
      }

      // Initialize classes collection
      const classesRef = collection(db, 'classes')
      const initialClasses = [
        {
          name: "Mathematics 101",
          teacher: "Jane Doe",
          subject: "Mathematics",
          status: "active",
          students: 0,
          enrolledStudents: [],
        }
      ]

      for (const classData of initialClasses) {
        await addDoc(classesRef, classData)
      }

      setSuccess(true)
    } catch (err) {
      console.error("Error initializing database:", err)
      setError(err instanceof Error ? err.message : "An error occurred while initializing the database")
    } finally {
      setIsInitializing(false)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <Tabs defaultValue="initialize" className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="initialize">Initialize Database</TabsTrigger>
        </TabsList>

        <TabsContent value="initialize">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle>Initialize Database</CardTitle>
              <CardDescription>Create sample data to get started with Education More portal</CardDescription>
            </CardHeader>
            <CardContent>
              {!isAuthenticated ? (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password Required</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                    />
                    {passwordError && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{passwordError}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <Button type="submit" className="w-full">
                    Authenticate
                  </Button>
                </form>
              ) : (
                <>
                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {success && (
                    <Alert className="mb-4">
                      <AlertTitle>Success</AlertTitle>
                      <AlertDescription>
                        Database initialized successfully! You can now log in with the following credentials:
                        <ul className="pl-6 mt-2 list-disc">
                          <li>
                            <strong>Admin:</strong> dylan.sood@educationmore.org / admin123
                          </li>
                          <li>
                            <strong>Teacher:</strong> jane.doe@example.com / password
                          </li>
                          <li>
                            <strong>Student:</strong> student@example.com / password
                          </li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={initializeDatabase}
                    disabled={isInitializing}
                    className="w-full"
                  >
                    {isInitializing ? "Initializing..." : "Initialize Database"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
