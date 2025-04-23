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
import { storage as firebaseStorage, db } from './firebase';
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';

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
      console.log("Getting users from Firestore...")
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const loadedUsers = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          name: data.name || '', 
          email: data.email || '', 
          password: data.password || '', 
          role: data.role || 'student',
          status: data.status || 'active',
          avatar: data.avatar || '',
          classes: data.classes || []
        } as User;
      });
      
      // Cache the users locally
      this.users = loadedUsers;
      console.log(`Loaded ${loadedUsers.length} users from Firestore`, loadedUsers);
      return loadedUsers;
    } catch (error) {
      console.error('Error getting users:', error);
      // Fallback to localStorage
      const localUsers = persistentStorage.getAllUsers();
      console.log('Falling back to local storage users:', localUsers);
      this.users = localUsers;
      return localUsers;
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
      console.log("Adding user to Firestore:", userData);
      
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
      
      console.log('User created in Firestore with ID:', docRef.id);
      
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
      console.error('Error adding user to Firestore:', error);
      // Try to add to persistent storage as fallback
      try {
        const localUser = persistentStorage.addUser(userData);
        console.log('User added to local storage as fallback:', localUser);
        return localUser;
      } catch (e) {
        console.error('Failed to add user to local storage too:', e);
        throw error;
      }
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
      // Load from Firestore
      const classesRef = collection(db, 'classes');
      const snapshot = await getDocs(classesRef);
      
      if (snapshot.docs.length > 0) {
        console.log(`Retrieved ${snapshot.docs.length} classes from Firestore`);
        
        const classesWithData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            teacher: data.teacher || 'Unknown Teacher',
            location: data.location || '',
            meetingDates: data.meetingDates || '',
            startDate: data.startDate || '',
            endDate: data.endDate || '',
            startTime: data.startTime || '',
            endTime: data.endTime || '',
            virtualLink: data.virtualLink || '',
            status: data.status || 'active',
            students: data.students || 0,
            enrolledStudents: data.enrolledStudents || [],
            subject: data.subject || '',
            meeting_day: data.meeting_day || ''
          } as Class;
        });
        
        return classesWithData;
      }
    } catch (err) {
      console.error("Error fetching classes from Firestore:", err);
    }

    // Fall back to local storage
    const localClasses = persistentStorage.getAllClasses();
    console.log('Falling back to local storage classes:', localClasses);
    return localClasses;
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
export const storage = storageService // Export as 'storage' for backwards compatibility

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
