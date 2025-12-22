# AI Integration Setup Guide

This guide explains how to set up the AI features for curriculum generation and teaching assistance.

## Features

### Admin Portal
- **AI Lesson Generation**: Generate complete lesson plans with objectives, descriptions, and suggested content
- **AI Content Generation**: Generate educational content with teaching instructions and suggested problems
- **AI Problem Generation**: Generate problems with questions, answers, explanations, and keywords

### Teacher Portal
- **AI Teaching Assistant**: Get teaching strategies, common misconceptions, engagement tips, and assessment ideas

## Setup Instructions

### 1. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key (you won't be able to see it again)

### 2. Add API Key to Environment Variables

Create or update your `.env.local` file in the root directory:

```bash
OPENAI_API_KEY=your-api-key-here
```

**Important**: Never commit your API key to version control. The `.env.local` file should already be in `.gitignore`.

### 3. Deploy Environment Variable

If deploying to production (Vercel, etc.):

1. Go to your deployment platform's environment variables settings
2. Add `OPENAI_API_KEY` with your API key value
3. Redeploy your application

## Usage

### Admin Portal - Generating Content

1. Navigate to a class's curriculum page
2. Click the **"AI Generate"** button next to:
   - **Add Lesson** - Generate a complete lesson plan
   - **Add Content** - Generate educational content
   - **Add Problem** - Generate problems/exercises
3. Enter a description of what you want to generate
4. Optionally add grade level, subject, or additional context
5. Click **Generate**
6. Review the generated content and click **Add** to save it

### Teacher Portal - Teaching Assistant

1. Navigate to a class's curriculum page
2. Select a lesson and content item
3. Click on the **"AI Assistant"** tab
4. Enter a question or use quick prompts:
   - Common Misconceptions
   - Engagement Tips
   - Teaching Strategies
   - Assessment Ideas
5. Click **Get AI Assistance**
6. Review the suggestions and tips

## API Costs

The integration uses OpenAI's `gpt-4o-mini` model, which is cost-effective:
- Approximately $0.15 per 1M input tokens
- Approximately $0.60 per 1M output tokens

Typical usage:
- Lesson generation: ~$0.01-0.02 per lesson
- Content generation: ~$0.01-0.02 per content item
- Problem generation: ~$0.005-0.01 per problem
- Teaching assistant: ~$0.01-0.02 per query

## Troubleshooting

### "OpenAI API key not configured" Error

- Make sure `OPENAI_API_KEY` is set in `.env.local`
- Restart your development server after adding the key
- Check that the key is correct (starts with `sk-`)

### "Failed to generate content" Error

- Check your OpenAI account has credits
- Verify the API key has proper permissions
- Check the browser console for detailed error messages

### Slow Generation

- AI generation typically takes 5-15 seconds
- This is normal for AI content generation
- Check your internet connection if it's taking longer

## Security Notes

- API keys are stored server-side only (in API routes)
- Client-side code never sees the API key
- All AI requests go through `/api/ai/generate` route
- Consider setting up rate limiting for production use

