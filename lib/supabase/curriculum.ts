// Curriculum service for Supabase
import { supabase } from "./client"

// Define types
interface Curriculum {
  id?: string
  class_id: string
  content: any
}

// Create or update curriculum for a class
export const saveCurriculum = async (classId: string, content: any) => {
  try {
    // Check if curriculum already exists
    const { data: existingCurriculum, error: checkError } = await supabase
      .from("curriculum")
      .select("id")
      .eq("class_id", classId)
      .maybeSingle()

    if (checkError) {
      console.error(`Error checking curriculum for class ${classId}:`, checkError)
      return { error: checkError }
    }

    if (existingCurriculum) {
      // Update existing curriculum
      const { data, error } = await supabase
        .from("curriculum")
        .update({ content })
        .eq("id", existingCurriculum.id)
        .select()

      if (error) {
        console.error(`Error updating curriculum for class ${classId}:`, error)
        return { error }
      }

      return { data: data[0] }
    } else {
      // Create new curriculum
      const { data, error } = await supabase.from("curriculum").insert({ class_id: classId, content }).select()

      if (error) {
        console.error(`Error creating curriculum for class ${classId}:`, error)
        return { error }
      }

      return { data: data[0] }
    }
  } catch (error: any) {
    console.error(`Unexpected error saving curriculum for class ${classId}:`, error)
    return { error }
  }
}

// Get curriculum for a class
export const getCurriculum = async (classId: string) => {
  try {
    const { data, error } = await supabase.from("curriculum").select("content").eq("class_id", classId).maybeSingle()

    if (error) {
      console.error(`Error fetching curriculum for class ${classId}:`, error)
      return { error }
    }

    return { data: data?.content || null }
  } catch (error: any) {
    console.error(`Unexpected error fetching curriculum for class ${classId}:`, error)
    return { error }
  }
}

// Update curriculum content for a class
export const updateCurriculum = async (classId: string, content: any) => {
  return saveCurriculum(classId, content)
}

// Get curriculum by class ID (alias for getCurriculum)
export const getCurriculumByClassId = async (classId: string) => {
  return getCurriculum(classId)
}

// Publish content item in curriculum
export const publishCurriculumItem = async (classId: string, lessonId: string, contentId: string) => {
  try {
    // First get the current curriculum
    const { data: curriculumData, error: fetchError } = await getCurriculum(classId)

    if (fetchError) {
      return { error: fetchError }
    }

    if (!curriculumData) {
      return { error: "Curriculum not found" }
    }

    // Find and update the content item
    const updatedContent = { ...curriculumData }
    const lessonIndex = updatedContent.lessons.findIndex((lesson: any) => lesson.id === lessonId)

    if (lessonIndex === -1) {
      return { error: "Lesson not found" }
    }

    const contentIndex = updatedContent.lessons[lessonIndex].content.findIndex((item: any) => item.id === contentId)

    if (contentIndex === -1) {
      return { error: "Content item not found" }
    }

    // Update the published status
    updatedContent.lessons[lessonIndex].content[contentIndex].published = true

    // Save the updated curriculum
    return saveCurriculum(classId, updatedContent)
  } catch (error: any) {
    console.error(`Unexpected error publishing curriculum item:`, error)
    return { error }
  }
}

// Unpublish content item in curriculum
export const unpublishCurriculumItem = async (classId: string, lessonId: string, contentId: string) => {
  try {
    // First get the current curriculum
    const { data: curriculumData, error: fetchError } = await getCurriculum(classId)

    if (fetchError) {
      return { error: fetchError }
    }

    if (!curriculumData) {
      return { error: "Curriculum not found" }
    }

    // Find and update the content item
    const updatedContent = { ...curriculumData }
    const lessonIndex = updatedContent.lessons.findIndex((lesson: any) => lesson.id === lessonId)

    if (lessonIndex === -1) {
      return { error: "Lesson not found" }
    }

    const contentIndex = updatedContent.lessons[lessonIndex].content.findIndex((item: any) => item.id === contentId)

    if (contentIndex === -1) {
      return { error: "Content item not found" }
    }

    // Update the published status
    updatedContent.lessons[lessonIndex].content[contentIndex].published = false

    // Save the updated curriculum
    return saveCurriculum(classId, updatedContent)
  } catch (error: any) {
    console.error(`Unexpected error unpublishing curriculum item:`, error)
    return { error }
  }
}
