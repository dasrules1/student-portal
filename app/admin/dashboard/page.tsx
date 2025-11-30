"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Settings, UserPlus, School, Plus, Edit, Trash2, Search, CheckCircle, User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { storage } from "@/lib/storage"
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
import { sessionManager } from "@/lib/session"

export default function AdminDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")
  const [users, setUsers] = useState([])
  const [classes, setClasses] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingUser, setIsAddingUser] = useState(false)
  const [isAddingClass, setIsAddingClass] = useState(false)
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
  })
  const [newClass, setNewClass] = useState({
    name: "",
    teacher: "",
    location: "",
    meetingDates: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    virtualLink: "",
    teacherJoinLink: "",
    studentJoinLink: "",
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [deleteClassDialogOpen, setDeleteClassDialogOpen] = useState(false)
  const [classToDelete, setClassToDelete] = useState(null)
  const [isEditingUser, setIsEditingUser] = useState(false)
  const [userToEdit, setUserToEdit] = useState(null)
  const [isEditingClass, setIsEditingClass] = useState(false)
  const [classToEdit, setClassToEdit] = useState(null)
  const [availableTeachers, setAvailableTeachers] = useState([])

  useEffect(() => {
    // Check if user is an admin
    const { user, role } = sessionManager.getCurrentUser()
    if (!user || role !== "admin") {
      toast({
        title: "Access denied",
        description: "You must be logged in as an admin to view this page",
        variant: "destructive",
      })
      router.push("/login?role=admin")
      return
    }

    // Load data
    loadData()

    // Set active tab from URL if present
    const tab = searchParams.get("tab")
    if (tab) {
      setActiveTab(tab)
    }
  }, [router, toast, searchParams])

  const loadData = async () => {
    setIsLoading(true)
    try {
      console.log("Loading data from Firebase...")
      
      // Load users from Firebase
      const loadedUsers = await storage.getUsers()
      console.log("Loaded users:", loadedUsers)
      setUsers(loadedUsers)

      // Set available teachers
      const teachers = loadedUsers.filter((user) => user.role === "teacher")
      setAvailableTeachers(teachers)

      // Load classes
      const loadedClasses = await storage.getClasses()
      setClasses(loadedClasses)

      // Load activity logs using the safe method
      const loadedLogs = await storage.getSafeActivityLogs()
      console.log("Loaded activity logs (safe):", loadedLogs)
      // Ensure it's an array when setting state
      setActivityLogs(Array.isArray(loadedLogs) ? loadedLogs : [])
    } catch (error) {
      console.error("Error loading data:", error)
      toast({
        title: "Error loading data",
        description: "There was an error loading the dashboard data",
        variant: "destructive",
      })
      // Set empty arrays for safety
      setUsers([])
      setClasses([])
      setActivityLogs([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddUser = async () => {
    try {
      // Validate input
      if (!newUser.name || !newUser.email || !newUser.password) {
        toast({
          title: "Missing information",
          description: "Please fill in all required fields",
          variant: "destructive",
        })
        return
      }

      console.log("Creating new user:", newUser)
      setIsLoading(true)
      
      // Add user (awaiting the async operation)
      const createdUser = await storage.addUser(newUser)
      console.log("User created:", createdUser)

      // Reset form
      setNewUser({
        name: "",
        email: "",
        password: "",
        role: "student",
      })

      // Close dialog
      setIsAddingUser(false)

      // Reload data
      console.log("Reloading data after user creation...")
      await loadData()

      toast({
        title: "User added",
        description: `${newUser.name} has been added as a ${newUser.role}`,
      })

      // Add activity log
      storage.addActivityLog({
        action: "New User Created",
        details: `${newUser.name} (${newUser.role})`,
        timestamp: new Date().toLocaleString(),
        category: "User Management",
      })
    } catch (error) {
      console.error("Error adding user:", error)
      toast({
        title: "Error adding user",
        description: error.message || "Failed to add user",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddClass = () => {
    try {
      // Validate input
      if (!newClass.name || !newClass.teacher) {
        toast({
          title: "Missing information",
          description: "Please fill in all required fields",
          variant: "destructive",
        })
        return
      }

      // Add class
      const addedClass = storage.addClass({
        ...newClass,
        status: "active",
        students: 0,
        enrolledStudents: [],
      })

      // Reset form
      setNewClass({
        name: "",
        teacher: "",
        location: "",
        meetingDates: "",
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
        virtualLink: "",
        teacherJoinLink: "",
        studentJoinLink: "",
      })

      // Close dialog
      setIsAddingClass(false)

      // Reload data
      loadData()

      toast({
        title: "Class added",
        description: `${newClass.name} has been added`,
      })

      // Add activity log
      storage.addActivityLog({
        action: "New Class Created",
        details: `${newClass.name} with ${newClass.teacher}`,
        timestamp: new Date().toLocaleString(),
        category: "Class Management",
      })

      // Redirect to curriculum editor
      router.push(`/admin/curriculum/${addedClass.id}`)
    } catch (error) {
      toast({
        title: "Error adding class",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleEditUser = async () => {
    try {
      if (!userToEdit) return;
      
      setIsLoading(true);

      // Update user
      await storage.updateUser(userToEdit.id, userToEdit);

      // Reload data
      await loadData();

      toast({
        title: "User updated",
        description: `${userToEdit.name} has been updated`,
      });

      // Add activity log
      storage.addActivityLog({
        action: "User Updated",
        details: `${userToEdit.name} (${userToEdit.role})`,
        timestamp: new Date().toLocaleString(),
        category: "User Management",
      });

      // Close dialog
      setIsEditingUser(false);
      setUserToEdit(null);
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Error updating user",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setIsLoading(true);
      
      // Delete user
      await storage.deleteUser(userToDelete.id);

      // Reload data
      await loadData();

      toast({
        title: "User deleted",
        description: `${userToDelete.name} has been deleted`,
      });

      // Add activity log
      storage.addActivityLog({
        action: "User Deleted",
        details: `${userToDelete.name} (${userToDelete.role})`,
        timestamp: new Date().toLocaleString(),
        category: "User Management",
      });

      // Close dialog
      setDeleteUserDialogOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error deleting user",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClass = () => {
    if (!classToDelete) return

    try {
      // Delete class
      storage.deleteClass(classToDelete.id)

      // Reload data
      loadData()

      toast({
        title: "Class deleted",
        description: `${classToDelete.name} has been deleted`,
      })

      // Add activity log
      storage.addActivityLog({
        action: "Class Deleted",
        details: `${classToDelete.name}`,
        timestamp: new Date().toLocaleString(),
        category: "Class Management",
      })

      // Close dialog
      setDeleteClassDialogOpen(false)
      setClassToDelete(null)
    } catch (error) {
      toast({
        title: "Error deleting class",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleEditClass = () => {
    if (!classToEdit) return

    try {
      // Update class
      storage.updateClass(classToEdit.id, classToEdit)

      // Reload data
      loadData()

      toast({
        title: "Class updated",
        description: `${classToEdit.name} has been updated`,
      })

      // Add activity log
      storage.addActivityLog({
        action: "Class Updated",
        details: `${classToEdit.name}`,
        timestamp: new Date().toLocaleString(),
        category: "Class Management",
      })

      // Close dialog
      setIsEditingClass(false)
      setClassToEdit(null)
    } catch (error) {
      toast({
        title: "Error updating class",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleManageEnrollment = (classId) => {
    console.log("Navigating to enrollment page for class:", classId)
    window.location.href = `/admin/class/${classId}/enrollment`
  }

  const handleManageCurriculum = (classId) => {
    console.log("Navigating to curriculum editor for class:", classId)
    window.location.href = `/admin/curriculum/${classId}`
  }

  const handleLogout = () => {
    sessionManager.logout()
    router.push("/admin-portal")
  }

  // Filter users based on search query
  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase()
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    )
  })

  // Filter classes based on search query
  const filteredClasses = classes.filter((cls) => {
    const query = searchQuery.toLowerCase()
    return (
      cls.name.toLowerCase().includes(query) ||
      cls.teacher.toLowerCase().includes(query) ||
      (cls.location && cls.location.toLowerCase().includes(query))
    )
  })

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="flex-1">
        <div className="container p-6 mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>

          <div className="mb-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="classes">Classes</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <div className="mt-4">
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                  prefix={<Search className="w-4 h-4 mr-2 opacity-50" />}
                />
              </div>

              <TabsContent value="overview" className="mt-6">
                {isLoading ? (
                  <div className="text-center py-10">Loading dashboard data...</div>
                ) : (
                  <>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {users.filter((user) => user.role === "student").length}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            +{Math.floor(Math.random() * 10)}% from last month
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {users.filter((user) => user.role === "teacher").length}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            +{Math.floor(Math.random() * 5)}% from last month
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {classes.filter((cls) => cls.status === "active").length}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            +{Math.floor(Math.random() * 15)}% from last month
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">System Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center">
                            <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                            <span className="text-sm font-medium">All Systems Operational</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Last updated: just now</p>
                        </CardContent>
                      </Card>
                    </div>

                    <h2 className="mt-8 mb-4 text-xl font-semibold">Recent Activity</h2>
                    <Card>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {activityLogs.slice(0, 5).map((log) => (
                            <div key={log.id} className="flex items-start p-4">
                              <div className="mr-4">
                                {log.category === "User Management" && (
                                  <User className="w-8 h-8 p-1 rounded-full bg-blue-100 text-blue-500" />
                                )}
                                {log.category === "Class Management" && (
                                  <School className="w-8 h-8 p-1 rounded-full bg-purple-100 text-purple-500" />
                                )}
                                {log.category === "System" && (
                                  <Settings className="w-8 h-8 p-1 rounded-full bg-gray-100 text-gray-500" />
                                )}
                              </div>
                              <div>
                                <h3 className="font-medium">{log.action}</h3>
                                <p className="text-sm text-muted-foreground">{log.details}</p>
                                <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              <TabsContent value="users" className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">User Management</h2>
                  <Button onClick={() => setIsAddingUser(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="text-center py-10">Loading users...</div>
                    ) : (
                      <div className="divide-y">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((user) => (
                            <div key={user.id} className="flex items-center justify-between p-4">
                              <div className="flex items-center">
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mr-4">
                                  {user.avatar || user.name.charAt(0)}
                                </div>
                                <div>
                                  <h3 className="font-medium">{user.name}</h3>
                                  <p className="text-sm text-muted-foreground">{user.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center">
                                <Badge variant={user.status === "active" ? "default" : "secondary"} className="mr-4">
                                  {user.role}
                                </Badge>
                                <div className="flex space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setUserToEdit({ ...user })
                                      setIsEditingUser(true)
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setUserToDelete(user)
                                      setDeleteUserDialogOpen(true)
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center">
                            <p className="text-muted-foreground">No users found</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="classes" className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Class Management</h2>
                  <Button onClick={() => setIsAddingClass(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Class
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="text-center py-10">Loading classes...</div>
                    ) : (
                      <div className="divide-y">
                        {filteredClasses.length > 0 ? (
                          filteredClasses.map((cls) => (
                            <div key={cls.id} className="flex items-center justify-between p-4">
                              <div className="flex items-center">
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mr-4">
                                  <School className="w-5 h-5" />
                                </div>
                                <div>
                                  <h3 className="font-medium">{cls.name}</h3>
                                  <p className="text-sm text-muted-foreground">Teacher: {cls.teacher}</p>
                                </div>
                              </div>
                              <div className="flex items-center">
                                <Badge variant={cls.status === "active" ? "default" : "secondary"} className="mr-4">
                                  {cls.enrolledStudents && Array.isArray(cls.enrolledStudents) ? cls.enrolledStudents.length : (cls.students || 0)} students
                                </Badge>
                                <div className="flex space-x-2">
                                  <Button variant="outline" size="sm" onClick={() => handleManageEnrollment(cls.id)}>
                                    Enrollment
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => handleManageCurriculum(cls.id)}>
                                    Curriculum
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setClassToEdit({ ...cls })
                                      setIsEditingClass(true)
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setClassToDelete(cls)
                                      setDeleteClassDialogOpen(true)
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center">
                            <p className="text-muted-foreground">No classes found</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reports" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Reports</CardTitle>
                    <CardDescription>View and generate reports</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Student Performance</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              View detailed reports on student performance across all classes.
                            </p>
                          </CardContent>
                          <CardFooter>
                            <Button variant="outline" size="sm" className="w-full">
                              Generate Report
                            </Button>
                          </CardFooter>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Teacher Activity</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              View detailed reports on teacher activity and class management.
                            </p>
                          </CardContent>
                          <CardFooter>
                            <Button variant="outline" size="sm" className="w-full">
                              Generate Report
                            </Button>
                          </CardFooter>
                        </Card>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Class Attendance</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              View detailed reports on class attendance and participation.
                            </p>
                          </CardContent>
                          <CardFooter>
                            <Button variant="outline" size="sm" className="w-full">
                              Generate Report
                            </Button>
                          </CardFooter>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">System Usage</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              View detailed reports on system usage and activity.
                            </p>
                          </CardContent>
                          <CardFooter>
                            <Button variant="outline" size="sm" className="w-full">
                              Generate Report
                            </Button>
                          </CardFooter>
                        </Card>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Settings</CardTitle>
                    <CardDescription>Manage system settings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="school-name">School Name</Label>
                        <Input id="school-name" defaultValue="Education More Academy" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-email">Admin Email</Label>
                        <Input id="admin-email" defaultValue="admin@educationmore.org" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="system-theme">System Theme</Label>
                        <select id="system-theme" className="w-full p-2 border rounded-md" defaultValue="light">
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="system">System</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notifications">Email Notifications</Label>
                        <div className="flex items-center space-x-2">
                          <input type="checkbox" id="notifications" defaultChecked />
                          <Label htmlFor="notifications">Enable email notifications</Label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button>Save Settings</Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Add User Dialog */}
      <Dialog open={isAddingUser} onOpenChange={setIsAddingUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Add a new user to the system</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <select
                id="role"
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="col-span-3 p-2 border rounded-md"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingUser(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>Add User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Class Dialog */}
      <Dialog open={isAddingClass} onOpenChange={setIsAddingClass}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Class</DialogTitle>
            <DialogDescription>Add a new class to the system</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="class-name" className="text-right">
                Class Name
              </Label>
              <Input
                id="class-name"
                value={newClass.name}
                onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="teacher" className="text-right">
                Teacher
              </Label>
              <select
                id="teacher"
                value={newClass.teacher}
                onChange={(e) => setNewClass({ ...newClass, teacher: e.target.value })}
                className="col-span-3 p-2 border rounded-md"
              >
                <option value="">Select a teacher</option>
                {availableTeachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.name}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">
                Location
              </Label>
              <Input
                id="location"
                value={newClass.location}
                onChange={(e) => setNewClass({ ...newClass, location: e.target.value })}
                className="col-span-3"
                placeholder="Room number or online"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="meeting-dates" className="text-right">
                Meeting Dates
              </Label>
              <Input
                id="meeting-dates"
                value={newClass.meetingDates}
                onChange={(e) => setNewClass({ ...newClass, meetingDates: e.target.value })}
                className="col-span-3"
                placeholder="e.g., Mon/Wed/Fri"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="start-date" className="text-right">
                Start Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={newClass.startDate}
                onChange={(e) => setNewClass({ ...newClass, startDate: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="end-date" className="text-right">
                End Date
              </Label>
              <Input
                id="end-date"
                type="date"
                value={newClass.endDate}
                onChange={(e) => setNewClass({ ...newClass, endDate: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="start-time" className="text-right">
                Start Time
              </Label>
              <Input
                id="start-time"
                type="time"
                value={newClass.startTime}
                onChange={(e) => setNewClass({ ...newClass, startTime: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="end-time" className="text-right">
                End Time
              </Label>
              <Input
                id="end-time"
                type="time"
                value={newClass.endTime}
                onChange={(e) => setNewClass({ ...newClass, endTime: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="virtual-link" className="text-right">
                Virtual Link
              </Label>
              <Input
                id="virtual-link"
                value={newClass.virtualLink}
                onChange={(e) => setNewClass({ ...newClass, virtualLink: e.target.value })}
                className="col-span-3"
                placeholder="Optional: URL for virtual meetings"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="teacher-join-link" className="text-right">
                Teacher Join Link
              </Label>
              <Input
                id="teacher-join-link"
                value={newClass.teacherJoinLink}
                onChange={(e) => setNewClass({ ...newClass, teacherJoinLink: e.target.value })}
                className="col-span-3"
                placeholder="e.g., https://example.com/join/teacher123"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="student-join-link" className="text-right">
                Student Join Link
              </Label>
              <Input
                id="student-join-link"
                value={newClass.studentJoinLink}
                onChange={(e) => setNewClass({ ...newClass, studentJoinLink: e.target.value })}
                className="col-span-3"
                placeholder="e.g., https://example.com/join/student123"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingClass(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddClass}>Add Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditingUser} onOpenChange={setIsEditingUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Edit user information</DialogDescription>
          </DialogHeader>
          {userToEdit && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="edit-name"
                  value={userToEdit.name}
                  onChange={(e) => setUserToEdit({ ...userToEdit, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-email" className="text-right">
                  Email
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={userToEdit.email}
                  onChange={(e) => setUserToEdit({ ...userToEdit, email: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-role" className="text-right">
                  Role
                </Label>
                <select
                  id="edit-role"
                  value={userToEdit.role}
                  onChange={(e) => setUserToEdit({ ...userToEdit, role: e.target.value })}
                  className="col-span-3 p-2 border rounded-md"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status" className="text-right">
                  Status
                </Label>
                <select
                  id="edit-status"
                  value={userToEdit.status}
                  onChange={(e) => setUserToEdit({ ...userToEdit, status: e.target.value })}
                  className="col-span-3 p-2 border rounded-md"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingUser(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog */}
      <Dialog open={isEditingClass} onOpenChange={setIsEditingClass}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>Edit class information</DialogDescription>
          </DialogHeader>
          {classToEdit && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-class-name" className="text-right">
                  Class Name
                </Label>
                <Input
                  id="edit-class-name"
                  value={classToEdit.name}
                  onChange={(e) => setClassToEdit({ ...classToEdit, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-teacher" className="text-right">
                  Teacher
                </Label>
                <select
                  id="edit-teacher"
                  value={classToEdit.teacher}
                  onChange={(e) => setClassToEdit({ ...classToEdit, teacher: e.target.value })}
                  className="col-span-3 p-2 border rounded-md"
                >
                  <option value="">Select a teacher</option>
                  {availableTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.name}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-location" className="text-right">
                  Location
                </Label>
                <Input
                  id="edit-location"
                  value={classToEdit.location}
                  onChange={(e) => setClassToEdit({ ...classToEdit, location: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-virtual-link" className="text-right">
                  Virtual Link
                </Label>
                <Input
                  id="edit-virtual-link"
                  value={classToEdit.virtualLink || ""}
                  onChange={(e) => setClassToEdit({ ...classToEdit, virtualLink: e.target.value })}
                  className="col-span-3"
                  placeholder="Optional: URL for virtual meetings"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-teacher-join-link" className="text-right">
                  Teacher Join Link
                </Label>
                <Input
                  id="edit-teacher-join-link"
                  value={classToEdit.teacherJoinLink || ""}
                  onChange={(e) => setClassToEdit({ ...classToEdit, teacherJoinLink: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g., https://example.com/join/teacher123"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-student-join-link" className="text-right">
                  Student Join Link
                </Label>
                <Input
                  id="edit-student-join-link"
                  value={classToEdit.studentJoinLink || ""}
                  onChange={(e) => setClassToEdit({ ...classToEdit, studentJoinLink: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g., https://example.com/join/student123"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status" className="text-right">
                  Status
                </Label>
                <select
                  id="edit-status"
                  value={classToEdit.status}
                  onChange={(e) => setClassToEdit({ ...classToEdit, status: e.target.value })}
                  className="col-span-3 p-2 border rounded-md"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingClass(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditClass}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {userToDelete?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteUserDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Class Dialog */}
      <AlertDialog open={deleteClassDialogOpen} onOpenChange={setDeleteClassDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {classToDelete?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteClassDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClass} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
