// A more robust storage solution that simulates server-side persistence
// This uses a combination of localStorage and sessionStorage with versioning

// Import existing types
import type { User, Class, ActivityLog } from "./storage"
import { db } from "./firebase"
import { collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc } from "firebase/firestore"

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
  public async updateClass(id: string, classData: Partial<Class>): Promise<Class | undefined> {
    try {
      this.ensureInitialized()
      console.log("PersistentStorage: Updating class:", id)

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
          try {
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
          } catch (teacherUpdateError) {
            console.error("Error updating teacher assignments:", teacherUpdateError)
            // Continue with class update even if teacher update fails
          }
        }

        // Save to storage
        this.saveToStorage()
        console.log("PersistentStorage: Class updated successfully:", this.classes[index])
        return this.classes[index]
      } else {
        // Try to fetch the class if it doesn't exist in our local array
        console.warn("PersistentStorage: Class not found locally, trying to fetch it: ", id)
        
        // Check if the class exists in localStorage directly
        const classJson = localStorage.getItem(`${STORAGE_PREFIX}class_${id}`)
        if (classJson) {
          try {
            // Parse the class from localStorage
            const foundClass = JSON.parse(classJson) as Class
            console.log("PersistentStorage: Found class in localStorage:", foundClass)
            
            // Update it with the new data
            const updatedClass = {
              ...foundClass,
              ...classData,
              students: classData.enrolledStudents 
                ? classData.enrolledStudents.length 
                : foundClass.enrolledStudents
                  ? foundClass.enrolledStudents.length
                  : foundClass.students
            }
            
            // Add it to our classes array
            this.classes.push(updatedClass)
            
            // Save everything
            this.saveToStorage()
            
            console.log("PersistentStorage: Class added and updated successfully:", updatedClass)
            return updatedClass
          } catch (parseError) {
            console.error("PersistentStorage: Error parsing class from localStorage:", parseError)
          }
        }
        
        console.warn("PersistentStorage: Class not found for update:", id)
        return undefined
      }
    } catch (error) {
      console.error("PersistentStorage: Error updating class:", error)
      return undefined
    }
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
      console.error(`PersistentStorage: Cannot enroll student - Class ${classId} not found or student ${studentId} is not valid`)
      return false
    }

    // Add student to class
    const enrolledStudents = this.classes[classIndex].enrolledStudents || []
    if (!enrolledStudents.includes(studentId)) {
      // Update the class with the new enrolled student
      this.classes[classIndex] = {
        ...this.classes[classIndex],
        enrolledStudents: [...enrolledStudents, studentId],
        students: enrolledStudents.length + 1, // Update the count
      }

      // Add class to student
      if (!student.classes.includes(classId)) {
        const updatedStudent = {
          ...student,
          classes: [...student.classes, classId],
        }
        // Use the proper update method to ensure consistency
        this.updateUser(studentId, updatedStudent)
      }

      // Save everything to storage
      this.saveToStorage()
      console.log(`PersistentStorage: Successfully enrolled student ${studentId} in class ${classId}`)
      return true
    }

    console.log(`PersistentStorage: Student ${studentId} is already enrolled in class ${classId}`)
    return true // Already enrolled is considered a success
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
      console.error(`PersistentStorage: Cannot unenroll student - Class ${classId} not found or student ${studentId} is not valid`)
      return false
    }

    // Remove student from class
    const enrolledStudents = this.classes[classIndex].enrolledStudents || []
    if (enrolledStudents.includes(studentId)) {
      // Update the class by removing the student
      const updatedEnrolledStudents = enrolledStudents.filter((id) => id !== studentId)
      this.classes[classIndex] = {
        ...this.classes[classIndex],
        enrolledStudents: updatedEnrolledStudents,
        students: updatedEnrolledStudents.length, // Update the count
      }

      // Remove class from student if it exists in their classes array
      if (student.classes.includes(classId)) {
        const updatedStudent = {
          ...student,
          classes: student.classes.filter((c) => c !== classId),
        }
        // Use the proper update method to ensure consistency
        this.updateUser(studentId, updatedStudent)
      }

      // Save everything to storage
      this.saveToStorage()
      console.log(`PersistentStorage: Successfully unenrolled student ${studentId} from class ${classId}`)
      return true
    }

    console.log(`PersistentStorage: Student ${studentId} is not enrolled in class ${classId}`)
    return true // Not being enrolled is considered a success for unenrollment
  }

  // Get activity logs - completely safe, always returns an immutable array
  public getActivityLogs(): ActivityLog[] {
    try {
      this.ensureInitialized();
      
      // Create a safe fallback array first
      const safeFallback: ActivityLog[] = [{
        id: "log_safe_fallback",
        action: "System Initialized",
        details: "Safe log created",
        timestamp: new Date().toISOString(),
        category: "System"
      }];
      
      // Check if activityLogs exists and is an array
      if (Array.isArray(this.activityLogs)) {
        // Additional validation to ensure each log is valid
        const validatedLogs = this.activityLogs.filter(log => 
          log && 
          typeof log === 'object' && 
          typeof log.id === 'string' &&
          typeof log.action === 'string'
        );
        
        if (validatedLogs.length > 0) {
          // Return a completely new array (freeze only for external use)
          return [...validatedLogs];
        }
      }
      
      // Reset activityLogs if it's not valid
      console.log("Activity logs were invalid, resetting to defaults");
      
      // Ensure initialActivityLogs is valid too
      if (Array.isArray(initialActivityLogs) && initialActivityLogs.length > 0) {
        // Create a new copy for internal use (mutable)
        this.activityLogs = [...initialActivityLogs];
        this.saveToStorage();
        return [...initialActivityLogs]; // Return a new copy
      } else {
        console.log("Initial activity logs data is also invalid, creating fallback logs");
        const fallbackLogs: ActivityLog[] = [{
          id: "log_fallback_1",
          action: "System Initialized",
          details: "Default logs created",
          timestamp: new Date().toISOString(),
          category: "System"
        }];
        
        this.activityLogs = [...fallbackLogs];
        this.saveToStorage();
        return [...fallbackLogs]; // Return a new copy
      }
    } catch (error) {
      console.error("Critical error getting activity logs:", error);
      // Create a safe fallback for this error case
      const errorFallback: ActivityLog[] = [{
        id: "log_error_fallback",
        action: "Error Recovery",
        details: "Created during error recovery",
        timestamp: new Date().toISOString(),
        category: "System Error"
      }];
      return [...errorFallback]; // Return a new copy of the error fallback
    }
  }

  // Add activity log with extensive validation
  public addActivityLog(log: Omit<ActivityLog, "id">): ActivityLog {
    try {
      this.ensureInitialized();
      
      // Validate log object
      if (!log || typeof log !== 'object') {
        throw new Error("Invalid activity log object");
      }
      
      // Generate ID
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 9);
      const newId = `log_${timestamp}_${randomStr}`;
      
      // Create log with defaults for missing properties
      const newLog = { 
        id: newId,
        action: log.action || "Unknown Action",
        details: log.details || "",
        timestamp: log.timestamp || new Date().toISOString(),
        category: log.category || "System" 
      };
      
      // Ensure activityLogs is initialized as an array
      if (!Array.isArray(this.activityLogs)) {
        console.log("Activity logs was not an array, initializing empty array");
        this.activityLogs = [];
      }
      
      // Add log to the beginning of the array
      this.activityLogs.unshift(newLog);
      
      // Trim array if it gets too long (optional)
      if (this.activityLogs.length > 100) {
        this.activityLogs = this.activityLogs.slice(0, 100);
      }
      
      // Save to storage
      try {
        this.saveToStorage();
      } catch (e) {
        console.error("Error saving logs to storage:", e);
      }
      
      return newLog;
    } catch (error) {
      console.error("Error adding activity log:", error);
      
      // Create a fallback log
      const fallbackLog = {
        id: `log_fallback_${Date.now()}`,
        action: log?.action || "Failed Log Creation",
        details: log?.details || "Error occurred while creating log",
        timestamp: new Date().toISOString(),
        category: log?.category || "Error"
      };
      
      // Try to add the fallback log
      try {
        if (Array.isArray(this.activityLogs)) {
          this.activityLogs.unshift(fallbackLog);
          this.saveToStorage();
        }
      } catch (e) {
        console.error("Failed to save fallback log:", e);
      }
      
      return fallbackLog;
    }
  }

  // Save curriculum
  public async saveCurriculum(classId: string, curriculum: any): Promise<boolean> {
    try {
      console.log(`PersistentStorage: Saving curriculum for class ${classId}`);
      
      if (!classId) {
        console.error("PersistentStorage: Invalid classId for saveCurriculum");
        return false;
      }
      
      // First check if the class exists
      const classData = this.getClassById(classId);
      if (!classData) {
        console.warn(`PersistentStorage: Saving curriculum for non-existent class ${classId}`);
        // Continue anyway - we'll still save the curriculum data
      }
      
      // Prepare curriculum data with timestamps
      const curriculumData = {
        ...curriculum,
        lastUpdated: new Date().toISOString()
      };
      
      // 1. Try to update in Firebase
      let firebaseSuccess = false;
      try {
        const curriculumRef = collection(db, "curriculum");
        const q = query(curriculumRef, where("classId", "==", classId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot && querySnapshot.docs && Array.isArray(querySnapshot.docs) && querySnapshot.docs.length > 0) {
          const docRef = doc(db, "curriculum", querySnapshot.docs[0].id);
          await updateDoc(docRef, {
            content: curriculumData,
            lastUpdated: new Date().toISOString()
          });
          firebaseSuccess = true;
        } else {
          await addDoc(curriculumRef, {
            classId,
            content: curriculumData,
            lastUpdated: new Date().toISOString()
          });
          firebaseSuccess = true;
        }
        console.log(`PersistentStorage: Successfully saved curriculum to Firebase for class ${classId}`);
      } catch (firestoreError) {
        console.error("PersistentStorage: Error saving curriculum to Firebase:", firestoreError);
        // Continue with other storage methods
      }
      
      // 2. Always save to localStorage, even if Firebase was successful
      try {
        const storageKey = `${STORAGE_PREFIX}curriculum_${classId}`;
        localStorage.setItem(storageKey, JSON.stringify(curriculumData));
        console.log(`PersistentStorage: Saved curriculum to localStorage for class ${classId}`);
        return true;
      } catch (localError) {
        console.error("PersistentStorage: Error saving curriculum to localStorage:", localError);
        // Return true if we at least saved to Firebase
        return firebaseSuccess;
      }
    } catch (error) {
      console.error("PersistentStorage: Critical error in saveCurriculum:", error);
      
      // Last resort - try direct localStorage
      try {
        const storageKey = `${STORAGE_PREFIX}curriculum_${classId}`;
        localStorage.setItem(storageKey, JSON.stringify(curriculum));
        return true;
      } catch (e) {
        console.error("PersistentStorage: All curriculum save methods failed");
        return false;
      }
    }
  }

  // Get curriculum
  public async getCurriculum(classId: string): Promise<any> {
    try {
      console.log(`PersistentStorage: Getting curriculum for class ${classId}`);
      
      if (!classId) {
        console.error("PersistentStorage: Invalid classId for getCurriculum");
        return null;
      }
      
      // 1. First try to get from Firebase
      try {
        const curriculumRef = collection(db, "curriculum");
        const q = query(curriculumRef, where("classId", "==", classId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot && querySnapshot.docs && Array.isArray(querySnapshot.docs) && querySnapshot.docs.length > 0) {
          const data = querySnapshot.docs[0].data();
          if (data && data.content) {
            console.log(`PersistentStorage: Found curriculum in Firebase for class ${classId}`);
            return data.content;
          }
        }
      } catch (firestoreError) {
        console.warn("PersistentStorage: Error fetching curriculum from Firebase:", firestoreError);
      }
      
      // 2. Try localStorage
      try {
        const storageKey = `${STORAGE_PREFIX}curriculum_${classId}`;
        const curriculumJson = localStorage.getItem(storageKey);
        
        if (curriculumJson) {
          const parsedData = JSON.parse(curriculumJson);
          console.log(`PersistentStorage: Found curriculum in localStorage for class ${classId}`);
          return parsedData;
        }
      } catch (localError) {
        console.warn("PersistentStorage: Error fetching curriculum from localStorage:", localError);
      }
      
      // 3. Try alternate storage key pattern as last resort
      try {
        const altKey = `curriculum_${classId}`;
        const altData = localStorage.getItem(altKey);
        
        if (altData) {
          const parsedAltData = JSON.parse(altData);
          console.log(`PersistentStorage: Found curriculum in localStorage with alternate key for class ${classId}`);
          return parsedAltData;
        }
      } catch (altError) {
        console.warn("PersistentStorage: Error fetching curriculum with alternate key:", altError);
      }
      
      console.log(`PersistentStorage: No curriculum found for class ${classId}`);
      return null;
    } catch (error) {
      console.error("PersistentStorage: Critical error in getCurriculum:", error);
      return null;
    }
  }

  // Get curriculum by class ID
  public async getCurriculumByClassId(classId: string): Promise<any> {
    return this.getCurriculum(classId)
  }

  // Update curriculum
  public async updateCurriculum(classId: string, curriculum: any): Promise<boolean> {
    try {
      console.log(`PersistentStorage: Updating curriculum for class ${classId}`);
      
      if (!classId) {
        console.error("PersistentStorage: Invalid classId for updateCurriculum");
        return false;
      }
      
      // First check if the class exists
      const classData = this.getClassById(classId);
      if (!classData) {
        console.warn(`PersistentStorage: Updating curriculum for non-existent class ${classId}`);
        // Continue anyway - we'll still update the curriculum data
      }
      
      // First get existing curriculum to merge with
      let existingCurriculum = null;
      try {
        existingCurriculum = await this.getCurriculum(classId);
      } catch (getError) {
        console.warn("PersistentStorage: Could not retrieve existing curriculum:", getError);
      }
      
      // Prepare updated curriculum
      const updatedCurriculum = existingCurriculum 
        ? { ...existingCurriculum, ...curriculum, lastUpdated: new Date().toISOString() }
        : { ...curriculum, lastUpdated: new Date().toISOString() };
      
      // 1. Try to update in Firebase
      let firebaseSuccess = false;
      try {
        const curriculumRef = collection(db, "curriculum");
        const q = query(curriculumRef, where("classId", "==", classId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot && querySnapshot.docs && Array.isArray(querySnapshot.docs) && querySnapshot.docs.length > 0) {
          const docRef = doc(db, "curriculum", querySnapshot.docs[0].id);
          await updateDoc(docRef, {
            content: updatedCurriculum,
            lastUpdated: new Date().toISOString()
          });
          firebaseSuccess = true;
        } else {
          // No existing record - create a new one
          await addDoc(curriculumRef, {
            classId,
            content: updatedCurriculum,
            lastUpdated: new Date().toISOString()
          });
          firebaseSuccess = true;
        }
        console.log(`PersistentStorage: Successfully updated curriculum in Firebase for class ${classId}`);
      } catch (firestoreError) {
        console.error("PersistentStorage: Error updating curriculum in Firebase:", firestoreError);
        // Continue with localStorage
      }
      
      // 2. Always update in localStorage, even if Firebase was successful
      try {
        const storageKey = `${STORAGE_PREFIX}curriculum_${classId}`;
        localStorage.setItem(storageKey, JSON.stringify(updatedCurriculum));
        
        // Also update with alternate key pattern for compatibility
        localStorage.setItem(`curriculum_${classId}`, JSON.stringify(updatedCurriculum));
        
        console.log(`PersistentStorage: Updated curriculum in localStorage for class ${classId}`);
        return true;
      } catch (localError) {
        console.error("PersistentStorage: Error updating curriculum in localStorage:", localError);
        // Return true if we at least updated in Firebase
        return firebaseSuccess;
      }
    } catch (error) {
      console.error("PersistentStorage: Critical error in updateCurriculum:", error);
      
      // Last resort - try direct localStorage
      try {
        localStorage.setItem(`${STORAGE_PREFIX}curriculum_${classId}`, JSON.stringify(curriculum));
        localStorage.setItem(`curriculum_${classId}`, JSON.stringify(curriculum));
        return true;
      } catch (e) {
        console.error("PersistentStorage: All curriculum update methods failed");
        return false;
      }
    }
  }

  // Save published curriculum for a class
  public async savePublishedCurriculum(classId: string, publishedContent: any): Promise<boolean> {
    try {
      console.log(`PersistentStorage: Saving published curriculum for class ${classId}`);
      
      if (!classId) {
        console.error("PersistentStorage: Invalid classId for savePublishedCurriculum");
        return false;
      }
      
      // Prepare curriculum data with timestamps
      const curriculumData = {
        ...publishedContent,
        lastUpdated: new Date().toISOString()
      };
      
      // 1. Try to update in Firebase
      let firebaseSuccess = false;
      try {
        const publishedRef = collection(db, "published_curricula");
        const q = query(publishedRef, where("classId", "==", classId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot && querySnapshot.docs && Array.isArray(querySnapshot.docs) && querySnapshot.docs.length > 0) {
          const docRef = doc(db, "published_curricula", querySnapshot.docs[0].id);
          await updateDoc(docRef, {
            content: curriculumData.content,
            lastUpdated: new Date().toISOString()
          });
          firebaseSuccess = true;
        } else {
          await addDoc(publishedRef, {
            classId,
            content: curriculumData.content,
            lastUpdated: new Date().toISOString()
          });
          firebaseSuccess = true;
        }
        console.log(`PersistentStorage: Successfully saved published curriculum to Firebase for class ${classId}`);
      } catch (firestoreError) {
        console.error("PersistentStorage: Error saving published curriculum to Firebase:", firestoreError);
        // Continue with other storage methods
      }
      
      // 2. Always save to localStorage
      try {
        const publishedKey = `published-curriculum-${classId}`;
        localStorage.setItem(publishedKey, JSON.stringify(curriculumData.content));
        console.log(`PersistentStorage: Saved published curriculum to localStorage for class ${classId}`);
        return true;
      } catch (localError) {
        console.error("PersistentStorage: Error saving published curriculum to localStorage:", localError);
        // Return true if we at least saved to Firebase
        return firebaseSuccess;
      }
    } catch (error) {
      console.error("PersistentStorage: Critical error in savePublishedCurriculum:", error);
      
      // Last resort - try direct localStorage
      try {
        const publishedKey = `published-curriculum-${classId}`;
        localStorage.setItem(publishedKey, JSON.stringify(publishedContent.content));
        return true;
      } catch (e) {
        console.error("PersistentStorage: All published curriculum save methods failed");
        return false;
      }
    }
  }

  // Get published curriculum for a class
  public async getPublishedCurriculum(classId: string): Promise<any> {
    try {
      console.log(`PersistentStorage: Getting published curriculum for class ${classId}`);
      
      if (!classId) {
        console.error("PersistentStorage: Invalid classId for getPublishedCurriculum");
        return null;
      }
      
      // 1. First try to get from Firebase
      try {
        const publishedRef = collection(db, "published_curricula");
        const q = query(publishedRef, where("classId", "==", classId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot && querySnapshot.docs && Array.isArray(querySnapshot.docs) && querySnapshot.docs.length > 0) {
          const data = querySnapshot.docs[0].data();
          if (data && data.content) {
            console.log(`PersistentStorage: Found published curriculum in Firebase for class ${classId}`);
            return data.content;
          }
        }
      } catch (firestoreError) {
        console.warn("PersistentStorage: Error fetching published curriculum from Firebase:", firestoreError);
      }
      
      // 2. Try localStorage
      try {
        const publishedKey = `published-curriculum-${classId}`;
        const publishedData = localStorage.getItem(publishedKey);
        
        if (publishedData) {
          const parsedData = JSON.parse(publishedData);
          console.log(`PersistentStorage: Found published curriculum in localStorage for class ${classId}`);
          return parsedData;
        }
      } catch (localError) {
        console.warn("PersistentStorage: Error fetching published curriculum from localStorage:", localError);
      }
      
      console.log(`PersistentStorage: No published curriculum found for class ${classId}`);
      return null;
    } catch (error) {
      console.error("PersistentStorage: Critical error in getPublishedCurriculum:", error);
      return null;
    }
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
