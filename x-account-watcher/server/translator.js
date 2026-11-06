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
 * Test Gemini API connection with a real lightweight prompt across v1beta & v1 API versions
 */
async function testGeminiConnection(geminiApiKey) {
  if (!geminiApiKey || geminiApiKey.trim() === '') {
    return { ok: false, status: 'unconfigured', message: 'Chưa cấu hình GEMINI_API_KEY trong file .env / Vercel' };
  }

  const cleanKey = geminiApiKey.trim();
  const versions = ['v1beta', 'v1'];
  const models = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-pro'];
  let lastError = null;

  for (const ver of versions) {
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${cleanKey}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hello' }] }]
          })
        });

        if (response.ok) {
          return { ok: true, status: 'ok', message: `Kết nối Gemini API (${ver}/${model}) hoạt động tốt.` };
        }

        const errText = await response.text();
        let parsedMsg = errText;
        try {
          const json = JSON.parse(errText);
          if (json.error && json.error.message) parsedMsg = json.error.message;
        } catch (e) {}

        lastError = `Gemini API (${ver}/${model}) Error ${response.status}: ${parsedMsg}`;
      } catch (err) {
        lastError = `Gemini API Exception (${ver}/${model}): ${err.message}`;
      }
    }
  }

  return { ok: false, status: 'error', message: lastError || 'Lỗi kết nối Gemini API' };
}

/**
 * Main translation function with multi-version & multi-model fallback and persistent DB error logging
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

  const cleanKey = geminiApiKey.trim();
  const prompt = `Bạn là biên dịch viên tài chính & crypto chuyên nghiệp. Hãy dịch bài đăng trên X (Twitter) sau đây từ tiếng Anh sang tiếng Việt tự nhiên, ngắn gọn, giữ nguyên ngữ cảnh và các thuật ngữ chuyên ngành (như perp, liquidity, yield, long/short, vault, gas, TWAP, wallet, RPC). 

Nội dung bài đăng gốc:
"""
${text}
"""

Chỉ trả về nội dung đã dịch tiếng Việt, không kèm lời giải thích hay tựa đề.`;

  const versions = ['v1beta', 'v1'];
  const models = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-pro'];
  let lastErrorDetail = null;

  for (const ver of versions) {
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${cleanKey}`;

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

          lastErrorDetail = `HTTP ${response.status} (${ver}/${model}): ${parsedMsg}`;
          console.error(`[Translator] Failed ${ver}/${model}:`, lastErrorDetail);

          // Record error into database api_logs table
          await dbAsync.run(`
            INSERT INTO api_logs (endpoint, status_code, requests_count, rate_limit_remaining, rate_limit_reset, note)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            `Gemini_Translate (${ver}/${model})`,
            response.status,
            1,
            0,
            new Date().toISOString(),
            `Lỗi dịch Gemini: ${parsedMsg.substring(0, 180)}`
          ]);

          continue;
        }

        const data = await response.json();
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
          const translatedText = data.candidates[0].content.parts.map(p => p.text).join('').trim();
          if (translatedText) {
            console.log(`[Translator] Successfully translated via ${ver}/${model}`);
            return translatedText;
          }
        }
      } catch (err) {
        lastErrorDetail = `Exception (${ver}/${model}): ${err.message}`;
        console.error(`[Translator] Exception ${ver}/${model}:`, err);
      }
    }
  }

  // Log final failure after trying all endpoints and models
  await dbAsync.run(`
    INSERT INTO api_logs (endpoint, status_code, requests_count, rate_limit_remaining, rate_limit_reset, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    'Gemini_Translate_Failed',
    500,
    1,
    0,
    new Date().toISOString(),
    `Tất cả endpoint Gemini đều thất bại: ${lastErrorDetail || 'Unknown error'}`
  ]);

  return null;
}

module.exports = {
  isEnglish,
  translateEnToVi,
  testGeminiConnection
};
