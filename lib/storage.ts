// Storage service for client-side data management
import { persistentStorage } from "./persistentStorage"
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  listAll,
  StorageReference,
  FirebaseStorage
} from 'firebase/storage';
import { storage as firebaseStorage } from './firebase';
import { db } from './firebase';
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

// Types
export interface User {
  id: string
  name: string
  email: string
  password: string
  role: "student" | "teacher" | "admin"
  status?: "active" | "inactive"
  avatar?: string
  classes: string[]
}

export interface Class {
  id: string
  name: string
  teacher: string
  teacher_id?: string
  location?: string
  meetingDates?: string
  startDate?: string
  endDate?: string
  startTime?: string
  endTime?: string
  virtualLink?: string
  status?: string
  students: number
  enrolledStudents?: string[]
  subject?: string
  meeting_day?: string
}

export interface ActivityLog {
  id: string
  action: string
  details: string
  timestamp: string
  category: string
}

export interface Submission {
  id: string
  studentId: string
  classId: string
  assignmentId: string
  content: string
  status: "submitted" | "graded" | "returned"
  grade?: number
  feedback?: string
  submittedAt: string
  gradedAt?: string
}

export interface UploadResult {
  url: string;
  path: string;
}

export interface FileMetadata {
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

class StorageService {
  private users: User[] = []
  private classes: Class[] = []
  private activityLogs: ActivityLog[] = []

  async getUsers(): Promise<User[]> {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const loadedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      
      // Cache the users locally
      this.users = loadedUsers;
      console.log(`Loaded ${loadedUsers.length} users from Firestore`);
      return loadedUsers;
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  getUserById(id: string): User | undefined {
    // Try to find in the local cache first
    const localUser = this.users.find(user => user.id === id);
    if (localUser) return localUser;
    
    // If not found in cache, return from persistent storage
    return persistentStorage.getUserById(id);
  }

  getUserByEmail(email: string): User | undefined {
    // Try to find in the local cache first
    const localUser = this.users.find(user => user.email === email);
    if (localUser) return localUser;
    
    // If not found in cache, return from persistent storage
    return persistentStorage.getUserByEmail(email);
  }

  async addUser(userData: Omit<User, "id">): Promise<User> {
    try {
      // Generate avatar initials
      const avatarInitials = userData.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();
        
      // Add status and avatar if not provided
      const enhancedUserData = {
        ...userData,
        status: userData.status || 'active',
        avatar: userData.avatar || avatarInitials,
        classes: userData.classes || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Add to Firestore
      const usersRef = collection(db, 'users');
      const docRef = await addDoc(usersRef, enhancedUserData);
      const newUser = { id: docRef.id, ...enhancedUserData } as User;
      
      // Update local cache
      this.users.push(newUser);
      
      // Also add to persistent storage as backup
      try {
        persistentStorage.addUser(enhancedUserData);
      } catch (e) {
        console.log('User already exists in persistent storage or other error:', e);
      }
      
      console.log('User added successfully:', newUser);
      return newUser;
    } catch (error) {
      console.error('Error adding user:', error);
      throw error;
    }
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User | undefined> {
    try {
      // Update in Firestore
      const userRef = doc(db, 'users', id);
      
      // Add updatedAt timestamp
      const updatedData = {
        ...userData,
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(userRef, updatedData);
      
      // Update local cache
      const index = this.users.findIndex(user => user.id === id);
      if (index !== -1) {
        this.users[index] = { ...this.users[index], ...updatedData };
      }
      
      // Also update in persistent storage
      persistentStorage.updateUser(id, updatedData);
      
      console.log('User updated successfully:', id);
      return this.users[index];
    } catch (error) {
      console.error('Error updating user:', error);
      return persistentStorage.updateUser(id, userData);
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      // Delete from Firestore
      const userRef = doc(db, 'users', id);
      await deleteDoc(userRef);
      
      // Update local cache
      const initialLength = this.users.length;
      this.users = this.users.filter(user => user.id !== id);
      
      // Also delete from persistent storage
      persistentStorage.deleteUser(id);
      
      console.log('User deleted successfully:', id);
      return this.users.length < initialLength;
    } catch (error) {
      console.error('Error deleting user:', error);
      return persistentStorage.deleteUser(id);
    }
  }

  // Classes
  async getClasses(): Promise<Class[]> {
    try {
      // Try to get classes from Supabase first
      const { data: classes, error } = await supabase.from("classes").select("*")

      if (!error && classes && classes.length > 0) {
        console.log(`Retrieved ${classes.length} classes from Supabase`)

        // Get teacher names for each class
        const classesWithTeachers = await Promise.all(
          classes.map(async (cls) => {
            let teacherName = "Unknown Teacher"

            if (cls.teacher_id) {
              const { data: teacher } = await supabase.from("users").select("name").eq("id", cls.teacher_id).single()

              if (teacher) {
                teacherName = teacher.name
              }
            }

            // Get enrollments for this class
            const { data: enrollments } = await supabase
              .from("class_enrollments")
              .select("student_id")
              .eq("class_id", cls.id)

            const enrolledStudents = enrollments?.map((e) => e.student_id) || []

            return {
              id: cls.id,
              name: cls.name,
              teacher: teacherName,
              teacher_id: cls.teacher_id,
              location: cls.location || "",
              meetingDates: cls.meeting_day || "",
              startDate: cls.start_date || "",
              endDate: cls.end_date || "",
              startTime: cls.start_time || "",
              endTime: cls.end_time || "",
              virtualLink: cls.virtual_link || "",
              status: cls.status || "active",
              students: enrolledStudents.length,
              enrolledStudents: enrolledStudents,
              subject: cls.subject || "",
              meeting_day: cls.meeting_day || "",
            }
          }),
        )

        return classesWithTeachers
      }
    } catch (err) {
      console.error("Error fetching classes from Supabase:", err)
    }

    // Fall back to local storage
    return persistentStorage.getAllClasses()
  }

  getClassById(id: string): Class | undefined {
    return persistentStorage.getClassById(id)
  }

  addClass(classData: Omit<Class, "id">): Class {
    return persistentStorage.addClass(classData)
  }

  updateClass(id: string, classData: Partial<Class>): Class | undefined {
    return persistentStorage.updateClass(id, classData)
  }

  deleteClass(id: string): boolean {
    return persistentStorage.deleteClass(id)
  }

  // Enrollment
  enrollStudent(classId: string, studentId: string): boolean {
    return persistentStorage.enrollStudent(classId, studentId)
  }

  unenrollStudent(classId: string, studentId: string): boolean {
    return persistentStorage.unenrollStudent(classId, studentId)
  }

  // Activity Logs
  getActivityLogs(): ActivityLog[] {
    return persistentStorage.getActivityLogs()
  }

  addActivityLog(log: Omit<ActivityLog, "id">): ActivityLog {
    return persistentStorage.addActivityLog(log)
  }

  // Curriculum
  async getCurriculum(classId: string): Promise<any> {
    return persistentStorage.getCurriculum(classId)
  }

  saveCurriculum(classId: string, curriculum: any): boolean {
    return persistentStorage.saveCurriculum(classId, curriculum)
  }

  updateCurriculum(classId: string, curriculum: any): boolean {
    return persistentStorage.updateCurriculum(classId, curriculum)
  }
}

export const storageService = new StorageService()

/**
 * Upload a file to Firebase Storage
 * @param file The file to upload
 * @param path The path where the file should be stored (e.g., 'assignments/course123/')
 * @returns Promise with the download URL and storage path
 */
export const uploadFile = async (
  file: File,
  path: string
): Promise<UploadResult> => {
  try {
    const storageRef = ref(firebaseStorage, `${path}${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return { url, path: snapshot.ref.fullPath };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Get the download URL for a file
 * @param path The storage path of the file
 * @returns Promise with the download URL
 */
export const getFileUrl = async (path: string): Promise<string> => {
  try {
    const storageRef = ref(firebaseStorage, path);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw error;
  }
};

/**
 * Delete a file from Firebase Storage
 * @param path The storage path of the file to delete
 * @returns Promise that resolves when the file is deleted
 */
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(firebaseStorage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

/**
 * List all files in a directory
 * @param path The directory path to list
 * @returns Promise with an array of file references
 */
export const listFiles = async (path: string): Promise<StorageReference[]> => {
  try {
    const storageRef = ref(firebaseStorage, path);
    const result = await listAll(storageRef);
    return result.items;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
};

/**
 * Get file metadata
 * @param file The file to get metadata for
 * @returns FileMetadata object
 */
export const getFileMetadata = (file: File): FileMetadata => {
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified
  };
};
