import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { userInput } = await req.json();

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a response generator. You must ONLY return a JSON array of exactly 3 strings, with no explanation or additional text. Example format: [\"response 1\", \"response 2\", \"response 3\"]"
      },
      {
        role: "user",
        content: `Generate 3 natural conversational responses to: "${userInput}"`
      }
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  return new Response(JSON.stringify(response.choices[0].message.content), {
    headers: { 'Content-Type': 'application/json' },
  });
} 