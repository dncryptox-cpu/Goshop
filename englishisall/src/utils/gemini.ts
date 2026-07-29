import type { GeminiEvaluation } from '../types';

const GEMINI_SYSTEM_PROMPT = `
You are an expert English evaluator & tutor for a Vietnamese freelance trader who also runs 100km ultra trail marathons.
Evaluate the user's English journal entry or spoken transcript.
You MUST return ONLY a valid JSON object matching this exact TypeScript structure:
{
  "is_english": boolean,
  "score": number,
  "feedback": string,
  "corrections": [
    {
      "original": string,
      "corrected": string
    }
  ]
}

Strict Rules:
1. "is_english": boolean. Return true if the submission is primarily written/spoken in English. Return false if it is gibberish, empty, or written mainly in Vietnamese.
2. "score": integer from 1 to 10 evaluating grammar, vocabulary accuracy, clarity, and expressiveness.
3. "feedback": Maximum 2 concise sentences in Vietnamese providing encouraging, practical feedback related to trading discipline, ultra trail mental resilience, or language improvement.
4. "corrections": Array with maximum 3 items containing ONLY genuine, impactful grammar or phrasing errors made by the user. If there are no errors, return an empty array []. "original" should be the exact flawed snippet, and "corrected" should be the natural English improvement. Do not invent errors if the text is already correct.
5. DO NOT return markdown formatting or extra text outside the JSON object.
`.trim();

export async function evaluateEnglishText(
  userText: string,
  apiKey: string
): Promise<GeminiEvaluation> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Chưa cấu hình API Key Gemini. Vui lòng vào Cài đặt để nhập API Key từ Google AI Studio.');
  }

  if (!userText || userText.trim().length < 5) {
    throw new Error('Vui lòng nhập ít nhất 5 ký tự tiếng Anh để Gemini đánh giá.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const payload = {
    systemInstruction: {
      parts: [{ text: GEMINI_SYSTEM_PROMPT }],
    },
    contents: [
      {
        parts: [{ text: userText.trim() }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 500,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      throw new Error('Đã vượt quá giới hạn lượt gọi AI (Free tier: 10 yêu cầu/phút). Vui lòng đợi 1 phút và thử lại.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error details:', errorText);
      throw new Error(`API Gemini báo lỗi (${response.status}). Vui lòng kiểm tra lại API Key trong cài đặt.`);
    }

    const data = await response.json();
    
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Không nhận được phản hồi hợp lệ từ Gemini API.');
    }

    // Try parsing JSON safely
    let parsed: GeminiEvaluation;
    try {
      // Strip potential code fences if any despite responseMimeType
      const cleanText = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error('JSON Parse Error:', parseErr, candidateText);
      throw new Error('Không thể phân tích phản hồi JSON từ AI. Vui lòng thử lại.');
    }

    // Normalize result
    return {
      is_english: Boolean(parsed.is_english),
      score: Math.max(1, Math.min(10, Math.round(Number(parsed.score) || 5))),
      feedback: parsed.feedback || 'Bài viết đã được ghi nhận.',
      corrections: Array.isArray(parsed.corrections)
        ? parsed.corrections.slice(0, 3).map(c => ({
            original: String(c.original || ''),
            corrected: String(c.corrected || ''),
          })).filter(c => c.original && c.corrected)
        : [],
    };
  } catch (err: any) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Đã xảy ra lỗi kết nối với Gemini AI.');
  }
}

export interface GeneratedMindsetCard {
  category: 'Trading' | 'Meditation' | 'Psychology' | 'Ultra Running';
  front: string;
  back: string;
}

const MINDSET_SYSTEM_PROMPT = `
You are a master mentor in Trading Psychology, Zen/Mindfulness Meditation, and Ultra Marathon Mental Toughness.
Generate 4 high-impact English flashcards that serve as daily wisdom mantras, mental anchors, and psychological tools for a Vietnamese trader and 100km ultra trail runner.

Return ONLY a raw JSON array matching this exact structure:
[
  {
    "category": "Trading" | "Meditation" | "Psychology" | "Ultra Running",
    "front": "A powerful principle, reflective question, or mindset rule in English.",
    "back": "The profound English wisdom mantra + concise Vietnamese explanation & mental action (Chấp nhận lỗ lập tức không để cái tôi can thiệp...)."
  }
]

Rules:
- Return exactly 4 unique cards.
- Focus on practical topics: Stop-loss discipline, FOMO control, Diaphragmatic breathing during market volatility, Non-attachment, Pain acceptance in 100km trail runs, Risk-Reward ratio.
- Keep English natural, sharp, and memorable.
- Provide clear Vietnamese translation and psychological key insight on the back side.
- DO NOT output any text or markdown syntax outside the JSON array.
`.trim();

export async function generateMindsetFlashcards(
  apiKey: string,
  categoryFilter: string = 'All'
): Promise<GeneratedMindsetCard[]> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Chưa cấu hình API Key Gemini. Vui lòng mở Cài đặt để nhập API Key.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const promptText = categoryFilter === 'All'
    ? 'Generate 4 wisdom mindset flashcards covering Trading, Meditation, Psychology, and Ultra Running.'
    : `Generate 4 wisdom mindset flashcards specifically focused on ${categoryFilter}.`;

  const payload = {
    systemInstruction: {
      parts: [{ text: MINDSET_SYSTEM_PROMPT }],
    },
    contents: [
      {
        parts: [{ text: promptText }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 800,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      throw new Error('Đã vượt quá giới hạn lượt gọi AI (Free tier: 10 yêu cầu/phút). Vui lòng đợi 1 phút.');
    }

    if (!response.ok) {
      throw new Error(`Gemini API báo lỗi (${response.status}). Vui lòng kiểm tra lại API Key.`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Không nhận được thẻ bài từ Gemini AI.');
    }

    const cleanText = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleanText);

    if (!Array.isArray(parsed)) {
      throw new Error('Dữ liệu thẻ AI không đúng cấu trúc mảng.');
    }

    return parsed.map((item: any) => ({
      category: item.category || 'Psychology',
      front: String(item.front || ''),
      back: String(item.back || ''),
    })).filter(item => item.front && item.back);
  } catch (err: any) {
    if (err instanceof Error) throw err;
    throw new Error('Không thể tạo thẻ AI mới.');
  }
}

