"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Edit, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { sessionManager } from "@/lib/session"
import { storage } from "@/lib/storage"
import { db } from "@/lib/firebase"
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, serverTimestamp, orderBy } from "firebase/firestore"
import { format } from "date-fns"

interface Announcement {
  id: string
  title: string
  message: string
  classId: string
  className?: string
  authorId: string
  authorName: string
  authorRole?: string
  createdAt: any
  updatedAt?: any
}

export default function TeacherAnnouncements() {
  const router = useRouter()
  const { toast } = useToast()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [announcementToDelete, setAnnouncementToDelete] = useState<string | null>(null)
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    message: "",
    classId: "",
  })

  useEffect(() => {
    const user = sessionManager.getCurrentUser()
    if (!user || user.role !== "teacher") {
      router.push("/staff-portal")
      return
    }

    loadData()
  }, [router])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const user = sessionManager.getCurrentUser()
      const userId = user?.user?.uid
      const userName = user?.user?.displayName || ""

      // Load teacher's classes
      const allClasses = await storage.getClasses()
      const teacherClasses = allClasses.filter(
        (cls: any) => cls.teacher_id === userId || cls.teacher === userName
      )
      setClasses(teacherClasses)

      // Load announcements for teacher's classes (including admin announcements for those classes)
      if (teacherClasses.length > 0) {
        const classIds = teacherClasses.map((cls: any) => cls.id)
        const announcementsRef = collection(db, "announcements")
        const q = query(
          announcementsRef,
          where("classId", "in", classIds),
          orderBy("createdAt", "desc")
        )
        const snapshot = await getDocs(q)
        const announcementsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Announcement[]
        setAnnouncements(announcementsData)
      }
    } catch (error: any) {
      console.error("Error loading announcements:", error)
      toast({
        title: "Error",
        description: "Failed to load announcements",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.message || !newAnnouncement.classId) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    try {
      const user = sessionManager.getCurrentUser()
      const userId = user?.user?.uid || user?.user?.id
      const userName = user?.user?.name || user?.user?.displayName || "Teacher"
      const selectedClass = classes.find((cls) => cls.id === newAnnouncement.classId)

      await addDoc(collection(db, "announcements"), {
        title: newAnnouncement.title,
        message: newAnnouncement.message,
        classId: newAnnouncement.classId,
        className: selectedClass?.name || "",
        authorId: userId,
        authorName: userName,
        authorRole: "teacher",
        createdAt: serverTimestamp(),
      })

      toast({
        title: "Success",
        description: "Announcement created successfully",
      })

      setNewAnnouncement({ title: "", message: "", classId: "" })
      setIsDialogOpen(false)
      loadData()
    } catch (error: any) {
      console.error("Error creating announcement:", error)
      toast({
        title: "Error",
        description: "Failed to create announcement",
        variant: "destructive",
      })
    }
  }

  const handleDeleteAnnouncement = async () => {
    if (!announcementToDelete) return

    try {
      await deleteDoc(doc(db, "announcements", announcementToDelete))
      toast({
        title: "Success",
        description: "Announcement deleted successfully",
      })
      setDeleteDialogOpen(false)
      setAnnouncementToDelete(null)
      loadData()
    } catch (error: any) {
      console.error("Error deleting announcement:", error)
      toast({
        title: "Error",
        description: "Failed to delete announcement",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">Create and manage announcements for your classes</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Announcement
        </Button>
      </div>

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No announcements yet</p>
            <Button onClick={() => setIsDialogOpen(true)} className="mt-4">
              Create Your First Announcement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle>{announcement.title}</CardTitle>
                    <CardDescription className="mt-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{announcement.className || "Unknown Class"}</Badge>
                        {announcement.authorRole && (
                          <Badge variant="secondary">{announcement.authorRole}</Badge>
                        )}
                        <span className="text-sm">
                          By {announcement.authorName} •{" "}
                          {announcement.createdAt
                            ? format(announcement.createdAt.toDate(), "MMM d, yyyy 'at' h:mm a")
                            : "Recently"}
                        </span>
                      </div>
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAnnouncementToDelete(announcement.id)
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{announcement.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Announcement Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Announcement</DialogTitle>
            <DialogDescription>Share important information with your students</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="class">Class</Label>
              <Select value={newAnnouncement.classId} onValueChange={(value) => setNewAnnouncement({ ...newAnnouncement, classId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newAnnouncement.title}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                placeholder="Announcement title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={newAnnouncement.message}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                placeholder="Enter your announcement message"
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAnnouncement}>Create Announcement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this announcement? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAnnouncement} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

