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
  conversationId?: string;
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
    conversationId: msg.conversationId,
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
    $select: "id,subject,bodyPreview,body,from,receivedDateTime,isRead,conversationId",
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
 * Fetch the last 3 messages from an Outlook conversation (most recent first).
 * Returns formatted text for display in the editor.
 */
export async function fetchOutlookConversationLast3(
  accessToken: string,
  conversationId: string,
): Promise<string> {
  const params = new URLSearchParams({
    $filter: `conversationId eq '${conversationId.replace(/'/g, "''")}'`,
    $orderby: "receivedDateTime asc",
    $top: "100",
    $select: "id,subject,bodyPreview,body,from,receivedDateTime",
  });
  const res = await fetch(`${GRAPH_API}/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Outlook conversation error: ${res.status} ${text}`);
  }
  const data = await res.json();
  const messages: MsGraphMessage[] = data.value || [];
  // Take last 3 (most recent)
  const last3 = messages.slice(-3);

  const parts: string[] = [];
  for (const msg of last3) {
    const sender = msg.from?.emailAddress;
    const senderName = sender?.name || sender?.address || "(不明)";
    const senderAddr = sender?.address || "";
    const bodyText = msg.body?.contentType === "html"
      ? stripHtml(msg.body.content)
      : (msg.body?.content || msg.bodyPreview || "");
    const date = new Date(msg.receivedDateTime).toLocaleString("ja-JP");
    const subject = msg.subject || "(件名なし)";
    parts.push(`--- ${date} ---\n差出人: ${senderName} <${senderAddr}>\n件名: ${subject}\n\n${bodyText}`);
  }
  return parts.join("\n\n");
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

/* ---------- Compose ---------- */

/**
 * Send an email via Microsoft Graph API.
 * If originalMessageId is provided, sends as a reply to that message (threaded).
 * Otherwise sends as a new message via sendMail.
 */
export async function sendOutlookMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  originalMessageId?: string,
): Promise<void> {
  if (originalMessageId) {
    // Create a reply draft from the original message
    const replyRes = await fetch(`${GRAPH_API}/messages/${originalMessageId}/createReply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    if (!replyRes.ok) {
      const text = await replyRes.text().catch(() => "");
      throw new Error(`Outlook createReply error: ${replyRes.status} ${replyRes.statusText}\n${text}`);
    }
    const replyDraft = await replyRes.json();
    const draftId = replyDraft.id;

    // Update the reply draft with our subject and body
    const updateRes = await fetch(`${GRAPH_API}/messages/${draftId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject,
        body: { contentType: "Text", content: body },
      }),
    });
    if (!updateRes.ok) {
      const text = await updateRes.text().catch(() => "");
      throw new Error(`Outlook update reply error: ${updateRes.status} ${updateRes.statusText}\n${text}`);
    }

    // Send the reply
    const sendRes = await fetch(`${GRAPH_API}/messages/${draftId}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!sendRes.ok) {
      const text = await sendRes.text().catch(() => "");
      throw new Error(`Outlook send reply error: ${sendRes.status} ${sendRes.statusText}\n${text}`);
    }
  } else {
    // New message (no thread)
    const res = await fetch(`${GRAPH_API}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "Text", content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Outlook send error: ${res.status} ${res.statusText}\n${text}`);
    }
  }
}

/**
 * Create a draft email via Microsoft Graph API.
 * If originalMessageId is provided, creates a reply draft (threaded).
 */
export async function createOutlookDraft(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  originalMessageId?: string,
): Promise<{ id: string }> {
  if (originalMessageId) {
    // Create reply draft from original message
    const replyRes = await fetch(`${GRAPH_API}/messages/${originalMessageId}/createReply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    if (!replyRes.ok) {
      const text = await replyRes.text().catch(() => "");
      throw new Error(`Outlook createReply draft error: ${replyRes.status} ${replyRes.statusText}\n${text}`);
    }
    const replyDraft = await replyRes.json();

    // Update with our content
    const updateRes = await fetch(`${GRAPH_API}/messages/${replyDraft.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject,
        body: { contentType: "Text", content: body },
      }),
    });
    if (!updateRes.ok) {
      const text = await updateRes.text().catch(() => "");
      throw new Error(`Outlook update reply draft error: ${updateRes.status} ${updateRes.statusText}\n${text}`);
    }

    return { id: replyDraft.id };
  }

  // New message draft (no thread)
  const res = await fetch(`${GRAPH_API}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject,
      body: { contentType: "Text", content: body },
      toRecipients: [{ emailAddress: { address: to } }],
      isDraft: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Outlook draft error: ${res.status} ${res.statusText}\n${text}`);
  }

  return res.json();
}
