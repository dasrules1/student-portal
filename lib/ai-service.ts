// AI Service for generating educational content

export interface AIGenerateOptions {
  contentType?: string;
  problemType?: string;
  gradeLevel?: string;
  subject?: string;
}

export interface AILessonResponse {
  title: string;
  description: string;
  topic: string;
  suggestedContents?: Array<{
    type: string;
    title: string;
    description: string;
  }>;
}

export interface AIContentResponse {
  title: string;
  description: string;
  type: string;
  teachersInstructions?: string;
  suggestedProblems?: Array<{
    question: string;
    type: string;
    options?: string[];
    correctAnswer?: string | number;
    explanation?: string;
    points?: number;
  }>;
}

export interface AIProblemResponse {
  question: string;
  type: string;
  options?: string[];
  correctAnswer?: string | number;
  correctAnswers?: string[];
  explanation?: string;
  points?: number;
  keywords?: string[];
}

export interface AITeachingAssistantResponse {
  suggestions: string[];
  misconceptions: string[];
  engagementTips: string[];
  assessmentIdeas: string[];
}

class AIService {
  private apiUrl = '/api/ai/generate';

  async generateLesson(
    prompt: string,
    context?: string,
    options?: AIGenerateOptions
  ): Promise<AILessonResponse> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'lesson',
          prompt,
          context,
          options,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate lesson');
      }

      const result = await response.json();
      return result.data as AILessonResponse;
    } catch (error: any) {
      console.error('Error generating lesson:', error);
      throw error;
    }
  }

  async generateContent(
    prompt: string,
    context?: string,
    options?: AIGenerateOptions
  ): Promise<AIContentResponse> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'content',
          prompt,
          context,
          options,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate content');
      }

      const result = await response.json();
      return result.data as AIContentResponse;
    } catch (error: any) {
      console.error('Error generating content:', error);
      throw error;
    }
  }

  async generateProblem(
    prompt: string,
    context?: string,
    options?: AIGenerateOptions
  ): Promise<AIProblemResponse> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'problem',
          prompt,
          context,
          options,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate problem');
      }

      const result = await response.json();
      return result.data as AIProblemResponse;
    } catch (error: any) {
      console.error('Error generating problem:', error);
      throw error;
    }
  }

  async getTeachingAssistant(
    prompt: string,
    context?: string
  ): Promise<AITeachingAssistantResponse> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'teaching-assistant',
          prompt,
          context,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get teaching assistance');
      }

      const result = await response.json();
      return result.data as AITeachingAssistantResponse;
    } catch (error: any) {
      console.error('Error getting teaching assistant:', error);
      throw error;
    }
  }
}

export const aiService = new AIService();

