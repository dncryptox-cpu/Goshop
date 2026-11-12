// DNC Desk — Edge Function "desk-bot": nhận MỌI tin nhắn của @goshopassistantbot và lưu vào bảng desk_inbox.
// Webhook Telegram trỏ thẳng vào đây (luôn trả 200 → Telegram không bao giờ kẹt hàng đợi).
// Tắt "Verify JWT" cho function này. Secrets: TG_BOT_TOKEN, TG_SECRET, GEMINI_API_KEY (tuỳ chọn: TG_CHAT_ID, DESK_USER_ID, GEMINI_MODEL)
// Cài webhook 1 lần: mở  https://<project>.supabase.co/functions/v1/desk-bot?setup=<TG_SECRET>
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default);
const TOKEN = Deno.env.get("TG_BOT_TOKEN") || "";
const SECRET = Deno.env.get("TG_SECRET") || "";
const CHAT = Deno.env.get("TG_CHAT_ID") || "1134598172";
const DESK = "https://godnc.com/desk/";
const TZ_MS = 7 * 3600e3;
const BUCKET = "desk-inbox";
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const KIND: Record<string, string> = { shop: "Shop", personal: "Cá nhân", trading: "Trading", crypto: "Crypto", remind: "Nhớ" };

const ok = (b: unknown = { ok: true }) => new Response(JSON.stringify(b), { headers: { "Content-Type": "application/json" } });
const esc = (s: string) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const today = (off = 0) => new Date(Date.now() + TZ_MS + off * 864e5).toISOString().slice(0, 10);
const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const fmtDue = (d?: string | null) => {
  if (!d) return "";
  if (d === today()) return "hôm nay";
  if (d === today(1)) return "mai";
  const x = new Date(d + "T00:00:00Z");
  return `${WD[x.getUTCDay()]} ${d.slice(8)}/${d.slice(5, 7)}`;
};

async function tg(method: string, body: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) console.error(method, JSON.stringify(j).slice(0, 300));
  return j;
}
const say = (text: string, extra: Record<string, unknown> = {}) =>
  tg("sendMessage", { chat_id: CHAT, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...extra });

/* ---------- chủ Desk: tài khoản cố định theo email (bảng desk_docs còn dùng chung với Trading OS) ---------- */
let OWNER = Deno.env.get("DESK_USER_ID") || "";
const OWNER_EMAIL = (Deno.env.get("DESK_OWNER_EMAIL") || "dncryptox@gmail.com").toLowerCase();
async function owner() {
  if (OWNER) return OWNER;
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("Không đọc được danh sách tài khoản: " + error.message);
    const u = (data?.users || []).find((x: any) => (x.email || "").toLowerCase() === OWNER_EMAIL);
    if (u) return (OWNER = u.id);
    if (!data?.users?.length || data.users.length < 200) break;
  }
  // dự phòng: tài khoản đang có mục Inbox
  const { data: r } = await db.from("desk_inbox").select("user_id").order("id", { ascending: false }).limit(1).maybeSingle();
  if (r?.user_id) return (OWNER = r.user_id);
  throw new Error(`Không thấy tài khoản ${OWNER_EMAIL} trên Desk`);
}

/* ---------- đọc nội dung tin ---------- */
function fwdOf(m: any): string | null {
  const o = m.forward_origin;
  if (o) {
    if (o.type === "user") return [o.sender_user.first_name, o.sender_user.last_name].filter(Boolean).join(" ") + (o.sender_user.username ? ` (@${o.sender_user.username})` : "");
    if (o.type === "hidden_user") return o.sender_user_name;
    if (o.type === "chat") return o.sender_chat?.title || "nhóm";
    if (o.type === "channel") return o.chat?.title || "kênh";
  }
  if (m.forward_from) return [m.forward_from.first_name, m.forward_from.last_name].filter(Boolean).join(" ");
  if (m.forward_sender_name) return m.forward_sender_name;
  return null;
}
function textOf(m: any): string {
  const parts: string[] = [];
  if (m.text) parts.push(m.text);
  if (m.caption) parts.push(m.caption);
  if (m.contact) parts.push(`Danh bạ: ${[m.contact.first_name, m.contact.last_name].filter(Boolean).join(" ")} ${m.contact.phone_number}`);
  if (m.location) parts.push(`Vị trí: https://maps.google.com/?q=${m.location.latitude},${m.location.longitude}`);
  if (m.venue) parts.push(`${m.venue.title} — ${m.venue.address}`);
  if (m.poll) parts.push(`Bình chọn: ${m.poll.question}\n${m.poll.options.map((o: any) => "• " + o.text).join("\n")}`);
  if (m.sticker) parts.push(`[sticker ${m.sticker.emoji || ""}]`);
  // giữ link ẩn trong chữ (text_link) để không mất URL
  const ents = [...(m.entities || []), ...(m.caption_entities || [])].filter((e: any) => e.type === "text_link").map((e: any) => e.url);
  if (ents.length) parts.push(ents.join("\n"));
  return parts.join("\n\n").trim();
}
function fileOf(m: any): { id: string; name: string; type: string; size?: number } | null {
  if (m.photo?.length) { const p = m.photo[m.photo.length - 1]; return { id: p.file_id, name: `photo_${m.message_id}.jpg`, type: "image/jpeg", size: p.file_size }; }
  if (m.document) return { id: m.document.file_id, name: m.document.file_name || `file_${m.message_id}`, type: m.document.mime_type || "application/octet-stream", size: m.document.file_size };
  if (m.voice) return { id: m.voice.file_id, name: `voice_${m.message_id}.ogg`, type: m.voice.mime_type || "audio/ogg", size: m.voice.file_size };
  if (m.audio) return { id: m.audio.file_id, name: m.audio.file_name || `audio_${m.message_id}.mp3`, type: m.audio.mime_type || "audio/mpeg", size: m.audio.file_size };
  if (m.video) return { id: m.video.file_id, name: m.video.file_name || `video_${m.message_id}.mp4`, type: m.video.mime_type || "video/mp4", size: m.video.file_size };
  if (m.video_note) return { id: m.video_note.file_id, name: `round_${m.message_id}.mp4`, type: "video/mp4", size: m.video_note.file_size };
  if (m.animation) return { id: m.animation.file_id, name: m.animation.file_name || `gif_${m.message_id}.mp4`, type: m.animation.mime_type || "video/mp4", size: m.animation.file_size };
  return null;
}

/* tải file từ Telegram → Storage. Lỗi thì vẫn ghi lại tên file + lý do (không mất dấu). */
async function saveFile(uid: string, id: number, f: NonNullable<ReturnType<typeof fileOf>>) {
  const name = f.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const meta: any = { name: f.name, type: f.type, size: f.size, tg_file: f.id };
  try {
    if ((f.size || 0) > 20e6) throw new Error("File > 20MB, Telegram không cho bot tải. Mở lại tin trong Telegram.");
    const g = await tg("getFile", { file_id: f.id });
    if (!g.ok) throw new Error(g.description || "getFile lỗi");
    const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${g.result.file_path}`);
    if (!r.ok) throw new Error("Tải file lỗi " + r.status);
    const bytes = new Uint8Array(await r.arrayBuffer());
    const path = `${uid}/${id}/${Date.now().toString(36)}_${name}`;
    const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: f.type, upsert: true });
    if (up.error) throw up.error;
    meta.path = path; meta.size = bytes.length;
    return { meta, bytes };
  } catch (e) {
    meta.error = (e as Error).message;
    return { meta, bytes: null };
  }
}

/* ---------- AI: tiêu đề + loại + hạn (+ chép lời voice) ----------
   Gemini hay quá tải (503, treo lâu) → mỗi model tối đa 20s, lỗi thì để ai.pending, cron thử lại mỗi 10 phút. */
const MODELS = [...new Set([Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash", "gemini-flash-latest", "gemini-flash-lite-latest"])];
async function enrich(raw: string, fwd: string | null, media: { type: string; bytes: Uint8Array }[]) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;
  const t = today();
  const prompt = `Bạn là trợ lý phân loại hộp thư cho DNL — chủ shop bán tài khoản YouTube Premium/Netflix/ChatGPT chia sẻ (có CTV Tuấn, Vương, Lộc), đồng thời trade crypto và chạy trail.
Hôm nay là ${t} (${WD[new Date(t + "T00:00:00Z").getUTCDay()]}), múi giờ GMT+7.
Đọc mục DNL vừa ghi lại (chữ, ảnh chụp màn hình, voice, file) và trả JSON:
{"title": tiêu đề ngắn ≤ 12 từ, nói rõ cần làm gì hoặc là gì, tiếng Việt, giữ nguyên tên người, email, số điện thoại,
 "kind": mảng của mục, chọn 1:
   "shop" — Goshop: khách, đơn, gia hạn, fam, CTV, bot hỗ trợ khách, email/mật khẩu/2FA tài khoản YouTube, Netflix, ChatGPT, hoàn tiền
   "trading" — lệnh, setup, chart, sàn, futures, funding, nhật ký giao dịch
   "crypto" — coin, ví, airdrop, onchain, nắm giữ dài hạn, dự án crypto
   "personal" — việc cá nhân, gia đình, chạy bộ, sức khoẻ, mua sắm, học, build app riêng
   "remind" — thứ cần nhớ làm vào lúc nào đó, không gấp, không thuộc rõ mảng nào,
 "due": "YYYY-MM-DD" nếu nội dung nêu rõ thời hạn (mai, thứ 6, tối nay, 20/11...) còn không thì null,
 "transcript": nếu có voice/audio thì chép nguyên lời tiếng Việt, không thì null,
 "summary": nếu là ảnh chụp/file thì tóm tắt 1-2 câu nội dung chính (tên khách, email, yêu cầu), không thì null}`;
  const parts: any[] = [{ text: prompt }, { text: `Nội dung chữ:\n${raw || "(không có)"}${fwd ? `\n\nChuyển tiếp từ: ${fwd}` : ""}` }];
  for (const m of media) {
    if (m.bytes.length > 7e6) continue;
    if (/^(image\/|audio\/|application\/pdf)/.test(m.type)) parts.push({ inline_data: { mime_type: m.type, data: encodeBase64(m.bytes) } });
  }
  if (await aiPaused()) return null;
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }),
      });
      if (!r.ok) {
        console.error("gemini", model, r.status, (await r.text()).slice(0, 160));
        // hết hạn mức: dừng gọi AI 3 tiếng để không ăn hết quota của bot hỗ trợ khách / báo cáo sáng
        if (r.status === 429) { await pauseAI(3); return null; }
        continue;
      }
      const j = await r.json();
      let out = JSON.parse(j.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "{}");
      if (Array.isArray(out)) out = out[0] || {};
      if (!out || typeof out.title !== "string" || !out.title.trim()) { console.error("gemini", model, "trả về thiếu title"); continue; }
      if (!KIND[out.kind]) out.kind = guessKind(raw);
      if (out.due && !/^\d{4}-\d{2}-\d{2}$/.test(out.due)) out.due = null;
      out.model = model;
      return out;
    } catch (e) { console.error("gemini", model, (e as Error).message); }
  }
  return null;
}

/* trạng thái tạm dừng AI lưu trong desk_docs (settings/ai_pause) */
async function aiPaused() {
  try {
    const uid = await owner();
    const { data } = await db.from("desk_docs").select("data").eq("user_id", uid).eq("kind", "settings").eq("key", "ai_pause").maybeSingle();
    return !!(data?.data?.until && Date.now() < data.data.until);
  } catch { return false; }
}
async function pauseAI(hours: number) {
  const uid = await owner();
  await db.from("desk_docs").upsert({ user_id: uid, kind: "settings", key: "ai_pause", data: { until: Date.now() + hours * 3600e3, why: "Gemini 429 hết hạn mức" }, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind,key" });
}

/* phân loại tạm bằng từ khoá khi chưa có AI */
function guessKind(raw: string): string {
  const t = (raw || "").toLowerCase();
  if (/@gmail|@yahoo|@hotmail|\bfam\b|family|khách|gia hạn|renew|netflix|youtube|ytb|chatgpt|gpt|capcut|canva|2fa|ctv|tuấn|vương|lộc|hoàn tiền|slot|premium|goshop/.test(t)) return "shop";
  if (/\b(long|short|entry|sl|tp|futures|funding|lệnh|chart|setup|leverage|đòn bẩy|binance|bybit|okx)\b/.test(t)) return "trading";
  if (/\b(btc|eth|sol|bnb|usdt|coin|token|ví|wallet|airdrop|onchain|defi|staking|crypto)\b/.test(t)) return "crypto";
  return "remind";
}

/* tải lại ảnh/voice đã lưu để AI đọc (dùng khi thử lại hoặc khi sửa tin) */
async function mediaOf(files: any[]) {
  const out: { type: string; bytes: Uint8Array }[] = [];
  for (const f of files || []) {
    if (!f.path || !/^(image\/|audio\/|application\/pdf)/.test(f.type) || (f.size || 0) > 7e6 || out.length >= 4) continue;
    const { data } = await db.storage.from(BUCKET).download(f.path);
    if (data) out.push({ type: f.type, bytes: new Uint8Array(await data.arrayBuffer()) });
  }
  return out;
}

/* chạy AI cho 1 mục rồi cập nhật thẻ trong Telegram. Không ghi đè thứ anh đã tự sửa trên Desk. */
async function enrichItem(id: number, media?: { type: string; bytes: Uint8Array }[]) {
  const { data: it } = await db.from("desk_inbox").select("*").eq("id", id).maybeSingle();
  if (!it) return null;
  const old = it.ai || {};
  const src = old.src ?? it.raw ?? "";
  const out = await enrich(src, it.fwd, media ?? await mediaOf(it.files));
  const patch: any = { updated_at: new Date().toISOString() };
  if (out) {
    const ai = { ...out, ack: old.ack, src, pending: false };
    patch.ai = ai;
    if (!it.title || it.title === old.title) patch.title = out.title || null;
    if (it.kind === "remind" || it.kind === old.kind) patch.kind = out.kind;
    if (out.due && (!it.due || it.due === old.due)) { patch.due = out.due; if (it.status === "inbox") patch.status = "todo"; }
    const extra = [out.transcript && `🎙 ${out.transcript}`, out.summary && `🖼 ${out.summary}`].filter(Boolean).join("\n\n");
    patch.raw = [src, extra].filter(Boolean).join("\n\n");
  } else {
    patch.ai = { ...old, src, pending: true, tries: (old.tries || 0) + 1 };
    if (it.kind === "remind") { const g = guessKind([src, it.fwd].filter(Boolean).join(" ")); if (g !== "remind") patch.kind = g; }
  }
  const u = await db.from("desk_inbox").update(patch).eq("id", id).select().single();
  const row = u.data || { ...it, ...patch };
  await refreshCard(row);
  return row;
}
async function refreshCard(it: any) {
  const ack = it.ai?.ack;
  if (ack) await tg("editMessageText", { chat_id: CHAT, message_id: ack, text: card(it), parse_mode: "HTML", reply_markup: kb(it) });
}

/* cron mỗi 10 phút: thử lại các mục AI chưa xử lý được */
async function retryPending() {
  if (await aiPaused()) return { paused: true };
  const { data } = await db.from("desk_inbox").select("id,ai").eq("ai->>pending", "true").in("status", ["inbox", "todo", "waiting"]).order("id").limit(30);
  const todo = (data || []).filter((r: any) => (r.ai?.tries || 0) < 30).slice(0, 2);
  const res: any[] = [];
  for (const r of todo) { const x = await enrichItem(r.id); res.push([r.id, x?.ai?.pending ? "vẫn lỗi" : "ok"]); }
  return { tried: res };
}

/* ---------- tin trả lời trong Telegram ---------- */
/* email / mật khẩu / mã 2FA → <code> để chạm là chép trong Telegram */
function creds(raw: string): string[] {
  const out: string[] = [];
  const add = (v?: string) => { v = (v || "").trim(); if (v && !out.includes(v)) out.push(v); };
  for (const line of String(raw || "").split("\n")) {
    for (const m of line.matchAll(/([\w.+-]+@[\w-]+(?:\.[\w-]+)+)(?:[|:\/\t]([^\s|]+))?(?:\|([^\s|]+))?/g)) { add(m[1]); add(m[2]); add(m[3]); }
    for (const m of line.matchAll(/(?:pass(?:word)?|pw|mk|m[aậ]t\s*kh[aẩ]u|2fa|otp|code)\s*[:=]\s*((?:[A-Za-z2-7]{4} ){3,7}[A-Za-z2-7]{4}\b|\S+)/gi)) add(m[1].replace(/\s+/g, ""));
    for (const m of line.matchAll(/\b(?=[A-Za-z2-7 ]*[2-7])(?:[A-Za-z2-7]{4} ){3,7}[A-Za-z2-7]{4}\b|\b[A-Z2-7]{16,64}\b/g)) add(m[0].replace(/\s+/g, ""));
  }
  return out.slice(0, 8);
}
function card(it: any) {
  const head = it.title || (it.raw || "").split("\n")[0].slice(0, 80) || ((it.files || []).length ? "Ảnh / tệp đính kèm" : "(trống)");
  const st = it.status === "done" ? "✅ Xong · " : it.status === "trash" ? "🗑 Đã bỏ · " : "📥 ";
  const nf = (it.files || []).filter((f: any) => f.path).length;
  const meta = [KIND[it.kind] || "Nhớ", it.due ? "hạn " + fmtDue(it.due) : "", nf ? `📎${nf}` : "", it.ai?.pending ? "⏳ chờ AI đặt tiêu đề" : ""].filter(Boolean).join(" · ");
  const cs = creds([it.title, it.raw].filter(Boolean).join("\n"));
  const copy = cs.length ? `\n📋 ${cs.map((c) => `<code>${esc(c)}</code>`).join("  ")}` : "";
  return `${st}<b>${esc(head)}</b>${copy}\n<i>#${it.id} · ${meta}</i>`;
}
function kb(it: any) {
  if (it.status === "done" || it.status === "trash") return { inline_keyboard: [[{ text: "↩️ Mở lại", callback_data: `d:open:${it.id}` }, { text: "Mở Desk", url: DESK }]] };
  return { inline_keyboard: [
    [{ text: "✅ Xong", callback_data: `d:done:${it.id}` }, { text: "📅 Mai", callback_data: `d:tmr:${it.id}` }, { text: "📅 T2 tới", callback_data: `d:mon:${it.id}` }, { text: "🗑 Bỏ", callback_data: `d:trash:${it.id}` }],
    [{ text: "Mở Desk", url: DESK }],
  ] };
}

/* ---------- lưu 1 tin: ghi thô → lưu file → rồi mới gọi AI (AI lỗi không làm mất gì) ---------- */
async function capture(m: any) {
  const uid = await owner();
  const raw = textOf(m), fwd = fwdOf(m), f = fileOf(m);
  // album ảnh: các ảnh cùng media_group gộp vào 1 mục
  if (m.media_group_id) {
    const { data: g } = await db.from("desk_inbox").select("*").eq("tg_chat", m.chat.id).eq("tg_group", m.media_group_id).order("id").limit(1).maybeSingle();
    if (g && g.tg_msg !== m.message_id) {
      const s = f ? await saveFile(uid, g.id, f) : null;
      const files = [...(g.files || []), ...(s ? [s.meta] : [])];
      const src = [g.ai?.src ?? g.raw, raw].filter(Boolean).join("\n\n");
      const u = await db.from("desk_inbox").update({ files, raw: raw ? [g.raw, raw].filter(Boolean).join("\n\n") : g.raw, ai: { ...(g.ai || {}), src }, updated_at: new Date().toISOString() }).eq("id", g.id).select().single();
      if (u.data) await refreshCard(u.data);
      return;
    }
  }
  const ins = await db.from("desk_inbox").upsert({
    user_id: uid, src: "telegram", tg_chat: m.chat.id, tg_msg: m.message_id, tg_group: m.media_group_id || null,
    raw, fwd, kind: "remind", status: "inbox", ai: { src: raw, pending: true },
    created_at: new Date(m.date * 1000).toISOString(),
  }, { onConflict: "tg_chat,tg_msg", ignoreDuplicates: true }).select().maybeSingle();
  if (ins.error) throw ins.error;
  if (!ins.data) return; // Telegram gửi lại tin đã lưu
  let it = ins.data;
  const ack = await say(`📥 Đã lưu #${it.id}${f ? " · đang lưu tệp…" : ""}`, { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true } });
  const media: { type: string; bytes: Uint8Array }[] = [];
  const patch: any = { ai: { src: raw, pending: true, ack: ack.ok ? ack.result.message_id : null }, updated_at: new Date().toISOString() };
  if (f) { const s = await saveFile(uid, it.id, f); patch.files = [s.meta]; if (s.bytes) media.push({ type: f.type, bytes: s.bytes }); }
  const u = await db.from("desk_inbox").update(patch).eq("id", it.id).select().single();
  if (u.error) console.error("save files", u.error.message);
  else it = u.data;
  await refreshCard(it);
  await enrichItem(it.id, media);
}

/* ---------- lệnh ---------- */
async function listOpen() {
  const { data } = await db.from("desk_inbox").select("id,title,raw,kind,due,status,files").in("status", ["inbox", "todo", "waiting"]).order("created_at", { ascending: false }).limit(500);
  const t = today(), rows = data || [];
  const now = rows.filter((r: any) => (r.due ? r.due <= t : r.status !== "waiting"));
  const late = now.filter((r: any) => r.due && r.due < t), dueToday = now.filter((r: any) => r.due === t), fresh = now.filter((r: any) => !r.due);
  const later = rows.length - now.length;
  const line = (r: any) => `• #${r.id} ${esc(r.title || (r.raw || "").split("\n")[0].slice(0, 70) || "Tệp đính kèm")}${r.due && r.due < t ? ` <i>(trễ từ ${fmtDue(r.due)})</i>` : ""}`;
  const sec = (h: string, a: any[]) => a.length ? `\n<b>${h}</b>\n${a.slice(0, 12).map(line).join("\n")}${a.length > 12 ? `\n… và ${a.length - 12} mục nữa` : ""}` : "";
  return { late, dueToday, fresh, later, text: (sec("🔴 Quá hạn", late) + sec("📌 Hôm nay", dueToday) + sec("📥 Mới vào / đang làm", fresh)).trim() };
}
async function help() {
  return say(`<b>Desk Inbox</b>\nNhắn bất cứ thứ gì cho bot — chữ, ảnh chụp, file, voice, tin chuyển tiếp — nó lưu vào <a href="${DESK}">godnc.com/desk</a> và tự đặt tiêu đề, loại, hạn.\n\n/homnay — việc shop sáng nay (YTB, Netflix, GPT, GG1, CapCut)\n/viec — xem việc cần xử lý\n/xong 12 — đánh dấu mục #12 xong\n/tf + tin — đưa lệnh đổi mail / gia hạn / đơn mới / hủy vào Thay Fam. Tin có email khách (đổi mail, gia hạn, hủy, mất pre…) tự vào Thay Fam, không vào Desk. Muốn lưu Desk thì gõ /desk + tin.\nHoặc bấm nút ngay dưới mỗi tin xác nhận.`);
}
async function setStatus(id: number, patch: any) {
  if (patch.status) patch.done_at = patch.status === "done" ? new Date().toISOString() : null;
  patch.updated_at = new Date().toISOString();
  const { data, error } = await db.from("desk_inbox").update(patch).eq("id", id).select().maybeSingle();
  if (error) throw error;
  return data;
}

/* ---------- Hôm nay: việc shop sáng nay (giống trang godnc.com/homnay) ----------
   Đọc lại đúng các nguồn trang dùng: Thay Fam/GG1 (cần secret TF_PASS = mật khẩu Thay Fam),
   Netflix + ChatGPT (admin), CapCut (sheet Tài chính, gviz). Thiếu TF_PASS thì bỏ phần YTB/GG1. */
const HOMNAY = "https://godnc.com/homnay/";
const TF_API = "https://script.google.com/macros/s/AKfycby2lwu9UYCAsbYMZtXnGTLMWlRE2aaO_FaBG312jiBEEjZdf5NotZsJ06I39TgG3Zjg/exec";
const MOD_API = "https://script.google.com/macros/s/AKfycbySu9evgLmqMVKSc-Z1cKUIzcfqJH9_pEFDdzOERQ1yP8uLy1hvLqJgNRkOlwDJEOba/exec";
const FIN_SHEET = "1-EgeNWztGQsY2rmLYp00yKDjgHR5WYoqzzhAkSnvJjc";
const PN: Record<string, string> = { ytb: "YTB", nf: "Netflix", gpt: "GPT", gg1: "GG1", cc: "CapCut" };

type Cus = { prod: string; key: string; who: string; ctv: string; hsd: string; days: number; done?: boolean };
const pad2 = (n: number) => String(n).padStart(2, "0");
function pDate(s: unknown): number | null { // → mốc UTC 00:00 của ngày đó
  const t = String(s ?? "").trim(); if (!t) return null;
  let p = t.split("/"); if (p.length === 3) { let y = +p[2]; if (y < 100) y += 2000; const v = Date.UTC(y, +p[1] - 1, +p[0]); return isNaN(v) ? null : v; }
  p = t.split("-"); if (p.length === 3 && p[0].length === 4) return Date.UTC(+p[0], +p[1] - 1, +p[2].slice(0, 2));
  const d = new Date(t); if (isNaN(+d)) return null;
  const v = new Date(+d + TZ_MS); return Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate());
}
const dmyU = (v: number) => { const d = new Date(v); return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; };
const daysU = (v: number) => Math.round((v - Date.parse(today() + "T00:00:00Z")) / 864e5);
function addMonthsU(v: number, m: number) { const d = new Date(v), day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + (+m || 0)); d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate())); return +d; }
function normCtv(c: unknown) {
  const s = String(c ?? "").trim(), k = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  if (!k || k === "admin" || k === "dnc" || k === "(trong)") return "Dnc";
  if (k.startsWith("tuan")) return "Tuấn"; if (k.startsWith("vuong")) return "Vương"; if (k === "loc") return "Lộc";
  return s;
}
function csvRows(text: string) {
  const rows: string[][] = []; let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; } else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
async function getJ(url: string, init?: RequestInit, ms = 50000) {
  const r = await fetch(url, { ...(init || {}), redirect: "follow", signal: AbortSignal.timeout(ms) });
  return await r.json();
}
async function tf(body: Record<string, unknown>) {
  const pass = Deno.env.get("TF_PASS"); if (!pass) throw new Error("chưa đặt secret TF_PASS");
  const d = await getJ(TF_API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ ...body, pass }) }, 60000);
  if (!d.ok) throw new Error(d.error || "Thay Fam lỗi"); return d;
}
function modRows(list: any[], prod: string): Cus[] {
  const m: Record<string, Cus> = {};
  (list || []).forEach((it) => {
    const a = pDate(it.activationDate), h = pDate(it.expiryDate) ?? (a != null ? addMonthsU(a, it.duration) : null);
    if (h == null) return;
    const who = String(it.userName || it.email || it.userCode || "").trim();
    const key = prod + ":" + String(it.userCode || it.email || who || it.id).toLowerCase();
    const r = { prod, key, who: who + (it.userCode && it.userName ? ` (${it.userCode})` : ""), ctv: normCtv(it.ctv), hsd: dmyU(h), days: daysU(h) };
    if (!m[key] || r.days > m[key].days) m[key] = r;
  });
  return Object.values(m);
}
async function capcutRows(): Promise<Cus[]> {
  const q = encodeURIComponent("select * where lower(E) contains 'capcut'"), best: Record<string, Cus & { nr?: boolean }> = {};
  for (const t of ["DATA(GCC)", "DATA(YTB)"]) {
    const txt = await fetch(`https://docs.google.com/spreadsheets/d/${FIN_SHEET}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(t)}&tq=${q}`, { signal: AbortSignal.timeout(30000) }).then((r) => r.text());
    csvRows(txt).forEach((r, i) => {
      if (!r || r.length < 14 || (i === 0 && /date/i.test(r[0]))) return;
      const h = pDate(r[13]); if (h == null || new Date(h).getUTCFullYear() < 2020) return;
      const em = (r[3] + " " + r[1]).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      const key = "cc:" + (em ? em[0].toLowerCase() : (r[1] + "|" + r[3]).toLowerCase().trim());
      const row = { prod: "cc", key, who: em ? em[0] : String(r[1] || r[3]).trim(), ctv: normCtv(r[7]), hsd: dmyU(h), days: daysU(h), nr: /ko gh|không gh/i.test(r.join(" ")) };
      if (!best[key] || row.days > best[key].days) best[key] = row;
    });
  }
  return Object.values(best).filter((x) => !x.nr);
}

async function shopBrief() {
  const err: string[] = [];
  const safe = async <T,>(name: string, f: () => Promise<T>): Promise<T | null> => { try { return await f(); } catch (e) { err.push(`${name}: ${(e as Error).message}`); return null; } };
  // Thay Fam đọc cùng 1 sheet → gọi lần lượt; nguồn khác song song
  const tfPart = (async () => {
    const dash = await safe("YTB", () => tf({ action: "dashboard", ahead: 2 }));
    const wk = dash ? await safe("YTB tuần", () => tf({ action: "week" })) : null;
    const gg = dash ? await safe("GG1", () => tf({ action: "gg_list" })) : null;
    return { dash, wk, gg };
  })();
  const [tfd, nf, gpt, cc] = await Promise.all([
    tfPart,
    safe("Netflix", async () => { const j = await getJ(`${MOD_API}?module=netflix`); if (!j?.success) throw new Error(j?.error || "không đọc được"); return modRows(j.data, "nf"); }),
    safe("GPT", async () => { const j = await getJ(`${MOD_API}?action=list`); if (!j?.success) throw new Error(j?.error || "không đọc được"); return modRows(j.data, "gpt"); }),
    safe("CapCut", capcutRows),
  ]);
  const { dash, wk, gg } = tfd;
  const gap: string[] = [], nay: string[] = [], tuan: string[] = [], blocks: string[] = [];
  const list = (a: string[], n = 8) => a.slice(0, n).join(", ") + (a.length > n ? ` +${a.length - n}` : "");

  // YTB
  const ytb: Cus[] = ((wk?.customers || dash?.renewals || []) as any[]).filter((c) => !c.kicked).map((c) => {
    const h = pDate(c.hsd); return { prod: "ytb", key: "ytb:" + c.email, who: c.email, ctv: normCtv(c.ctv), hsd: c.hsd, days: c.daysLeft ?? (h != null ? daysU(h) : 99), done: !!c.reminded };
  });
  if (dash) {
    const rep = dash.reported || [], due = dash.due || [];
    if (rep.length) gap.push(`YTB: xử lý ${rep.length} fam báo lỗi <i>(${esc(list(rep.map((f: any) => f.rn)))})</i>`);
    const late = due.filter((f: any) => (f.days ?? 0) <= 0);
    if (late.length) gap.push(`YTB: thay ${late.length} fam đến hạn/quá hạn <i>(${esc(list(late.map((f: any) => f.rn + (f.days < 0 ? ` −${-f.days}n` : ""))))})</i>`);
    const next = due.filter((f: any) => f.days > 0);
    if (next.length) tuan.push(`YTB: ${next.length} fam đến hạn 1–2 ngày tới`);
    if (wk) {
      const need = Math.max(0, (wk.due || []).length - (wk.frReady || 0));
      if (need) nay.push(`YTB: chuẩn bị thêm ${need} FR (có ${wk.frReady || 0}, cần ${(wk.due || []).length} trong 7 ngày)`);
      const bl = (wk.blocked || []).filter((b: any) => b.due);
      if (bl.length) nay.push(`YTB: mời lại ${bl.length} fam hết bị chặn mời <i>(${esc(list(bl.map((b: any) => b.rn)))})</i>`);
      if ((wk.waiting || []).length) nay.push(`YTB: xếp fam cho ${wk.waiting.length} khách đang chờ`);
    } else if (dash.blocksDue) nay.push(`YTB: mời lại ${dash.blocksDue} fam hết bị chặn mời`);
    const kick = ytb.filter((c) => c.days < -3 && c.days >= -7);
    if (kick.length) tuan.push(`YTB: ${kick.length} khách quá hạn >3 ngày — hỏi lần cuối rồi kick`);
  }
  // GG1
  const ggRows: Cus[] = [];
  if (gg) {
    let wait = 0;
    (gg.fams || []).filter((f: any) => f.status !== "Đã xoá").forEach((f: any) => (f.customers || []).forEach((c: any) => {
      if (c.status === "Đã xoá") return; if (["Đã mời", "Chờ mời"].includes(c.status)) { wait++; return; }
      const h = pDate(c.hsd); if (h != null) ggRows.push({ prod: "gg1", key: "gg1:" + c.email, who: c.email, ctv: normCtv(c.ctv), hsd: dmyU(h), days: daysU(h) });
    }));
    if (wait) nay.push(`GG1: kiểm tra ${wait} khách đã vào nhóm chưa`);
  }
  // Nhắc gia hạn: quá hạn ≤7n → còn ≤3n, gom theo người phụ trách
  const all = [...ytb, ...(nf || []), ...(gpt || []), ...ggRows, ...(cc || [])];
  const am = all.filter((c) => c.days >= -7 && c.days <= 3 && !c.done).sort((a, b) => a.days - b.days);
  const by: Record<string, Cus[]> = {}; am.forEach((c) => (by[c.ctv] ||= []).push(c));
  const cnt = (a: Cus[]) => Object.entries(a.reduce((m: Record<string, number>, c) => (m[PN[c.prod]] = (m[PN[c.prod]] || 0) + 1, m), {})).map(([k, v]) => `${k} ${v}`).join(", ");
  const line = (c: Cus) => `• ${PN[c.prod]} · ${c.who} · HSD ${c.hsd}${c.days < 0 ? ` (hết ${-c.days}n)` : c.days === 0 ? " (hôm nay)" : ""}`;
  if (by.Dnc) {
    nay.push(`Tự nhắn ${by.Dnc.length} khách của bạn gia hạn <i>(${cnt(by.Dnc)})</i>`);
    blocks.push(`<b>Khách của bạn</b>\n<pre>${esc(by.Dnc.slice(0, 25).map(line).join("\n"))}${by.Dnc.length > 25 ? `\n… +${by.Dnc.length - 25}` : ""}</pre>`);
  }
  Object.entries(by).filter(([k]) => k !== "Dnc").sort((a, b) => b[1].length - a[1].length).forEach(([ctv, a]) => {
    nay.push(`Gửi ${esc(ctv)} ${a.length} khách cần nhắc <i>(${cnt(a)})</i>`);
    blocks.push(`<b>Gửi ${esc(ctv)}</b> — chạm để copy, dán vào nhóm Zalo\n<pre>${esc(`Khách sắp/đã hết hạn — nhờ ${ctv} nhắc gia hạn giúp mình:\n` + a.slice(0, 30).map(line).join("\n"))}</pre>`);
  });
  // Netflix / GPT quá hạn còn trong danh sách
  for (const [p, rows, how] of [["nf", nf, "xoá hồ sơ/đổi mã"], ["gpt", gpt, "thu hồi thiết bị"]] as const) {
    const ex = (rows || []).filter((c) => c.days < -3 && c.days >= -30);
    if (ex.length) tuan.push(`${PN[p]}: ${ex.length} khách quá hạn >3 ngày — ${how} nếu không gia hạn`);
  }
  return { gap, nay, tuan, blocks, err };
}

function briefText(B: Awaited<ReturnType<typeof shopBrief>>, deskText = "") {
  const d = new Date(Date.now() + TZ_MS);
  const sec = (h: string, a: string[]) => a.length ? `\n\n<b>${h}</b>\n${a.map((x) => "• " + x).join("\n")}` : "";
  const n = B.gap.length + B.nay.length;
  let t = `☀️ <b>Sáng nay ${WD[d.getUTCDay()]} ${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}</b> · ${n ? n + " việc" : "không có việc gấp"}`
    + sec("🔴 Gấp", B.gap) + sec("📌 Sáng nay", B.nay) + sec("🗓 Tuần này", B.tuan)
    + (deskText ? `\n\n<b>📥 Desk</b>\n${deskText}` : "")
    + (B.err.length ? `\n\n<i>⚠ Không đọc được: ${esc(B.err.join("; "))}</i>` : "");
  return t;
}
const BRIEF_KB = { inline_keyboard: [[{ text: "Mở Hôm nay", url: HOMNAY }, { text: "Mở Desk", url: DESK }]] };
async function sendBrief(deskText = "") {
  const B = await shopBrief();
  let t = briefText(B, deskText);
  if (t.length > 4000) t = t.slice(0, 3990) + "…";
  await say(t, { reply_markup: BRIEF_KB });
  // danh sách khách gửi riêng từng tin (chạm khối chữ để copy)
  for (const b of B.blocks) await say(b.length > 4000 ? b.slice(0, 3980) + "…</pre>" : b);
  return B;
}

/* ---------- nhắc buổi sáng (pg_cron gọi ?digest=1, mỗi ngày tối đa 1 lần) ---------- */
async function digest() {
  const uid = await owner();
  const { data: s } = await db.from("desk_docs").select("data").eq("user_id", uid).eq("kind", "settings").eq("key", "inbox_digest").maybeSingle();
  if (s?.data?.last === today()) return { skipped: "đã gửi hôm nay" };
  const L = await listOpen();
  await db.from("desk_docs").upsert({ user_id: uid, kind: "settings", key: "inbox_digest", data: { last: today() }, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind,key" });
  // Gộp: việc shop (Hôm nay) + Desk vào 1 tin buổi sáng
  const deskText = (L.late.length || L.dueToday.length || L.fresh.length) ? `${L.later ? `<i>${L.later} mục hẹn sau/đang chờ</i>\n` : ""}${L.text}` : "";
  await sendBrief(deskText);
  return { sent: true };
}

/* Tin về khách YouTube (có email khách) → Thay Fam, KHÔNG lưu Desk (tránh trùng).
   Trừ tin kiểu tài khoản / mật khẩu / 2FA (anh lưu đồ của mình) → vẫn vào Desk. Muốn ép vào Desk: gõ /desk + tin. */
function looksTF(t: string) {
  if (!/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(t)) return false;
  if (/pass(word)?\b|\bpw\b|\bmk\b|mật khẩu|2fa|\botp\b|netflix|chatgpt|\bgpt\b|capcut|canva|gg1|google one/i.test(t)) return false;
  return true;
}

async function handle(u: any) {
  if (u.callback_query) {
    const q = u.callback_query;
    if (String(q.from.id) !== CHAT) return;
    const [, a, sid] = String(q.data || "").split(":");
    const id = Number(sid);
    const p: any = a === "done" ? { status: "done" } : a === "trash" ? { status: "trash" } : a === "open" ? { status: "inbox" }
      : a === "tmr" ? { due: today(1), status: "todo" }
      : a === "mon" ? { due: (() => { const w = new Date(today() + "T00:00:00Z").getUTCDay(); return today(((8 - w) % 7) || 7); })(), status: "todo" } : null;
    if (!p || !id) return tg("answerCallbackQuery", { callback_query_id: q.id });
    const it = await setStatus(id, p);
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: it ? (p.due ? `Hẹn ${fmtDue(p.due)}` : "Đã cập nhật") : "Không thấy mục này" });
    if (it && q.message) await tg("editMessageText", { chat_id: CHAT, message_id: q.message.message_id, text: card(it), parse_mode: "HTML", reply_markup: kb(it) });
    return;
  }
  const edited = u.edited_message;
  const m = u.message || edited;
  if (!m) return;
  if (String(m.chat.id) !== CHAT) {
    if (m.chat.type === "private") await tg("sendMessage", { chat_id: m.chat.id, text: "Bot riêng, không nhận tin từ tài khoản này." });
    return;
  }
  if (edited) {
    const raw = textOf(edited);
    const { data: it } = await db.from("desk_inbox").select("id,raw,ai").eq("tg_chat", m.chat.id).eq("tg_msg", m.message_id).maybeSingle();
    if (!it) return capture(edited);
    await db.from("desk_inbox").update({ raw, ai: { ...(it.ai || {}), src: raw }, updated_at: new Date().toISOString() }).eq("id", it.id);
    await enrichItem(it.id);
    return;
  }
  const text = (m.text || "").trim();
  if (/^\/(start|help)\b/i.test(text)) return help();
  if (/^\/(viec|việc|list)\b/i.test(text)) {
    const L = await listOpen();
    return say(L.text || "Inbox trống. Không có gì cần xử lý 👌", { reply_markup: { inline_keyboard: [[{ text: "Mở Desk", url: DESK }]] } });
  }
  if (/^\/(homnay|hômnay|sangnay|sáng)\b/i.test(text)) {
    await say("⏳ Đang gom việc sáng nay…");
    const L = await listOpen();
    await sendBrief(L.text);
    return;
  }
  // Lệnh Thay Fam (đổi mail / gia hạn / đơn mới / hủy): đưa vào hàng chờ godnc.com/thayfam, anh duyệt trên web
  const tfm = text.match(/^\/(tf|thayfam)\b\s*([\s\S]*)$/i);
  const toDesk = /^\/desk\b/i.test(text);
  if (toDesk) { m.text = text.replace(/^\/desk\b\s*/i, ""); return capture(m); }
  if (tfm || (!m.photo && !m.document && !m.voice && looksTF(text))) {
    const body = tfm ? tfm[2].trim() : text;
    if (!body) return say("Gõ /tf rồi dán tin, ví dụ:\n<code>/tf 1039 abc@gmail.com | ytb 12th plus | 09/07/2026 → 09/07/2027</code>");
    try {
      const d = await tf({ action: "queue", op: "add", text: body, from: fwdOf(m) || "Telegram", src: "bot" });
      return say(`🛠 Đã đưa ${d.lines} dòng vào hàng chờ <b>Thay Fam</b>. Mở web để kiểm tra và bấm Duyệt (chưa ghi gì vào sheet).`, {
        reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true },
        reply_markup: { inline_keyboard: [[{ text: "Mở Thay Fam", url: "https://godnc.com/thayfam/#lenh" }]] },
      });
    } catch (e) {
      // lỗi thì rơi xuống lưu Desk như tin thường để không mất
      await say(`⚠️ Chưa đưa được vào Thay Fam (${esc((e as Error).message)}). Lưu tạm vào Desk.`);
    }
  }
  const dm = text.match(/^\/(xong|done)\s+#?(\d+)/i);
  if (dm) {
    const it = await setStatus(Number(dm[2]), { status: "done" });
    return it ? say(card(it), { reply_markup: kb(it) }) : say(`Không thấy mục #${dm[2]}.`);
  }
  await capture(m);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  try {
    // cài webhook (mở 1 lần trên trình duyệt)
    if (url.searchParams.has("setup")) {
      if (!SECRET || url.searchParams.get("setup") !== SECRET) return ok({ ok: false, error: "sai TG_SECRET" });
      if (!TOKEN) return ok({ ok: false, error: "thiếu TG_BOT_TOKEN" });
      const self = `${SB_URL}/functions/v1/desk-bot`;
      const info = await tg("getWebhookInfo", {});
      if (info.result?.url && info.result.url !== self && url.searchParams.get("force") !== "1")
        return ok({ ok: false, error: "Bot đang gắn webhook khác, không gỡ", current: info.result.url });
      const set = await tg("setWebhook", { url: self, secret_token: SECRET, allowed_updates: ["message", "edited_message", "callback_query"], max_connections: 1 });
      await tg("setMyCommands", { commands: [{ command: "homnay", description: "Việc shop sáng nay" }, { command: "viec", description: "Việc cần xử lý" }, { command: "xong", description: "Đánh dấu xong: /xong 12" }, { command: "tf", description: "Lệnh Thay Fam: /tf + tin của Tuấn" }, { command: "help", description: "Cách dùng" }] });
      let who = ""; try { who = await owner(); } catch (e) { who = "LỖI: " + (e as Error).message; }
      if (set.ok) await say("✅ Desk Inbox đã bật. Từ giờ nhắn gì cho bot cũng được lưu vào godnc.com/desk. Gõ /help xem cách dùng.");
      return ok({ ok: set.ok, webhook: self, desk_user: who, telegram: set });
    }
    if (url.searchParams.has("digest")) return ok(await digest());
    if (url.searchParams.has("retry")) {
      // cron gọi: trả lời ngay, thử lại chạy nền (mỗi mục có thể mất tới ~60s khi Gemini bận)
      const p = retryPending().catch((e) => console.error("retry", e));
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) { EdgeRuntime.waitUntil(p); return ok({ started: true }); }
      return ok(await p);
    }
    // webhook Telegram
    if (req.method !== "POST" || req.headers.get("x-telegram-bot-api-secret-token") !== SECRET) return new Response("forbidden", { status: 403 });
    const u = await req.json();
    const job = (async () => {
      try { await handle(u); }
      catch (e) {
        console.error(e);
        const m = u.message || u.edited_message;
        if (m && String(m.chat.id) === CHAT) await say(`⚠️ Chưa lưu được tin này: ${esc((e as Error).message)}\nNhắn lại giúp mình, hoặc ghi tay trên Desk.`, { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true } }).catch(() => {});
      }
    })();
    // trả 200 ngay cho Telegram, phần lưu file + AI chạy nền
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(job); else await job;
    return ok();
  } catch (e) {
    console.error(e);
    return ok({ ok: false, error: (e as Error).message });
  }
});
