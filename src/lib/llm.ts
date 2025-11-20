import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const MAX_TOKENS = 1400;
const TEMPERATURE = 0.0;

export async function generateTestsWithLLM(prompt: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('LLM returned no content');
    }

    return content;
  } catch (error) {
    console.error('LLM generation error:', error);
    throw new Error(`Failed to generate tests: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}