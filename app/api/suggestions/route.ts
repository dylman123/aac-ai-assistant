import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatMessage {
  text: string;
  isUser: boolean;
}

const suggestionsSchema = z.object({
  suggestions: z.array(z.string())
});

export async function POST(request: Request) {
  try {
    const { userInput, chatHistory }: {
      userInput?: string; 
      chatHistory: ChatMessage[];
    } = await request.json();

    // Format chat history for the prompt
    const formattedHistory = chatHistory
      .map((msg: ChatMessage) => 
        `${msg.isUser ? "User" : "Partner"}: ${msg.text}`
      )
      .join('\n');

    const messages = [
      {
        role: "system",
        content: `You are an AI assistant helping someone with communication difficulties generate natural responses or follow-up questions in conversations. Your task is to provide exactly THREE appropriate suggestions.

CRITICAL RULES:
- Always respond with an array of length 3, with each element being a string that represents a suggestion
- If the user is typing something, every response MUST include their exact input somewhere in each suggestion
- Never include numbers, bullets, any other formatting, explanations, or additional text
- Keep responses natural, conversational and appropriate to the most recent message in the conversation history
- Make each suggestion distinct from the others
- Consider the full conversation context`
      },
      {
        role: "user",
        content: `Conversation history:
${formattedHistory}

${userInput ? `User is currently typing: "${userInput}"` : ''}`
      },
      {
        role: "assistant",
        content: '['
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: messages as ChatCompletionMessageParam[],
      temperature: 0.7,
      max_tokens: 200,
      response_format: zodResponseFormat(suggestionsSchema, 'suggestions'),
    });

    let suggestions = (JSON.parse(completion.choices[0]?.message?.content || '{ suggestions: [] }').suggestions || []) as string[]

    console.log({formattedHistory, userInput, suggestions})

    return NextResponse.json({ suggestions });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
} 