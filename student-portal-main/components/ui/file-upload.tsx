import { useState } from 'react';
import { Button } from './button';
import { uploadFile, getFileMetadata } from '@/lib/firebase-storage';
import { toast } from 'sonner';

interface FileUploadProps {
  path: string;
  onUploadComplete?: (url: string, path: string) => void;
  onUploadError?: (error: Error) => void;
  accept?: string;
  maxSize?: number; // in bytes
  className?: string;
}

export function FileUpload({
  path,
  onUploadComplete,
  onUploadError,
  accept,
  maxSize = 5 * 1024 * 1024, // 5MB default
  className = '',
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > maxSize) {
      toast.error(`File size must be less than ${maxSize / 1024 / 1024}MB`);
      return;
    }

    // Check file type if accept is specified
    if (accept && !accept.split(',').some(type => file.type.match(type.trim()))) {
      toast.error('Invalid file type');
      return;
    }

    try {
      setIsUploading(true);
      
      // Get file metadata
      const metadata = getFileMetadata(file);
      
      // Upload file
      const result = await uploadFile(file, path);
      
      // Call success callback
      onUploadComplete?.(result.url, result.path);
      
      toast.success('File uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      onUploadError?.(error as Error);
      toast.error('Error uploading file');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={className}>
      <input
        type="file"
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
        id="file-upload"
        disabled={isUploading}
      />
      <label htmlFor="file-upload">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isUploading}
        >
          {isUploading ? 'Uploading...' : 'Choose File'}
        </Button>
      </label>
    </div>
  );
} 