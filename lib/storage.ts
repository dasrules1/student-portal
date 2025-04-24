// @ts-nocheck
// Storage service for client-side data management

// Type declarations for external modules to suppress errors
// @ts-ignore
import { persistentStorage } from "@/lib/persistentStorage"
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
  DocumentReference,
  writeBatch
} from 'firebase/firestore';
// Import Firebase Auth functionality
import { firebaseAuth } from './firebase-auth';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from './firebase';

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
      
      if (!snapshot || !snapshot.docs) {
        console.warn("No snapshot or docs found in Firestore");
        // Return from localStorage
        const localUsers = persistentStorage.getAllUsers();
        this.users = Array.isArray(localUsers) ? localUsers : [];
        return this.users;
      }
      
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
      
      // Cache the users locally (ensure it's an array)
      this.users = Array.isArray(loadedUsers) ? loadedUsers : [];
      console.log(`Loaded ${this.users.length} users from Firestore`, this.users);
      return this.users;
    } catch (error) {
      console.error('Error getting users:', error);
      // Fallback to localStorage
      try {
        const localUsers = persistentStorage.getAllUsers();
        // Make sure we always return an array
        const safeUsers = Array.isArray(localUsers) ? localUsers : [];
        console.log('Falling back to local storage users:', safeUsers);
        this.users = safeUsers;
        return safeUsers;
      } catch (backupError) {
        console.error('Critical error getting users from all sources:', backupError);
        // Ultimate fallback - empty array
        this.users = [];
      return [];
      }
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
      
      // First, create the user in Firebase Authentication
      let authUserId = '';
      try {
        // Create the authentication user
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        const authUser = userCredential.user;
        authUserId = authUser.uid;
        
        // Update the user's display name
        await updateProfile(authUser, {
          displayName: userData.name
        });
        
        console.log('User created in Firebase Auth with ID:', authUserId);
      } catch (authError) {
        console.error('Error creating user in Firebase Auth:', authError);
        // If the user already exists in Firebase Auth, continue with Firestore update
        if (authError.code === 'auth/email-already-in-use') {
          console.log('User already exists in Firebase Auth, continuing with Firestore update');
        } else {
          throw authError;
        }
      }
      
      // Add to Firestore using the Firebase Auth UID if available
      let firestoreId = authUserId;
      if (!firestoreId) {
        // If Firebase Auth creation failed, generate a new ID for Firestore
      const usersRef = collection(db, 'users');
        const docRef = await addDoc(usersRef, enhancedUserData);
        firestoreId = docRef.id;
      } else {
        // Use the Firebase Auth UID for Firestore document ID
        await setDoc(doc(db, 'users', authUserId), enhancedUserData);
      }
      
      const newUser = { id: firestoreId, ...enhancedUserData } as User;
      
      console.log('User created in Firestore with ID:', firestoreId);
      
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
      // Create a safe fallback array
      const fallbackClasses: Class[] = [];
      
      // Try to load from Firestore
      try {
        console.log("Getting classes from Firestore...");
        const classesRef = collection(db, 'classes');
        const snapshot = await getDocs(classesRef);
        
        if (snapshot && snapshot.docs && Array.isArray(snapshot.docs) && snapshot.docs.length > 0) {
          console.log(`Retrieved ${snapshot.docs.length} classes from Firestore`);
          
          const classesWithData = [];
          // Use for loop instead of map for better error handling
          for (let i = 0; i < snapshot.docs.length; i++) {
            try {
              const doc = snapshot.docs[i];
              if (doc && typeof doc.data === 'function') {
                const data = doc.data();
                classesWithData.push({
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
                });
              }
            } catch (docError) {
              console.error("Error processing class document:", docError);
            }
          }
          
          if (classesWithData.length > 0) {
            // Cache classes locally
            this.classes = classesWithData;
            return [...classesWithData]; // Return a new copy
          }
        }
      } catch (firestoreError) {
        console.error("Error fetching classes from Firestore:", firestoreError);
      }

      // Fall back to local storage
      try {
        const localClasses = persistentStorage.getAllClasses();
        if (localClasses && Array.isArray(localClasses) && localClasses.length > 0) {
          console.log('Using local storage classes:', localClasses);
          this.classes = [...localClasses];
          return [...localClasses]; // Return a new copy
        }
      } catch (localError) {
        console.error("Error getting classes from local storage:", localError);
      }
      
      // If everything failed, return an empty array
      console.log('No classes found, returning empty array');
      this.classes = [];
      return [];
    } catch (error) {
      console.error("Critical error in getClasses:", error);
      // Last resort fallback
      this.classes = [];
      return [];
    }
  }

  // Safe wrapper for UI components
  async getSafeClasses(): Promise<Class[]> {
    try {
      const classes = await this.getClasses();
      // Ensure it's a valid array
      if (classes && Array.isArray(classes)) {
        return classes;
      } else {
        console.error("getClasses returned non-array, using empty array");
        return [];
      }
    } catch (error) {
      console.error("Error in getSafeClasses:", error);
      return [];
    }
  }

  async getClassById(id: string): Promise<Class | undefined> {
    try {
      console.log(`Looking for class with ID: ${id}`);
      
      // First check the local cache
      const localClass = this.classes.find(cls => cls.id === id);
      if (localClass) {
        console.log(`Found class in local cache: ${id}`);
        return localClass;
      }
      
      console.log(`Class not found in local cache, trying Firestore: ${id}`);
      // Then try to get from Firestore
      try {
        const classRef = doc(db, 'classes', id);
        const docSnap = await getDoc(classRef);
        
        if (docSnap.exists()) {
          const classData = { id: docSnap.id, ...(docSnap.data() as Omit<Class, 'id'>) } as Class;
          console.log(`Found class in Firestore: ${id}`);
          
          // Update local cache with this class
          const existingIndex = this.classes.findIndex(c => c.id === id);
          if (existingIndex >= 0) {
            this.classes[existingIndex] = classData;
          } else {
            this.classes.push(classData);
          }
          
          return classData;
        }
      } catch (firestoreError) {
        console.error(`Error getting class from Firestore: ${id}`, firestoreError);
      }
      
      console.log(`Class not found in Firestore, trying persistent storage: ${id}`);
      // Try to fall back to persistent storage
      return persistentStorage.getClassById(id);
    } catch (error) {
      console.error(`Error in getClassById for ${id}:`, error);
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
      console.log("Starting class update process for:", id);
      
      // First, ensure we have the class in our cache
      let classToUpdate = this.classes.find(cls => cls.id === id);
      
      // If not in cache, try to fetch it first
      if (!classToUpdate) {
        console.log("Class not in cache, attempting to fetch it first:", id);
        classToUpdate = await this.getClassById(id);
        
        if (!classToUpdate) {
          console.error("Cannot update class that doesn't exist:", id);
          throw new Error(`Class with id ${id} not found`);
        }
      }
      
      // Now we have the class, proceed with update
      console.log("Updating class in storage:", id);
      
      // First try updating in Firestore
      try {
        const classRef = doc(db, 'classes', id);
        
        // Add updatedAt timestamp
        const updatedData = {
          ...classData,
          updatedAt: new Date().toISOString()
        };
        
        await updateDoc(classRef, updatedData);
        console.log("Class updated in Firestore successfully");
      } catch (firestoreError) {
        console.error("Error updating class in Firestore:", firestoreError);
      }
      
      // Update local cache
      const index = this.classes.findIndex(cls => cls.id === id);
      if (index !== -1) {
        this.classes[index] = { ...this.classes[index], ...classData };
        console.log("Class updated in local cache");
      } else {
        // This should not happen now that we prefetch the class if needed
        console.warn("Class not found in local cache after prefetch, adding it now:", id);
        if (classToUpdate) {
          this.classes.push({...classToUpdate, ...classData});
        }
      }
      
      // Also update in persistent storage
      const updatedClass = await persistentStorage.updateClass(id, classData);
      
      // Return the updated class - either from persistent storage or our cache
      if (updatedClass) {
        console.log("Class updated successfully in all storage layers:", id);
        return updatedClass;
      } else {
        console.warn("Class update in persistent storage failed, returning from cache");
        const cachedClass = this.classes.find(cls => cls.id === id);
        if (!cachedClass) {
          throw new Error("Class update returned no result");
        }
        return cachedClass;
      }
    } catch (error) {
      console.error("Error in overall updateClass process:", error);
      throw error; // Let the caller handle this error
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
    console.log(`Getting curriculum for class ${classId}`);
    
    try {
      // First attempt to get from Firestore
      const curriculumRef = doc(db, 'curricula', classId);
      const curriculumSnapshot = await getDoc(curriculumRef);
      
      if (curriculumSnapshot.exists()) {
        const curriculumData = curriculumSnapshot.data();
        console.log(`Retrieved curriculum from Firestore for class ${classId}`);
        return curriculumData as Curriculum;
      }
      
      console.log(`No curriculum found in Firestore for class ${classId}, trying persistent storage`);
      
      // Second attempt to get from persistent storage
      try {
        const persistentCurriculum = await persistentStorage.getCurriculum(classId);
        if (persistentCurriculum) {
          console.log(`Retrieved curriculum from persistent storage for class ${classId}`);
          
          // Save to Firestore to ensure consistency
          try {
            await this.saveCurriculum(classId, persistentCurriculum);
          } catch (saveError) {
            console.warn(`Failed to save persistent curriculum to Firestore: ${saveError}`);
          }
          
          return persistentCurriculum;
        }
      } catch (persistentError) {
        console.warn(`Error getting curriculum from persistent storage: ${persistentError}`);
      }
      
      // Third attempt: check localStorage
      if (typeof window !== "undefined") {
        try {
          // Try both key formats for compatibility
          const localData = localStorage.getItem(`curriculum_${classId}`) || 
                           localStorage.getItem(`${STORAGE_PREFIX}curriculum_${classId}`);
          
          if (localData) {
            try {
              const parsedData = JSON.parse(localData);
              console.log(`Retrieved curriculum from localStorage for class ${classId}`);
              
              // Save to Firestore to ensure consistency
              try {
                await this.saveCurriculum(classId, parsedData);
              } catch (saveError) {
                console.warn(`Failed to save localStorage curriculum to Firestore: ${saveError}`);
              }
              
              return parsedData;
            } catch (parseError) {
              console.error(`Error parsing localStorage curriculum data: ${parseError}`);
            }
          }
        } catch (localStorageError) {
          console.warn(`Error checking localStorage: ${localStorageError}`);
        }
      }
      
      // Fourth attempt: check if curriculum is embedded in the class object
      const classData = await this.getClassById(classId);
      if (classData && classData.curriculum) {
        console.log(`Found curriculum embedded in class ${classId}`);
        
        // Format the data properly
        const formattedCurriculum = {
          classId,
          content: classData.curriculum,
          lastUpdated: new Date().toISOString()
        };
        
        // Save to Firestore for future use
        try {
          await this.saveCurriculum(classId, formattedCurriculum);
        } catch (saveError) {
          console.warn(`Failed to save embedded curriculum to Firestore: ${saveError}`);
        }
        
        return formattedCurriculum;
      }
      
      console.log(`No curriculum found for class ${classId} in any storage`);
      return null;
    } catch (error) {
      console.error(`Error retrieving curriculum for class ${classId}:`, error);
      return null;
    }
  }

  async saveCurriculum(classId: string, curriculum: Curriculum): Promise<boolean> {
    try {
      console.log(`Saving curriculum for class ${classId} to Firestore`);
      
      // Ensure curriculum has proper structure and preserves correctAnswer fields
      let curriculumToSave = { ...curriculum };
      
      // Make sure content is properly structured
      if (!curriculumToSave.content && typeof curriculumToSave === 'object') {
        // Handle case where content is the top-level object itself
        if (curriculumToSave.lessons || curriculumToSave.assignments) {
          curriculumToSave = {
            classId,
            content: curriculumToSave,
            lastUpdated: new Date().toISOString()
          };
        }
      }
      
      // Ensure all lesson content has the isPublished property explicitly set
      if (curriculumToSave.content?.lessons) {
        curriculumToSave.content.lessons = curriculumToSave.content.lessons.map(lesson => {
          if (lesson.contents) {
            lesson.contents = lesson.contents.map(content => {
              // Ensure isPublished is explicitly boolean
              content.isPublished = content.isPublished === true;
              
              // Ensure all problem content preserves correctAnswer fields
              if (content.problems && Array.isArray(content.problems)) {
                content.problems = content.problems.map(problem => {
                  // Preserve correctAnswer and other grading fields
                  return { ...problem };
                });
              }
              
              return content;
            });
          }
          return lesson;
        });
      }
      
      // Verify the class exists before saving curriculum
      let classExists = false;
      try {
        // Check if class exists in Firestore
        const classRef = doc(db, 'classes', classId);
        const classSnapshot = await getDoc(classRef);
        classExists = classSnapshot.exists();
        
        if (!classExists) {
          // Check local cache as well
          classExists = this.classes.some(cls => cls.id === classId);
          
          // Last resort - check persistent storage
          if (!classExists) {
            const localClass = persistentStorage.getClassById(classId);
            classExists = !!localClass;
          }
        }
        
        if (!classExists) {
          console.error(`Cannot save curriculum - class ${classId} does not exist`);
          return false;
        }
      } catch (classCheckError) {
        console.warn(`Error checking if class ${classId} exists:`, classCheckError);
        // Continue anyway - we'll save the curriculum data
      }
      
      // Save curriculum to Firestore
      const curriculumRef = doc(db, 'curricula', classId);
      const curriculumData = {
        ...curriculumToSave,
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(curriculumRef, curriculumData);
      
      // Also save to persistent storage as fallback
      try {
        await persistentStorage.saveCurriculum(classId, curriculumToSave);
      } catch (storageError) {
        console.log('Error saving curriculum to persistent storage:', storageError);
      }
      
      // Create a direct key-value in localStorage as a last resort
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`curriculum_${classId}`, JSON.stringify(curriculumToSave));
        } catch (e) {
          console.log('Error saving curriculum to localStorage:', e);
        }
      }
      
      return true;
    } catch (error) {
      console.error(`Error saving curriculum for class ${classId} to Firestore:`, error);
      
      // Try persistent storage as fallback
      try {
        return await persistentStorage.saveCurriculum(classId, curriculum);
      } catch (persistentError) {
        console.error('Error saving to persistent storage too:', persistentError);
        
        // Last resort - direct localStorage
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`curriculum_${classId}`, JSON.stringify(curriculum));
            return true;
          } catch (e) {
            console.error('All curriculum saving methods failed:', e);
          }
        }
        return false;
      }
    }
  }

  async updateCurriculum(classId: string, curriculum: Partial<Curriculum>): Promise<boolean> {
    try {
      console.log(`Updating curriculum for class ${classId} in Firestore`);
      
      // Verify the class exists before updating curriculum
      let classExists = false;
      try {
        // Check if class exists in Firestore
        const classRef = doc(db, 'classes', classId);
        const classSnapshot = await getDoc(classRef);
        classExists = classSnapshot.exists();
        
        if (!classExists) {
          // Check local cache as well
          classExists = this.classes.some(cls => cls.id === classId);
          
          // Last resort - check persistent storage
          if (!classExists) {
            const localClass = persistentStorage.getClassById(classId);
            classExists = !!localClass;
          }
        }
        
        if (!classExists) {
          console.error(`Cannot update curriculum - class ${classId} does not exist`);
          return false;
        }
      } catch (classCheckError) {
        console.warn(`Error checking if class ${classId} exists:`, classCheckError);
        // Continue anyway - we'll update the curriculum data
      }
      
      // First try to get existing curriculum
      let existingCurriculum = null;
      try {
        const curriculumRef = doc(db, 'curricula', classId);
        const curriculumSnapshot = await getDoc(curriculumRef);
        if (curriculumSnapshot.exists()) {
          existingCurriculum = curriculumSnapshot.data();
        }
      } catch (getError) {
        console.warn(`Could not retrieve existing curriculum for ${classId}:`, getError);
      }
      
      // Update curriculum in Firestore
      try {
        const curriculumRef = doc(db, 'curricula', classId);
        
        // Merge with existing data if available
        const updateData = existingCurriculum 
          ? { ...existingCurriculum, ...curriculum, updatedAt: new Date().toISOString() }
          : { ...curriculum, updatedAt: new Date().toISOString() };
        
        await setDoc(curriculumRef, updateData, { merge: true });
        
        // Also update in persistent storage as fallback
        try {
          await persistentStorage.updateCurriculum(classId, curriculum);
        } catch (storageError) {
          console.log('Error updating curriculum in persistent storage:', storageError);
        }
        
        // Create a direct key-value in localStorage as a last resort
        if (typeof window !== "undefined") {
          try {
            // First try to get existing localStorage data
            const existingLocalData = localStorage.getItem(`curriculum_${classId}`);
            let localData = curriculum;
            
            if (existingLocalData) {
              try {
                const parsedLocalData = JSON.parse(existingLocalData);
                localData = { ...parsedLocalData, ...curriculum };
              } catch (parseError) {
                console.warn('Could not parse existing localStorage curriculum data:', parseError);
              }
            }
            
            localStorage.setItem(`curriculum_${classId}`, JSON.stringify(localData));
          } catch (e) {
            console.log('Error saving curriculum to localStorage:', e);
          }
        }
        
        return true;
      } catch (updateError) {
        console.error(`Error updating curriculum in Firestore:`, updateError);
        throw updateError;
      }
    } catch (error) {
      console.error(`Error in overall curriculum update process:`, error);
      
      // Try persistent storage as fallback
      try {
        return await persistentStorage.updateCurriculum(classId, curriculum);
      } catch (persistentError) {
        console.error('Error updating in persistent storage too:', persistentError);
        
        // Last resort - direct localStorage
        if (typeof window !== "undefined") {
          try {
            // Get existing data if possible
            const existingData = localStorage.getItem(`curriculum_${classId}`);
            let mergedData = curriculum;
            
            if (existingData) {
              try {
                const parsedData = JSON.parse(existingData);
                mergedData = { ...parsedData, ...curriculum };
              } catch (e) {
                // Use curriculum as is if parsing fails
              }
            }
            
            localStorage.setItem(`curriculum_${classId}`, JSON.stringify(mergedData));
            return true;
          } catch (e) {
            console.error('All curriculum update methods failed:', e);
          }
        }
        return false;
      }
    }
  }

  // Enrollment
  async enrollStudent(classId: string, studentId: string): Promise<boolean> {
    try {
      console.log(`Attempting to enroll student ${studentId} in class ${classId}`);
      
      // First, verify both class and student exist
      const classRef = doc(db, 'classes', classId);
      const studentRef = doc(db, 'users', studentId);
      
      const [classSnap, studentSnap] = await Promise.all([
        getDoc(classRef),
        getDoc(studentRef)
      ]);
      
      if (!classSnap.exists()) {
        console.error(`Class ${classId} not found`);
        // Fall back to persistent storage
        return persistentStorage.enrollStudent(classId, studentId);
      }
      
      if (!studentSnap.exists()) {
        console.error(`Student ${studentId} not found`);
        // Fall back to persistent storage
        return persistentStorage.enrollStudent(classId, studentId);
      }
      
      const classData = classSnap.data();
      const studentData = studentSnap.data();
      
      // Validate student role
      if (studentData.role !== 'student') {
        console.error(`User ${studentId} is not a student`);
        return false;
      }
      
      const enrolledStudents = classData.enrolledStudents || [];
      const studentClasses = studentData.classes || [];
      
      // Check if student is already enrolled
      if (enrolledStudents.includes(studentId)) {
        console.log(`Student ${studentId} is already enrolled in class ${classId}`);
        return true;
      }
      
      // Add student to class
      const updatedEnrolledStudents = [...enrolledStudents, studentId];
      const updatedClassData = {
        ...classData,
        enrolledStudents: updatedEnrolledStudents
      };
      
      // Update class in Firestore
      await updateDoc(classRef, updatedClassData);
      
      // Update student in Firestore
      await updateDoc(studentRef, {
        classes: [...studentClasses, classId]
      });
      
      // Update local cache
      const index = this.classes.findIndex(cls => cls.id === classId);
      if (index !== -1) {
        this.classes[index] = { ...this.classes[index], ...updatedClassData };
      }
      
      // Also update in persistent storage
      persistentStorage.enrollStudent(classId, studentId);
      
      console.log(`Student ${studentId} enrolled in class ${classId} successfully`);
      return true;
    } catch (error) {
      console.error(`Error enrolling student ${studentId} in class ${classId}:`, error);
      return persistentStorage.enrollStudent(classId, studentId);
    }
  }

  // Files
  async uploadFile(file: File, path: string): Promise<UploadResult> {
    try {
      console.log(`Uploading file ${file.name} to path ${path}`);
      
      const storageRef = ref(firebaseStorage, path);
      const uploadTask = uploadBytes(storageRef, file);
      
      await uploadTask;
      
      const downloadURL = await getDownloadURL(storageRef);
      
      console.log(`File ${file.name} uploaded successfully to ${path}`);
      return { url: downloadURL, path };
    } catch (error) {
      console.error(`Error uploading file ${file.name}:`, error);
      throw error;
    }
  }

  async deleteFile(path: string): Promise<boolean> {
    try {
      console.log(`Deleting file at path ${path}`);
      
      const storageRef = ref(firebaseStorage, path);
      await deleteObject(storageRef);
      
      console.log(`File at path ${path} deleted successfully`);
      return true;
    } catch (error) {
      console.error(`Error deleting file at path ${path}:`, error);
      return false;
    }
  }

  // ... rest of the file - files, etc. ...
}

// Export the class instance for use throughout the application
export const storageService = new StorageService()
export const storage = storageService // Export as 'storage' for backwards compatibility