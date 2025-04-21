// Classes service for Supabase
import { supabase } from "./client"

// Define types
interface Class {
  id?: string
  name: string
  subject?: string
  teacher_id: string
  location?: string
  meeting_day?: string
  start_time?: string
  end_time?: string
  virtual_link?: string
  status?: string
}

interface ClassWithTeacher extends Class {
  teacher: {
    name: string
    email: string
  }
}

// Create a new class
export const createClass = async (classData: Class) => {
  try {
    const { data, error } = await supabase.from("classes").insert(classData).select()

    if (error) {
      console.error("Error creating class:", error)
      return { error }
    }

    return { data: data[0] }
  } catch (error: any) {
    console.error("Unexpected error creating class:", error)
    return { error }
  }
}

// Get all classes
export const getAllClasses = async () => {
  try {
    const { data, error } = await supabase
      .from("classes")
      .select(`
        *,
        teacher:teacher_id(name, email)
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching classes:", error)
      return { error }
    }

    return { data: data as ClassWithTeacher[] }
  } catch (error: any) {
    console.error("Unexpected error fetching classes:", error)
    return { error }
  }
}

// Get class by ID
export const getClassById = async (id: string) => {
  try {
    const { data, error } = await supabase
      .from("classes")
      .select(`
        *,
        teacher:teacher_id(name, email)
      `)
      .eq("id", id)
      .single()

    if (error) {
      console.error(`Error fetching class ${id}:`, error)
      return { error }
    }

    return { data: data as ClassWithTeacher }
  } catch (error: any) {
    console.error(`Unexpected error fetching class ${id}:`, error)
    return { error }
  }
}

// Update a class
export const updateClass = async (id: string, classData: Partial<Class>) => {
  try {
    const { data, error } = await supabase.from("classes").update(classData).eq("id", id).select()

    if (error) {
      console.error(`Error updating class ${id}:`, error)
      return { error }
    }

    return { data: data[0] }
  } catch (error: any) {
    console.error(`Unexpected error updating class ${id}:`, error)
    return { error }
  }
}

// Delete a class
export const deleteClass = async (id: string) => {
  try {
    const { error } = await supabase.from("classes").delete().eq("id", id)

    if (error) {
      console.error(`Error deleting class ${id}:`, error)
      return { error }
    }

    return { success: true }
  } catch (error: any) {
    console.error(`Unexpected error deleting class ${id}:`, error)
    return { error }
  }
}

// Get classes for a teacher
export const getClassesForTeacher = async (teacherId: string) => {
  try {
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(`Error fetching classes for teacher ${teacherId}:`, error)
      return { error }
    }

    return { data }
  } catch (error: any) {
    console.error(`Unexpected error fetching classes for teacher ${teacherId}:`, error)
    return { error }
  }
}

// Get classes for a student
export const getClassesForStudent = async (studentId: string) => {
  try {
    const { data, error } = await supabase
      .from("class_enrollments")
      .select(`
        class_id,
        class:class_id(
          id,
          name,
          subject,
          teacher:teacher_id(name, email),
          location,
          meeting_day,
          start_time,
          end_time,
          virtual_link,
          status
        )
      `)
      .eq("student_id", studentId)
      .eq("status", "active")

    if (error) {
      console.error(`Error fetching classes for student ${studentId}:`, error)
      return { error }
    }

    // Transform the data to match the expected format
    const classes = data.map((enrollment) => ({
      id: enrollment.class.id,
      name: enrollment.class.name,
      subject: enrollment.class.subject,
      teacher: enrollment.class.teacher.name,
      teacherId: enrollment.class.teacher.id,
      location: enrollment.class.location,
      meetingDay: enrollment.class.meeting_day,
      startTime: enrollment.class.start_time,
      endTime: enrollment.class.end_time,
      virtualLink: enrollment.class.virtual_link,
      status: enrollment.class.status,
    }))

    return { data: classes }
  } catch (error: any) {
    console.error(`Unexpected error fetching classes for student ${studentId}:`, error)
    return { error }
  }
}

// Enroll a student in a class
export const enrollStudent = async (classId: string, studentId: string) => {
  try {
    const { data, error } = await supabase
      .from("class_enrollments")
      .insert({
        class_id: classId,
        student_id: studentId,
        status: "active",
      })
      .select()

    if (error) {
      console.error(`Error enrolling student ${studentId} in class ${classId}:`, error)
      return { error }
    }

    return { data: data[0] }
  } catch (error: any) {
    console.error(`Unexpected error enrolling student ${studentId} in class ${classId}:`, error)
    return { error }
  }
}

// Unenroll a student from a class
export const unenrollStudent = async (classId: string, studentId: string) => {
  try {
    const { error } = await supabase
      .from("class_enrollments")
      .delete()
      .eq("class_id", classId)
      .eq("student_id", studentId)

    if (error) {
      console.error(`Error unenrolling student ${studentId} from class ${classId}:`, error)
      return { error }
    }

    return { success: true }
  } catch (error: any) {
    console.error(`Unexpected error unenrolling student ${studentId} from class ${classId}:`, error)
    return { error }
  }
}

// Get students enrolled in a class
export const getStudentsInClass = async (classId: string) => {
  try {
    const { data, error } = await supabase
      .from("class_enrollments")
      .select(`
        student:student_id(
          id,
          name,
          email,
          avatar,
          status
        )
      `)
      .eq("class_id", classId)
      .eq("status", "active")

    if (error) {
      console.error(`Error fetching students for class ${classId}:`, error)
      return { error }
    }

    // Transform the data to match the expected format
    const students = data.map((enrollment) => enrollment.student)

    return { data: students }
  } catch (error: any) {
    console.error(`Unexpected error fetching students for class ${classId}:`, error)
    return { error }
  }
}
