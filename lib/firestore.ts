import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'

// Types
export interface Course {
  id?: string
  name: string
  description: string
  teacherId: string
  startDate: Date
  endDate: Date
  createdAt: Date
  updatedAt: Date
}

export interface Assignment {
  id?: string
  courseId: string
  title: string
  description: string
  points: number
  createdAt: Date
  updatedAt: Date
  problems: Array<{
    id: string
    question: string
    type: 'multiple-choice' | 'short-answer' | 'long-answer'
    options?: string[]
    correctAnswer?: string
  }>
}

export interface Grade {
  id?: string
  studentId: string
  assignmentId: string
  courseId: string
  score: number
  feedback?: string
  submittedAt: Date
  gradedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface Student {
  id?: string
  userId: string
  name: string
  email: string
  grade: number
  createdAt: Date
  updatedAt: Date
}

export interface Teacher {
  id?: string
  userId: string
  name: string
  email: string
  subjects: string[]
  createdAt: Date
  updatedAt: Date
}

export interface StudentProgress {
  id?: string
  studentId: string
  assignmentId: string
  courseId: string
  status: 'not-started' | 'in-progress' | 'completed'
  currentProblem: number
  answers: {
    [problemId: string]: {
      answer: string
      isCorrect?: boolean
      submittedAt: Date
    }
  }
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Helper function to convert Firestore data to app data
const convertTimestamp = (data: any) => {
  const result = { ...data }
  for (const key in result) {
    if (result[key] instanceof Timestamp) {
      result[key] = result[key].toDate()
    }
  }
  return result
}

// Courses
export const getCourses = async () => {
  const coursesRef = collection(db, 'courses')
  const snapshot = await getDocs(coursesRef)
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamp(doc.data()) }))
}

export const getCourse = async (id: string) => {
  const courseRef = doc(db, 'courses', id)
  const snapshot = await getDoc(courseRef)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...convertTimestamp(snapshot.data()) }
}

export const getCoursesByTeacher = async (teacherId: string) => {
  const coursesRef = collection(db, 'courses')
  const q = query(coursesRef, where('teacherId', '==', teacherId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamp(doc.data()) }))
}

export const createCourse = async (course: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>) => {
  const coursesRef = collection(db, 'courses')
  const now = serverTimestamp()
  const newCourse = {
    ...course,
    createdAt: now,
    updatedAt: now
  }
  const docRef = await addDoc(coursesRef, newCourse)
  return { id: docRef.id, ...course, createdAt: new Date(), updatedAt: new Date() }
}

export const updateCourse = async (id: string, course: Partial<Course>) => {
  const courseRef = doc(db, 'courses', id)
  const updateData = {
    ...course,
    updatedAt: serverTimestamp()
  }
  await updateDoc(courseRef, updateData)
  return { id, ...course }
}

export const deleteCourse = async (id: string) => {
  const courseRef = doc(db, 'courses', id)
  await deleteDoc(courseRef)
  return id
}

// Assignments
export const getAssignments = async () => {
  const assignmentsRef = collection(db, 'assignments')
  const snapshot = await getDocs(assignmentsRef)
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamp(doc.data()) }))
}

export const getAssignment = async (id: string) => {
  const assignmentRef = doc(db, 'assignments', id)
  const snapshot = await getDoc(assignmentRef)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...convertTimestamp(snapshot.data()) }
}

export const getAssignmentsByCourse = async (courseId: string) => {
  const assignmentsRef = collection(db, 'assignments')
  const q = query(assignmentsRef, where('courseId', '==', courseId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamp(doc.data()) }))
}

export const createAssignment = async (assignment: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>) => {
  const assignmentsRef = collection(db, 'assignments')
  const now = serverTimestamp()
  const newAssignment = {
    ...assignment,
    createdAt: now,
    updatedAt: now
  }
  const docRef = await addDoc(assignmentsRef, newAssignment)
  return { id: docRef.id, ...assignment, createdAt: new Date(), updatedAt: new Date() }
}

export const updateAssignment = async (id: string, assignment: Partial<Assignment>) => {
  const assignmentRef = doc(db, 'assignments', id)
  const updateData = {
    ...assignment,
    updatedAt: serverTimestamp()
  }
  await updateDoc(assignmentRef, updateData)
  return { id, ...assignment }
}

export const deleteAssignment = async (id: string) => {
  const assignmentRef = doc(db, 'assignments', id)
  await deleteDoc(assignmentRef)
  return id
}

// Grades
export const getGrades = async () => {
  const gradesRef = collection(db, 'grades')
  const snapshot = await getDocs(gradesRef)
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamp(doc.data()) }))
}

export const getGrade = async (id: string) => {
  const gradeRef = doc(db, 'grades', id)
  const snapshot = await getDoc(gradeRef)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...convertTimestamp(snapshot.data()) }
}

export const getGradesByStudent = async (studentId: string) => {
  const gradesRef = collection(db, 'grades')
  const q = query(gradesRef, where('studentId', '==', studentId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamp(doc.data()) }))
}

export const getGradesByAssignment = async (assignmentId: string) => {
  const gradesRef = collection(db, 'grades')
  const q = query(gradesRef, where('assignmentId', '==', assignmentId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamp(doc.data()) }))
}

export const createGrade = async (grade: Omit<Grade, 'id' | 'createdAt' | 'updatedAt'>) => {
  const gradesRef = collection(db, 'grades')
  const now = serverTimestamp()
  const newGrade = {
    ...grade,
    createdAt: now,
    updatedAt: now
  }
  const docRef = await addDoc(gradesRef, newGrade)
  return { id: docRef.id, ...grade, createdAt: new Date(), updatedAt: new Date() }
}

export const updateGrade = async (id: string, grade: Partial<Grade>) => {
  const gradeRef = doc(db, 'grades', id)
  const updateData = {
    ...grade,
    updatedAt: serverTimestamp()
  }
  await updateDoc(gradeRef, updateData)
  return { id, ...grade }
}

export const deleteGrade = async (id: string) => {
  const gradeRef = doc(db, 'grades', id)
  await deleteDoc(gradeRef)
  return id
}

// Students
export const getStudents = async () => {
  const studentsRef = collection(db, 'students')
  const snapshot = await getDocs(studentsRef)
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamp(doc.data()) }))
}

export const getStudent = async (id: string) => {
  const studentRef = doc(db, 'students', id)
  const snapshot = await getDoc(studentRef)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...convertTimestamp(snapshot.data()) }
}

export const getStudentByUserId = async (userId: string) => {
  const studentsRef = collection(db, 'students')
  const q = query(studentsRef, where('userId', '==', userId), limit(1))
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  return { id: snapshot.docs[0].id, ...convertTimestamp(snapshot.docs[0].data()) }
}

export const createStudent = async (student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => {
  const studentsRef = collection(db, 'students')
  const now = serverTimestamp()
  const newStudent = {
    ...student,
    createdAt: now,
    updatedAt: now
  }
  const docRef = await addDoc(studentsRef, newStudent)
  return { id: docRef.id, ...student, createdAt: new Date(), updatedAt: new Date() }
}

export const updateStudent = async (id: string, student: Partial<Student>) => {
  const studentRef = doc(db, 'students', id)
  const updateData = {
    ...student,
    updatedAt: serverTimestamp()
  }
  await updateDoc(studentRef, updateData)
  return { id, ...student }
}

export const deleteStudent = async (id: string) => {
  const studentRef = doc(db, 'students', id)
  await deleteDoc(studentRef)
  return id
}

// Teachers
export const getTeachers = async () => {
  const teachersRef = collection(db, 'teachers')
  const snapshot = await getDocs(teachersRef)
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamp(doc.data()) }))
}

export const getTeacher = async (id: string) => {
  const teacherRef = doc(db, 'teachers', id)
  const snapshot = await getDoc(teacherRef)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...convertTimestamp(snapshot.data()) }
}

export const getTeacherByUserId = async (userId: string) => {
  const teachersRef = collection(db, 'teachers')
  const q = query(teachersRef, where('userId', '==', userId), limit(1))
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  return { id: snapshot.docs[0].id, ...convertTimestamp(snapshot.docs[0].data()) }
}

export const createTeacher = async (teacher: Omit<Teacher, 'id' | 'createdAt' | 'updatedAt'>) => {
  const teachersRef = collection(db, 'teachers')
  const now = serverTimestamp()
  const newTeacher = {
    ...teacher,
    createdAt: now,
    updatedAt: now
  }
  const docRef = await addDoc(teachersRef, newTeacher)
  return { id: docRef.id, ...teacher, createdAt: new Date(), updatedAt: new Date() }
}

export const updateTeacher = async (id: string, teacher: Partial<Teacher>) => {
  const teacherRef = doc(db, 'teachers', id)
  const updateData = {
    ...teacher,
    updatedAt: serverTimestamp()
  }
  await updateDoc(teacherRef, updateData)
  return { id, ...teacher }
}

export const deleteTeacher = async (id: string) => {
  const teacherRef = doc(db, 'teachers', id)
  await deleteDoc(teacherRef)
  return id
}

// Student Progress
export const getStudentProgress = async (studentId: string, assignmentId: string) => {
  const progressRef = collection(db, 'student_progress')
  const q = query(progressRef, 
    where('studentId', '==', studentId),
    where('assignmentId', '==', assignmentId)
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  return { id: snapshot.docs[0].id, ...convertTimestamp(snapshot.docs[0].data()) }
}

export const updateStudentProgress = async (progress: Omit<StudentProgress, 'id' | 'createdAt' | 'updatedAt'>) => {
  const progressRef = collection(db, 'student_progress')
  const q = query(progressRef, 
    where('studentId', '==', progress.studentId),
    where('assignmentId', '==', progress.assignmentId)
  )
  const snapshot = await getDocs(q)
  
  const now = serverTimestamp()
  if (snapshot.empty) {
    // Create new progress
    const newProgress = {
      ...progress,
      createdAt: now,
      updatedAt: now
    }
    const docRef = await addDoc(progressRef, newProgress)
    return { id: docRef.id, ...progress, createdAt: new Date(), updatedAt: new Date() }
  } else {
    // Update existing progress
    const docRef = snapshot.docs[0].ref
    const updateData = {
      ...progress,
      updatedAt: now
    }
    await updateDoc(docRef, updateData)
    return { id: docRef.id, ...progress }
  }
} 