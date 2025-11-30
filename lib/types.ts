// Common types used across storage modules
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
  teacherJoinLink?: string
  studentJoinLink?: string
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