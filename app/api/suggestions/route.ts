import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatMessage {
  text: string;
  isUser: boolean;
}

export async function POST(request: Request) {
  try {
    const { partnerInput, userInput, chatHistory }: {
      partnerInput?: string;
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
        content: `You are an AI assistant helping someone with communication difficulties generate natural responses in conversations. Your task is to provide exactly 3 appropriate response options.

Rules:
- Always provide exactly 3 responses, one per line
- Never include numbers, bullets, or any other formatting
- If the user has started typing, every response MUST start with their exact input
- Keep responses natural and conversational
- Make each response distinct
- Consider the full conversation context
- Never include explanations or additional text`
      },
      {
        role: "user",
        content: `Conversation history:
${formattedHistory}

${partnerInput ? `Partner's most recent message: "${partnerInput}"` : ''}
${userInput ? `User is currently typing: "${userInput}"` : ''}

CRITICAL: If the user is typing something, EVERY response MUST start with exactly "${userInput}". Do not alter or paraphrase their input - use it exactly as written.

Generate exactly 3 complete, natural responses that match these criteria:
- Start with the user's exact input if provided
- Are appropriate responses to the partner's message
- Consider the full conversation context
- Are distinct from each other
- Are natural and conversational

Important: Provide exactly 3 responses, one per line, with no numbers, bullets, or additional text.`
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages as ChatCompletionMessageParam[],
      temperature: 0.7,
      max_tokens: 200,
    });

    let suggestions = completion.choices[0].message?.content
      ?.split('\n')
      .filter((line: string) => line.trim().length > 0)
      .map((line: string) => line.replace(/^[-*\d.\s]+/, '').trim())
      .map((line: string) => line.replace(/^["](.*)["]$/, '$1'))
      .slice(0, 3) || [];

    // Ensure all suggestions start with user input if it exists
    console.log({userInput, suggestions, formattedHistory, partnerInput})
    if (userInput?.trim()) {
      suggestions = suggestions.map(suggestion => 
        suggestion.startsWith(userInput) 
          ? suggestion 
          : `${userInput}${suggestion}`
      );
    }

    return NextResponse.json({ suggestions });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
} 