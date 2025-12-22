import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, prompt, context, options } = body;

    // Get OpenAI API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Build the system prompt based on type
    let systemPrompt = '';
    let userPrompt = '';

    switch (type) {
      case 'lesson':
        systemPrompt = `You are an expert educational content creator. Generate comprehensive lesson plans that include:
- Clear learning objectives
- Engaging lesson descriptions
- Appropriate content structure
- Teaching strategies

Format your response as JSON with this structure:
{
  "title": "Lesson title",
  "description": "Detailed lesson description with objectives",
  "topic": "Main topic/subject",
  "suggestedContents": [
    {
      "type": "new-material",
      "title": "Content title",
      "description": "Content description"
    }
  ]
}`;
        userPrompt = `Create a lesson plan for: ${prompt}\n\nContext: ${context || 'No additional context'}`;
        break;

      case 'content':
        systemPrompt = `You are an expert educational content creator. Generate educational content that includes:
- Clear title and description
- Appropriate content type (new-material, guided-practice, classwork, homework, quiz, test)
- Teaching instructions
- Suggested problems/exercises

Format your response as JSON with this structure:
{
  "title": "Content title",
  "description": "Content description",
  "type": "content-type",
  "teachersInstructions": "Instructions for teachers",
  "suggestedProblems": [
    {
      "question": "Problem question",
      "type": "multiple-choice|open-ended|math-expression",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": "correct answer or index",
      "explanation": "Explanation of the answer",
      "points": 3
    }
  ]
}`;
        userPrompt = `Create ${options?.contentType || 'educational content'} for: ${prompt}\n\nContext: ${context || 'No additional context'}`;
        break;

      case 'problem':
        systemPrompt = `You are an expert educational content creator. Generate educational problems/exercises that include:
- Clear, well-formulated questions
- Appropriate problem type
- Correct answers with explanations
- Point values

Format your response as JSON with this structure:
{
  "question": "Problem question",
  "type": "multiple-choice|open-ended|math-expression|geometric",
  "options": ["option1", "option2", "option3", "option4"] (if multiple-choice),
  "correctAnswer": "correct answer or index",
  "correctAnswers": ["answer1", "answer2"] (if multiple correct answers),
  "explanation": "Detailed explanation of the answer",
  "points": 3,
  "keywords": ["keyword1", "keyword2"]
}`;
        userPrompt = `Create a ${options?.problemType || 'problem'} for: ${prompt}\n\nContext: ${context || 'No additional context'}`;
        break;

      case 'teaching-assistant':
        systemPrompt = `You are an expert teaching assistant. Provide helpful guidance for teachers including:
- Teaching strategies
- Common student misconceptions
- Engagement techniques
- Assessment suggestions

Format your response as JSON with this structure:
{
  "suggestions": [
    "Suggestion 1",
    "Suggestion 2"
  ],
  "misconceptions": [
    "Common misconception 1",
    "Common misconception 2"
  ],
  "engagementTips": [
    "Engagement tip 1",
    "Engagement tip 2"
  ],
  "assessmentIdeas": [
    "Assessment idea 1",
    "Assessment idea 2"
  ]
}`;
        userPrompt = `Provide teaching assistance for: ${prompt}\n\nContext: ${context || 'No additional context'}`;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid type' },
          { status: 400 }
        );
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using cost-effective model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate content', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'No content generated' },
        { status: 500 }
      );
    }

    // Parse JSON response
    try {
      const parsedContent = JSON.parse(content);
      return NextResponse.json({ data: parsedContent });
    } catch (parseError) {
      // If JSON parsing fails, return as text
      return NextResponse.json({ data: { content } });
    }
  } catch (error: any) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

