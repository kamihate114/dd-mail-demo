import { EmailItem } from "./mockEmails";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessageMeta {
  id: string;
  threadId: string;
}

interface GmailMessageFull {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  labelIds: string[];
  payload: {
    headers: GmailHeader[];
    mimeType: string;
    body?: { data?: string; size: number };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string; size: number };
      parts?: Array<{ mimeType: string; body?: { data?: string; size: number } }>;
    }>;
  };
}

function getHeader(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function extractSender(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].replace(/"/g, "").trim(), email: match[2] };
  return { name: from, email: from };
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return atob(base64);
  }
}

function extractBody(payload: GmailMessageFull["payload"]): string {
  // Try plain text first
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Try multipart
  if (payload.parts) {
    // Prefer text/plain
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      // Nested multipart
      if (part.parts) {
        for (const sub of part.parts) {
          if (sub.mimeType === "text/plain" && sub.body?.data) {
            return decodeBase64Url(sub.body.data);
          }
        }
      }
    }
    // Fallback to text/html → strip tags
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        const doc = new DOMParser().parseFromString(html, "text/html");
        return doc.body.textContent || "";
      }
    }
  }

  // Fallback: body directly is HTML
  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = decodeBase64Url(payload.body.data);
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  }

  return "";
}

function formatDate(internalDate: string): string {
  const date = new Date(Number(internalDate));
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * Mark a message as read (remove UNREAD label)
 */
export async function markGmailAsRead(accessToken: string, messageId: string): Promise<void> {
  await fetch(`${GMAIL_API}/messages/${messageId}/modify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
}

/**
 * Archive a message (remove INBOX label)
 */
export async function archiveGmailMessage(accessToken: string, messageId: string): Promise<void> {
  await fetch(`${GMAIL_API}/messages/${messageId}/modify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
  });
}

/**
 * Gmail label info
 */
export interface GmailLabel {
  id: string;
  name: string;
  type: "system" | "user";
  messagesTotal?: number;
  messagesUnread?: number;
}

// Map system label IDs to Japanese display names
const SYSTEM_LABEL_NAMES: Record<string, string> = {
  INBOX: "受信トレイ",
  SENT: "送信済み",
  DRAFT: "下書き",
  TRASH: "ゴミ箱",
  SPAM: "迷惑メール",
  STARRED: "スター付き",
  IMPORTANT: "重要",
};

// Labels to show in sidebar (in order)
const VISIBLE_SYSTEM_LABELS = ["INBOX", "SENT", "DRAFT", "STARRED", "IMPORTANT", "SPAM", "TRASH"];

/**
 * Fetch Gmail labels
 */
export async function fetchGmailLabels(accessToken: string): Promise<GmailLabel[]> {
  const res = await fetch(`${GMAIL_API}/labels`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const rawLabels: Array<{ id: string; name: string; type: string; messagesTotal?: number; messagesUnread?: number }> = data.labels || [];

  // Fetch details for system labels to get counts
  const systemIds = rawLabels
    .filter((l) => VISIBLE_SYSTEM_LABELS.includes(l.id))
    .map((l) => l.id);

  const detailed = await Promise.all(
    systemIds.map(async (id) => {
      const r = await fetch(`${GMAIL_API}/labels/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) return null;
      return (await r.json()) as { id: string; name: string; type: string; messagesTotal: number; messagesUnread: number };
    })
  );

  const detailMap = new Map(detailed.filter(Boolean).map((d) => [d!.id, d!]));

  // Build ordered list: system labels first, then user labels
  const result: GmailLabel[] = [];

  for (const sysId of VISIBLE_SYSTEM_LABELS) {
    const detail = detailMap.get(sysId);
    if (detail) {
      result.push({
        id: detail.id,
        name: SYSTEM_LABEL_NAMES[detail.id] || detail.name,
        type: "system",
        messagesTotal: detail.messagesTotal,
        messagesUnread: detail.messagesUnread,
      });
    }
  }

  // Add user labels
  for (const l of rawLabels) {
    if (l.type === "user") {
      result.push({ id: l.id, name: l.name, type: "user" });
    }
  }

  return result;
}

/**
 * Result of fetching emails — includes nextPageToken for pagination
 */
export interface FetchEmailsResult {
  emails: EmailItem[];
  nextPageToken: string | null;
}

/**
 * Fetch the latest emails from Gmail API (with pagination support)
 */
export async function fetchGmailMessages(
  accessToken: string,
  maxResults: number = 20,
  labelId: string = "INBOX",
  pageToken?: string
): Promise<FetchEmailsResult> {
  // Step 1: Get message IDs
  let url = `${GMAIL_API}/messages?maxResults=${maxResults}&labelIds=${labelId}`;
  if (pageToken) url += `&pageToken=${pageToken}`;

  const listRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const errorBody = await listRes.text().catch(() => "");
    console.error("[Dragop] Gmail API list error:", listRes.status, errorBody);
    throw new Error(`Gmail API error: ${listRes.status} ${listRes.statusText}\n${errorBody}`);
  }

  const listData = await listRes.json();
  const messageIds: GmailMessageMeta[] = listData.messages || [];
  const nextPageToken: string | null = listData.nextPageToken || null;

  if (messageIds.length === 0) return { emails: [], nextPageToken: null };

  // Step 2: Fetch each message in parallel
  const messages = await Promise.all(
    messageIds.map(async (meta) => {
      const res = await fetch(
        `${GMAIL_API}/messages/${meta.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return null;
      return (await res.json()) as GmailMessageFull;
    })
  );

  // Step 3: Transform to EmailItem
  const emails = messages
    .filter((m): m is GmailMessageFull => m !== null)
    .map((msg) => {
      const headers = msg.payload.headers;
      const from = getHeader(headers, "From");
      const sender = extractSender(from);
      const subject = getHeader(headers, "Subject") || "(件名なし)";
      const body = extractBody(msg.payload);

      const date = new Date(Number(msg.internalDate));
      return {
        id: msg.id,
        sender: sender.name,
        senderEmail: sender.email,
        subject,
        preview: msg.snippet || body.substring(0, 80),
        body: body || msg.snippet || "",
        receivedAt: formatDate(msg.internalDate),
        receivedDate: date.toISOString().split("T")[0],
        unread: msg.labelIds.includes("UNREAD"),
        threadId: msg.threadId,
      };
    });

  return { emails, nextPageToken };
}

/**
 * Fetch the last 3 messages from a Gmail thread (most recent first).
 * Returns formatted text for display in the editor.
 */
export async function fetchGmailThreadLast3(accessToken: string, threadId: string): Promise<string> {
  const res = await fetch(`${GMAIL_API}/threads/${encodeURIComponent(threadId)}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gmail thread error: ${res.status} ${body}`);
  }
  const thread = (await res.json()) as { messages?: GmailMessageFull[] };
  const messages = thread.messages || [];
  // Sort by internalDate ascending (oldest first), then take last 3
  const sorted = [...messages].sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
  const last3 = sorted.slice(-3);

  const parts: string[] = [];
  for (const msg of last3) {
    const headers = msg.payload.headers;
    const from = getHeader(headers, "From");
    const sender = extractSender(from);
    const subject = getHeader(headers, "Subject") || "(件名なし)";
    const body = extractBody(msg.payload);
    const date = new Date(Number(msg.internalDate)).toLocaleString("ja-JP");
    parts.push(`--- ${date} ---\n差出人: ${sender.name} <${sender.email}>\n件名: ${subject}\n\n${body}`);
  }
  return parts.join("\n\n");
}

/* ---------- Compose helpers ---------- */

/**
 * Encode a string to Base64URL (RFC 4648 §5) for Gmail API
 */
function encodeBase64Url(str: string): string {
  const utf8 = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of utf8) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Build an RFC 2822 formatted email message
 */
function buildRawEmail(to: string, subject: string, body: string, inReplyTo?: string, references?: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `Content-Type: text/plain; charset=UTF-8`,
    `MIME-Version: 1.0`,
  ];
  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`);
    lines.push(`References: ${references || inReplyTo}`);
  }
  lines.push("", body);
  return lines.join("\r\n");
}

/**
 * Send an email via Gmail API
 */
export async function sendGmailMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
): Promise<{ id: string; threadId: string }> {
  const raw = encodeBase64Url(buildRawEmail(to, subject, body));

  const payload: Record<string, string> = { raw };
  if (threadId) payload.threadId = threadId;

  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail send error: ${res.status} ${res.statusText}\n${text}`);
  }

  return res.json();
}

/**
 * Create a draft via Gmail API
 */
export async function createGmailDraft(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
): Promise<{ id: string }> {
  const raw = encodeBase64Url(buildRawEmail(to, subject, body));

  const message: Record<string, string> = { raw };
  if (threadId) message.threadId = threadId;

  const res = await fetch(`${GMAIL_API}/drafts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail draft error: ${res.status} ${res.statusText}\n${text}`);
  }

  return res.json();
}
