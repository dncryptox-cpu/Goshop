// DNC Desk — Edge Function "desk-bot": nhận MỌI tin nhắn của @goshopassistantbot và lưu vào bảng desk_inbox.
// Webhook Telegram trỏ thẳng vào đây (luôn trả 200 → Telegram không bao giờ kẹt hàng đợi).
// Tắt "Verify JWT" cho function này. Secrets: TG_BOT_TOKEN, TG_SECRET, GEMINI_API_KEY (tuỳ chọn: TG_CHAT_ID, DESK_USER_ID, GEMINI_MODEL, TF_PASS)
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

async function tg(method: string, body: Record<string, unknown>, token = TOKEN) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
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
  return say(`<b>Desk Inbox</b>\nNhắn bất cứ thứ gì cho bot — chữ, ảnh chụp, file, voice, tin chuyển tiếp — nó lưu vào <a href="${DESK}">godnc.com/desk</a> và tự đặt tiêu đề, loại, hạn.\n\n/homnay — việc shop sáng nay (YTB, Netflix, GPT, GG1, CapCut)\n/viec — xem việc cần xử lý\n/hoi + câu hỏi (hoặc tin bắt đầu bằng ?) — hỏi trợ lý Thay Fam: khách ở fam nào, fam nào cần thay, khách Tuấn sắp hết hạn…\n/xong 12 — đánh dấu mục #12 xong\n/tf + tin — đưa lệnh đổi mail / gia hạn / đơn mới / hủy vào Thay Fam. Tin có email khách (đổi mail, gia hạn, hủy, mất pre…) tự vào Thay Fam, không vào Desk. Muốn lưu Desk thì gõ /desk + tin.\nHoặc bấm nút ngay dưới mỗi tin xác nhận.`);
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

/* Tra trạng thái khách YouTube ngay trong bot (giống thẻ Lệnh trên Thay Fam), trả lời ngắn */
const shortD = (s: string) => String(s || "").replace(/\/(\d{4})$/, (_, y) => (y === String(new Date().getFullYear()) ? "" : "/" + y.slice(2)));
const conL = (n: number | null | undefined) => (n == null ? "" : n < 0 ? `hết ${-n} ngày` : n === 0 ? "hết hôm nay" : `còn ${n} ngày`);
async function tfFind(e: string) {
  const d = await tf({ action: "search", q: e });
  let hit: any = null, phu: any = null;
  for (const f of d.items || []) for (const c of f.customers || []) {
    const it = { f, c };
    if (!hit && String(c.email || "").toLowerCase() === e) hit = it;
    if (!phu && String(c.mailPhu || "").toLowerCase().includes(e)) phu = it;
  }
  if (hit) return { ...hit };
  const a = (d.archived || []).find((x: any) => String(x.email || "").toLowerCase() === e);
  if (a) return { arch: a };
  if (phu) return { ...phu, phuOf: true };
  return null;
}
function tfStatus(e: string, r: any) {
  if (!r) return `❓ <b>${esc(e)}</b>\nKhông có trong Kho TK (khách mới / gõ sai mail?).`;
  if (r.arch) {
    const v = pDate(r.arch.hsd), left = v == null ? null : daysU(v);
    if (left != null && left < 0) return `⛔ <b>${esc(e)}</b>\nĐang ở vùng lưu, <b>hết hạn ${shortD(r.arch.hsd)}</b> (${conL(left)}) → gia hạn thì chuyển vào fam còn slot rồi mời.`;
    return `⚠️ <b>${esc(e)}</b>\nĐang ở vùng lưu, <b>chưa có slot</b> → chưa được mời. Cần chuyển vào fam còn slot.` + (r.arch.hsd ? `\nHSD ${shortD(r.arch.hsd)}` : "");
  }
  const { f, c } = r, why: string[] = [];
  if (c.daysLeft != null && c.daysLeft < 0) why.push(`Khách hết hạn ${-c.daysLeft} ngày`);
  const st = f.famState ? ({ deleted: "đã xoá nhóm", scanned: "bị quét" } as any)[f.famState.state] || f.famState.state : "";
  if (st) why.push(`Fam ${st}`);
  else if (f.status && !["FULL", "Còn slot", "Còn slot(đang check)"].includes(f.status)) why.push(`Fam đang "${esc(f.status)}"`);
  if (f.daysToRenew != null && f.daysToRenew <= 0) why.push(`Fam tới ngày renew (${f.daysToRenew === 0 ? "hôm nay" : "quá " + -f.daysToRenew + " ngày"})`);
  if (c.nojoin) why.push(`Đã ghi khách chưa vào nhóm (${esc(c.nojoin)})`);
  const head = why.length ? `⚠️ <b>${esc(e)}</b> — ${why.join(" · ")}` : `✅ <b>${esc(e)}</b> — Bình thường`;
  const lines = [head];
  if (r.phuOf) lines.push(`Là mail phụ của <code>${esc(c.email)}</code>`);
  lines.push(`${esc(f.rn)} · khách HSD ${shortD(c.hsd) || "—"}${c.daysLeft != null ? " (" + conL(c.daysLeft) + ")" : ""} · fam renew ${shortD(f.renew) || "—"}${f.daysToRenew != null && f.daysToRenew > 0 ? " (còn " + f.daysToRenew + " ngày)" : ""} · CTV ${esc(c.ctv || "—")}`);
  if (c.invitedAt) lines.push(`Mời lần cuối ${esc(c.invitedAt)}`);
  lines.push(why.length ? "→ Mở Thay Fam xử lý (chuyển fam khác + mời)." : "→ Sheet ổn. Mở fam xem khách còn trong nhóm không / mời lại.");
  return lines.join("\n");
}
async function tfReport(text: string) {
  const ems = [...new Set((text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || []).map((x) => x.toLowerCase()))].slice(0, 5);
  const out: string[] = [];
  for (const e of ems) { try { out.push(tfStatus(e, await tfFind(e))); } catch (err) { out.push(`⚠️ <b>${esc(e)}</b>: không tra được (${esc((err as Error).message)})`); } }
  return out.join("\n\n");
}


/* ---------- Nhóm CTV Tuấn (dùng chung bot này, chỉ làm đúng việc tra mail) ----------
   Tuấn gõ email khách vào nhóm → bot tra Kho TK:
   - đã fix (mời lại ≤3 ngày, fam ổn) → trả kết quả ngắn
   - chưa fix → "đợi DNC check" + đưa vào tab Lệnh Thay Fam (from = "Nhóm Tuấn")
   DNC bấm Xong trên Thay Fam → web gọi ?tuan_notify → bot báo lại nhóm.
   Nối nhóm: anh gõ /ketnoi trong nhóm (chỉ tài khoản anh mới nối được). */
const TUAN_FROM = "Nhóm Tuấn";
const ttg = (method: string, body: Record<string, unknown>) => tg(method, body);
async function tuanGroup(): Promise<string> {
  const { data } = await db.from("desk_docs").select("data").eq("user_id", await owner()).eq("kind", "settings").eq("key", "tuan_group").maybeSingle();
  return data?.data?.chat ? String(data.data.chat) : "";
}
async function tuanSay(text: string, extra: Record<string, unknown> = {}) {
  const chat = await tuanGroup(); if (!chat) throw new Error("chưa nối nhóm Tuấn (gõ /ketnoi trong nhóm)");
  return ttg("sendMessage", { chat_id: chat, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...extra });
}
/* "10/11 14:20", "10/11/2026", "2026-11-10…" → số ngày đã qua (null nếu không đọc được) */
function agoDays(s: string): number | null {
  const t = String(s || "").trim(); let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let v: number | null = null;
  if (m) v = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  else if ((m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/))) {
    const now = new Date(Date.now() + TZ_MS); let y = m[3] ? +m[3] : now.getUTCFullYear(); if (y < 100) y += 2000;
    v = Date.UTC(y, +m[2] - 1, +m[1]); if (!m[3] && v > Date.parse(today() + "T00:00:00Z")) v = Date.UTC(y - 1, +m[2] - 1, +m[1]);
  }
  return v == null || isNaN(v) ? null : -daysU(v);
}
function famProblems(f: any, c: any) {
  const why: string[] = [];
  if (c.daysLeft != null && c.daysLeft < 0) why.push(`khách hết hạn ${-c.daysLeft} ngày`);
  if (f.famState) why.push("fam đang lỗi");
  else if (f.status && !["FULL", "Còn slot", "Còn slot(đang check)"].includes(f.status)) why.push("fam đang lỗi");
  if (f.daysToRenew != null && f.daysToRenew < 0) why.push("fam quá ngày renew");
  return why;
}
/* Mail DNC đã fix (ghi khi bấm Xong / thay fam trên Thay Fam) — để Tuấn hỏi lại vẫn thấy "đã fix" */
type Fixed = Record<string, { at: number; msg: string }>;
async function tuanFixedGet(): Promise<Fixed> {
  const { data } = await db.from("desk_docs").select("data").eq("user_id", await owner()).eq("kind", "settings").eq("key", "tuan_fixed").maybeSingle();
  return (data?.data as Fixed) || {};
}
async function tuanFixedAdd(emails: string[], msg: string) {
  const m = await tuanFixedGet(), now = Date.now();
  for (const k of Object.keys(m)) if (now - m[k].at > 7 * 864e5) delete m[k];
  for (const e of emails) m[String(e).toLowerCase()] = { at: now, msg: msg.slice(0, 300) };
  await db.from("desk_docs").upsert({ user_id: await owner(), kind: "settings", key: "tuan_fixed", data: m, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind,key" });
}
const fmtAt = (t: number) => { const d = new Date(t + TZ_MS); const p = (n: number) => String(n).padStart(2, "0"); return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`; };
const STILL = /vẫn\s*(lỗi|chưa|ch|ko|k\b|không|mất)|van\s*(loi|chua|ko|khong)|lại lỗi|lai loi/i;
async function tuanCheck(e: string, raw: string, openText: string, fixed: Fixed = {}): Promise<{ text: string; queue: boolean }> {
  const fx = fixed[e], line = raw.split(/\r?\n/).find((l) => l.toLowerCase().includes(e)) || raw;
  if (fx && Date.now() - fx.at < 3 * 864e5 && !STILL.test(line))
    return { text: `✅ <b>${esc(e)}</b>: DNC đã fix lúc ${fmtAt(fx.at)}.\nBáo khách kiểm tra lại (mở Gmail bấm Chấp nhận lời mời). Khách vẫn lỗi thì gõ: <code>${esc(e)} vẫn lỗi</code>`, queue: false };
  const r = await tfFind(e);
  if (!r) return { text: `❓ <b>${esc(e)}</b>: chưa thấy trong danh sách. ⏳ Đợi DNC check lại.`, queue: true };
  if (r.arch) {
    // khách ở vùng lưu: hết hạn thì báo hết hạn (không phải chờ xếp fam)
    const a = r.arch, v = pDate(a.hsd), left = v == null ? null : daysU(v);
    if (a.ctv && normCtv(a.ctv) !== "Tuấn") return { text: `ℹ️ <b>${esc(e)}</b>: không phải khách của Tuấn.`, queue: false };
    if (left != null && left < 0) return { text: `⛔ <b>${esc(e)}</b>: <b>hết hạn ${shortD(a.hsd)}</b>. Khách cần gia hạn.`, queue: false };
    return { text: `⏳ <b>${esc(e)}</b>: đang chờ xếp fam mới, chưa mời${a.hsd ? ` · HSD ${shortD(a.hsd)}` : ""}. Đợi DNC xử lý.`, queue: true };
  }
  const { f, c } = r;
  if (normCtv(c.ctv) !== "Tuấn") return { text: `ℹ️ <b>${esc(e)}</b>: không phải khách của Tuấn.`, queue: false };
  const who = r.phuOf ? ` (mail phụ của ${esc(c.email)})` : "";
  const hsd = c.hsd ? ` · HSD ${shortD(c.hsd)}` : "";
  if (c.daysLeft != null && c.daysLeft < 0) return { text: `⛔ <b>${esc(e)}</b>${who}: <b>hết hạn ${shortD(c.hsd)}</b>. Khách cần gia hạn.`, queue: false };
  const why = famProblems(f, c), ago = agoDays(c.invitedAt);
  if (!why.length && ago != null && ago <= 3 && !STILL.test(line))
    return { text: `✅ <b>${esc(e)}</b>${who}: đã mời lại ${ago === 0 ? "hôm nay" : ago === 1 ? "hôm qua" : ago + " ngày trước"}${hsd}.\nBáo khách mở Gmail bấm <b>Chấp nhận lời mời</b>, hoặc vào https://myaccount.google.com/family/details`, queue: false };
  if (openText.includes(e) && !STILL.test(line)) return { text: `⏳ <b>${esc(e)}</b>${who}: đã báo rồi, đang đợi DNC check.`, queue: false };
  return { text: `⏳ <b>${esc(e)}</b>${who}: đã ghi nhận, đợi DNC check lại. Xong bot sẽ báo.`, queue: true };
}
async function tuanHandle(m: any) {
  const text = String(m.text || m.caption || "").trim();
  const isOwner = String(m.from?.id) === CHAT;
  if (/^\/ketnoi\b/i.test(text)) {
    if (!isOwner || m.chat.type === "private") return ttg("sendMessage", { chat_id: m.chat.id, text: "Chỉ DNC mới nối được bot, và phải gõ trong nhóm." });
    await db.from("desk_docs").upsert({ user_id: await owner(), kind: "settings", key: "tuan_group", data: { chat: m.chat.id, title: m.chat.title || "" }, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind,key" });
    // menu lệnh trong nhóm chỉ còn /help (ẩn /homnay, /viec… của Desk)
    await ttg("setMyCommands", { commands: [{ command: "help", description: "Cách dùng" }], scope: { type: "chat", chat_id: m.chat.id } });
    return ttg("sendMessage", { chat_id: m.chat.id, text: "✅ Đã nối nhóm. Tuấn gõ email khách (vd: abc@gmail.com chưa có lời mời) để bot kiểm tra." });
  }
  const grp = await tuanGroup();
  if (!grp || String(m.chat.id) !== grp) return; // chỉ trả lời trong nhóm đã nối
  if (/^\/(start|help)\b/i.test(text)) return tuanSay("Gõ email khách (1 hoặc nhiều mail, kèm mô tả lỗi nếu có). Bot báo: ✅ đã fix · ⏳ đợi DNC check · ⛔ hết hạn.");
  const ems = [...new Set((text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || []).map((x) => x.toLowerCase()))].slice(0, 8);
  if (!ems.length) return;
  let openText = "";
  try { const q = await tf({ action: "queue", op: "list" }); openText = (q.open || []).map((x: any) => String(x.text || "")).join("\n").toLowerCase(); } catch (_) { /* bỏ qua */ }
  let fixed: Fixed = {}; try { fixed = await tuanFixedGet(); } catch (_) { /* bỏ qua */ }
  const out: string[] = [], toQ: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const e of ems) {
    try {
      const r = await tuanCheck(e, text, openText, fixed);
      const ln = lines.find((l) => l.toLowerCase().includes(e)) || e;
      // đã có tin đang chờ cùng mail → không tạo việc trùng (trừ khi Tuấn ghi "vẫn lỗi")
      if (r.queue && openText.includes(e) && !STILL.test(ln)) { out.push(`⏳ <b>${esc(e)}</b>: đã báo rồi, đang đợi DNC check.`); continue; }
      out.push(r.text);
      if (r.queue) toQ.push(ln);
    } catch (err) { out.push(`⚠️ <b>${esc(e)}</b>: chưa tra được, đợi DNC check.`); toQ.push(e); console.error("tuan", e, (err as Error).message); }
  }
  if (toQ.length) {
    try { await tf({ action: "queue", op: "add", text: toQ.join("\n"), from: TUAN_FROM, src: "tuan" }); }
    catch (err) { console.error("tuan queue", (err as Error).message); await say(`⚠️ Nhóm Tuấn báo nhưng chưa vào được Thay Fam:\n${esc(toQ.join("\n"))}`); }
    // báo DNC trên bot riêng
    await say(`👥 <b>Tuấn báo</b> (${toQ.length}) — đã vào tab Lệnh Thay Fam:\n${esc(toQ.join("\n"))}`, { reply_markup: { inline_keyboard: [[{ text: "Mở Thay Fam", url: "https://godnc.com/thayfam/#lenh" }]] } }).catch(() => {});
  }
  return tuanSay(out.join("\n\n"), { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true } });
}
/* ---------- Bot khách lẻ (bot Telegram RIÊNG, token CUS_BOT_TOKEN) ----------
   Hỗ trợ: khách gõ email → trạng thái; lỗi → tab Lệnh (from "Khách lẻ") + báo DNC; Xong / mời lại → bot nhắn lại khách.
   Bán hàng: /mua → chọn gói → email → QR chuyển khoản (VietQR) → khách bấm "Đã chuyển khoản" → dòng đơn mới / gia hạn vào tab Lệnh;
   DNC kiểm tra tiền rồi Duyệt/Xong trên Thay Fam → bot nhắn "đã kích hoạt / đã gia hạn".
   Mọi câu chữ, gói, giá, tài khoản nhận tiền chỉnh ở tab "🤖 Bot khách" trên Thay Fam (lưu desk_docs settings/cus_cfg).
   Không lộ RN, mail fam, CTV, tên shop. Chỉ phục vụ khách CTV Dnc. */
const CUS_TOKEN = Deno.env.get("CUS_BOT_TOKEN") || "";
const CUS_FROM = "Khách lẻ";
const ctg = (method: string, body: Record<string, unknown>) => tg(method, body, CUS_TOKEN);
const csay = (chat: number | string, text: string, extra: Record<string, unknown> = {}) =>
  ctg("sendMessage", { chat_id: chat, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...extra });

const CUS_TEXTS: Record<string, [string, string]> = { // key: [mô tả, mặc định]. {email} {hsd} {ngay} {goi} {gia} {ma}
  start: ["Lời chào (/start)", "Chào bạn 👋 Đây là bot hỗ trợ YouTube Premium gia đình.\n\nGửi email bạn dùng để vào gia đình YouTube (vd: abc@gmail.com), có thể kèm mô tả lỗi. Bot sẽ kiểm tra và báo lại ngay tại đây."],
  ask_email: ["Khách nhắn không có email", "Bạn gửi giúp mình email dùng để vào gia đình YouTube (vd: abc@gmail.com) nhé."],
  notfound: ["Không thấy email", "❓ Chưa thấy {email} trong danh sách.\nBạn kiểm tra lại đúng email đã đăng ký khi mua nhé."],
  other: ["Khách của đại lý khác", "ℹ️ {email} được đăng ký qua đại lý khác. Bạn liên hệ nơi đã mua để được hỗ trợ nhanh nhất nhé."],
  expired: ["Hết hạn", "⛔ Gói của {email} đã hết hạn ngày {hsd}.\nMuốn gia hạn, bạn bấm Gia hạn bên dưới hoặc nhắn người bán nhé."],
  done_recent: ["Vừa xử lý xong (khách hỏi lại)", "✅ {email} đã được xử lý lúc {ngay}."],
  invited_recent: ["Vừa được mời lại (khách hỏi lại)", "✅ Đã gửi lời mời mới cho {email} {ngay}."],
  guide: ["Hướng dẫn chấp nhận lời mời", "Bạn mở Gmail của {email}, tìm thư mời từ Google và bấm Chấp nhận lời mời (hoặc vào https://myaccount.google.com/family/details).\nVẫn lỗi thì gõ: {email} vẫn lỗi"],
  waiting: ["Đã báo rồi, đang chờ", "⏳ Lỗi của {email} đã được ghi nhận, đang chờ kiểm tra. Xử lý xong bot sẽ nhắn bạn tại đây."],
  reported: ["Ghi nhận lỗi mới", "📝 Đã ghi nhận lỗi của {email}.\nBên mình sẽ kiểm tra và nhắn lại bạn ngay tại đây khi xử lý xong."],
  fixed: ["Nhắn khi bấm Xong lỗi", "✅ Lỗi của {email} đã được xử lý xong."],
  invited: ["Nhắn khi thay fam mời lại", "🔄 Đã chuyển {email} sang gia đình YouTube mới và gửi lời mời."],
  limit: ["Tra quá nhiều email/ngày", "Hôm nay bạn đã tra nhiều email rồi, thử lại vào ngày mai nhé."],
  sell_menu: ["Bán: chọn gói", "🛒 Chọn gói YouTube Premium:"],
  sell_email: ["Bán: hỏi email", "Gửi email Gmail bạn muốn dùng YouTube Premium (vd: abc@gmail.com)."],
  sell_pay: ["Bán: hướng dẫn chuyển khoản", "💳 Đơn {ma}: {goi} cho {email}\nSố tiền: {gia}\nNội dung chuyển khoản: {ma}\n\nChuyển xong bấm “Tôi đã chuyển khoản”."],
  sell_paid: ["Bán: khách báo đã chuyển", "🙏 Đã nhận báo chuyển khoản đơn {ma}. Bên mình kiểm tra và kích hoạt, xong bot sẽ nhắn bạn tại đây."],
  activated: ["Bán: nhắn khi kích hoạt đơn mới", "🎉 Đã kích hoạt YouTube Premium cho {email}. Cảm ơn bạn!"],
  renewed: ["Bán: nhắn khi gia hạn xong", "✅ Đã gia hạn {email} thành công. Cảm ơn bạn!"],
  sell_info: ["Bán SP khác: hỏi thông tin nhận hàng", "Gửi email (hoặc thông tin) để nhận {goi}."],
  delivered: ["Bán SP khác: nhắn khi giao xong", "✅ Đơn {ma} ({goi}) đã giao xong. Cảm ơn bạn!"],
  out_stock: ["Hết hàng", "😔 {goi} tạm hết hàng. Bấm 🔔 bên dưới, có hàng bot sẽ nhắn bạn ngay."],
  wait_ok: ["Khách bấm 🔔 báo khi có hàng", "🔔 Đã ghi nhận. Khi {goi} có hàng bot sẽ nhắn bạn."],
  restock: ["Báo hàng về (gửi khách đã bấm 🔔)", "🔥 {goi} đã có hàng!\n➕ Thêm: {them}\n📦 Tồn kho hiện tại: {ton}\n💵 Giá: {gia}"],
};
type CusPack = { id: string; name: string; months: number; price: number; stock?: number | null; ytb?: boolean }; // stock null = không giới hạn; ytb = YouTube (xử lý qua Thay Fam)
type CusCfg = { texts: Record<string, string>; sell: { on: boolean; packs: CusPack[]; bank: { id: string; acc: string; name: string } } };
const CUS_DEFAULT: CusCfg = { texts: {}, sell: { on: false, packs: [{ id: "p1", name: "1 tháng", months: 1, price: 0 }, { id: "p6", name: "6 tháng", months: 6, price: 0 }, { id: "p12", name: "12 tháng", months: 12, price: 0 }], bank: { id: "", acc: "", name: "" } } };
async function docGet<T>(key: string, def: T): Promise<T> {
  const { data } = await db.from("desk_docs").select("data").eq("user_id", await owner()).eq("kind", "settings").eq("key", key).maybeSingle();
  return (data?.data as T) || def;
}
async function docPut(key: string, data: unknown) {
  await db.from("desk_docs").upsert({ user_id: await owner(), kind: "settings", key, data, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind,key" });
}
async function cusCfg(): Promise<CusCfg> {
  const c = await docGet<CusCfg>("cus_cfg", CUS_DEFAULT);
  return { texts: c.texts || {}, sell: { ...CUS_DEFAULT.sell, ...(c.sell || {}), bank: { ...CUS_DEFAULT.sell.bank, ...(c.sell?.bank || {}) } } };
}
const money = (n: number) => Number(n || 0).toLocaleString("vi-VN") + "đ";
/* câu chữ: escape rồi thay {biến} bằng chữ đậm */
function T(cfg: CusCfg, key: string, v: Record<string, string> = {}) {
  const raw = (cfg.texts[key] ?? "").trim() || CUS_TEXTS[key][1];
  return esc(raw).replace(/\{(\w+)\}/g, (m, k) => (k in v ? `<b>${esc(v[k])}</b>` : m));
}

type CusSub = { chat: number; name: string; at: number; pending: boolean; kind?: "report" | "order" | "renew" };
type CusOrder = { chat: number; name: string; email: string; pack: string; packId?: string; ytb?: boolean; months: number; price: number; kind: "new" | "renew"; at: number; st: "wait" | "paid" | "done" | "cancel"; note?: string };
type CusDoc = { subs: Record<string, CusSub>; rate: Record<string, { day: string; emails: string[] }>; state: Record<string, { step: string; pack?: string; kind?: string; email?: string; at: number }>; orders: Record<string, CusOrder>; wait: Record<string, number[]>; users: Record<string, { name: string; at: number }> };
async function cusGet(): Promise<CusDoc> {
  const d = await docGet<CusDoc>("cus_bot", {} as CusDoc);
  d.subs ||= {}; d.rate ||= {}; d.state ||= {}; d.orders ||= {}; d.wait ||= {}; d.users ||= {}; return d;
}
async function cusPut(d: CusDoc) {
  const now = Date.now(), t = today();
  for (const k of Object.keys(d.subs)) if (now - d.subs[k].at > 60 * 864e5) delete d.subs[k];
  for (const k of Object.keys(d.rate)) if (d.rate[k].day !== t) delete d.rate[k];
  for (const k of Object.keys(d.state)) if (now - d.state[k].at > 864e5) delete d.state[k];
  for (const k of Object.keys(d.orders)) if (now - d.orders[k].at > 90 * 864e5) delete d.orders[k];
  await docPut("cus_bot", d);
}
const nameOf = (f: any) => [f?.first_name, f?.last_name].filter(Boolean).join(" ") + (f?.username ? ` @${f.username}` : "");
const isYtb = (p: CusPack) => p.ytb !== false;
const inStock = (p: CusPack) => p.stock == null || p.stock > 0;
const packKb = (cfg: CusCfg, kind: "n" | "r") => ({ inline_keyboard: cfg.sell.packs.filter((p) => p.price > 0 && (kind === "n" || isYtb(p))).map((p) => [inStock(p)
  ? { text: `${p.name} · ${money(p.price)}${p.stock != null ? ` · còn ${p.stock}` : ""}`, callback_data: `p:${p.id}:${kind}` }
  : { text: `${p.name} · Hết hàng 🔔`, callback_data: `w:${p.id}` }]) });
const sellReady = (cfg: CusCfg) => cfg.sell.on && cfg.sell.packs.some((p) => p.price > 0);

async function cusCheck(cfg: CusCfg, e: string, line: string, openText: string, fixed: Fixed): Promise<{ text: string; queue: boolean; renew?: boolean }> {
  const r = await tfFind(e);
  if (!r) return { text: T(cfg, "notfound", { email: e }), queue: false };
  const hsdRaw = String((r.arch ? r.arch.hsd : r.c.hsd) || ""), ctv = r.arch ? r.arch.ctv : r.c.ctv;
  if (normCtv(ctv) !== "Dnc") return { text: T(cfg, "other", { email: e }), queue: false };
  const v = pDate(hsdRaw), left = v == null ? null : daysU(v);
  if (left != null && left < 0) return { text: T(cfg, "expired", { email: e, hsd: hsdRaw }), queue: false, renew: true };
  const hsd = hsdRaw ? `\nHạn dùng: <b>${esc(hsdRaw)}</b>` : "";
  const still = STILL.test(line), fx = fixed[e];
  if (fx && Date.now() - fx.at < 3 * 864e5 && !still) return { text: `${T(cfg, "done_recent", { email: e, ngay: fmtAt(fx.at) })}${hsd}\n\n${T(cfg, "guide", { email: e })}`, queue: false };
  if (!r.arch) {
    const ago = agoDays(r.c.invitedAt);
    if (!famProblems(r.f, r.c).length && ago != null && ago <= 3 && !still)
      return { text: `${T(cfg, "invited_recent", { email: e, ngay: ago === 0 ? "hôm nay" : ago === 1 ? "hôm qua" : ago + " ngày trước" })}${hsd}\n\n${T(cfg, "guide", { email: e })}`, queue: false };
  }
  if (openText.includes(e) && !still) return { text: T(cfg, "waiting", { email: e }), queue: false };
  return { text: T(cfg, "reported", { email: e }) + hsd, queue: true };
}

async function cusStartOrder(cfg: CusCfg, doc: CusDoc, chat: number, from: any, packId: string, kind: "new" | "renew", email: string) {
  const p = cfg.sell.packs.find((x) => x.id === packId);
  if (!p || !(p.price > 0)) return csay(chat, "Gói này không còn bán, bạn chọn gói khác nhé.", { reply_markup: packKb(cfg, kind === "renew" ? "r" : "n") });
  if (!inStock(p)) { delete doc.state[String(chat)]; await cusPut(doc); return csay(chat, T(cfg, "out_stock", { goi: p.name }), { reply_markup: { inline_keyboard: [[{ text: "🔔 Báo khi có hàng", callback_data: `w:${p.id}` }]] } }); }
  let ma = ""; do { ma = (isYtb(p) ? "YT" : "SP") + Math.floor(10000 + Math.random() * 90000); } while (doc.orders[ma]);
  doc.orders[ma] = { chat, name: nameOf(from), email, pack: p.name, packId: p.id, ytb: isYtb(p), months: p.months, price: p.price, kind: isYtb(p) ? kind : "new", at: Date.now(), st: "wait" };
  delete doc.state[String(chat)];
  await cusPut(doc);
  const cap = T(cfg, "sell_pay", { ma, goi: p.name, email, gia: money(p.price) });
  const kb = { inline_keyboard: [[{ text: "✅ Tôi đã chuyển khoản", callback_data: `paid:${ma}` }], [{ text: "Huỷ đơn", callback_data: `cx:${ma}` }]] };
  const b = cfg.sell.bank;
  if (b.id && b.acc) {
    const qr = `https://img.vietqr.io/image/${encodeURIComponent(b.id)}-${encodeURIComponent(b.acc)}-compact2.png?amount=${p.price}&addInfo=${encodeURIComponent(ma)}&accountName=${encodeURIComponent(b.name || "")}`;
    const r = await ctg("sendPhoto", { chat_id: chat, photo: qr, caption: cap, parse_mode: "HTML", reply_markup: kb });
    if (r.ok) return r;
  }
  return csay(chat, cap + (b.acc ? `\n\nTK: <code>${esc(b.acc)}</code> · ${esc(b.id)}${b.name ? " · " + esc(b.name) : ""}` : ""), { reply_markup: kb });
}

/* email gửi lúc đang mua: có trong kho & của Dnc → gia hạn; không có → đơn mới; đại lý khác → từ chối */
async function cusOrderEmail(cfg: CusCfg, doc: CusDoc, chat: number, from: any, e: string) {
  const st = doc.state[String(chat)]!;
  const pk = cfg.sell.packs.find((x) => x.id === st.pack);
  if (pk && !isYtb(pk)) return cusStartOrder(cfg, doc, chat, from, pk.id, "new", e);
  let kind: "new" | "renew" = st.kind === "renew" ? "renew" : "new";
  try {
    const r = await tfFind(e);
    if (r) { const ctv = r.arch ? r.arch.ctv : r.c.ctv; if (normCtv(ctv) !== "Dnc") { delete doc.state[String(chat)]; await cusPut(doc); return csay(chat, T(cfg, "other", { email: e })); } kind = "renew"; }
  } catch (_) { /* tra lỗi → cứ tạo đơn, DNC kiểm tra */ }
  return cusStartOrder(cfg, doc, chat, from, st.pack || "", kind, e);
}

async function cusCallback(q: any) {
  const chat = q.message?.chat?.id; if (!chat) return;
  const [a, x, y] = String(q.data || "").split(":");
  const cfg = await cusCfg(), doc = await cusGet();
  await ctg("answerCallbackQuery", { callback_query_id: q.id });
  if (a === "buy") { if (!sellReady(cfg)) return csay(chat, "Hiện chưa mở bán qua bot, bạn nhắn người bán nhé."); return csay(chat, T(cfg, "sell_menu"), { reply_markup: packKb(cfg, "n") }); }
  if (a === "p") {
    if (!sellReady(cfg)) return csay(chat, "Hiện chưa mở bán qua bot, bạn nhắn người bán nhé.");
    const prev = doc.state[String(chat)];
    if (y === "r" && prev?.email) return cusStartOrder(cfg, doc, chat, q.from, x, "renew", prev.email);
    const pk = cfg.sell.packs.find((p) => p.id === x);
    if (pk && !inStock(pk)) return csay(chat, T(cfg, "out_stock", { goi: pk.name }), { reply_markup: { inline_keyboard: [[{ text: "🔔 Báo khi có hàng", callback_data: `w:${pk.id}` }]] } });
    doc.state[String(chat)] = { step: "email", pack: x, kind: y === "r" ? "renew" : "new", at: Date.now() };
    await cusPut(doc);
    return csay(chat, pk && !isYtb(pk) ? T(cfg, "sell_info", { goi: pk.name }) : T(cfg, "sell_email"));
  }
  if (a === "w") {
    const pk = cfg.sell.packs.find((p) => p.id === x); if (!pk) return csay(chat, "Sản phẩm này không còn bán.");
    if (inStock(pk)) return csay(chat, `${esc(pk.name)} đang có hàng, bấm mua nhé.`, { reply_markup: { inline_keyboard: [[{ text: `🛒 Mua ngay · ${money(pk.price)}`, callback_data: `p:${pk.id}:n` }]] } });
    const l = doc.wait[x] ||= []; if (!l.includes(chat)) l.push(chat);
    await cusPut(doc);
    return csay(chat, T(cfg, "wait_ok", { goi: pk.name }));
  }
  const o = doc.orders[x]; if (!o || o.chat !== chat) return csay(chat, "Không tìm thấy đơn này.");
  if (a === "cx") { if (o.st === "wait") { o.st = "cancel"; await cusPut(doc); } return csay(chat, `Đã huỷ đơn <b>${esc(x)}</b>.`); }
  if (a === "paid") {
    if (o.st !== "wait") return csay(chat, o.st === "cancel" ? "Đơn này đã huỷ." : T(cfg, "sell_paid", { ma: x }));
    const pk = cfg.sell.packs.find((p) => p.id === o.packId);
    let low = "";
    if (pk && pk.stock != null) { pk.stock = pk.stock - 1; if (pk.stock < 0) low = "\n⚠️ <b>Hết hàng</b> — khách đã chuyển tiền, cần xử lý."; await docPut("cus_cfg", cfg); }
    if (o.ytb === false) {
      o.st = "paid"; await cusPut(doc);
      await say(`💰 <b>Đơn ${esc(o.pack)} ${esc(x)}</b> — khách báo đã chuyển khoản\nNhận hàng: <code>${esc(o.email)}</code> · <b>${money(o.price)}</b>\nKhách: ${esc(o.name || "Telegram")}${pk && pk.stock != null ? ` · còn ${pk.stock}` : ""}${low}\n\nKiểm tra tiền (nội dung ${esc(x)}), giao hàng rồi bấm "Đã giao" (hoặc gửi kèm thông tin ở tab Bot khách).`, { reply_markup: { inline_keyboard: [[{ text: "✅ Đã giao", callback_data: `cg:${x}` }], [{ text: "Mở tab Bot khách", url: "https://godnc.com/thayfam/" }]] } });
      return csay(chat, T(cfg, "sell_paid", { ma: x }));
    }
    const line = o.kind === "renew"
      ? `${o.email} gia hạn ${o.months} tháng (đơn ${x}, ${money(o.price)}, khách lẻ báo đã CK — kiểm tra tiền)`
      : `${o.email} ${o.months} tháng (đơn mới ${x}, ${money(o.price)}, khách lẻ báo đã CK — kiểm tra tiền)`;
    await tf({ action: "queue", op: "add", text: line, from: CUS_FROM, src: "cusbot" });
    o.st = "paid"; doc.subs[o.email] = { chat, name: o.name, at: Date.now(), pending: true, kind: o.kind === "renew" ? "renew" : "order" };
    await cusPut(doc);
    await say(`💰 <b>Đơn ${o.kind === "renew" ? "gia hạn" : "mới"} ${esc(x)}</b> — khách báo đã chuyển khoản\n${esc(o.email)} · ${esc(o.pack)} · <b>${money(o.price)}</b>\nKhách: ${esc(o.name || "Telegram")}${low}\n\nKiểm tra tiền (nội dung ${esc(x)}) rồi duyệt ở tab Lệnh — duyệt xong bot tự nhắn khách.`, { reply_markup: { inline_keyboard: [[{ text: "Mở Thay Fam", url: "https://godnc.com/thayfam/#lenh" }]] } });
    return csay(chat, T(cfg, "sell_paid", { ma: x }));
  }
}

async function cusHandle(u: any) {
  if (u.callback_query) return cusCallback(u.callback_query);
  const m = u.message || u.edited_message; if (!m || m.chat?.type !== "private") return;
  const chat = m.chat.id, text = String(m.text || m.caption || "").trim();
  const cfg = await cusCfg();
  if (/^\/start\b/i.test(text)) { try { const d0 = await cusGet(); d0.users[String(chat)] = { name: nameOf(m.from), at: Date.now() }; await cusPut(d0); } catch (_) { /* bỏ qua */ } }
  const startKb = sellReady(cfg) ? { reply_markup: { inline_keyboard: [[{ text: "🛒 Mua / gia hạn YouTube Premium", callback_data: "buy" }]] } } : {};
  if (!text || /^\/(start|help)\b/i.test(text)) return csay(chat, T(cfg, "start"), startKb);
  if (/^\/?(mua|buy)\b/i.test(text)) { if (!sellReady(cfg)) return csay(chat, "Hiện chưa mở bán qua bot, bạn nhắn người bán nhé."); return csay(chat, T(cfg, "sell_menu"), { reply_markup: packKb(cfg, "n") }); }
  const ems = [...new Set((text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || []).map((x) => x.toLowerCase()))].slice(0, 3);
  const doc = await cusGet(), key = String(chat);
  const st = doc.state[key];
  if (st?.step === "email" && sellReady(cfg)) {
    const pk = cfg.sell.packs.find((x) => x.id === st.pack);
    if (pk && !isYtb(pk)) { if (/^\//.test(text)) return csay(chat, T(cfg, "sell_info", { goi: pk.name })); return cusOrderEmail(cfg, doc, chat, m.from, (ems[0] || text).slice(0, 200)); }
    if (!ems.length) return csay(chat, T(cfg, "sell_email"));
    return cusOrderEmail(cfg, doc, chat, m.from, ems[0]);
  }
  if (!ems.length) return csay(chat, T(cfg, "ask_email"), startKb);
  const t = today();
  const rt = doc.rate[key]?.day === t ? doc.rate[key] : { day: t, emails: [] as string[] };
  const fresh = ems.filter((e) => !rt.emails.includes(e));
  if (rt.emails.length + fresh.length > 5) return csay(chat, T(cfg, "limit"));
  rt.emails.push(...fresh); doc.rate[key] = rt;
  await ctg("sendChatAction", { chat_id: chat, action: "typing" });
  let openText = "";
  try { const q = await tf({ action: "queue", op: "list" }); openText = (q.open || []).map((x: any) => String(x.text || "")).join("\n").toLowerCase(); } catch (_) { /* bỏ qua */ }
  let fixed: Fixed = {}; try { fixed = await tuanFixedGet(); } catch (_) { /* bỏ qua */ }
  const lines = text.split(/\r?\n/), name = nameOf(m.from);
  const out: string[] = [], toQ: string[] = []; let renewEmail = "";
  for (const e of ems) {
    const ln = lines.find((l) => l.toLowerCase().includes(e)) || e;
    try {
      const r = await cusCheck(cfg, e, ln, openText, fixed);
      out.push(r.text);
      if (r.renew) renewEmail ||= e;
      if (r.queue || (openText.includes(e) && !STILL.test(ln))) doc.subs[e] = { chat, name, at: Date.now(), pending: true, kind: "report" };
      if (r.queue) toQ.push(/pre|lỗi|loi|mất|mat/i.test(ln) && ln.length > e.length + 3 ? ln : `${e} mất pre`);
    } catch (err) { console.error("cus", e, (err as Error).message); out.push(`⚠️ Chưa kiểm tra được <b>${esc(e)}</b>, bạn thử lại sau ít phút nhé.`); }
  }
  if (toQ.length) {
    try {
      await tf({ action: "queue", op: "add", text: toQ.join("\n"), from: CUS_FROM, src: "cusbot" });
      await say(`🆘 <b>Khách lẻ báo lỗi</b> (${esc(name || "Telegram")}):\n${toQ.map((l) => "• " + esc(l)).join("\n")}\n\nĐã vào tab Lệnh — bấm Xong là bot tự nhắn lại khách.`, { reply_markup: { inline_keyboard: [[{ text: "Mở Thay Fam", url: "https://godnc.com/thayfam/#lenh" }]] } });
    } catch (e) { console.error("cus queue", (e as Error).message); }
  }
  let extra: Record<string, unknown> = {};
  if (renewEmail && sellReady(cfg)) { doc.state[key] = { step: "renew", email: renewEmail, kind: "renew", at: Date.now() }; extra = { reply_markup: packKb(cfg, "r") }; }
  await cusPut(doc);
  return csay(chat, out.join("\n\n"), extra);
}

/* Thay Fam gọi khi Xong / thay fam mời lại. Chỉ nhắn khách đang chờ, mỗi lần 1 tin; câu chữ theo loại (lỗi / đơn mới / gia hạn). */
async function cusNotify(emails: string[], kind: string) {
  const cfg = await cusCfg(), doc = await cusGet(); let sent = 0;
  for (const raw of emails) {
    const e = String(raw).toLowerCase(), s = doc.subs[e];
    if (!s || !s.pending) continue;
    let msg: string;
    if (s.kind === "renew") msg = T(cfg, "renewed", { email: e });
    else if (s.kind === "order") msg = `${T(cfg, "activated", { email: e })}\n\n${T(cfg, "guide", { email: e })}`;
    else msg = `${T(cfg, kind === "invited" ? "invited" : "fixed", { email: e })}\n\n${T(cfg, "guide", { email: e })}`;
    const r = await csay(s.chat, msg);
    if (r.ok) {
      s.pending = false; s.at = Date.now(); sent++;
      for (const o of Object.values(doc.orders)) if (o.email === e && o.st === "paid") o.st = "done";
    }
  }
  if (sent) await cusPut(doc);
  return sent;
}

/* Đơn SP khác (không phải YouTube): DNC bấm Đã giao (bot riêng hoặc tab Bot khách, có thể kèm thông tin) → nhắn khách */
async function cusDeliver(ma: string, note = "") {
  const cfg = await cusCfg(), doc = await cusGet(), o = doc.orders[ma];
  if (!o) return { ok: false, error: "không thấy đơn " + ma };
  if (o.st === "done") return { ok: false, error: "đơn đã giao rồi" };
  const msg = T(cfg, "delivered", { ma, goi: o.pack, email: o.email }) + (note.trim() ? `\n\n${esc(note.trim()).slice(0, 3000)}` : "");
  const r = await csay(o.chat, msg);
  if (!r.ok) return { ok: false, error: "không nhắn được khách: " + (r.description || "") };
  o.st = "done"; o.note = note.trim().slice(0, 500); await cusPut(doc);
  return { ok: true };
}
/* hàng về (tồn 0 → >0): nhắn khách đã bấm 🔔 */
async function cusRestock(cfg: CusCfg, p: CusPack, added: number) {
  const doc = await cusGet(), list = doc.wait[p.id] || []; let n = 0;
  const text = T(cfg, "restock", { goi: p.name, them: String(added), ton: String(p.stock ?? ""), gia: money(p.price) });
  for (const chat of list) { const r = await csay(chat, text, { reply_markup: { inline_keyboard: [[{ text: "🛒 Mua ngay", callback_data: `p:${p.id}:n` }]] } }); if (r.ok) n++; }
  delete doc.wait[p.id]; await cusPut(doc);
  return n;
}

/* tab "📮 Bot khách" trên Thay Fam */
async function cusAdmin(b: any) {
  const op = String(b.op || "get");
  let note = "";
  if (op === "deliver") { const r = await cusDeliver(String(b.ma || ""), String(b.note || "")); if (!r.ok) return r; note = "Đã nhắn khách đơn " + b.ma; }
  if (op === "set") {
    const prev = await cusCfg();
    const c = b.cfg || {}, texts: Record<string, string> = {};
    for (const k of Object.keys(CUS_TEXTS)) { const v = String(c.texts?.[k] ?? "").slice(0, 1500); if (v.trim() && v.trim() !== CUS_TEXTS[k][1]) texts[k] = v; }
    const packs: CusPack[] = (Array.isArray(c.sell?.packs) ? c.sell.packs : []).slice(0, 20).map((p: any, i: number) => ({ id: String(p.id || "p" + i).replace(/[^\w]/g, "").slice(0, 10) || "p" + i, name: String(p.name || "").slice(0, 40), months: Math.max(1, Math.min(36, Math.round(+p.months || 1))), price: Math.max(0, Math.round(+p.price || 0)), stock: p.stock === "" || p.stock == null ? null : Math.round(+p.stock || 0), ytb: p.ytb !== false })).filter((p: CusPack) => p.name);
    const bank = { id: String(c.sell?.bank?.id || "").trim().slice(0, 30), acc: String(c.sell?.bank?.acc || "").replace(/\s+/g, "").slice(0, 30), name: String(c.sell?.bank?.name || "").trim().slice(0, 60) };
    // tồn kho không sửa trên web (bằng lúc tải) → giữ số hiện tại (bot có thể đã trừ khi khách mua)
    const raw: any[] = Array.isArray(c.sell?.packs) ? c.sell.packs : [];
    for (const p of packs) { const r0 = raw.find((x) => String(x.id) === p.id), o = prev.sell.packs.find((x) => x.id === p.id); if (r0 && o && "stock0" in r0 && String(r0.stock ?? "") === String(r0.stock0 ?? "")) p.stock = o.stock ?? null; }
    const next: CusCfg = { texts, sell: { on: !!c.sell?.on, packs, bank } };
    await docPut("cus_cfg", next);
    // hàng về: tồn cũ ≤ 0 → mới > 0
    let n = 0;
    for (const p of packs) { const o = prev.sell.packs.find((x) => x.id === p.id); if (o && o.stock != null && o.stock <= 0 && p.stock != null && p.stock > 0) n += await cusRestock(next, p, p.stock - Math.max(0, o.stock)); }
    if (n) note = `Đã báo hàng về cho ${n} khách`;
  }
  if (op === "setup") {
    if (!CUS_TOKEN) return { ok: false, error: "chưa có secret CUS_BOT_TOKEN trên Supabase" };
    if (CUS_TOKEN === TOKEN) return { ok: false, error: "CUS_BOT_TOKEN phải là bot khác @goshopassistantbot" };
    const self = `${SB_URL}/functions/v1/desk-bot?cus=1`;
    const set = await ctg("setWebhook", { url: self, secret_token: SECRET, allowed_updates: ["message", "edited_message", "callback_query"], max_connections: 2 });
    await ctg("setMyCommands", { commands: [{ command: "start", description: "Hướng dẫn" }, { command: "mua", description: "Mua / gia hạn" }] });
    if (!set.ok) return { ok: false, error: set.description || "setWebhook lỗi" };
  }
  const cfg = await cusCfg(), doc = await cusGet();
  let bot: any = null, hook: any = null;
  if (CUS_TOKEN) { const [me, wh] = await Promise.all([ctg("getMe", {}), ctg("getWebhookInfo", {})]); bot = me.result?.username || null; hook = wh.result ? { url: wh.result.url, ok: wh.result.url === `${SB_URL}/functions/v1/desk-bot?cus=1`, err: wh.result.last_error_message || "", pending: wh.result.pending_update_count || 0 } : null; }
  const texts: Record<string, { label: string; def: string; val: string }> = {};
  for (const [k, [label, def]] of Object.entries(CUS_TEXTS)) texts[k] = { label, def, val: cfg.texts[k] ?? def };
  const orders = Object.entries(doc.orders).map(([ma, o]) => ({ ma, email: o.email, pack: o.pack, price: o.price, kind: o.kind, ytb: o.ytb !== false, st: o.st, at: o.at, name: o.name, note: o.note || "" })).sort((a, b) => b.at - a.at).slice(0, 40);
  const waitN: Record<string, number> = {}; for (const [k, l] of Object.entries(doc.wait)) waitN[k] = l.length;
  const waiting = Object.entries(doc.subs).filter(([, s]) => s.pending).map(([e, s]) => ({ email: e, kind: s.kind || "report", at: s.at, name: s.name }));
  return { ok: true, token: !!CUS_TOKEN, bot, hook, sell: cfg.sell, texts, orders, waiting, waitN, users: Object.keys(doc.users).length, note };
}

/* ---------- Gia hạn duyệt ngay trên bot ----------
   Gõ "abc@gmail.com gia hạn 12 tháng" → vào hàng chờ Lệnh như cũ + bot gửi thẻ xem trước HSD mới có nút ✅ Duyệt.
   Bấm Duyệt = đúng như Duyệt trên web (renewCus): HSD bản sao + data gốc + dòng Tài chính, rồi đánh Xong dòng lệnh. */
type RenewP = { qid: string; li: number; email: string; months: number; base: "old" | "today"; product: string; at: number; done?: string };
function lineKind(raw: string) { // giống cmdAdd trên web
  const t = raw.toLowerCase(), ems = raw.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || [];
  const mm = /(\d{1,2})\s*(?:th|tháng|thang|t)\b/i.exec(raw), dates = raw.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g) || [];
  if (/h[uủ]y|hoàn tiền|hoan tien|refund/.test(t)) return null;
  if (/đổi|doi |chuyển mail|chuyen mail/.test(t) && ems.length >= 2) return null;
  if (/mất\s*pre|mat\s*pre|mất premium|hết pre|lỗi|\bloi\b|không vào|ko vào|k vào|bị out|bị kick|bị đá|văng|out fam|không xem|ko xem/.test(t)) return null;
  if (!ems.length || !(mm || dates.length || /gia hạn|giahan|gia han|\bgh\b|ytb|youtube|plus/.test(t))) return null;
  return { email: String(ems[0]).toLowerCase(), months: mm && [1, 3, 6, 12].includes(Number(mm[1])) ? Number(mm[1]) : 12, product: /plus/i.test(raw) ? "YoutubePlus" : "Youtube", start: String(dates[0] || "") };
}
async function renewGet(): Promise<Record<string, RenewP>> {
  const { data } = await db.from("desk_docs").select("data").eq("user_id", await owner()).eq("kind", "settings").eq("key", "tf_renew").maybeSingle();
  return (data?.data as Record<string, RenewP>) || {};
}
async function renewPut(m: Record<string, RenewP>) {
  for (const k of Object.keys(m)) if (Date.now() - m[k].at > 14 * 864e5) delete m[k];
  await db.from("desk_docs").upsert({ user_id: await owner(), kind: "settings", key: "tf_renew", data: m, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind,key" });
}
const newHsdOf = (hsd: string, months: number, base: string) => { const v = base === "today" ? Date.parse(today() + "T00:00:00Z") : pDate(hsd); return v == null ? "—" : dmyU(addMonthsU(v, months)); };
function famBadOf(f: any) { return f.famState || (f.status && !["FULL", "Còn slot", "Còn slot(đang check)"].includes(f.status)) || (f.daysToRenew != null && f.daysToRenew < 0); }
function renewCard(p: RenewP, r: any): { text: string; kb: any } {
  const PL = p.product === "YoutubePlus" ? "YTB Plus" : "YTB";
  if (!r) return { text: `❓ <b>${esc(p.email)}</b> — gia hạn ${p.months}th\nKhông có trong Kho TK → là đơn mới, xử lý ở tab Lệnh.`, kb: null };
  if (r.arch) return { text: `⚠️ <b>${esc(p.email)}</b> — gia hạn ${p.months}th\nKhách ở vùng lưu (chưa có slot) → chuyển vào fam trước rồi gia hạn ở tab Lệnh.`, kb: null };
  if (r.phuOf) return { text: `⚠️ <b>${esc(p.email)}</b> là mail phụ của <code>${esc(r.c.email)}</code> — kiểm tra lại trên tab Lệnh.`, kb: null };
  const { f, c } = r, exp = c.daysLeft != null && c.daysLeft < 0;
  const lines = [`🔁 <b>Gia hạn ${PL} +${p.months}th</b> · <code>${esc(c.email)}</code>`,
    `${esc(f.rn)} · CTV ${esc(normCtv(c.ctv))}${exp ? ` · <b>đã hết ${-c.daysLeft} ngày</b>` : ""}`,
    `HSD ${shortD(c.hsd) || "—"} → <b>${newHsdOf(c.hsd, p.months, p.base)}</b> ${p.base === "today" ? "(tính từ hôm nay)" : "(nối tiếp HSD cũ)"}`];
  if (c.daysLeft != null && c.daysLeft > 25) lines.push(`<i>Còn ${c.daysLeft} ngày — kiểm tra có phải đã gia hạn rồi không.</i>`);
  if (famBadOf(f)) lines.push(`⚠️ Fam ${esc(f.rn)} đang lỗi/Banned → duyệt xong cần mời khách vào fam mới.`);
  const row1: any[] = [{ text: "✅ Duyệt", callback_data: "" }];
  if (exp) row1.push({ text: p.base === "today" ? "↩️ Nối HSD cũ" : "📅 Tính từ hôm nay", callback_data: "" });
  return { text: lines.join("\n"), kb: row1 };
}
async function renewCards(body: string, from: string) {
  const ls = body.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const want = ls.map((l, i) => ({ i, k: lineKind(l) })).filter((x) => x.k);
  if (!want.length) return [];
  let qid = "";
  try {
    const q = await tf({ action: "queue", op: "list" });
    const hit = (q.open || []).filter((x: any) => String(x.text || "").trim() === body.trim()).pop();
    qid = hit ? String(hit.id) : "";
  } catch (_) { /* bỏ qua */ }
  const store = await renewGet(), out: { text: string; kb: any }[] = [];
  for (const w of want) {
    const k = w.k!, p: RenewP = { qid, li: w.i, email: k.email, months: k.months, base: "old", product: k.product, at: Date.now() };
    let r: any = null;
    try { r = await tfFind(k.email); } catch (e) { out.push({ text: `⚠️ <b>${esc(k.email)}</b>: không tra được (${esc((e as Error).message)})`, kb: null }); continue; }
    if (r?.phuOf) r = { phuOf: true, c: r.c };
    // khách hết hạn mà ngày mua ghi trong tin ≈ hôm nay → mua lại, tính từ hôm nay (giống web)
    if (r?.c && r.c.daysLeft < 0 && k.start) { const st = pDate(k.start); if (st != null && Math.abs(daysU(st)) < 4) p.base = "today"; }
    const cd = renewCard(p, r);
    if (cd.kb) {
      const id = Date.now().toString(36) + w.i; store[id] = p;
      cd.kb[0].callback_data = `g:ok:${id}`; if (cd.kb[1]) cd.kb[1].callback_data = `g:base:${id}`;
      cd.kb = { inline_keyboard: [cd.kb, [{ text: "Mở Thay Fam", url: "https://godnc.com/thayfam/#lenh" }]] };
    }
    out.push(cd);
  }
  await renewPut(store);
  return out;
}
const vnd = (n: unknown) => (n ? Number(n).toLocaleString("vi-VN") + "đ" : "—");
async function renewCallback(q: any, a: string, id: string) {
  const store = await renewGet(), p = store[id];
  const edit = (text: string, kb?: any) => tg("editMessageText", { chat_id: CHAT, message_id: q.message.message_id, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: kb || { inline_keyboard: [[{ text: "Mở Thay Fam", url: "https://godnc.com/thayfam/" }]] } });
  if (!p) return tg("answerCallbackQuery", { callback_query_id: q.id, text: "Thẻ cũ, không còn dữ liệu — làm trên Thay Fam" });
  if (p.done) return tg("answerCallbackQuery", { callback_query_id: q.id, text: "Đã duyệt rồi" });
  if (a === "base") {
    p.base = p.base === "today" ? "old" : "today"; await renewPut(store);
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: p.base === "today" ? "Tính từ hôm nay" : "Nối tiếp HSD cũ" });
    const cd = renewCard(p, await tfFind(p.email));
    if (cd.kb) { cd.kb[0].callback_data = `g:ok:${id}`; if (cd.kb[1]) cd.kb[1].callback_data = `g:base:${id}`; }
    return edit(cd.text, cd.kb ? { inline_keyboard: [cd.kb, [{ text: "Mở Thay Fam", url: "https://godnc.com/thayfam/#lenh" }]] } : undefined);
  }
  await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Đang gia hạn…" });
  try {
    // dòng lệnh đã được xử lý trên web chưa?
    if (p.qid) {
      const ql = await tf({ action: "queue", op: "list" });
      const it = (ql.open || []).find((x: any) => String(x.id) === p.qid);
      if (!it || (it.res && it.res[p.li])) { p.done = "web"; await renewPut(store); return edit(`ℹ️ <b>${esc(p.email)}</b>: dòng này đã xử lý trên Thay Fam rồi, bot không gia hạn lần nữa.`); }
    }
    // tra lại ngay trước khi ghi (dòng trong sheet có thể đã đổi)
    const r = await tfFind(p.email);
    if (!r || r.arch || r.phuOf) return edit(renewCard(p, r).text + "\n\n<i>Không duyệt được trên bot → làm ở tab Lệnh.</i>");
    const x = await tf({ action: "renewCus", row: r.c.row, email: r.c.email, months: p.months, bonusDays: 0, base: p.base, product: p.product });
    const msg = `${x.email || r.c.email} HSD ${x.oldHsd || r.c.hsd} + ${p.months}th → ${x.hsd || x.newHsd}`;
    p.done = "bot"; await renewPut(store);
    if (p.qid) { try { await tf({ action: "queue", op: "set", id: p.qid, line: p.li, status: "xong", note: "Gia hạn " + msg + " (duyệt trên bot)" }); } catch (e) { console.error("queue set", (e as Error).message); } }
    const lines = [`✅ <b>Đã gia hạn</b> ${esc(x.sku || "")}: <code>${esc(r.c.email)}</code>`, `HSD ${esc(x.oldHsd || r.c.hsd)} → <b>${esc(x.hsd || x.newHsd || "")}</b> · ${esc(r.f.rn)}`];
    if (x.tcRow) lines.push(`Tài chính dòng ${x.tcRow}: giá ${vnd(x.price)}, HH ${vnd(x.hh)}, lãi ${vnd(x.profit)}`);
    lines.push(x.sync && x.sync.ok ? "Đã ghi data gốc." : `⚠️ CHƯA ghi data gốc${x.sync?.error ? ": " + esc(x.sync.error) : ""} → tab Đồng bộ đẩy lại.`);
    if (famBadOf(r.f) || p.base === "today") lines.push(famBadOf(r.f) ? `⚠️ Fam ${esc(r.f.rn)} đang lỗi → mời khách vào fam mới trên Thay Fam.` : `⚠️ Tính từ hôm nay (khách mua lại) → kiểm tra khách còn trong ${esc(r.f.rn)} không, không thì mời vào fam mới.`);
    lines.push(`\n📋 <code>${esc(msg)}</code>`);
    return edit(lines.join("\n"));
  } catch (e) {
    return edit(`⚠️ Gia hạn <b>${esc(p.email)}</b> lỗi: ${esc((e as Error).message)}\nChưa chắc đã ghi — kiểm tra tab Lịch sử trước khi làm lại.`, { inline_keyboard: [[{ text: "Mở Thay Fam", url: "https://godnc.com/thayfam/" }]] });
  }
}

/* ---------- Trợ lý Thay Fam: AI agent hỏi-đáp trên dữ liệu Thay Fam ----------
   Một bộ não, 2 cửa: Telegram riêng (/hoi hoặc tin bắt đầu bằng "?", trả lời tin của trợ lý để hỏi tiếp)
   và tab "Hỏi" trên godnc.com/thayfam (POST ?tf_ask, xác thực bằng TF_PASS).
   Chỉ ĐỌC sheet. Việc cần ghi → chỉ được đưa vào hàng chờ tab Lệnh để DNC duyệt. Không bao giờ gửi mật khẩu/2FA cho AI. */
const SECRET_KEY = /^(pass|pw|password|mkp|twofa|2fa|otp|secret|token)$/i;
function compact(v: any, d = 0): any {
  if (v == null || typeof v !== "object") return typeof v === "string" ? v.slice(0, 300) : v;
  if (d > 6) return "…";
  if (Array.isArray(v)) return v.slice(0, 150).map((x) => compact(x, d + 1)).concat(v.length > 150 ? [`…còn ${v.length - 150} mục`] : []);
  const o: any = {};
  for (const [k, x] of Object.entries(v)) { if (SECRET_KEY.test(k) || x === "" || x == null) continue; o[k] = compact(x, d + 1); }
  return o;
}
const cutJ = (o: unknown, n = 24000) => { const s = JSON.stringify(compact(o)); return s.length > n ? s.slice(0, n) + "…(cắt bớt, hãy lọc hẹp hơn)" : s; };
const noAcc = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim();

function agentTools(ctx: { all?: any; queued: string[] }) {
  const all = async () => (ctx.all ||= await tf({ action: "all" }));
  const flatCus = async () => {
    const d = await all(), out: any[] = [];
    for (const f of d.items || []) for (const c of f.customers || []) if (c.email)
      out.push({ email: c.email, rn: f.rn, hsd: c.hsd, daysLeft: c.daysLeft, ctv: normCtv(c.ctv), mailPhu: c.mailPhu, nojoin: c.nojoin, invitedAt: c.invitedAt, kicked: c.kicked, famStatus: f.status, famRenew: f.renew, famDaysToRenew: f.daysToRenew, famState: f.famState?.state });
    return out;
  };
  const fns: Record<string, (a: any) => Promise<unknown>> = {
    tim: async (a) => { const d = await tf({ action: "search", q: String(a.q || "") }); return { fams: d.items, total: d.total, vung_luu_chua_co_slot: d.archived }; },
    loc_khach: async (a) => {
      let r = await flatCus();
      if (a.ctv) { const k = noAcc(a.ctv); r = r.filter((c) => noAcc(c.ctv).startsWith(k)); }
      if (a.rn) { const k = noAcc(a.rn); r = r.filter((c) => noAcc(c.rn).includes(k)); }
      if (a.con_ngay_tu != null) r = r.filter((c) => c.daysLeft != null && c.daysLeft >= +a.con_ngay_tu);
      if (a.con_ngay_den != null) r = r.filter((c) => c.daysLeft != null && c.daysLeft <= +a.con_ngay_den);
      if (a.chua_vao_nhom) r = r.filter((c) => c.nojoin);
      if (a.co_huy) r = r.filter((c) => /h[uủ]y|hoàn/i.test(String(c.mailPhu || "")));
      r.sort((x, y) => (x.daysLeft ?? 999) - (y.daysLeft ?? 999));
      const n = Math.min(+a.gioi_han || 60, 150);
      return { tong: r.length, hien: Math.min(n, r.length), khach: r.slice(0, n) };
    },
    loc_fam: async (a) => {
      const d = await all();
      let r = (d.items || []).map((f: any) => ({ rn: f.rn, status: f.status, renew: f.renew, daysToRenew: f.daysToRenew, famState: f.famState?.state, baoLoi: !!f.report, soKhach: (f.customers || []).filter((c: any) => c.email).length, khachHetHan: (f.customers || []).filter((c: any) => c.email && c.daysLeft != null && c.daysLeft < 0).length }));
      if (a.trang_thai) { const k = noAcc(a.trang_thai); r = r.filter((f: any) => noAcc(f.status).includes(k)); }
      if (a.renew_trong_ngay != null) r = r.filter((f: any) => f.daysToRenew != null && f.daysToRenew <= +a.renew_trong_ngay);
      if (a.bao_loi) r = r.filter((f: any) => f.baoLoi || f.famState);
      if (a.rn) { const k = noAcc(a.rn); r = r.filter((f: any) => noAcc(f.rn).includes(k)); }
      r.sort((x: any, y: any) => (x.daysToRenew ?? 999) - (y.daysToRenew ?? 999));
      const n = Math.min(+a.gioi_han || 60, 200);
      return { tong: r.length, hien: Math.min(n, r.length), fams: r.slice(0, n), vung_luu: (d.archive?.length ?? d.archive?.items?.length) };
    },
    tong_quan: async () => tf({ action: "dashboard", ahead: 3 }),
    tuan_nay: async () => tf({ action: "week" }),
    con_slot: async () => tf({ action: "slots" }),
    chan_moi: async () => tf({ action: "blocks", op: "list" }),
    lich_su: async (a) => { const d = await tf({ action: "log", days: Math.min(+a.ngay || 7, 30) }); return { log: (d.log || []).slice(-120) }; },
    hang_cho: async () => { const d = await tf({ action: "queue", op: "list" }); return { dang_cho: d.open }; },
    gg1: async () => tf({ action: "gg_list" }),
    dua_vao_lenh: async (a) => {
      const t = String(a.noi_dung || "").trim(); if (!t) return { loi: "trống" };
      const d = await tf({ action: "queue", op: "add", text: t, from: "Trợ lý", src: "agent" });
      ctx.queued.push(t); return { ok: true, so_dong: d.lines, ghi_chu: "Đã vào tab Lệnh, CHƯA ghi sheet — DNC duyệt." };
    },
  };
  const S = (props: Record<string, unknown>, req: string[] = []) => ({ type: "object", properties: props, required: req });
  const str = (d: string) => ({ type: "string", description: d }), num = (d: string) => ({ type: "number", description: d }), bool = (d: string) => ({ type: "boolean", description: d });
  const decls = [
    { name: "tim", description: "Tìm khách hoặc fam theo email khách, mail phụ, RN (vd RN123) hoặc email fam. Trả fam kèm danh sách khách + khách ở vùng lưu (chưa có slot).", parameters: S({ q: str("email / RN / từ khoá") }, ["q"]) },
    { name: "loc_khach", description: "Lọc toàn bộ khách YouTube trong Kho TK. daysLeft = số ngày còn lại của khách (âm = đã hết hạn).", parameters: S({ ctv: str("Dnc, Tuấn, Vương, Lộc"), rn: str("lọc theo fam"), con_ngay_tu: num("daysLeft >= "), con_ngay_den: num("daysLeft <= (vd 3 = sắp hết hạn trong 3 ngày, -1 = đã hết hạn)"), chua_vao_nhom: bool("chỉ khách đã ghi là chưa vào nhóm"), co_huy: bool("chỉ khách có ghi hủy/hoàn tiền"), gioi_han: num("số dòng trả về, mặc định 60") }) },
    { name: "loc_fam", description: "Lọc toàn bộ fam (RN). daysToRenew = số ngày tới ngày renew (≤0 = tới hạn thay fam).", parameters: S({ trang_thai: str("FULL, Còn slot, Banned…"), renew_trong_ngay: num("fam có daysToRenew <= số này"), bao_loi: bool("chỉ fam bị báo lỗi / đã xoá nhóm / bị quét"), rn: str("RN"), gioi_han: num("mặc định 60") }) },
    { name: "tong_quan", description: "Bảng tổng quan hôm nay: fam đến hạn thay (3 ngày tới), fam bị báo lỗi, khách cần gia hạn.", parameters: S({}) },
    { name: "tuan_nay", description: "Kế hoạch 7 ngày: fam đến hạn, số FR sẵn sàng, fam bị chặn mời, khách đang chờ xếp fam, khách sắp hết hạn.", parameters: S({}) },
    { name: "con_slot", description: "Các fam còn slot trống / mời chưa vào (cần kiểm tra join).", parameters: S({}) },
    { name: "chan_moi", description: "Fam đang bị Google chặn mời (hết lượt mời tuần) và còn bao nhiêu ngày mới mời lại được.", parameters: S({}) },
    { name: "lich_su", description: "Lịch sử thao tác trên Thay Fam (thay fam, mời, đổi mail…).", parameters: S({ ngay: num("số ngày gần nhất, mặc định 7") }) },
    { name: "hang_cho", description: "Các lệnh đang chờ duyệt ở tab Lệnh (tin Tuấn, báo lỗi…).", parameters: S({}) },
    { name: "gg1", description: "Dữ liệu Google One (GG1): các fam và khách.", parameters: S({}) },
    { name: "dua_vao_lenh", description: "CHỈ dùng khi DNC yêu cầu rõ làm một việc ghi (đổi mail, gia hạn, đơn mới, hủy, báo lỗi). Đưa 1 dòng lệnh vào hàng chờ tab Lệnh, không ghi sheet. Viết theo mẫu tin của Tuấn, vd: 'abc@gmail.com gia hạn 12 tháng', 'đổi a@gmail.com sang b@gmail.com', 'hủy abc@gmail.com', 'abc@gmail.com mất pre'.", parameters: S({ noi_dung: str("dòng lệnh") }, ["noi_dung"]) },
  ];
  return { fns, decls };
}

function agentPrompt() {
  const t = today();
  return `Bạn là trợ lý Thay Fam của DNC (DNL) — shop bán slot YouTube Premium gia đình (fam). Trả lời tiếng Việt, ngắn, thẳng, đúng số liệu.
Hôm nay ${t} (${WD[new Date(t + "T00:00:00Z").getUTCDay()]}), GMT+7.
Kiến thức nghiệp vụ:
- RN = fam đang dùng để mời khách; FR = fam chờ, được nâng lên thay RN khi RN tới ngày renew. Thay fam: RN cũ → Banned, FR mới thành RN, mời lại khách còn hạn (khách hết hạn không mời, trừ khi CTV báo đang gia hạn). Ngày renew mới = ngày này tháng sau.
- Fam còn khách hết hạn không mời lại → trạng thái "Còn slot" (slot trống cần lấp), không phải FULL.
- Google giới hạn ~6-7 lời mời/tuần/fam; bị chặn thì 4-5 ngày sau mới mời lại được. Mời xong phải kiểm tra lại sau vài ngày xem khách đã vào chưa.
- "Mất pre" = khách chưa được mời lại hoặc fam hỏng → cần fix (chuyển fam còn slot + mời).
- CTV: Dnc (khách của DNC), Tuấn, Vương, Lộc. Khách ở "vùng lưu" = chưa có slot, chưa được mời.
- Data gốc (Kho TK) không sửa trực tiếp; webapp sửa bản sao, admin duyệt rồi đồng bộ.
Cách làm:
- LUÔN gọi công cụ lấy dữ liệu thật trước khi trả lời về khách/fam; không đoán. Câu hỏi đếm/lọc → dùng loc_khach / loc_fam. Có email/RN → tim.
- Bạn chỉ đọc. Nếu DNC bảo làm việc ghi, dùng dua_vao_lenh rồi nói rõ "đã vào tab Lệnh, anh duyệt". Không tự đưa lệnh khi DNC chỉ hỏi.
- Không bao giờ nêu mật khẩu, MKP, 2FA.
- Định dạng: chữ thường, gạch đầu dòng "• ", không markdown (không **, #, bảng). Ngày dạng dd/mm. Danh sách dài thì nêu tổng + tối đa ~15 dòng quan trọng nhất. Cuối câu trả lời có việc cần làm thì ghi 1 dòng "→ ...".`;
}

type Turn = { role: "user" | "model"; text: string };
async function askTF(q: string, hist: Turn[] = []): Promise<{ text: string; used: string[]; queued: string[] }> {
  const key = Deno.env.get("GEMINI_API_KEY"); if (!key) throw new Error("chưa có GEMINI_API_KEY");
  const ctx: { all?: any; queued: string[] } = { queued: [] };
  const { fns, decls } = agentTools(ctx);
  const contents: any[] = [...hist.slice(-8).map((h) => ({ role: h.role, parts: [{ text: h.text }] })), { role: "user", parts: [{ text: q }] }];
  const used: string[] = [];
  let model = MODELS[0];
  for (let round = 0; round < 7; round++) {
    let j: any = null, lastErr = "";
    for (const m of round === 0 ? MODELS : [model, ...MODELS.filter((x) => x !== model)]) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
          method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(45000),
          body: JSON.stringify({ systemInstruction: { parts: [{ text: agentPrompt() }] }, contents, tools: [{ functionDeclarations: decls }], generationConfig: { temperature: 0.2 } }),
        });
        if (!r.ok) { lastErr = `${m} ${r.status}`; console.error("agent", m, r.status, (await r.text()).slice(0, 200)); if (r.status === 429) lastErr = "Gemini hết hạn mức, thử lại sau"; continue; }
        j = await r.json(); model = m; break;
      } catch (e) { lastErr = `${m}: ${(e as Error).message}`; }
    }
    if (!j) throw new Error(lastErr || "AI không trả lời");
    const content = j.candidates?.[0]?.content;
    if (!content?.parts?.length) throw new Error("AI trả về rỗng" + (j.candidates?.[0]?.finishReason ? ` (${j.candidates[0].finishReason})` : ""));
    contents.push(content);
    const calls = content.parts.filter((p: any) => p.functionCall);
    if (!calls.length) {
      const text = content.parts.map((p: any) => (p.thought ? "" : p.text || "")).join("").trim();
      return { text: text.replace(/\*\*/g, "") || "(không có câu trả lời)", used, queued: ctx.queued };
    }
    const resp: any[] = [];
    for (const p of calls) {
      const { name, args } = p.functionCall; used.push(name);
      let out: string;
      try { const f = fns[name]; out = f ? cutJ(await f(args || {})) : JSON.stringify({ loi: "không có công cụ " + name }); }
      catch (e) { out = JSON.stringify({ loi: (e as Error).message }); }
      resp.push({ functionResponse: { name, response: { ket_qua: out } } });
    }
    contents.push({ role: "user", parts: resp });
  }
  return { text: "Câu hỏi cần tra quá nhiều bước — hỏi hẹp hơn giúp mình (vd theo CTV, RN hoặc 1 email).", used, queued: ctx.queued };
}

/* Telegram: hội thoại gần nhất lưu ở desk_docs settings/tf_chat (hết hạn sau 2 tiếng) */
async function tfChatGet() {
  const { data } = await db.from("desk_docs").select("data").eq("user_id", await owner()).eq("kind", "settings").eq("key", "tf_chat").maybeSingle();
  const d = data?.data; return d && Date.now() - (d.at || 0) < 2 * 3600e3 ? d as { at: number; hist: Turn[]; ids: number[] } : null;
}
async function tfChatSave(d: { hist: Turn[]; ids: number[] }) {
  await db.from("desk_docs").upsert({ user_id: await owner(), kind: "settings", key: "tf_chat", data: { at: Date.now(), hist: d.hist.slice(-10), ids: d.ids.slice(-20) }, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind,key" });
}
async function tgAsk(m: any, q: string, cont: boolean) {
  const prev = cont ? await tfChatGet() : null;
  await tg("sendChatAction", { chat_id: CHAT, action: "typing" });
  const wait = await say("🤖 Đang tra Thay Fam…", { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true } });
  let text: string, r: Awaited<ReturnType<typeof askTF>> | null = null;
  try { r = await askTF(q, prev?.hist || []); text = r.text; }
  catch (e) { text = "⚠️ Trợ lý lỗi: " + (e as Error).message; }
  let body = esc(text).slice(0, 3900);
  if (r?.queued.length) body += `\n\n<i>🛠 Đã đưa ${r.queued.length} lệnh vào tab Lệnh — chưa ghi sheet.</i>`;
  const kbd = { inline_keyboard: [[{ text: "Mở Thay Fam", url: "https://godnc.com/thayfam/" + (r?.queued.length ? "#lenh" : "") }]] };
  let id = wait.ok ? wait.result.message_id : 0;
  if (id) { const e2 = await tg("editMessageText", { chat_id: CHAT, message_id: id, text: body, parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: kbd }); if (!e2.ok) id = 0; }
  if (!id) { const s = await say(body, { reply_markup: kbd }); id = s.ok ? s.result.message_id : 0; }
  if (r) await tfChatSave({ hist: [...(prev?.hist || []), { role: "user", text: q }, { role: "model", text: r.text }], ids: [...(prev?.ids || []), id].filter(Boolean) }).catch(() => {});
}

const CORS = { "Access-Control-Allow-Origin": "https://godnc.com", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };

async function handle(u: any) {
  if (u.callback_query) {
    const q = u.callback_query;
    if (String(q.from.id) !== CHAT) return;
    if (q.data === "noop") return tg("answerCallbackQuery", { callback_query_id: q.id });
    if (String(q.data || "").startsWith("cg:")) {
      const ma = String(q.data).slice(3), r = await cusDeliver(ma);
      await tg("answerCallbackQuery", { callback_query_id: q.id, text: r.ok ? "Đã nhắn khách" : r.error });
      if (r.ok) await tg("editMessageReplyMarkup", { chat_id: CHAT, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: "✅ Đã giao — đã nhắn khách", callback_data: "noop" }]] } });
      return;
    }
    if (String(q.data || "").startsWith("g:")) { const [, ga, gid] = String(q.data).split(":"); return renewCallback(q, ga, gid); }
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
    // Nhóm (vd nhóm Tuấn): chỉ xử lý tra mail trong nhóm đã nối; mọi việc Desk khác không chạy ở đây
    if (m.chat.type === "group" || m.chat.type === "supergroup") { if (!edited) await tuanHandle(m); return; }
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
  // Trợ lý Thay Fam: /hoi + câu hỏi, tin bắt đầu bằng "?", hoặc trả lời (reply) tin của trợ lý để hỏi tiếp
  const hm = text.match(/^\/(hoi|hỏi|ask)\b\s*([\s\S]*)$/i);
  if (hm || /^[?？]\s*\S/.test(text)) {
    const q = hm ? hm[2].trim() : text.replace(/^[?？]\s*/, "");
    if (!q) return say("Hỏi gì về Thay Fam cũng được, ví dụ:\n<code>/hoi abc@gmail.com đang ở fam nào?</code>\n<code>? hôm nay cần thay fam nào</code>\n<code>? khách Tuấn hết hạn 3 ngày tới</code>\nTrả lời (reply) tin của trợ lý để hỏi tiếp.");
    return tgAsk(m, q, false);
  }
  if (m.reply_to_message && text && !text.startsWith("/")) {
    const c = await tfChatGet().catch(() => null);
    if (c?.ids?.includes(m.reply_to_message.message_id)) return tgAsk(m, text, true);
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
      // dòng gia hạn → thẻ có nút Duyệt; các dòng khác báo trạng thái như cũ
      const gh = await renewCards(body, fwdOf(m) || "Telegram").catch((e) => { console.error("renew", e); return []; });
      if (gh.length) {
        for (const c of gh) await say(c.text, { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true }, ...(c.kb ? { reply_markup: c.kb } : {}) });
        const rest = body.split(/\r?\n/).filter((l: string) => l.trim() && !lineKind(l.trim())).join("\n");
        const rep2 = rest ? await tfReport(rest).catch(() => "") : "";
        if (rep2) await say(rep2 + "\n\n🛠 Các dòng này đã vào hàng chờ Thay Fam.", { reply_markup: { inline_keyboard: [[{ text: "Mở Thay Fam", url: "https://godnc.com/thayfam/#lenh" }]] } });
        return;
      }
      const rep = await tfReport(body).catch(() => "");
      return say(`${rep ? rep + "\n\n" : ""}🛠 Đã vào hàng chờ Thay Fam (${d.lines} dòng), chưa ghi gì vào sheet.`, {
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
      await tg("setMyCommands", { commands: [{ command: "homnay", description: "Việc shop sáng nay" }, { command: "viec", description: "Việc cần xử lý" }, { command: "xong", description: "Đánh dấu xong: /xong 12" }, { command: "tf", description: "Lệnh Thay Fam: /tf + tin của Tuấn" }, { command: "hoi", description: "Hỏi trợ lý Thay Fam" }, { command: "help", description: "Cách dùng" }] });
      let who = ""; try { who = await owner(); } catch (e) { who = "LỖI: " + (e as Error).message; }
      if (set.ok) await say("✅ Desk Inbox đã bật. Từ giờ nhắn gì cho bot cũng được lưu vào godnc.com/desk. Gõ /help xem cách dùng.");
      return ok({ ok: set.ok, webhook: self, desk_user: who, telegram: set });
    }
    // ---- bot khách lẻ ----
    if (url.searchParams.has("cus_setup")) {
      // mở bằng TG_SECRET hoặc mật khẩu admin Thay Fam (TF_PASS)
      const k = url.searchParams.get("cus_setup") || "", tfp = Deno.env.get("TF_PASS") || "";
      if (!SECRET) return ok({ ok: false, error: "thiếu TG_SECRET" });
      if (k !== SECRET && !(tfp && k === tfp)) return ok({ ok: false, error: "sai mã (dùng mật khẩu admin Thay Fam)" });
      if (!CUS_TOKEN) return ok({ ok: false, error: "thiếu secret CUS_BOT_TOKEN" });
      if (CUS_TOKEN === TOKEN) return ok({ ok: false, error: "CUS_BOT_TOKEN phải là bot khác @goshopassistantbot" });
      const self = `${SB_URL}/functions/v1/desk-bot?cus=1`;
      const r = await cusAdmin({ op: "setup" });
      return ok({ ok: r.ok, bot: (r as any).bot, error: (r as any).error });
    }
    if (url.searchParams.has("cus")) {
      if (req.method !== "POST" || req.headers.get("x-telegram-bot-api-secret-token") !== SECRET || !CUS_TOKEN) return new Response("forbidden", { status: 403 });
      const u = await req.json();
      const job = cusHandle(u).catch((e) => console.error("cus", e));
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(job); else await job;
      return ok();
    }
    if (url.searchParams.has("cus_admin")) {
      if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
      const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
      const b = await req.json().catch(() => ({}));
      const pass = Deno.env.get("TF_PASS") || "";
      if (!pass || b.pass !== pass) return J({ ok: false, error: "Chỉ admin" }, 403);
      try { return J(await cusAdmin(b)); } catch (e) { return J({ ok: false, error: (e as Error).message }); }
    }
    if (url.searchParams.has("cus_notify")) {
      if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
      const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
      const b = await req.json().catch(() => ({}));
      const pass = Deno.env.get("TF_PASS") || "";
      if (!pass || b.pass !== pass) return J({ ok: false, error: "sai mật khẩu" }, 403);
      if (!CUS_TOKEN) return J({ ok: true, sent: 0, note: "chưa cài bot khách" });
      const ems = Array.isArray(b.emails) ? b.emails.filter((x: unknown) => typeof x === "string" && x.includes("@")).slice(0, 50) : [];
      try {
        const sent = await cusNotify(ems, String(b.kind || "fixed"));
        if (sent && b.kind !== "invited") { try { await tuanFixedAdd(ems, "Khách lẻ: đã xử lý"); } catch (_) { /* bỏ qua */ } }
        return J({ ok: true, sent });
      } catch (e) { return J({ ok: false, error: (e as Error).message }); }
    }
    // ---- bot nhóm Tuấn ----
    if (url.searchParams.has("tuan_notify")) {
      // Thay Fam gọi khi DNC bấm Xong / ghi nhận thay fam. Xác thực bằng mật khẩu Thay Fam (TF_PASS).
      if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
      const b = await req.json().catch(() => ({}));
      const pass = Deno.env.get("TF_PASS") || "";
      if (!pass || b.pass !== pass) return new Response(JSON.stringify({ ok: false, error: "sai mật khẩu" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
      const t = String(b.text || "").trim().slice(0, 3500);
      let r: any = { ok: false, error: "trống" };
      if (t) { try { r = await tuanSay(esc(t)); } catch (e) { r = { ok: false, error: (e as Error).message }; } }
      const ems = Array.isArray(b.emails) ? b.emails.filter((x: unknown) => typeof x === "string" && x.includes("@")).slice(0, 50) : [];
      if (ems.length) { try { await tuanFixedAdd(ems, t); } catch (e) { console.error("tuan_fixed", (e as Error).message); } }
      return new Response(JSON.stringify({ ok: !!r.ok, error: r.ok ? undefined : (r.error || r.description) }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }
    // ---- Trợ lý Thay Fam (tab Hỏi trên godnc.com/thayfam) ----
    if (url.searchParams.has("tf_ask")) {
      if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
      const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
      const b = await req.json().catch(() => ({}));
      const pass = Deno.env.get("TF_PASS") || "";
      if (!pass || b.pass !== pass) return J({ ok: false, error: "Chỉ admin dùng được trợ lý" }, 403);
      const q = String(b.q || "").trim().slice(0, 2000); if (!q) return J({ ok: false, error: "trống" });
      const hist: Turn[] = (Array.isArray(b.history) ? b.history : []).filter((h: any) => (h.role === "user" || h.role === "model") && typeof h.text === "string").map((h: any) => ({ role: h.role, text: h.text.slice(0, 4000) }));
      try { const r = await askTF(q, hist); return J({ ok: true, answer: r.text, used: r.used, queued: r.queued }); }
      catch (e) { return J({ ok: false, error: (e as Error).message }); }
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
