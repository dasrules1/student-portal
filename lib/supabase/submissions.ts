import { supabase } from "./client"
import { createServerClient } from "./server"

export interface Submission {
  id: string
  student_id: string
  class_id: string
  lesson_id: string
  content_id: string
  submission_data: any // JSON data
  grade?: number
  feedback?: string
  status: "draft" | "submitted" | "graded"
  created_at: string
  updated_at: string
}

export const submissionService = {
  // Student: Get submissions for a student
  async getStudentSubmissions(studentId: string): Promise<Submission[]> {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Get student submissions error:", error)
      return []
    }

    return data
  },

  // Teacher: Get submissions for a class
  async getClassSubmissions(classId: string): Promise<Submission[]> {
    const { data, error } = await supabase
      .from("submissions")
      .select(`
        *,
        student:student_id(name, email)
      `)
      .eq("class_id", classId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Get class submissions error:", error)
      return []
    }

    return data
  },

  // Get a specific submission
  async getSubmission(submissionId: string): Promise<Submission | null> {
    const { data, error } = await supabase.from("submissions").select("*").eq("id", submissionId).single()

    if (error) {
      console.error("Get submission error:", error)
      return null
    }

    return data
  },

  // Student: Create or update a submission
  async saveSubmission(
    submissionData: {
      student_id: string
      class_id: string
      lesson_id: string
      content_id: string
      submission_data: any
      status: "draft" | "submitted"
    },
    submissionId?: string,
  ): Promise<{ success: boolean; error?: string; submissionId?: string }> {
    if (submissionId) {
      // Update existing submission
      const { data, error } = await supabase
        .from("submissions")
        .update({
          ...submissionData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", submissionId)
        .select()
        .single()

      if (error) {
        console.error("Update submission error:", error)
        return { success: false, error: error.message }
      }

      return { success: true, submissionId: data.id }
    } else {
      // Create new submission
      const { data, error } = await supabase.from("submissions").insert([submissionData]).select().single()

      if (error) {
        console.error("Create submission error:", error)
        return { success: false, error: error.message }
      }

      return { success: true, submissionId: data.id }
    }
  },

  // Teacher: Grade a submission
  async gradeSubmission(
    submissionId: string,
    gradeData: {
      grade: number
      feedback?: string
    },
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from("submissions")
      .update({
        ...gradeData,
        status: "graded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId)

    if (error) {
      console.error("Grade submission error:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  },

  // Server-side functions (using service role key)
  server: {
    // Admin: Get all submissions (server-side only)
    async getAllSubmissions(): Promise<Submission[]> {
      const supabaseServer = createServerClient()
      const { data, error } = await supabaseServer
        .from("submissions")
        .select(`
          *,
          student:student_id(name, email)
        `)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Get all submissions error:", error)
        return []
      }

      return data
    },
  },
}
