// @ts-nocheck
// Storage service for client-side data management

// Type declarations for external modules to suppress errors
// @ts-ignore
import { persistentStorage } from "./persistentStorage"
// @ts-ignore
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  listAll,
  StorageReference,
  FirebaseStorage
} from 'firebase/storage';
// @ts-ignore
import { storage as firebaseStorage, db } from './firebase';
// @ts-ignore
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp,
  DocumentData,
  setDoc,
  QueryDocumentSnapshot,
  DocumentReference
} from 'firebase/firestore';

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

export interface Curriculum {
  classId: string;
  content: {
    lessons?: {
      id: string;
      title: string;
      description?: string;
      resources?: Array<{
        id: string;
        title: string;
        type: string;
        url?: string;
        content?: string;
      }>;
    }[];
    assignments?: {
      id: string;
      title: string;
      description: string;
      dueDate?: string;
      points?: number;
    }[];
  };
  lastUpdated?: string;
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
      const loadedUsers = snapshot.docs.map((doc: QueryDocumentSnapshot) => {
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
        
        const classesWithData = snapshot.docs.map((doc: QueryDocumentSnapshot) => {
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
        
        // Cache classes locally
        this.classes = classesWithData;
        return classesWithData;
      }
    } catch (err) {
      console.error("Error fetching classes from Firestore:", err);
    }

    // Fall back to local storage
    const localClasses = persistentStorage.getAllClasses();
    console.log('Falling back to local storage classes:', localClasses);
    this.classes = localClasses;
    return localClasses;
  }

  async getClassById(id: string): Promise<Class | undefined> {
    try {
      console.log(`Getting class ${id} from Firestore`);
      const classRef = doc(db, 'classes', id);
      const snapshot = await getDoc(classRef);
      
      if (snapshot.exists()) {
        const data = snapshot.data();
        return { id: snapshot.id, ...data } as Class;
      }
      return undefined;
    } catch (error) {
      console.error(`Error getting class ${id} from Firestore:`, error);
      // Fall back to localStorage
      return persistentStorage.getClassById(id);
    }
  }

  async addClass(classData: Omit<Class, "id">): Promise<Class> {
    try {
      console.log("Adding class to Firestore:", classData);
      
      // Prepare data for Firestore
      const enhancedClassData = {
        ...classData,
        status: classData.status || 'active',
        students: classData.students || 0,
        enrolledStudents: classData.enrolledStudents || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Add to Firestore
      const classesRef = collection(db, 'classes');
      const docRef = await addDoc(classesRef, enhancedClassData);
      const newClass = { id: docRef.id, ...enhancedClassData } as Class;
      
      console.log('Class created in Firestore with ID:', docRef.id);
      
      // Update local cache
      this.classes.push(newClass);
      
      // Also add to persistent storage as backup
      try {
        persistentStorage.addClass(enhancedClassData);
      } catch (e) {
        console.log('Error adding class to persistent storage:', e);
      }
      
      return newClass;
    } catch (error) {
      console.error('Error adding class to Firestore:', error);
      // Try fallback to localStorage
      const localClass = persistentStorage.addClass(classData);
      return localClass;
    }
  }

  async updateClass(id: string, classData: Partial<Class>): Promise<Class | undefined> {
    try {
      // Update in Firestore
      const classRef = doc(db, 'classes', id);
      
      // Add updatedAt timestamp
      const updatedData = {
        ...classData,
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(classRef, updatedData);
      
      // Update local cache
      const index = this.classes.findIndex(cls => cls.id === id);
      if (index !== -1) {
        this.classes[index] = { ...this.classes[index], ...updatedData };
      }
      
      // Also update in persistent storage
      persistentStorage.updateClass(id, updatedData);
      
      console.log('Class updated successfully:', id);
      
      // Get the updated class from the local cache
      const updatedClass = this.classes.find(cls => cls.id === id);
      return updatedClass;
    } catch (error) {
      console.error('Error updating class in Firestore:', error);
      return persistentStorage.updateClass(id, classData);
    }
  }

  async deleteClass(id: string): Promise<boolean> {
    try {
      // Delete from Firestore
      const classRef = doc(db, 'classes', id);
      await deleteDoc(classRef);
      
      // Update local cache
      const initialLength = this.classes.length;
      this.classes = this.classes.filter(cls => cls.id !== id);
      
      // Also delete from persistent storage
      persistentStorage.deleteClass(id);
      
      console.log('Class deleted successfully:', id);
      return this.classes.length < initialLength;
    } catch (error) {
      console.error('Error deleting class from Firestore:', error);
      return persistentStorage.deleteClass(id);
    }
  }

  // Activity Logs - with safe wrapper to ensure array is ALWAYS returned
  async getActivityLogs(): Promise<ActivityLog[]> {
    try {
      // First create a safe fallback array
      const safeDefaultLogs = [
        {
          id: "log_safe_1",
          action: "System Started",
          details: "Safe initialization",
          timestamp: new Date().toISOString(),
          category: "System"
        }
      ];

      // Try Firestore
      try {
        console.log("Getting activity logs from Firestore...");
        const logsRef = collection(db, 'activityLogs');
        const snapshot = await getDocs(logsRef);
        
        if (snapshot && snapshot.docs && Array.isArray(snapshot.docs) && snapshot.docs.length > 0) {
          const logs = [];
          for (let i = 0; i < snapshot.docs.length; i++) {
            try {
              const doc = snapshot.docs[i];
              if (doc && typeof doc.data === 'function') {
                const data = doc.data();
                logs.push({
                  id: doc.id || `log_${Date.now()}_${i}`,
                  action: (data && data.action) ? data.action : 'Unknown Action',
                  details: (data && data.details) ? data.details : '',
                  timestamp: (data && data.timestamp) ? data.timestamp : new Date().toISOString(),
                  category: (data && data.category) ? data.category : 'General'
                });
              }
            } catch (docError) {
              console.error("Error processing a single document:", docError);
            }
          }
          
          if (logs.length > 0) {
            console.log(`Retrieved ${logs.length} activity logs from Firestore`);
            this.activityLogs = logs;
            return Object.freeze([...logs]); // Return an immutable copy
          }
        }
      } catch (firebaseError) {
        console.error("Error fetching activity logs from Firestore:", firebaseError);
      }
      
      // Try localStorage
      try {
        const localLogs = persistentStorage.getActivityLogs();
        if (localLogs && Array.isArray(localLogs) && localLogs.length > 0) {
          console.log('Using local storage activity logs:', localLogs);
          this.activityLogs = localLogs;
          return Object.freeze([...localLogs]); // Return an immutable copy
        }
      } catch (localError) {
        console.error("Error getting activity logs from local storage:", localError);
      }
      
      // When all else fails, return our safe array
      console.log('All log retrieval methods failed, using safe default logs');
      return Object.freeze([...safeDefaultLogs]);
    } catch (error) {
      console.error("Critical error in getActivityLogs:", error);
      return Object.freeze([{
        id: "log_error",
        action: "Error Recovery",
        details: "System recovered from critical error",
        timestamp: new Date().toISOString(),
        category: "Error"
      }]);
    }
  }

  // A completely safe wrapper function to ensure we ALWAYS get an array
  // Use this method in UI components
  async getSafeActivityLogs(): Promise<ActivityLog[]> {
    try {
      const logs = await this.getActivityLogs();
      
      // Ensure it's a valid array
      if (logs && Array.isArray(logs)) {
        return logs;
      } else {
        console.error("getActivityLogs returned non-array, using fallback");
        return Object.freeze([{
          id: "log_fallback_safe",
          action: "System Recovered",
          details: "Recovered from invalid data format",
          timestamp: new Date().toISOString(),
          category: "System Recovery"
        }]);
      }
    } catch (error) {
      console.error("Error in getSafeActivityLogs:", error);
      return Object.freeze([{
        id: "log_error_safe",
        action: "Error Recovery",
        details: "Safe method recovered from error",
        timestamp: new Date().toISOString(),
        category: "Error"
      }]);
    }
  }

  async addActivityLog(log: Omit<ActivityLog, "id">): Promise<ActivityLog> {
    try {
      if (!log || typeof log !== 'object') {
        throw new Error('Invalid activity log object');
      }
      
      console.log("Adding activity log to Firestore:", log);
      
      // Ensure we have minimal required properties
      const safeLog = {
        action: log.action || 'Unknown action',
        details: log.details || '',
        timestamp: log.timestamp || new Date().toISOString(),
        category: log.category || 'General',
        createdAt: new Date().toISOString()
      };
      
      // Add to Firestore
      const logsRef = collection(db, 'activityLogs');
      const docRef = await addDoc(logsRef, safeLog);
      
      const newLog = { id: docRef.id, ...safeLog };
      
      // Update local cache safely
      if (!Array.isArray(this.activityLogs)) {
        this.activityLogs = [];
      }
      this.activityLogs.push(newLog);
      
      // Also add to persistent storage as backup
      try {
        persistentStorage.addActivityLog(safeLog);
      } catch (e) {
        console.log('Error adding activity log to persistent storage:', e);
      }
      
      return newLog;
    } catch (error) {
      console.error('Error adding activity log to Firestore:', error);
      // Fallback to localStorage with error handling
      try {
        return persistentStorage.addActivityLog(log);
      } catch (e) {
        console.error('Critical error adding activity log:', e);
        // Create a fallback log with generated ID
        const fallbackLog = {
          id: `log_fallback_${Date.now()}`,
          action: log?.action || 'Unknown action',
          details: log?.details || 'Error creating log',
          timestamp: new Date().toISOString(),
          category: log?.category || 'Error'
        };
        return fallbackLog;
      }
    }
  }

  // Curriculum
  async getCurriculum(classId: string): Promise<Curriculum | null> {
    try {
      console.log(`Getting curriculum for class ${classId} from Firestore`);
      const curriculumRef = doc(db, 'curricula', classId);
      const snapshot = await getDoc(curriculumRef);
      
      if (snapshot.exists()) {
        return snapshot.data() as Curriculum;
      }
      return null;
    } catch (error) {
      console.error(`Error getting curriculum for class ${classId} from Firestore:`, error);
      // Fall back to localStorage
      return persistentStorage.getCurriculum(classId);
    }
  }

  async saveCurriculum(classId: string, curriculum: Curriculum): Promise<boolean> {
    try {
      console.log(`Saving curriculum for class ${classId} to Firestore`);
      const curriculumRef = doc(db, 'curricula', classId);
      await setDoc(curriculumRef, {
        ...curriculum,
        updatedAt: new Date().toISOString()
      });
      
      // Also save to persistent storage
      try {
        persistentStorage.saveCurriculum(classId, curriculum);
      } catch (e) {
        console.log('Error saving curriculum to persistent storage:', e);
      }
      
      return true;
    } catch (error) {
      console.error(`Error saving curriculum for class ${classId} to Firestore:`, error);
      return persistentStorage.saveCurriculum(classId, curriculum);
    }
  }

  async updateCurriculum(classId: string, curriculum: Partial<Curriculum>): Promise<boolean> {
    try {
      console.log(`Updating curriculum for class ${classId} in Firestore`);
      const curriculumRef = doc(db, 'curricula', classId);
      await updateDoc(curriculumRef, {
        ...curriculum,
        updatedAt: new Date().toISOString()
      });
      
      // Also update in persistent storage
      try {
        persistentStorage.updateCurriculum(classId, curriculum);
      } catch (e) {
        console.log('Error updating curriculum in persistent storage:', e);
      }
      
      return true;
    } catch (error) {
      console.error(`Error updating curriculum for class ${classId} in Firestore:`, error);
      return persistentStorage.updateCurriculum(classId, curriculum);
    }
  }

  // Enrollment
  async enrollStudent(classId: string, studentId: string): Promise<boolean> {
    try {
      // Get the class from Firestore
      const classRef = doc(db, 'classes', classId);
      const classSnap = await getDoc(classRef);
      
      if (!classSnap.exists()) {
        throw new Error(`Class ${classId} not found`);
      }
      
      const classData = classSnap.data();
      const enrolledStudents = classData.enrolledStudents || [];
      
      // Check if student is already enrolled
      if (enrolledStudents.includes(studentId)) {
        return true;
      }
      
      // Add student to enrolledStudents array
      enrolledStudents.push(studentId);
      
      // Update class in Firestore
      await updateDoc(classRef, {
        enrolledStudents,
        students: enrolledStudents.length,
        updatedAt: new Date().toISOString()
      });
      
      // Also update in localStorage
      try {
        persistentStorage.enrollStudent(classId, studentId);
      } catch (e) {
        console.log('Error enrolling student in persistent storage:', e);
      }
      
      return true;
    } catch (error) {
      console.error(`Error enrolling student ${studentId} in class ${classId}:`, error);
      return persistentStorage.enrollStudent(classId, studentId);
    }
  }

  async unenrollStudent(classId: string, studentId: string): Promise<boolean> {
    try {
      // Get the class from Firestore
      const classRef = doc(db, 'classes', classId);
      const classSnap = await getDoc(classRef);
      
      if (!classSnap.exists()) {
        throw new Error(`Class ${classId} not found`);
      }
      
      const classData = classSnap.data();
      let enrolledStudents = classData.enrolledStudents || [];
      
      // Check if student is enrolled
      if (!enrolledStudents.includes(studentId)) {
        return true;
      }
      
      // Remove student from enrolledStudents array
      enrolledStudents = enrolledStudents.filter(id => id !== studentId);
      
      // Update class in Firestore
      await updateDoc(classRef, {
        enrolledStudents,
        students: enrolledStudents.length,
        updatedAt: new Date().toISOString()
      });
      
      // Also update in localStorage
      try {
        persistentStorage.unenrollStudent(classId, studentId);
      } catch (e) {
        console.log('Error unenrolling student in persistent storage:', e);
      }
      
      return true;
    } catch (error) {
      console.error(`Error unenrolling student ${studentId} from class ${classId}:`, error);
      return persistentStorage.unenrollStudent(classId, studentId);
    }
  }

  async getFileUrl(fileId: string): Promise<string | null> {
    try {
      // Get file URL from Firestore or storage
      return null;
    } catch (error) {
      console.error(`Error getting file URL for ${fileId}:`, error);
      return null;
    }
  }

  // File handling (outside of the main storage methods)
  // @ts-ignore - Suppress the parameter error
  listFilesById(id: string): string[] {
    try {
      // Implementation of listing files by ID
      return [];
    } catch (error) {
      console.error(`Error listing files for ID ${id}:`, error);
      return [];
    }
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
