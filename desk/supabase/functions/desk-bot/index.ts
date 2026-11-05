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
const KIND: Record<string, string> = { task: "Việc", customer: "Khách", idea: "Ý tưởng", note: "Ghi chú", link: "Link" };

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

/* ---------- chủ Desk: user duy nhất có dữ liệu desk_docs ---------- */
let OWNER = Deno.env.get("DESK_USER_ID") || "";
async function owner() {
  if (OWNER) return OWNER;
  const { data } = await db.from("desk_docs").select("user_id").limit(1000);
  const ids = [...new Set((data || []).map((r: any) => r.user_id))];
  if (ids.length !== 1) throw new Error(ids.length ? "Desk có nhiều tài khoản, cần đặt secret DESK_USER_ID" : "Chưa có tài khoản Desk nào (đăng nhập godnc.com/desk trước)");
  return (OWNER = ids[0] as string);
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

/* ---------- AI: tiêu đề + loại + hạn (+ chép lời voice) ---------- */
async function enrich(raw: string, fwd: string | null, media: { type: string; bytes: Uint8Array }[]) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;
  const t = today();
  const prompt = `Bạn là trợ lý phân loại hộp thư cho DNL — chủ shop bán tài khoản YouTube Premium/Netflix/ChatGPT chia sẻ (có CTV Tuấn, Vương, Lộc), đồng thời trade crypto và chạy trail.
Hôm nay là ${t} (${WD[new Date(t + "T00:00:00Z").getUTCDay()]}), múi giờ GMT+7.
Đọc mục DNL vừa ghi lại (chữ, ảnh chụp màn hình, voice, file) và trả JSON:
{"title": tiêu đề ngắn ≤ 12 từ, nói rõ cần làm gì hoặc là gì, tiếng Việt, giữ tên người/email/số quan trọng,
 "kind": "task" (việc phải làm) | "customer" (liên quan khách hàng, gia hạn, lỗi fam, hoàn tiền) | "idea" (ý tưởng) | "link" (chỉ là link để xem) | "note" (thông tin để lưu),
 "due": "YYYY-MM-DD" nếu nội dung nêu rõ thời hạn (mai, thứ 6, tối nay, 20/11...) còn không thì null,
 "transcript": nếu có voice/audio thì chép nguyên lời tiếng Việt, không thì null,
 "summary": nếu là ảnh chụp/file thì tóm tắt 1-2 câu nội dung chính (tên khách, email, yêu cầu), không thì null}`;
  const parts: any[] = [{ text: prompt }, { text: `Nội dung chữ:\n${raw || "(không có)"}${fwd ? `\n\nChuyển tiếp từ: ${fwd}` : ""}` }];
  for (const m of media) {
    if (m.bytes.length > 7e6) continue;
    if (/^(image\/|audio\/|application\/pdf)/.test(m.type)) parts.push({ inline_data: { mime_type: m.type === "audio/ogg" ? "audio/ogg" : m.type, data: encodeBase64(m.bytes) } });
  }
  const models = [...new Set([Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash", "gemini-flash-latest"])];
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }),
      });
      if (!r.ok) { console.error("gemini", model, r.status, (await r.text()).slice(0, 200)); continue; }
      const j = await r.json();
      const out = JSON.parse(j.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "{}");
      if (!KIND[out.kind]) out.kind = "note";
      if (out.due && !/^\d{4}-\d{2}-\d{2}$/.test(out.due)) out.due = null;
      out.model = model;
      return out;
    } catch (e) { console.error("gemini", model, (e as Error).message); }
  }
  return null;
}

/* ---------- tin trả lời trong Telegram ---------- */
function card(it: any) {
  const head = it.title || (it.raw || "").split("\n")[0].slice(0, 80) || "Tệp đính kèm";
  const st = it.status === "done" ? "✅ Xong · " : it.status === "trash" ? "🗑 Đã bỏ · " : "📥 ";
  const meta = [KIND[it.kind] || "Ghi chú", it.due ? "hạn " + fmtDue(it.due) : "", (it.files || []).length ? `📎${it.files.length}` : ""].filter(Boolean).join(" · ");
  return `${st}<b>${esc(head)}</b>\n<i>#${it.id} · ${meta}</i>`;
}
function kb(it: any) {
  if (it.status === "done" || it.status === "trash") return { inline_keyboard: [[{ text: "↩️ Mở lại", callback_data: `d:open:${it.id}` }, { text: "Mở Desk", url: DESK }]] };
  return { inline_keyboard: [
    [{ text: "✅ Xong", callback_data: `d:done:${it.id}` }, { text: "📅 Mai", callback_data: `d:tmr:${it.id}` }, { text: "📅 T2 tới", callback_data: `d:mon:${it.id}` }, { text: "🗑 Bỏ", callback_data: `d:trash:${it.id}` }],
    [{ text: "Mở Desk", url: DESK }],
  ] };
}

/* ---------- lưu 1 tin ---------- */
async function capture(m: any) {
  const uid = await owner();
  const raw = textOf(m), fwd = fwdOf(m), f = fileOf(m);
  // album ảnh: các ảnh cùng media_group gộp vào 1 mục
  if (m.media_group_id) {
    const { data: g } = await db.from("desk_inbox").select("*").eq("tg_chat", m.chat.id).eq("tg_group", m.media_group_id).maybeSingle();
    if (g) {
      const s = f ? await saveFile(uid, g.id, f) : null;
      const files = [...(g.files || []), ...(s ? [s.meta] : [])];
      const nraw = [g.raw, raw].filter(Boolean).join("\n\n");
      await db.from("desk_inbox").update({ files, raw: nraw, updated_at: new Date().toISOString() }).eq("id", g.id);
      return;
    }
  }
  // 1) ghi ngay bản thô — kể cả AI/tải file lỗi thì mục vẫn còn
  const ins = await db.from("desk_inbox").upsert({
    user_id: uid, src: "telegram", tg_chat: m.chat.id, tg_msg: m.message_id, tg_group: m.media_group_id || null,
    raw, fwd, kind: /^https?:\/\/\S+$/.test(raw) ? "link" : "note", status: "inbox",
    created_at: new Date(m.date * 1000).toISOString(),
  }, { onConflict: "tg_chat,tg_msg", ignoreDuplicates: true }).select().maybeSingle();
  if (ins.error) throw ins.error;
  if (!ins.data) return; // Telegram gửi lại tin đã lưu
  let it = ins.data;
  const ack = await say(`📥 Đã lưu #${it.id}…`, { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true } });
  // 2) file + AI
  const media: { type: string; bytes: Uint8Array }[] = [];
  const patch: any = {};
  if (f) { const s = await saveFile(uid, it.id, f); patch.files = [s.meta]; if (s.bytes) media.push({ type: f.type, bytes: s.bytes }); }
  const ai = await enrich(raw, fwd, media);
  if (ai) {
    patch.ai = ai; patch.title = ai.title || null; patch.kind = ai.kind; patch.due = ai.due || null;
    if (ai.due) patch.status = "todo";
    const extra = [ai.transcript && `🎙 ${ai.transcript}`, ai.summary && `🖼 ${ai.summary}`].filter(Boolean).join("\n\n");
    if (extra) patch.raw = [raw, extra].filter(Boolean).join("\n\n");
  }
  if (Object.keys(patch).length) {
    patch.updated_at = new Date().toISOString();
    const u = await db.from("desk_inbox").update(patch).eq("id", it.id).select().single();
    if (!u.error) it = u.data;
  }
  if (ack.ok) {
    await tg("editMessageText", { chat_id: CHAT, message_id: ack.result.message_id, text: card(it), parse_mode: "HTML", reply_markup: kb(it) });
    await db.from("desk_inbox").update({ ai: { ...(it.ai || {}), ack: ack.result.message_id } }).eq("id", it.id);
  }
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
  return say(`<b>Desk Inbox</b>\nNhắn bất cứ thứ gì cho bot — chữ, ảnh chụp, file, voice, tin chuyển tiếp — nó lưu vào <a href="${DESK}">godnc.com/desk</a> và tự đặt tiêu đề, loại, hạn.\n\n/viec — xem việc cần xử lý\n/xong 12 — đánh dấu mục #12 xong\nHoặc bấm nút ngay dưới mỗi tin xác nhận.`);
}
async function setStatus(id: number, patch: any) {
  if (patch.status) patch.done_at = patch.status === "done" ? new Date().toISOString() : null;
  patch.updated_at = new Date().toISOString();
  const { data, error } = await db.from("desk_inbox").update(patch).eq("id", id).select().maybeSingle();
  if (error) throw error;
  return data;
}

/* ---------- nhắc buổi sáng (pg_cron gọi ?digest=1, mỗi ngày tối đa 1 lần) ---------- */
async function digest() {
  const uid = await owner();
  const { data: s } = await db.from("desk_docs").select("data").eq("user_id", uid).eq("kind", "settings").eq("key", "inbox_digest").maybeSingle();
  if (s?.data?.last === today()) return { skipped: "đã gửi hôm nay" };
  const L = await listOpen();
  await db.from("desk_docs").upsert({ user_id: uid, kind: "settings", key: "inbox_digest", data: { last: today() }, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind,key" });
  if (!L.late.length && !L.dueToday.length && !L.fresh.length) return { skipped: "không có gì" };
  await say(`☀️ <b>Desk sáng nay</b>${L.later ? ` · ${L.later} mục hẹn sau/đang chờ` : ""}\n${L.text}`, { reply_markup: { inline_keyboard: [[{ text: "Mở Desk", url: DESK }]] } });
  return { sent: true };
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
    if (it) {
      const extra = [it.ai?.transcript && `🎙 ${it.ai.transcript}`, it.ai?.summary && `🖼 ${it.ai.summary}`].filter(Boolean).join("\n\n");
      await db.from("desk_inbox").update({ raw: [raw, extra].filter(Boolean).join("\n\n"), updated_at: new Date().toISOString() }).eq("id", it.id);
    } else await capture(edited);
    return;
  }
  const text = (m.text || "").trim();
  if (/^\/(start|help)\b/i.test(text)) return help();
  if (/^\/(viec|việc|list)\b/i.test(text)) {
    const L = await listOpen();
    return say(L.text || "Inbox trống. Không có gì cần xử lý 👌", { reply_markup: { inline_keyboard: [[{ text: "Mở Desk", url: DESK }]] } });
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
      await tg("setMyCommands", { commands: [{ command: "viec", description: "Việc cần xử lý" }, { command: "xong", description: "Đánh dấu xong: /xong 12" }, { command: "help", description: "Cách dùng" }] });
      let who = ""; try { who = await owner(); } catch (e) { who = "LỖI: " + (e as Error).message; }
      if (set.ok) await say("✅ Desk Inbox đã bật. Từ giờ nhắn gì cho bot cũng được lưu vào godnc.com/desk. Gõ /help xem cách dùng.");
      return ok({ ok: set.ok, webhook: self, desk_user: who, telegram: set });
    }
    if (url.searchParams.has("digest")) return ok(await digest());
    // webhook Telegram
    if (req.method !== "POST" || req.headers.get("x-telegram-bot-api-secret-token") !== SECRET) return new Response("forbidden", { status: 403 });
    const u = await req.json();
    try { await handle(u); }
    catch (e) {
      console.error(e);
      const m = u.message || u.edited_message;
      if (m && String(m.chat.id) === CHAT) await say(`⚠️ Chưa lưu được tin này: ${esc((e as Error).message)}\nNhắn lại giúp mình, hoặc ghi tay trên Desk.`, { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true } }).catch(() => {});
    }
    return ok(); // luôn 200 để Telegram không gửi lại mãi
  } catch (e) {
    console.error(e);
    return ok({ ok: false, error: (e as Error).message });
  }
});
