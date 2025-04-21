// A more robust storage solution that simulates server-side persistence
// This uses a combination of localStorage and sessionStorage with versioning

// Import existing types
import type { User, Class, ActivityLog } from "./storage"
import { getCurriculum, updateCurriculum as updateSupabaseCurriculum } from "./supabase/curriculum"

// Constants
const STORAGE_VERSION = "1.0.0"
const STORAGE_PREFIX = "educationmore_"
const STORAGE_KEYS = {
  VERSION: `${STORAGE_PREFIX}version`,
  USERS: `${STORAGE_PREFIX}users`,
  CLASSES: `${STORAGE_PREFIX}classes`,
  ACTIVITY_LOGS: `${STORAGE_PREFIX}activity_logs`,
  LAST_SYNC: `${STORAGE_PREFIX}last_sync`,
}

// Initial data
const initialUsers: User[] = [
  {
    id: "admin_1",
    name: "Dylan Sood",
    email: "dylan.sood@educationmore.org",
    password: "admin123",
    role: "admin",
    status: "active",
    avatar: "DS",
    classes: [],
  },
  {
    id: "teacher_1",
    name: "Jane Doe",
    email: "jane.doe@example.com",
    password: "password",
    role: "teacher",
    status: "active",
    avatar: "JD",
    classes: [],
  },
  {
    id: "teacher_2",
    name: "Robert Johnson",
    email: "robert.johnson@example.com",
    password: "password",
    role: "teacher",
    status: "active",
    avatar: "RJ",
    classes: [],
  },
  {
    id: "teacher_3",
    name: "Sarah Wilson",
    email: "sarah.wilson@example.com",
    password: "password",
    role: "teacher",
    status: "active",
    avatar: "SW",
    classes: [],
  },
  {
    id: "student_1",
    name: "John Smith",
    email: "student@example.com",
    password: "password",
    role: "student",
    status: "active",
    avatar: "JS",
    classes: [],
  },
]

const initialClasses: Class[] = []

const initialActivityLogs: ActivityLog[] = [
  {
    id: "log_1",
    action: "New Teacher Account",
    details: "Created by Admin",
    timestamp: "2 hours ago",
    category: "User Management",
  },
  {
    id: "log_2",
    action: "Class Assignment",
    details: "5 students assigned to Mathematics 101",
    timestamp: "5 hours ago",
    category: "Class Management",
  },
  {
    id: "log_3",
    action: "System Update",
    details: "Grading module updated",
    timestamp: "Yesterday",
    category: "System",
  },
]

// PersistentStorage class
export class PersistentStorage {
  private users: User[] = []
  private classes: Class[] = []
  private activityLogs: ActivityLog[] = []
  private static instance: PersistentStorage
  private initialized = false
  private lastSyncTime = 0

  private constructor() {
    this.initialize()
  }

  public static getInstance(): PersistentStorage {
    if (!PersistentStorage.instance) {
      PersistentStorage.instance = new PersistentStorage()
    }
    return PersistentStorage.instance
  }

  // Initialize storage
  private initialize(): void {
    if (typeof window === "undefined") return

    console.log("Initializing persistent storage...")

    try {
      // Check storage version
      const storedVersion = localStorage.getItem(STORAGE_KEYS.VERSION)

      if (storedVersion !== STORAGE_VERSION) {
        console.log(`Storage version mismatch: ${storedVersion} vs ${STORAGE_VERSION}, resetting storage`)
        this.resetStorage()
      } else {
        this.loadFromStorage()
      }

      // Ensure critical data exists
      this.ensureCriticalData()

      this.initialized = true
      this.saveToStorage()
      console.log("Persistent storage initialized successfully")
    } catch (error) {
      console.error("Error initializing storage:", error)
      this.resetToDefaults()
    }
  }

  // Load data from storage
  private loadFromStorage(): void {
    try {
      // Load users
      const usersJson = localStorage.getItem(STORAGE_KEYS.USERS)
      if (usersJson) {
        this.users = JSON.parse(usersJson)
        console.log(`Loaded ${this.users.length} users from storage`)
      } else {
        this.users = [...initialUsers]
        console.log("No users in storage, using defaults")
      }

      // Load classes
      const classesJson = localStorage.getItem(STORAGE_KEYS.CLASSES)
      if (classesJson) {
        this.classes = JSON.parse(classesJson)
        // Ensure classes have enrolledStudents array
        this.classes = this.classes.map((cls) => ({
          ...cls,
          enrolledStudents: cls.enrolledStudents || [],
        }))
        console.log(`Loaded ${this.classes.length} classes from storage`)
      } else {
        this.classes = [...initialClasses]
        console.log("No classes in storage, using defaults")
      }

      // Load activity logs
      const logsJson = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS)
      if (logsJson) {
        this.activityLogs = JSON.parse(logsJson)
        console.log(`Loaded ${this.activityLogs.length} activity logs from storage`)
      } else {
        this.activityLogs = [...initialActivityLogs]
        console.log("No activity logs in storage, using defaults")
      }

      // Load last sync time
      const lastSyncJson = localStorage.getItem(STORAGE_KEYS.LAST_SYNC)
      if (lastSyncJson) {
        this.lastSyncTime = JSON.parse(lastSyncJson)
      }
    } catch (error) {
      console.error("Error loading from storage:", error)
      this.resetToDefaults()
    }
  }

  // Save data to storage
  private saveToStorage(): void {
    if (typeof window === "undefined") return

    try {
      // Save version
      localStorage.setItem(STORAGE_KEYS.VERSION, STORAGE_VERSION)

      // Save users
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.users))

      // Save classes
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(this.classes))

      // Save activity logs
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(this.activityLogs))

      // Save last sync time
      this.lastSyncTime = Date.now()
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, JSON.stringify(this.lastSyncTime))

      // Also store in sessionStorage for faster access
      sessionStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.users))
      sessionStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(this.classes))

      console.log("Data saved to storage successfully")
    } catch (error) {
      console.error("Error saving to storage:", error)
    }
  }

  // Reset storage to defaults
  private resetToDefaults(): void {
    this.users = [...initialUsers]
    this.classes = [...initialClasses]
    this.activityLogs = [...initialActivityLogs]
    this.saveToStorage()
    console.log("Storage reset to defaults")
  }

  // Reset storage completely
  private resetStorage(): void {
    if (typeof window === "undefined") return

    // Clear all storage keys
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    })

    // Set version
    localStorage.setItem(STORAGE_KEYS.VERSION, STORAGE_VERSION)

    // Reset to defaults
    this.resetToDefaults()
  }

  // Ensure critical data exists
  private ensureCriticalData(): void {
    // Ensure admin account exists
    if (!this.users.some((user) => user.email === "dylan.sood@educationmore.org")) {
      console.log("Adding default admin account")
      this.users.push({
        id: "admin_1",
        name: "Dylan Sood",
        email: "dylan.sood@educationmore.org",
        password: "admin123",
        role: "admin",
        status: "active",
        avatar: "DS",
        classes: [],
      })
    }

    // Ensure at least one teacher account exists
    if (!this.users.some((user) => user.role === "teacher")) {
      console.log("Adding default teacher account")
      this.users.push({
        id: "teacher_1",
        name: "Jane Doe",
        email: "jane.doe@example.com",
        password: "password",
        role: "teacher",
        status: "active",
        avatar: "JD",
        classes: [],
      })
    }
  }

  // Public methods

  // Ensure storage is initialized
  public ensureInitialized(): boolean {
    if (!this.initialized) {
      this.initialize()
    }
    return this.initialized
  }

  // Get all users
  public getAllUsers(): User[] {
    this.ensureInitialized()
    return [...this.users]
  }

  // Get user by ID
  public getUserById(id: string): User | undefined {
    this.ensureInitialized()
    return this.users.find((user) => user.id === id)
  }

  // Get user by email
  public getUserByEmail(email: string): User | undefined {
    if (!email) return undefined
    this.ensureInitialized()

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim()

    // Find user
    const user = this.users.find((user) => user.email.toLowerCase().trim() === normalizedEmail)

    console.log(`Looking for user with email: ${normalizedEmail}`)
    console.log(`Found user:`, user)

    return user
  }

  // Add user
  public addUser(userData: Omit<User, "id">): User {
    this.ensureInitialized()

    // Generate ID
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 9)
    const newId = `${userData.role}_${timestamp}_${randomStr}`

    // Create avatar initials
    const avatarInitials = userData.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()

    // Normalize email
    const normalizedEmail = userData.email.trim().toLowerCase()

    // Check if user exists
    const existingUser = this.getUserByEmail(normalizedEmail)
    if (existingUser) {
      throw new Error(`User with email ${normalizedEmail} already exists`)
    }

    // Create user
    const newUser: User = {
      id: newId,
      name: userData.name,
      email: normalizedEmail,
      password: userData.password,
      role: userData.role,
      status: "active",
      avatar: userData.avatar || avatarInitials,
      classes: userData.classes || [],
    }

    // Add user
    this.users.push(newUser)
    this.saveToStorage()

    console.log("New user created:", newUser)

    return newUser
  }

  // Update user
  public updateUser(id: string, userData: Partial<User>): User | undefined {
    this.ensureInitialized()

    const index = this.users.findIndex((user) => user.id === id)
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...userData }
      this.saveToStorage()
      return this.users[index]
    }

    return undefined
  }

  // Delete user
  public deleteUser(id: string): boolean {
    this.ensureInitialized()

    const initialLength = this.users.length
    this.users = this.users.filter((user) => user.id !== id)

    // Remove user from classes
    this.classes = this.classes.map((cls) => ({
      ...cls,
      enrolledStudents: cls.enrolledStudents ? cls.enrolledStudents.filter((studentId) => studentId !== id) : [],
      students: cls.enrolledStudents ? cls.enrolledStudents.filter((studentId) => studentId !== id).length : 0,
    }))

    this.saveToStorage()
    return this.users.length < initialLength
  }

  // Get all classes
  public getAllClasses(): Class[] {
    this.ensureInitialized()
    return [...this.classes]
  }

  // Get class by ID
  public getClassById(id: string): Class | undefined {
    this.ensureInitialized()
    return this.classes.find((cls) => cls.id === id)
  }

  // Add class
  public addClass(cls: Omit<Class, "id">): Class {
    this.ensureInitialized()

    // Generate ID
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 9)
    const newId = `class_${timestamp}_${randomStr}`

    // Create class
    const newClass = {
      ...cls,
      id: newId,
      enrolledStudents: cls.enrolledStudents || [],
      students: cls.enrolledStudents ? cls.enrolledStudents.length : 0,
    }

    // Add class
    this.classes.push(newClass)
    this.saveToStorage()

    return newClass
  }

  // Update class
  public updateClass(id: string, classData: Partial<Class>): Class | undefined {
    this.ensureInitialized()

    const index = this.classes.findIndex((cls) => cls.id === id)
    if (index !== -1) {
      // Update class
      this.classes[index] = {
        ...this.classes[index],
        ...classData,
        students: classData.enrolledStudents
          ? classData.enrolledStudents.length
          : this.classes[index].enrolledStudents
            ? this.classes[index].enrolledStudents.length
            : this.classes[index].students,
      }

      // Update teacher if changed
      if (classData.teacher && classData.teacher !== this.classes[index].teacher) {
        // Remove class from old teacher
        const oldTeacher = this.users.find((u) => u.name === this.classes[index].teacher)
        if (oldTeacher) {
          this.updateUser(oldTeacher.id, {
            classes: oldTeacher.classes.filter((c) => c !== id),
          })
        }

        // Add class to new teacher
        const newTeacher = this.users.find((u) => u.name === classData.teacher)
        if (newTeacher) {
          this.updateUser(newTeacher.id, {
            classes: [...newTeacher.classes, id],
          })
        }
      }

      this.saveToStorage()
      return this.classes[index]
    }

    return undefined
  }

  // Delete class
  public deleteClass(id: string): boolean {
    this.ensureInitialized()

    const initialLength = this.classes.length
    const classToDelete = this.classes.find((c) => c.id === id)

    if (classToDelete) {
      // Remove class from users
      this.users.forEach((user) => {
        if (user.classes.includes(id)) {
          this.updateUser(user.id, {
            classes: user.classes.filter((c) => c !== id),
          })
        }
      })
    }

    this.classes = this.classes.filter((cls) => cls.id !== id)
    this.saveToStorage()

    return this.classes.length < initialLength
  }

  // Enroll student
  public enrollStudent(classId: string, studentId: string): boolean {
    this.ensureInitialized()

    const classIndex = this.classes.findIndex((c) => c.id === classId)
    const student = this.getUserById(studentId)

    if (classIndex === -1 || !student || student.role !== "student") {
      return false
    }

    // Add student to class
    const enrolledStudents = this.classes[classIndex].enrolledStudents || []
    if (!enrolledStudents.includes(studentId)) {
      this.classes[classIndex] = {
        ...this.classes[classIndex],
        enrolledStudents: [...enrolledStudents, studentId],
        students: enrolledStudents.length + 1,
      }

      // Add class to student
      if (!student.classes.includes(classId)) {
        this.updateUser(studentId, {
          classes: [...student.classes, classId],
        })
      }

      this.saveToStorage()
      return true
    }

    return false
  }

  // Enroll student in class (alias for enrollStudent)
  public enrollStudentInClass(studentId: string, classId: string): boolean {
    return this.enrollStudent(classId, studentId)
  }

  // Unenroll student
  public unenrollStudent(classId: string, studentId: string): boolean {
    this.ensureInitialized()

    const classIndex = this.classes.findIndex((c) => c.id === classId)
    const student = this.getUserById(studentId)

    if (classIndex === -1 || !student) {
      return false
    }

    // Remove student from class
    const enrolledStudents = this.classes[classIndex].enrolledStudents || []
    if (enrolledStudents.includes(studentId)) {
      this.classes[classIndex] = {
        ...this.classes[classIndex],
        enrolledStudents: enrolledStudents.filter((id) => id !== studentId),
        students: enrolledStudents.filter((id) => id !== studentId).length,
      }

      // Remove class from student
      this.updateUser(studentId, {
        classes: student.classes.filter((c) => c !== classId),
      })

      this.saveToStorage()
      return true
    }

    return false
  }

  // Get activity logs
  public getActivityLogs(): ActivityLog[] {
    this.ensureInitialized()
    return [...this.activityLogs]
  }

  // Add activity log
  public addActivityLog(log: Omit<ActivityLog, "id">): ActivityLog {
    this.ensureInitialized()

    // Generate ID
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 9)
    const newId = `log_${timestamp}_${randomStr}`

    // Create log
    const newLog = { ...log, id: newId }

    // Add log
    this.activityLogs.unshift(newLog)
    this.saveToStorage()

    return newLog
  }

  // Save curriculum
  public saveCurriculum(classId: string, curriculum: any): boolean {
    if (typeof window === "undefined") return false

    try {
      // Save to localStorage
      localStorage.setItem(`${STORAGE_PREFIX}curriculum-${classId}`, JSON.stringify(curriculum))

      // Try to save to Supabase as well
      this.trySaveToSupabase(classId, curriculum)

      return true
    } catch (error) {
      console.error("Error saving curriculum:", error)
      return false
    }
  }

  // Try to save curriculum to Supabase
  private async trySaveToSupabase(classId: string, curriculum: any): Promise<void> {
    try {
      await updateSupabaseCurriculum(classId, curriculum)
    } catch (error) {
      console.warn("Failed to save curriculum to Supabase, using local storage only:", error)
    }
  }

  // Get curriculum
  public async getCurriculum(classId: string): Promise<any> {
    if (typeof window === "undefined") return null

    try {
      // Try to get from Supabase first
      try {
        const { data, error } = await getCurriculum(classId)
        if (!error && data) {
          // Also update local storage
          localStorage.setItem(`${STORAGE_PREFIX}curriculum-${classId}`, JSON.stringify(data))
          return data
        }
      } catch (supabaseError) {
        console.warn("Failed to get curriculum from Supabase, using local storage:", supabaseError)
      }

      // Fall back to local storage
      const curriculum = localStorage.getItem(`${STORAGE_PREFIX}curriculum-${classId}`)
      return curriculum ? JSON.parse(curriculum) : null
    } catch (error) {
      console.error("Error loading curriculum:", error)
      return null
    }
  }

  // Get curriculum by class ID
  public async getCurriculumByClassId(classId: string): Promise<any> {
    return this.getCurriculum(classId)
  }

  // Update curriculum
  public updateCurriculum(classId: string, curriculum: any): boolean {
    return this.saveCurriculum(classId, curriculum)
  }

  // Get current user from session
  public getCurrentUser(): any {
    if (typeof window === "undefined") return null

    try {
      const userJson = localStorage.getItem("currentUser")
      return userJson ? JSON.parse(userJson) : null
    } catch (error) {
      console.error("Error getting current user:", error)
      return null
    }
  }
}

// Create and export instance
export const persistentStorage = PersistentStorage.getInstance()

// Ensure storage is initialized on import
persistentStorage.ensureInitialized()
