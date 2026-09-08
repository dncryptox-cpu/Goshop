/**
 * Gemini AI Translation Engine (EN -> VI)
 * Translates English X posts into natural Vietnamese while retaining crypto & tech terms.
 */

function isEnglish(text) {
  if (!text) return false;
  // Simple heuristic: ratio of common English words and ASCII characters
  const englishCommonWords = /\b(the|is|at|which|on|a|an|this|that|with|for|are|was|were|be|been|by|from|about|to|in|of|or|and|it|you|we|they)\b/i;
  const vietnameseAccents = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

  if (vietnameseAccents.test(text)) {
    return false; // Definitely Vietnamese
  }

  return englishCommonWords.test(text) || /[a-zA-Z]/.test(text);
}

async function translateEnToVi(text, geminiApiKey) {
  if (!text || text.trim() === '') return null;

  // If text is already in Vietnamese, no translation needed
  if (!isEnglish(text)) {
    console.log('[Translator] Post is already in Vietnamese. Skipping translation.');
    return null;
  }

  if (!geminiApiKey || geminiApiKey.trim() === '') {
    console.warn('[Translator] GEMINI_API_KEY is not configured in .env. Storing original text only.');
    return null;
  }

  const prompt = `Bạn là biên dịch viên tài chính & crypto chuyên nghiệp. Hãy dịch bài đăng trên X (Twitter) sau đây từ tiếng Anh sang tiếng Việt tự nhiên, ngắn gọn, giữ nguyên ngữ cảnh và các thuật ngữ chuyên ngành (như perp, liquidity, yield, long/short, vault, gas, TWAP, wallet, RPC). 

Nội dung bài đăng gốc:
"""
${text}
"""

Chỉ trả về nội dung đã dịch tiếng Việt, không kèm lời giải thích hay tựa đề.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Translator] Gemini API Error (${response.status}): ${errText}`);
      return null;
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      const translatedText = data.candidates[0].content.parts.map(p => p.text).join('').trim();
      return translatedText;
    }

    return null;

  } catch (err) {
    console.error(`[Translator] Exception during Gemini translation: ${err.message}`);
    return null;
  }
}

module.exports = {
  isEnglish,
  translateEnToVi
};
