/**
 * Outlook Mail API via Microsoft Graph v1.0
 * Follows the same pattern as gmail.ts — returns EmailItem[].
 */
import { EmailItem } from "./mockEmails";

const GRAPH_API = "https://graph.microsoft.com/v1.0/me";

/* ---------- Types ---------- */

interface MsGraphMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body?: { contentType: string; content: string };
  from?: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  isRead: boolean;
}

interface MsGraphFolder {
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
}

export interface OutlookFolder {
  id: string;
  name: string;
  type: "system" | "user";
  messagesTotal?: number;
  messagesUnread?: number;
}

export interface FetchOutlookResult {
  emails: EmailItem[];
  hasMore: boolean;
  nextSkip: number;
}

/* ---------- Helpers ---------- */

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
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

function stripHtml(html: string): string {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  }
  return html.replace(/<[^>]*>/g, "");
}

function msgToEmailItem(msg: MsGraphMessage): EmailItem {
  const sender = msg.from?.emailAddress;
  const bodyText = msg.body?.contentType === "html"
    ? stripHtml(msg.body.content)
    : (msg.body?.content || msg.bodyPreview || "");

  const date = new Date(msg.receivedDateTime);

  return {
    id: msg.id,
    sender: sender?.name || sender?.address || "(不明)",
    senderEmail: sender?.address || "",
    subject: msg.subject || "(件名なし)",
    preview: msg.bodyPreview || bodyText.substring(0, 80),
    body: bodyText,
    receivedAt: formatDate(msg.receivedDateTime),
    receivedDate: date.toISOString().split("T")[0],
    unread: !msg.isRead,
  };
}

// Well-known folder mapping
const SYSTEM_FOLDER_NAMES: Record<string, string> = {
  inbox: "受信トレイ",
  sentitems: "送信済み",
  drafts: "下書き",
  deleteditems: "ゴミ箱",
  junkemail: "迷惑メール",
  archive: "アーカイブ",
};

const VISIBLE_FOLDERS = ["inbox", "sentitems", "drafts", "archive", "deleteditems"];

/* ---------- API Functions ---------- */

/**
 * Fetch Outlook messages with pagination.
 */
export async function fetchOutlookMessages(
  accessToken: string,
  top = 20,
  folderId = "inbox",
  skip = 0,
): Promise<FetchOutlookResult> {
  const params = new URLSearchParams({
    $top: String(top),
    $skip: String(skip),
    $orderby: "receivedDateTime desc",
    $select: "id,subject,bodyPreview,body,from,receivedDateTime,isRead",
  });

  const url = `${GRAPH_API}/mailFolders/${encodeURIComponent(folderId)}/messages?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Dragop] Outlook API error:", res.status, text);
    throw new Error(`Outlook API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const messages: MsGraphMessage[] = data.value || [];

  return {
    emails: messages.map(msgToEmailItem),
    hasMore: !!data["@odata.nextLink"],
    nextSkip: skip + messages.length,
  };
}

/**
 * Fetch Outlook mail folders.
 */
export async function fetchOutlookFolders(accessToken: string): Promise<OutlookFolder[]> {
  const res = await fetch(`${GRAPH_API}/mailFolders?$top=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const folders: MsGraphFolder[] = data.value || [];

  const result: OutlookFolder[] = [];

  // System folders first (in order)
  for (const wellKnown of VISIBLE_FOLDERS) {
    const folder = folders.find(
      (f) => f.displayName.toLowerCase() === wellKnown ||
             f.id.toLowerCase().includes(wellKnown)
    );
    if (folder) {
      result.push({
        id: folder.id,
        name: SYSTEM_FOLDER_NAMES[wellKnown] || folder.displayName,
        type: "system",
        messagesTotal: folder.totalItemCount,
        messagesUnread: folder.unreadItemCount,
      });
    }
  }

  // Other folders
  const systemIds = new Set(result.map((r) => r.id));
  for (const f of folders) {
    if (!systemIds.has(f.id)) {
      result.push({
        id: f.id,
        name: f.displayName,
        type: "user",
        messagesTotal: f.totalItemCount,
        messagesUnread: f.unreadItemCount,
      });
    }
  }

  return result;
}

/**
 * Mark message as read.
 */
export async function markOutlookAsRead(accessToken: string, messageId: string): Promise<void> {
  await fetch(`${GRAPH_API}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ isRead: true }),
  });
}

/**
 * Archive a message (move to archive folder).
 */
export async function archiveOutlookMessage(accessToken: string, messageId: string): Promise<void> {
  await fetch(`${GRAPH_API}/messages/${messageId}/move`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ destinationId: "archive" }),
  });
}
