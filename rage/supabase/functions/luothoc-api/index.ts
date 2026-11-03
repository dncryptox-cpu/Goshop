// Lướt Học — Edge Function "api"
// Secrets cần đặt: GEMINI_API_KEY, RAPIDAPI_KEY (tuỳ chọn: GEMINI_MODEL)
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default);
const GEM = "https://generativelanguage.googleapis.com";
const DL_HOST = "auto-download-all-in-one.p.rapidapi.com";

class UserError extends Error {}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const LEVELS: Record<string, string> = {
  "mat-goc": "absolute beginner (lost the basics)", "co-ban": "elementary (A2)",
  "giao-tiep": "intermediate, can hold simple conversations (B1)", "kha": "upper-intermediate (B2+)",
};
const GOALS: Record<string, string> = {
  "giao-tiep": "everyday conversation", "cong-viec": "work and business",
  "du-lich": "travel", "phim-nhac": "understanding movies, shows and music",
};

/* ---------------- helpers ---------------- */
function platformOf(u: string) {
  const s = u.toLowerCase();
  if (/youtube\.com|youtu\.be/.test(s)) return "youtube";
  if (/tiktok\.com/.test(s)) return "tiktok";
  if (/instagram\.com/.test(s)) return "instagram";
  if (/facebook\.com|fb\.watch/.test(s)) return "facebook";
  if (/threads\.(net|com)/.test(s)) return "threads";
  if (/twitter\.com|x\.com/.test(s)) return "x";
  return "web";
}
function ytId(u: string) {
  const m = u.match(/(?:shorts\/|v=|youtu\.be\/|embed\/|live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function urlKey(u: string, plat: string) {
  if (plat === "youtube") { const id = ytId(u); if (id) return "yt:" + id; }
  if (plat === "facebook") return u;
  try { const x = new URL(u); return x.origin + x.pathname.replace(/\/$/, ""); } catch { return u; }
}
const MIME: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4a: "audio/mp4", mp3: "audio/mpeg", aac: "audio/aac", opus: "audio/ogg" };

async function resolveMedia(url: string) {
  const key = Deno.env.get("RAPIDAPI_KEY");
  if (!key) throw new UserError("Hiện mới hỗ trợ link YouTube. Các nền tảng khác sẽ bật sớm.");
  const r = await fetch(`https://${DL_HOST}/v1/social/autolink`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-rapidapi-key": key, "x-rapidapi-host": DL_HOST },
    body: JSON.stringify({ url }),
  });
  if (r.status === 401 || r.status === 403) throw new Error("RapidAPI từ chối key.");
  if (r.status === 429) throw new UserError("Hệ thống tải video đang hết lượt, thử lại sau.");
  const d = await r.json().catch(() => null);
  if (!d || d.error) throw new UserError("Không lấy được video từ link này. Link có thể riêng tư hoặc đã bị xoá.");
  const medias = (d.medias || []).filter((m: any) => m?.url);
  const isAudio = (m: any) => m.type === "audio" || /^(m4a|mp3|aac|opus)$/i.test(m.extension || "");
  const isVideo = (m: any) => !isAudio(m) && (m.type === "video" || /^(mp4|webm|mov)$/i.test(m.extension || ""));
  const score = (m: any) => (/mp4/i.test(m.extension || "") ? 4 : 0) + (/no[_ ]?audio|video[_ ]?only/i.test(m.quality || "") ? 0 : 3) + (/no[_ ]?watermark/i.test(m.quality || "") ? 2 : 0);
  const video = medias.filter(isVideo).sort((a: any, b: any) => score(b) - score(a))[0];
  const audio = medias.find(isAudio);
  if (!video && !audio) throw new UserError("Link này không có video.");
  return {
    title: d.title || "",
    video: video?.url, videoExt: video?.extension || "mp4",
    audio: audio?.url, audioExt: audio?.extension || "m4a",
  };
}

async function fetchBytes(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("Không tải được file video (" + r.status + ")");
  return new Uint8Array(await r.arrayBuffer());
}

async function gemini(parts: unknown[], jsonOut = true) {
  const key = Deno.env.get("GEMINI_API_KEY")!;
  const models = [...new Set([Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash", "gemini-flash-latest"])];
  let last = "";
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(`${GEM}/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.2, ...(jsonOut ? { responseMimeType: "application/json" } : {}) },
        }),
      });
      const d = await r.json();
      if (!d.error) {
        const text = (d.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
        return jsonOut ? JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) : text;
      }
      last = d.error.message || "";
      if (/private|unlisted/i.test(last)) throw new UserError("Video riêng tư hoặc không công khai, AI không đọc được.");
      const busy = r.status === 503 || r.status === 429 || /high demand|overloaded|unavailable|try again/i.test(last);
      if (!busy) break;
      await new Promise((ok) => setTimeout(ok, 2000 * (attempt + 1)));
    }
  }
  throw new UserError("AI đang quá tải, thử lại sau 1 phút.");
}

async function geminiUpload(bytes: Uint8Array, mime: string) {
  const key = Deno.env.get("GEMINI_API_KEY")!;
  const r = await fetch(`${GEM}/upload/v1beta/files?uploadType=media&key=${key}`, {
    method: "POST", headers: { "content-type": mime }, body: bytes,
  });
  let f = (await r.json()).file;
  if (!f) throw new Error("Upload Gemini thất bại");
  for (let i = 0; i < 40 && f.state === "PROCESSING"; i++) {
    await new Promise((ok) => setTimeout(ok, 2500));
    f = await (await fetch(`${GEM}/v1beta/${f.name}?key=${key}`)).json();
  }
  if (f.state === "FAILED") throw new UserError("AI không xử lý được video này.");
  return f;
}

/* ---------------- prompts ---------------- */
const TRANSCRIBE = `Transcribe ALL spoken English in this video with accurate timestamps.
Return ONLY JSON: {"title":"short Vietnamese title for this clip","level":"A1|A2|B1|B2|C1",
"lines":[{"s":start_seconds,"e":end_seconds,"en":"exact words spoken","vi":"natural Vietnamese translation"}]}
Rules: lines in order, max ~14 words each, timestamps to 0.1s, keep contractions, no speaker labels, no summarizing.
If there is no English speech, return {"title":"","level":"","lines":[]}.`;

function phrasePrompt(lines: any[], prof: any) {
  return `You are an English coach for a Vietnamese learner. Learner level: ${LEVELS[prof?.level] || "intermediate"}. Goal: ${GOALS[prof?.goal] || "everyday conversation"}.
From this transcript, pick 3 to 5 phrases this learner should learn: reusable collocations, phrasal verbs or idioms that fit their level and goal (skip words too easy for them).
Transcript lines (index: text):
${lines.map((l, i) => `${i}: ${l.en}`).join("\n")}
Return ONLY JSON: {"phrases":[{"en":"phrase copied exactly from a line","vi":"Vietnamese meaning","note":"one short Vietnamese sentence on when/how to use it, matched to the learner's goal","line":line_index,"wrong":["plausible wrong Vietnamese meaning","another plausible wrong meaning"]}]}`;
}

function cleanLines(raw: any[]) {
  return (raw || []).filter((l) => l?.en && isFinite(l.s)).map((l) => ({
    s: +l.s, e: isFinite(l.e) && +l.e > +l.s ? +l.e : +l.s + 2, en: String(l.en).trim(), vi: String(l.vi || "").trim(),
  })).sort((a, b) => a.s - b.s);
}
function cleanPhrases(raw: any[], lines: any[]) {
  return (raw || []).filter((p) => p?.en && p?.vi).map((p) => {
    let li = Math.max(0, Math.min(lines.length - 1, parseInt(p.line, 10) || 0));
    const hit = lines.findIndex((l) => l.en.toLowerCase().includes(String(p.en).toLowerCase()));
    if (hit >= 0) li = hit;
    return { en: String(p.en), vi: String(p.vi), note: String(p.note || ""), line: li, wrong: (p.wrong || []).slice(0, 2).map(String) };
  });
}

/* ---------------- actions ---------------- */
async function getVideo(url: string) {
  const plat = platformOf(url);
  const key = urlKey(url, plat);
  const { data: hit } = await admin.from("lh_videos").select("*").eq("url_key", key).maybeSingle();
  if (hit) return hit;

  let parts: unknown[], media: any, title = "";
  const yid = plat === "youtube" ? ytId(url) : null;
  if (yid) {
    parts = [{ fileData: { fileUri: "https://www.youtube.com/watch?v=" + yid } }];
    media = { type: "yt", id: yid };
  } else {
    const m = await resolveMedia(url);
    title = m.title;
    const src = m.audio || m.video;
    const ext = m.audio ? m.audioExt : m.videoExt;
    const bytes = await fetchBytes(src);
    const mime = MIME[String(ext).toLowerCase()] || "video/mp4";
    if (bytes.length <= 18 * 1024 * 1024) {
      parts = [{ inlineData: { mimeType: mime, data: encodeBase64(bytes) } }];
    } else {
      const f = await geminiUpload(bytes, mime);
      parts = [{ fileData: { fileUri: f.uri, mimeType: f.mimeType } }];
    }
    media = { type: "mp4", url: m.video || m.audio, ext: m.video ? m.videoExt : m.audioExt, at: Date.now() };
  }
  const g = await gemini([...parts, { text: TRANSCRIBE }]);
  const lines = cleanLines(g.lines);
  if (!lines.length) throw new UserError("Không nghe thấy tiếng Anh trong video này.");
  const row = { url_key: key, url, platform: plat, title: g.title || title || "Video", level: g.level || "", media, lines };
  const { data, error } = await admin.from("lh_videos").upsert(row, { onConflict: "url_key" }).select().single();
  if (error) throw error;
  return data;
}

async function addLesson(user: any, url: string) {
  const m = String(url || "").match(/https?:\/\/\S+/);
  if (!m) throw new UserError("Dán một link video (YouTube, TikTok, Instagram, Facebook, Threads, X…).");
  const link = m[0];
  const { data: prof } = await admin.from("lh_profiles").select("*").eq("id", user.id).single();

  // Bài đã có → mở lại, không tính lượt
  const plat = platformOf(link);
  const { data: v0 } = await admin.from("lh_videos").select("id").eq("url_key", urlKey(link, plat)).maybeSingle();
  if (v0) {
    const { data: l0 } = await admin.from("lh_lessons").select("id").eq("user_id", user.id).eq("video_id", v0.id).maybeSingle();
    if (l0) return await openLesson(user, l0.id);
  }

  // Hạn mức theo ngày (giờ Việt Nam)
  const start = new Date(Date.now() + 7 * 3600e3); start.setUTCHours(0, 0, 0, 0);
  const since = new Date(start.getTime() - 7 * 3600e3).toISOString();
  const { count } = await admin.from("lh_lessons").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  const limit = prof?.daily_limit ?? 5;
  if ((count ?? 0) >= limit) throw new UserError(`Hôm nay bạn đã học đủ ${limit} video. Mai quay lại nhé, hoặc ôn lại các cụm đã lưu.`);

  const video = await getVideo(link);
  const pp = await gemini([{ text: phrasePrompt(video.lines, prof) }]);
  const phrases = cleanPhrases(pp.phrases, video.lines);
  const { data: les, error } = await admin.from("lh_lessons")
    .upsert({ user_id: user.id, video_id: video.id, phrases }, { onConflict: "user_id,video_id" }).select().single();
  if (error) throw error;
  return { ...les, video };
}

async function openLesson(user: any, id: string) {
  const { data: les } = await admin.from("lh_lessons").select("*, video:lh_videos(*)").eq("id", id).eq("user_id", user.id).single();
  if (!les) throw new UserError("Không tìm thấy bài học.");
  const v = les.video;
  if (v.media?.type === "mp4" && Date.now() - (v.media.at || 0) > 2 * 3600e3) {
    try {
      const m = await resolveMedia(v.url);
      v.media = { type: "mp4", url: m.video || m.audio, ext: m.video ? m.videoExt : m.audioExt, at: Date.now() };
      await admin.from("lh_videos").update({ media: v.media }).eq("id", v.id);
    } catch { /* giữ link cũ */ }
  }
  return les;
}

async function ask(user: any, line: string, question: string) {
  const { data: prof } = await admin.from("lh_profiles").select("level,goal").eq("id", user.id).single();
  const q = String(question || "").slice(0, 300);
  return await gemini([{ text: `You are a friendly English coach. Answer in Vietnamese, short (max 90 words), plain text, no markdown headers.
Learner level: ${LEVELS[prof?.level] || "intermediate"}. Goal: ${GOALS[prof?.goal] || "everyday conversation"}.
English sentence from a video: "${String(line).slice(0, 300)}"
${q ? `Learner's question: ${q}` : "Explain naturally what it means, why it is said this way, and give 2 short example sentences (English + Vietnamese) fitting the learner's goal."}` }], false);
}

async function speak(target: string, b64: string, mime: string) {
  if (!b64 || b64.length > 4_000_000) throw new UserError("Bản ghi quá dài, nói lại ngắn hơn nhé.");
  return await gemini([
    { inlineData: { mimeType: mime || "audio/webm", data: b64 } },
    { text: `A Vietnamese learner tried to say: "${String(target).slice(0, 200)}".
Listen and grade pronunciation and fluency. Return ONLY JSON:
{"heard":"what you actually heard","score":0-100,"tip":"one short, concrete Vietnamese tip on the biggest issue (which sound/word and how to fix it)","good":"one short Vietnamese compliment on what was good"}` },
  ]);
}

async function proxy(user: any, id: string) {
  const les = await openLesson(user, id);
  const url = les.video.media?.url;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok || !r.body) throw new UserError("Không phát được video này.");
  return new Response(r.body, { headers: { ...CORS, "Content-Type": r.headers.get("content-type") || "video/mp4" } });
}

/* ---------------- nói theo nghĩa (ôn chủ động) ---------------- */
async function recall(target: string, vi: string, b64: string, mime: string) {
  if (!b64 || b64.length > 4_000_000) throw new UserError("Bản ghi quá dài, nói lại ngắn hơn nhé.");
  return await gemini([
    { inlineData: { mimeType: mime || "audio/webm", data: b64 } },
    { text: `A Vietnamese learner sees the Vietnamese meaning "${String(vi).slice(0, 200)}" and must say the English phrase "${String(target).slice(0, 200)}".
Listen. Accept small grammar slips or close natural paraphrases with the same meaning. Return ONLY JSON:
{"heard":"what you heard","correct":true|false,"score":0-100,"tip":"one short Vietnamese sentence: what was missing or mispronounced, or a short praise if correct"}` },
  ]);
}

/* ---------------- hội thoại theo tình huống ---------------- */
function sceneText(scene: any, prof: any, phrases: string[]) {
  return `You are role-playing to help a Vietnamese English learner practise speaking.
Learner level: ${LEVELS[prof?.level] || "beginner"}. Scenario: ${String(scene?.t || "").slice(0, 120)}.
Your role: ${String(scene?.ai || "").slice(0, 300)}
The learner's goal in this conversation: ${String(scene?.goal || "").slice(0, 300)}
Rules for your replies: stay in role; use very simple, natural spoken English (A2); 1-2 short sentences; usually end with an easy question so the learner keeps talking.
When it fits naturally, reuse some phrases the learner studied: ${(phrases || []).slice(0, 12).map((p) => `"${String(p).slice(0, 60)}"`).join(", ") || "(none)"}.`;
}
function histText(history: any[]) {
  return (history || []).slice(-12).map((h) => `${h.r === "ai" ? "YOU" : "LEARNER"}: ${String(h.en || "").slice(0, 300)}`).join("\n");
}
async function chat(user: any, body: any) {
  const { data: prof } = await admin.from("lh_profiles").select("level,goal").eq("id", user.id).single();
  const base = sceneText(body.scene, prof, body.phrases);
  if (!body.audio) {
    return await gemini([{ text: `${base}
Start the conversation with your first line. Return ONLY JSON:
{"reply":"your first line","reply_vi":"Vietnamese translation","hint":"a simple English sentence the learner could answer with","hint_vi":"its Vietnamese"}` }]);
  }
  if (body.audio.length > 4_000_000) throw new UserError("Bản ghi quá dài, nói ngắn hơn nhé.");
  return await gemini([
    { inlineData: { mimeType: body.mime || "audio/webm", data: body.audio } },
    { text: `${base}
Conversation so far:
${histText(body.history)}
The audio is the learner's next turn. Listen, then return ONLY JSON:
{"heard":"exactly what the learner said (best guess, English; if they used Vietnamese write it as is)",
"better":"a natural, correct English version of what they meant (same as heard if already good)",
"fix_vi":"one short Vietnamese note on the single most important mistake (grammar, word or pronunciation); empty string if none",
"reply":"your next line in role","reply_vi":"Vietnamese translation of your reply",
"hint":"a simple English sentence the learner could say next","hint_vi":"its Vietnamese",
"goal_met":true|false}` },
  ]);
}
async function chatEval(user: any, body: any) {
  const { data: prof } = await admin.from("lh_profiles").select("level").eq("id", user.id).single();
  return await gemini([{ text: `Evaluate a Vietnamese learner's speaking in this role-play. Learner level: ${LEVELS[prof?.level] || "beginner"}.
Scenario: ${String(body.scene?.t || "").slice(0, 120)}. Learner's goal: ${String(body.scene?.goal || "").slice(0, 300)}
Transcript:
${histText(body.history)}
Judge mainly: did they communicate the goal so a listener understands? Be encouraging but honest for their level.
Return ONLY JSON: {"score":0-100,"passed":true|false (true if score>=60),"summary_vi":"2 short Vietnamese sentences on how they did","tips_vi":["up to 2 short Vietnamese tips"],"useful":[{"en":"a useful phrase for this situation","vi":"meaning"}]}` }]);
}

/* ---------------- router ---------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const auth = req.headers.get("Authorization") || "";
    const { data: { user } } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "Phiên đăng nhập đã hết, đăng nhập lại nhé." }, 401);
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case "add": return json(await addLesson(user, body.url));
      case "open": return json(await openLesson(user, body.id));
      case "ask": return json({ answer: await ask(user, body.line, body.question) });
      case "speak": return json(await speak(body.target, body.audio, body.mime));
      case "recall": return json(await recall(body.target, body.vi, body.audio, body.mime));
      case "chat": return json(await chat(user, body));
      case "chat_eval": return json(await chatEval(user, body));
      case "proxy": return await proxy(user, body.id);
      default: return json({ error: "Không rõ thao tác." }, 400);
    }
  } catch (e) {
    console.error(e);
    const msg = e instanceof UserError ? e.message : "Có lỗi khi xử lý. Thử lại sau ít phút.";
    return json({ error: msg }, e instanceof UserError ? 400 : 500);
  }
});
