const { dbAsync } = require('./db');

/**
 * Gemini AI Translation Engine (EN -> VI)
 * Translates English X posts into natural Vietnamese while retaining crypto & tech terms.
 */

function isEnglish(text) {
  if (!text) return false;
  const englishCommonWords = /\b(the|is|at|which|on|a|an|this|that|with|for|are|was|were|be|been|by|from|about|to|in|of|or|and|it|you|we|they)\b/i;
  const vietnameseAccents = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

  if (vietnameseAccents.test(text)) {
    return false; // Definitely Vietnamese
  }

  return englishCommonWords.test(text) || /[a-zA-Z]/.test(text);
}

/**
 * Test Gemini API connection with a real lightweight prompt
 */
async function testGeminiConnection(geminiApiKey) {
  if (!geminiApiKey || geminiApiKey.trim() === '') {
    return { ok: false, status: 'unconfigured', message: 'Chưa cấu hình GEMINI_API_KEY trong file .env / Vercel' };
  }

  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
  let lastError = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey.trim()}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello' }] }]
        })
      });

      if (response.ok) {
        return { ok: true, status: 'ok', message: `Kết nối Gemini API (${model}) hoạt động bình thường.` };
      }

      const errText = await response.text();
      let parsedMsg = errText;
      try {
        const json = JSON.parse(errText);
        if (json.error && json.error.message) parsedMsg = json.error.message;
      } catch (e) {}

      lastError = `Gemini API (${model}) Error ${response.status}: ${parsedMsg}`;
      console.error(`[Translator_HealthCheck] ${lastError}`);
    } catch (err) {
      lastError = `Gemini API Exception: ${err.message}`;
      console.error(`[Translator_HealthCheck] ${lastError}`);
    }
  }

  return { ok: false, status: 'error', message: lastError || 'Lỗi kết nối Gemini API' };
}

/**
 * Main translation function with fallback models and persistent error logging
 */
async function translateEnToVi(text, geminiApiKey) {
  if (!text || text.trim() === '') return null;

  if (!isEnglish(text)) {
    console.log('[Translator] Post is already in Vietnamese. Skipping translation.');
    return null;
  }

  if (!geminiApiKey || geminiApiKey.trim() === '') {
    console.warn('[Translator] GEMINI_API_KEY is missing. Skipping translation.');
    return null;
  }

  const prompt = `Bạn là biên dịch viên tài chính & crypto chuyên nghiệp. Hãy dịch bài đăng trên X (Twitter) sau đây từ tiếng Anh sang tiếng Việt tự nhiên, ngắn gọn, giữ nguyên ngữ cảnh và các thuật ngữ chuyên ngành (như perp, liquidity, yield, long/short, vault, gas, TWAP, wallet, RPC). 

Nội dung bài đăng gốc:
"""
${text}
"""

Chỉ trả về nội dung đã dịch tiếng Việt, không kèm lời giải thích hay tựa đề.`;

  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
  let lastErrorDetail = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey.trim()}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        let parsedMsg = errText;
        try {
          const json = JSON.parse(errText);
          if (json.error && json.error.message) parsedMsg = json.error.message;
        } catch (e) {}

        lastErrorDetail = `HTTP ${response.status} (${model}): ${parsedMsg}`;
        console.error(`[Translator] Failed model ${model}:`, lastErrorDetail);

        // Record error to database log table
        await dbAsync.run(`
          INSERT INTO api_logs (endpoint, status_code, requests_count, rate_limit_remaining, rate_limit_reset, note)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          `Gemini_Translate (${model})`,
          response.status,
          1,
          0,
          new Date().toISOString(),
          `Lỗi dịch Gemini: ${parsedMsg.substring(0, 180)}`
        ]);

        continue; // Try next model
      }

      const data = await response.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        const translatedText = data.candidates[0].content.parts.map(p => p.text).join('').trim();
        if (translatedText) {
          console.log(`[Translator] Successfully translated via ${model}`);
          return translatedText;
        }
      }
    } catch (err) {
      lastErrorDetail = `Exception (${model}): ${err.message}`;
      console.error(`[Translator] Exception model ${model}:`, err);
    }
  }

  // Log final failure after trying all models
  await dbAsync.run(`
    INSERT INTO api_logs (endpoint, status_code, requests_count, rate_limit_remaining, rate_limit_reset, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    'Gemini_Translate_Failed',
    500,
    1,
    0,
    new Date().toISOString(),
    `Tất cả model Gemini đều thất bại: ${lastErrorDetail || 'Unknown error'}`
  ]);

  return null;
}

module.exports = {
  isEnglish,
  translateEnToVi,
  testGeminiConnection
};
