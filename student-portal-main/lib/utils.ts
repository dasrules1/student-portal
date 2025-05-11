import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { persistentStorage } from "./persistentStorage"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility function to format date
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// Utility function to generate a random ID
export function generateId(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
}

// Utility function to validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Utility function to truncate text
export function truncateText(text: string, maxLength: number): string {
  if (!text) return ""
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + "..."
}

// Utility function to get class name from ID
export function getClassNameById(classId: string): string {
  const classData = persistentStorage.getClassById(classId)
  return classData ? classData.name : "Unknown Class"
}

// Utility function to count enrolled students in a class
export function countEnrolledStudents(classId: string): number {
  const classData = persistentStorage.getClassById(classId)
  return classData && classData.enrolledStudents ? classData.enrolledStudents.length : 0
}
