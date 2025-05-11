import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  listAll,
  StorageReference
} from 'firebase/storage';
import { storage } from './firebase';

// Types
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
    // Create a storage reference
    const storageRef = ref(storage, `${path}${file.name}`);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get the download URL
    const url = await getDownloadURL(snapshot.ref);
    
    return {
      url,
      path: snapshot.ref.fullPath
    };
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
    const storageRef = ref(storage, path);
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
    const storageRef = ref(storage, path);
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
    const storageRef = ref(storage, path);
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