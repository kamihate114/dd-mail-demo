"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MainEditor } from "@/components/MainEditor";
import { RightSidebar, TodoItem } from "@/components/RightSidebar";
import { MailPreview } from "@/components/MailPreview";
import { ScheduleItem } from "@/components/DaySchedule";
import { MOCK_EMAILS, EmailItem } from "@/lib/mockEmails";
import { fetchGmailMessages, markGmailAsRead, archiveGmailMessage, fetchGmailLabels, GmailLabel, sendGmailMessage, createGmailDraft } from "@/lib/gmail";
import { fetchCalendarEvents, updateCalendarEvent, createCalendarEvent, deleteCalendarEvent } from "@/lib/gcalendar";
import { fetchTasks, addTask, toggleTask, updateTask, fetchTaskLists } from "@/lib/gtasks";
import { fetchOutlookMessages, fetchOutlookFolders, markOutlookAsRead, archiveOutlookMessage, OutlookFolder, sendOutlookMessage, createOutlookDraft } from "@/lib/outlook";
import { fetchMsCalendarEvents, createMsCalendarEvent, updateMsCalendarEvent, deleteMsCalendarEvent } from "@/lib/ms-calendar";
import { fetchMsTasks, addMsTask, toggleMsTask, updateMsTask, fetchMsTaskLists } from "@/lib/ms-tasks";
import { msalClearCache } from "@/lib/msal";
import { TaskList } from "@/components/RightSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChevronRight } from "lucide-react";
import { Calendar } from "@/components/Calendar";
import {
  AiWorkflowState,
  AiEmailContext,
  AiApiRequest,
  AiApiResponse,
  AI_INITIAL_STATE,
} from "@/lib/ai-types";
import { Step3Sidebar } from "@/components/AiPanel";
import { Mail as MailIcon, Loader2, Sparkles as SparklesIcon } from "lucide-react";

function generateId(): string {
  return crypto.randomUUID();
}

// Per-provider localStorage keys
function lsToken(p: "outlook" | "gmail") { return `dragop-mail-${p}-token`; }
function lsEmails(p: "outlook" | "gmail") { return `dragop-mail-${p}-emails-v2`; }

// Active provider key (which provider is currently displayed)
const LS_ACTIVE = "dragop-mail-active-provider";

function getSavedProviders(): ("outlook" | "gmail")[] {
  if (typeof window === "undefined") return [];
  const result: ("outlook" | "gmail")[] = [];
  for (const p of ["gmail", "outlook"] as const) {
    const token = localStorage.getItem(lsToken(p));
    const emails = localStorage.getItem(lsEmails(p));
    if (token || emails) result.push(p);
  }
  return result;
}

function getActiveProvider(): "outlook" | "gmail" | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(LS_ACTIVE);
  return v === "outlook" || v === "gmail" ? v : null;
}

function getSavedEmailsFor(provider: "outlook" | "gmail"): EmailItem[] {
  if (typeof window === "undefined") return [];
  try {
    const v = localStorage.getItem(lsEmails(provider));
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}

function getSavedTokenFor(provider: "outlook" | "gmail"): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(lsToken(provider));
}

function saveSession(provider: "outlook" | "gmail", token: string | null, emails: EmailItem[]) {
  localStorage.setItem(LS_ACTIVE, provider);
  if (token) localStorage.setItem(lsToken(provider), token);
  localStorage.setItem(lsEmails(provider), JSON.stringify(emails));
}

function clearProviderSession(provider: "outlook" | "gmail") {
  localStorage.removeItem(lsToken(provider));
  localStorage.removeItem(lsEmails(provider));
  // If this was the active provider, clear active
  if (getActiveProvider() === provider) {
    localStorage.removeItem(LS_ACTIVE);
  }
}

function migrateOldSession() {
  // Migrate from old single-provider keys to per-provider keys
  const oldProvider = localStorage.getItem("dragop-mail-provider");
  const oldToken = localStorage.getItem("dragop-mail-token");
  const oldEmails = localStorage.getItem("dragop-mail-emails-v2");
  if (oldProvider === "gmail" || oldProvider === "outlook") {
    if (oldToken) localStorage.setItem(lsToken(oldProvider), oldToken);
    if (oldEmails) localStorage.setItem(lsEmails(oldProvider), oldEmails);
    localStorage.setItem(LS_ACTIVE, oldProvider);
  }
  // Clean up old keys
  localStorage.removeItem("dragop-mail-provider");
  localStorage.removeItem("dragop-mail-token");
  localStorage.removeItem("dragop-mail-emails-v2");
  localStorage.removeItem("dragop-mail-emails");
}

// No more demo events — real Google Calendar events fetched via API

export default function Home() {
  const ORIGINAL_MAIL_PANEL_WIDTH = 320;
  const FINAL_CHECK_PANEL_WIDTH = 240;
  const CENTER_EDITOR_WIDTH = 768;
  const CENTER_CONTENT_TOP_OFFSET = 52;

  // Layout state
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);

  // Mail login state — start empty to avoid hydration mismatch, restore on mount
  const [mailLoggedIn, setMailLoggedIn] = useState(false);
  const [mailLoading, setMailLoading] = useState(false);
  const [mailProvider, setMailProvider] = useState<"outlook" | "gmail" | null>(null);
  const [emails, setEmails] = useState<EmailItem[]>([]);

  // Gmail labels & active label (also used for Outlook folders)
  const [gmailLabels, setGmailLabels] = useState<GmailLabel[]>([]);
  const [activeLabelId, setActiveLabelId] = useState("INBOX");

  // Pagination — Gmail uses nextPageToken, Outlook uses skip offset
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [outlookSkip, setOutlookSkip] = useState(0);
  const [outlookHasMore, setOutlookHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Re-run savedProviders after full logout; show brief logout feedback
  const [savedProvidersVersion, setSavedProvidersVersion] = useState(0);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  // Reference to handleOutlookAuth for use in mount effect (defined later, assigned via ref)
  const outlookAuthRef = useRef<((token: string) => Promise<void>) | null>(null);
  // Track provider for task list/tasks so we reset when switching Google ↔ Outlook
  const taskProviderRef = useRef<"outlook" | "gmail" | null>(null);

  // On mount: リダイレクト戻りを処理してからキャッシュ復元
  const didRestore = useRef(false);
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;
    migrateOldSession();
    const hadRedirectPending =
      typeof sessionStorage !== "undefined" && sessionStorage.getItem("dragop-msal-redirect-pending") === "1";
    sessionStorage.removeItem("dragop-msal-redirect-pending");

    const provider = getActiveProvider();
    const token = provider ? getSavedTokenFor(provider) : null;
    const cachedEmails = provider ? getSavedEmailsFor(provider) : [];

    (async () => {
      // 1) OAuth リダイレクトから戻ったときだけ MSAL で自動ログイン（アカウント選択に戻ったあとのリロードでは自動復帰しない）
      try {
        const { msalTryGetToken } = await import("@/lib/msal");
        const msToken = await msalTryGetToken();
        if (msToken && outlookAuthRef.current && hadRedirectPending) {
          console.log("[Dragop] MSAL redirect flow completed, got token");
          outlookAuthRef.current(msToken);
          return;
        }
      } catch (err) {
        console.warn("[Dragop] MSAL redirect check failed:", err);
      }

      // 2) MSAL トークンがなければキャッシュから復元して API で更新
      if (provider && (cachedEmails.length > 0 || token)) {
        setMailProvider(provider);
        setEmails(cachedEmails);
        setMailLoggedIn(true);
      }
      if (provider === "gmail" && token) {
        fetchGmailMessages(token, 20)
          .then((result) => {
            setEmails(result.emails);
            setNextPageToken(result.nextPageToken);
            saveSession("gmail", token, result.emails);
            console.log("[Dragop] Refresh: loaded", result.emails.length, "emails");
          })
          .catch((err) => {
            console.warn("[Dragop] Refresh failed (using cached):", err);
          });
        fetchGmailLabels(token)
          .then((labels) => { if (labels.length > 0) setGmailLabels(labels); })
          .catch(() => {});
      } else if (provider === "outlook" && token) {
        fetchOutlookMessages(token, 20)
          .then((result) => {
            setEmails(result.emails);
            setOutlookSkip(result.nextSkip);
            setOutlookHasMore(result.hasMore);
            saveSession("outlook", token, result.emails);
            console.log("[Dragop] Refresh: loaded", result.emails.length, "Outlook emails");
          })
          .catch((err) => {
            console.warn("[Dragop] Outlook refresh failed (using cached):", err);
          });
        fetchOutlookFolders(token)
          .then((folders) => {
            if (folders.length > 0) {
              setGmailLabels(folders.map((f) => ({
                id: f.id, name: f.name, type: f.type,
                messagesTotal: f.messagesTotal, messagesUnread: f.messagesUnread,
              })));
            }
          })
          .catch(() => {});
      }
    })();
  }, []);

  // Mail preview state
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const selectedEmail = emails.find((e) => e.id === selectedEmailId) || null;

  // Calendar
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Schedule events — fetched from Google Calendar API
  const [events, setEvents] = useState<ScheduleItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Fetch calendar events when selectedDate or login changes — provider-aware
  const fetchEvents = useCallback(async (date: Date, provider?: "gmail" | "outlook" | null) => {
    const p = provider ?? getActiveProvider();
    const token = p ? getSavedTokenFor(p) : null;
    if (!token || !p) return;
    setIsLoadingEvents(true);
    try {
      const items = p === "gmail"
        ? await fetchCalendarEvents(token, date)
        : await fetchMsCalendarEvents(token, date);
      setEvents(items);
    } catch (err) {
      console.warn("[Dragop] Calendar fetch failed:", err);
      setEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  // Fetch events on mount if logged in
  useEffect(() => {
    if (mailLoggedIn && mailProvider) {
      fetchEvents(selectedDate, mailProvider);
    }
  }, [mailLoggedIn, mailProvider, selectedDate, fetchEvents]);

  // Wrap setSelectedDate to also fetch events
  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleUpdateEvent = useCallback(
    async (eventId: string, updates: Partial<Pick<ScheduleItem, "title" | "startTime" | "endTime">>) => {
      const p = getActiveProvider();
      const token = p ? getSavedTokenFor(p) : null;
      if (!token || !p) {
        alert("予定の更新にはログインが必要です。");
        return;
      }
      try {
        if (p === "gmail") {
          await updateCalendarEvent(token, eventId, selectedDate, updates);
        } else {
          await updateMsCalendarEvent(token, eventId, selectedDate, updates);
        }
        await fetchEvents(selectedDate, p);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[Dragop] Calendar update failed:", err);
        alert(`予定の更新に失敗しました。\n\n${msg}`);
      }
    },
    [selectedDate, fetchEvents],
  );

  const handleAddEvent = useCallback(
    async (date: Date, event: { title: string; startTime: string; endTime?: string }) => {
      const p = getActiveProvider();
      const token = p ? getSavedTokenFor(p) : null;
      if (!token || !p) {
        alert("予定の追加にはログインが必要です。");
        return;
      }
      try {
        if (p === "gmail") {
          await createCalendarEvent(token, date, event);
        } else {
          await createMsCalendarEvent(token, date, event);
        }
        await fetchEvents(selectedDate, p);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[Dragop] Calendar create failed:", err);
        alert(`予定の追加に失敗しました。\n\n${msg}`);
      }
    },
    [selectedDate, fetchEvents],
  );

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      const p = getActiveProvider();
      const token = p ? getSavedTokenFor(p) : null;
      if (!token || !p) {
        alert("予定の削除にはログインが必要です。");
        return;
      }
      try {
        if (p === "gmail") {
          await deleteCalendarEvent(token, eventId);
        } else {
          await deleteMsCalendarEvent(token, eventId);
        }
        await fetchEvents(selectedDate, p);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[Dragop] Calendar delete failed:", err);
        alert(`予定の削除に失敗しました。\n\n${msg}`);
      }
    },
    [selectedDate, fetchEvents],
  );

  // Todos — synced with Google Tasks API
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoadingTodos, setIsLoadingTodos] = useState(false);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [activeTaskListId, setActiveTaskListId] = useState<string | undefined>(undefined);

  // Fetch task lists — provider-aware. forceFirstList: プロバイダー切り替え時に先頭リストを選択する
  const loadTaskLists = useCallback(async (provider?: "gmail" | "outlook" | null, forceFirstList?: boolean) => {
    const p = provider ?? getActiveProvider();
    const token = p ? getSavedTokenFor(p) : null;
    if (!token || !p) return;
    try {
      let mapped: TaskList[];
      if (p === "gmail") {
        const lists = await fetchTaskLists(token);
        mapped = lists.map((l) => ({ id: l.id, title: l.title }));
      } else {
        const lists = await fetchMsTaskLists(token);
        mapped = lists.map((l) => ({ id: l.id, title: l.displayName }));
      }
      setTaskLists(mapped);
      if ((forceFirstList || !activeTaskListId) && mapped.length > 0) {
        setActiveTaskListId(mapped[0].id);
      }
    } catch (err) {
      console.warn("[Dragop] Task lists fetch failed:", err);
    }
  }, [activeTaskListId]);

  // Fetch tasks — provider-aware
  const loadTasks = useCallback(async (listId?: string, provider?: "gmail" | "outlook" | null) => {
    const p = provider ?? getActiveProvider();
    const token = p ? getSavedTokenFor(p) : null;
    if (!token || !p) return;
    setIsLoadingTodos(true);
    try {
      if (p === "gmail") {
        const tasks = await fetchTasks(token, 30, listId);
        setTodos(tasks.map((t) => ({ id: t.id, text: t.title, notes: t.notes, done: t.status === "completed" })));
      } else {
        const tasks = await fetchMsTasks(token, 30, listId);
        setTodos(tasks.map((t) => ({
          id: t.id,
          text: t.title,
          notes: t.body?.content || undefined,
          done: t.status === "completed",
        })));
      }
    } catch (err) {
      console.warn("[Dragop] Tasks fetch failed:", err);
    } finally {
      setIsLoadingTodos(false);
    }
  }, []);

  // Load task lists and tasks when logged in; reset and reload when provider changes (Google ↔ Outlook)
  useEffect(() => {
    if (!mailLoggedIn || !mailProvider) return;
    const providerChanged = taskProviderRef.current !== mailProvider;
    if (providerChanged) {
      taskProviderRef.current = mailProvider;
      setTodos([]);
      setTaskLists([]);
      setActiveTaskListId(undefined);
    }
    loadTaskLists(mailProvider, providerChanged);
    // プロバイダー切り替え直後は activeTaskListId が前のアカウントのIDのままなので、listId は渡さずデフォルトリストを取得
    const listIdForLoad = providerChanged ? undefined : activeTaskListId;
    loadTasks(listIdForLoad, mailProvider);
  }, [mailLoggedIn, mailProvider, loadTaskLists, loadTasks, activeTaskListId]);

  // Mock login (Outlook or Gmail without CLIENT_ID)
  const handleMailLogin = useCallback((provider: "outlook" | "gmail") => {
    setMailProvider(provider);
    setEmails(MOCK_EMAILS);
    setMailLoggedIn(true);
    saveSession(provider, null, MOCK_EMAILS);
  }, []);

  // Real Gmail OAuth login
  const handleGmailAuth = useCallback(async (accessToken: string) => {
    console.log("[Dragop] Gmail OAuth token received, length:", accessToken.length);
    setMailLoading(true);
    setMailProvider("gmail");
    try {
      const result = await fetchGmailMessages(accessToken, 20);
      console.log("[Dragop] Fetched", result.emails.length, "emails from Gmail");
      setEmails(result.emails);
      setNextPageToken(result.nextPageToken);
      setMailLoggedIn(true);
      saveSession("gmail", accessToken, result.emails);
      // Fetch labels in background
      fetchGmailLabels(accessToken)
        .then((labels) => { if (labels.length > 0) setGmailLabels(labels); })
        .catch(() => {});
    } catch (err: unknown) {
      console.error("[Dragop] Gmail fetch error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`メールの取得に失敗しました。\n\n${msg}`);
      setMailProvider(null);
    } finally {
      setMailLoading(false);
    }
  }, []);

  // Real Outlook OAuth login
  const handleOutlookAuth = useCallback(async (accessToken: string) => {
    console.log("[Dragop] Outlook OAuth token received, length:", accessToken.length);
    setMailLoading(true);
    setMailProvider("outlook");
    try {
      const result = await fetchOutlookMessages(accessToken, 20);
      console.log("[Dragop] Fetched", result.emails.length, "emails from Outlook");
      setEmails(result.emails);
      setOutlookSkip(result.nextSkip);
      setOutlookHasMore(result.hasMore);
      setNextPageToken(null);
      setMailLoggedIn(true);
      saveSession("outlook", accessToken, result.emails);
      // Fetch folders in background
      fetchOutlookFolders(accessToken)
        .then((folders) => {
          if (folders.length > 0) {
            setGmailLabels(folders.map((f) => ({
              id: f.id, name: f.name, type: f.type,
              messagesTotal: f.messagesTotal, messagesUnread: f.messagesUnread,
            })));
          }
        })
        .catch(() => {});
    } catch (err: unknown) {
      console.error("[Dragop] Outlook fetch error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`メールの取得に失敗しました。\n\n${msg}`);
      setMailProvider(null);
    } finally {
      setMailLoading(false);
    }
  }, []);

  // Keep ref in sync so mount effect can call handleOutlookAuth
  outlookAuthRef.current = handleOutlookAuth;

  // "アカウントを選択" — go back to login screen (keep saved sessions so user can restore without re-auth)
  const handleMailLogout = useCallback(() => {
    setMailLoggedIn(false);
    setMailProvider(null);
    setEmails([]);
    setSelectedEmailId(null);
    setGmailLabels([]);
    setActiveLabelId("INBOX");
    localStorage.removeItem(LS_ACTIVE);
    setLogoutMessage("アカウント選択に戻りました");
    setTimeout(() => setLogoutMessage(null), 3000);
  }, []);

  // Full logout — clears saved session for a specific provider
  const handleFullLogout = useCallback((provider: "outlook" | "gmail") => {
    clearProviderSession(provider);
    if (provider === "outlook") msalClearCache();
    setSavedProvidersVersion((v) => v + 1);
    const label = provider === "gmail" ? "Gmail" : "Outlook";
    setLogoutMessage(`${label}からログアウトしました`);
    setTimeout(() => setLogoutMessage(null), 3000);
    // If the current active session is this provider, also clear UI
    if (mailProvider === provider) {
      setMailLoggedIn(false);
      setMailProvider(null);
      setEmails([]);
      setSelectedEmailId(null);
      setGmailLabels([]);
      setActiveLabelId("INBOX");
    }
  }, [mailProvider]);

  // Quick restore from saved session (no re-auth) — provider-specific
  const handleRestoreSession = useCallback((provider: "outlook" | "gmail") => {
    const token = getSavedTokenFor(provider);
    const cached = getSavedEmailsFor(provider);
    if (cached.length > 0 || token) {
      setMailProvider(provider);
      setEmails(cached);
      setMailLoggedIn(true);
      localStorage.setItem(LS_ACTIVE, provider);
      // Background refresh
      if (provider === "gmail" && token) {
        fetchGmailMessages(token, 20)
          .then((result) => {
            setEmails(result.emails);
            setNextPageToken(result.nextPageToken);
            saveSession("gmail", token, result.emails);
          })
          .catch(() => {});
        fetchGmailLabels(token)
          .then((labels) => { if (labels.length > 0) setGmailLabels(labels); })
          .catch(() => {});
      } else if (provider === "outlook" && token) {
        fetchOutlookMessages(token, 20)
          .then((result) => {
            setEmails(result.emails);
            setOutlookSkip(result.nextSkip);
            setOutlookHasMore(result.hasMore);
            saveSession("outlook", token, result.emails);
          })
          .catch(() => {});
        fetchOutlookFolders(token)
          .then((folders) => {
            if (folders.length > 0) {
              setGmailLabels(folders.map((f) => ({
                id: f.id, name: f.name, type: f.type,
                messagesTotal: f.messagesTotal, messagesUnread: f.messagesUnread,
              })));
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  // Refresh emails
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    const provider = getActiveProvider();
    const token = provider ? getSavedTokenFor(provider) : null;
    if (!token || !provider) return;
    setIsRefreshing(true);
    try {
      if (provider === "gmail") {
        const result = await fetchGmailMessages(token, 20, activeLabelId);
        setEmails(result.emails);
        setNextPageToken(result.nextPageToken);
        if (activeLabelId === "INBOX") saveSession("gmail", token, result.emails);
        fetchGmailLabels(token)
          .then((lbls) => { if (lbls.length > 0) setGmailLabels(lbls); })
          .catch(() => {});
      } else {
        const result = await fetchOutlookMessages(token, 20, activeLabelId);
        setEmails(result.emails);
        setOutlookSkip(result.nextSkip);
        setOutlookHasMore(result.hasMore);
        saveSession("outlook", token, result.emails);
        fetchOutlookFolders(token)
          .then((folders) => {
            if (folders.length > 0) {
              setGmailLabels(folders.map((f) => ({
                id: f.id, name: f.name, type: f.type,
                messagesTotal: f.messagesTotal, messagesUnread: f.messagesUnread,
              })));
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      console.warn("[Dragop] Refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeLabelId]);

  // Mark email as read — provider-aware
  const handleMarkAsRead = useCallback((emailId: string) => {
    setEmails((prev) => prev.map((e) => e.id === emailId ? { ...e, unread: false } : e));
    const p = getActiveProvider();
    const token = p ? getSavedTokenFor(p) : null;
    if (token && p) {
      const fn = p === "gmail" ? markGmailAsRead : markOutlookAsRead;
      fn(token, emailId).catch((err) =>
        console.warn("[Dragop] markAsRead failed:", err)
      );
    }
  }, []);

  // Archive email (remove from list) — provider-aware
  const handleArchive = useCallback((emailId: string) => {
    setEmails((prev) => {
      const updated = prev.filter((e) => e.id !== emailId);
      const p = getActiveProvider();
      const t = p ? getSavedTokenFor(p) : null;
      if (p) saveSession(p, t, updated);
      return updated;
    });
    if (selectedEmailId === emailId) setSelectedEmailId(null);
    const p = getActiveProvider();
    const token = p ? getSavedTokenFor(p) : null;
    if (token && p) {
      const fn = p === "gmail" ? archiveGmailMessage : archiveOutlookMessage;
      fn(token, emailId).catch((err) =>
        console.warn("[Dragop] archive failed:", err)
      );
    }
  }, [selectedEmailId]);

  // Select label/folder — fetch emails for that label — provider-aware
  const handleSelectLabel = useCallback(async (labelId: string) => {
    setActiveLabelId(labelId);
    const p = getActiveProvider();
    const token = p ? getSavedTokenFor(p) : null;
    if (!token || !p) return;
    setIsRefreshing(true);
    try {
      if (p === "gmail") {
        const result = await fetchGmailMessages(token, 20, labelId);
        setEmails(result.emails);
        setNextPageToken(result.nextPageToken);
      } else {
        const result = await fetchOutlookMessages(token, 20, labelId, 0);
        setEmails(result.emails);
        setOutlookSkip(result.nextSkip);
        setOutlookHasMore(result.hasMore);
      }
    } catch (err) {
      console.warn("[Dragop] Label/folder fetch failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Load more emails (infinite scroll) — provider-aware
  const handleLoadMore = useCallback(async () => {
    const p = getActiveProvider();
    const token = p ? getSavedTokenFor(p) : null;
    if (!token || !p || isLoadingMore) return;

    if (p === "gmail") {
      if (!nextPageToken) return;
      setIsLoadingMore(true);
      try {
        const result = await fetchGmailMessages(token, 20, activeLabelId, nextPageToken);
        setEmails((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newEmails = result.emails.filter((e) => !existingIds.has(e.id));
          return [...prev, ...newEmails];
        });
        setNextPageToken(result.nextPageToken);
      } catch (err) {
        console.warn("[Dragop] Load more failed:", err);
      } finally {
        setIsLoadingMore(false);
      }
    } else {
      if (!outlookHasMore) return;
      setIsLoadingMore(true);
      try {
        const result = await fetchOutlookMessages(token, 20, activeLabelId, outlookSkip);
        setEmails((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newEmails = result.emails.filter((e) => !existingIds.has(e.id));
          return [...prev, ...newEmails];
        });
        setOutlookSkip(result.nextSkip);
        setOutlookHasMore(result.hasMore);
      } catch (err) {
        console.warn("[Dragop] Load more failed:", err);
      } finally {
        setIsLoadingMore(false);
      }
    }
  }, [nextPageToken, isLoadingMore, activeLabelId, outlookSkip, outlookHasMore]);

  // Search emails (client-side for now — onSearch callback for future Gmail API search)
  const [isSearching, setIsSearching] = useState(false);
  const handleSearch = useCallback((_query: string) => {
    // Currently client-side only — MailInbox handles filtering locally
    // Could be extended to use Gmail API q= parameter for server-side search
    setIsSearching(false);
  }, []);

  // Get total count for the active label from gmailLabels
  const activeLabelTotal = useMemo(() => {
    const label = gmailLabels.find((l) => l.id === activeLabelId);
    return label?.messagesTotal ?? null;
  }, [gmailLabels, activeLabelId]);

  // Left sidebar resize
  const [leftWidth, setLeftWidth] = useState(240);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = leftWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(180, Math.min(400, startWidth + (ev.clientX - startX)));
      setLeftWidth(newWidth);
    };
    const onUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [leftWidth]);

  // Mail loaded callback
  const handleMailLoaded = useCallback((_text: string, _source: string) => {
    // Could be extended for AI analysis
  }, []);

  const handleAppleMailDrop = useCallback((_subject: string) => {
    // Apple Mail drop — body not available, subject only
  }, []);

  const handleAddTodo = useCallback(async (text: string, notes?: string) => {
    const tempId = generateId();
    setTodos((prev) => [{ id: tempId, text, notes, done: false }, ...prev]);
    const p = getActiveProvider();
    const token = p ? getSavedTokenFor(p) : null;
    if (token && p) {
      try {
        const task = p === "gmail"
          ? await addTask(token, text, activeTaskListId, notes)
          : await addMsTask(token, text, activeTaskListId, notes);
        setTodos((prev) => prev.map((t) => t.id === tempId ? { ...t, id: task.id } : t));
      } catch (err) {
        console.warn("[Dragop] Add task failed:", err);
      }
    }
  }, [activeTaskListId]);

  const handleToggleTodo = useCallback(async (id: string) => {
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
    const p = getActiveProvider();
    const token = p ? getSavedTokenFor(p) : null;
    if (token && p) {
      const todo = todos.find((t) => t.id === id);
      if (todo) {
        try {
          if (p === "gmail") {
            await toggleTask(token, id, todo.done, activeTaskListId);
          } else {
            await toggleMsTask(token, id, todo.done, activeTaskListId);
          }
        } catch (err) {
          console.warn("[Dragop] Toggle task failed:", err);
          setTodos((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
        }
      }
    }
  }, [todos, activeTaskListId]);

  const handleSelectTaskList = useCallback((listId: string) => {
    setActiveTaskListId(listId);
  }, []);

  const handleUpdateTodo = useCallback(async (id: string, updates: { title?: string; notes?: string }) => {
    setTodos((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      return { ...t, text: updates.title ?? t.text, notes: updates.notes ?? t.notes };
    }));
    const p = getActiveProvider();
    const token = p ? getSavedTokenFor(p) : null;
    if (token && p) {
      try {
        if (p === "gmail") {
          await updateTask(token, id, updates, activeTaskListId);
        } else {
          await updateMsTask(token, id, updates, activeTaskListId);
        }
      } catch (err) {
        console.warn("[Dragop] Update task failed:", err);
      }
    }
  }, [activeTaskListId]);

  // AI Assistant state
  const [isSendingMail, setIsSendingMail] = useState(false);
  const [aiState, setAiState] = useState<AiWorkflowState>(AI_INITIAL_STATE);
  const [aiMailContent, setAiMailContent] = useState("");

  const callAiApi = useCallback(async (body: AiApiRequest): Promise<AiApiResponse> => {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: AiApiResponse = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || `API error: ${res.status}`);
    }
    return data;
  }, []);

  const handleAiAnalyze = useCallback(async (emailContext: AiEmailContext) => {
    setAiState({ ...AI_INITIAL_STATE, step: "step1-loading", emailContext });
    try {
      const data = await callAiApi({ step: 1, emailContext });
      if (data.step1) {
        setAiState((prev) => ({ ...prev, step: "step1", step1Result: data.step1! }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiState((prev) => ({ ...prev, step: "idle", error: msg }));
    }
  }, [callAiApi]);

  const handleAiSelectAction = useCallback(async (actionPrompt: string) => {
    setAiState((prev) => ({ ...prev, step: "step2-loading", selectedAction: actionPrompt }));
    try {
      const data = await callAiApi({
        step: 2,
        emailContext: aiState.emailContext!,
        selectedAction: actionPrompt,
        step1Result: aiState.step1Result!,
      });
      if (data.step2) {
        // Auto-append saved signature if available
        const savedSig = localStorage.getItem("dragop-mail-signature") || "";
        const draftWithSig = savedSig.trim()
          ? `${data.step2!.draftReply}\n\n${savedSig.trim()}`
          : data.step2!.draftReply;
        setAiState((prev) => ({
          ...prev,
          step: "step2",
          step2Result: data.step2!,
          editedDraft: draftWithSig,
          editedSubject: data.step2!.replySubject,
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiState((prev) => ({ ...prev, step: "step1", error: msg }));
    }
  }, [callAiApi, aiState.emailContext, aiState.step1Result]);

  const handleAiEditDraft = useCallback((draft: string) => {
    setAiState((prev) => ({ ...prev, editedDraft: draft }));
  }, []);

  const handleAiEditSubject = useCallback((subject: string) => {
    setAiState((prev) => ({ ...prev, editedSubject: subject }));
  }, []);

  const handleAiConfirm = useCallback(async (editedDraft: string) => {
    console.log("[Dragop] handleAiConfirm called with draft length:", editedDraft.length);
    setAiState((prev) => ({ ...prev, step: "step3-loading" }));
    try {
      console.log("[Dragop] Calling AI API for step 3...");
      const data = await callAiApi({
        step: 3,
        emailContext: aiState.emailContext!,
        step1Result: aiState.step1Result!,
        selectedAction: aiState.selectedAction!,
        step2Result: aiState.step2Result!,
        editedDraft,
      });
      console.log("[Dragop] AI API response:", data);
      if (data.step3) {
        console.log("[Dragop] Step 3 result received:", data.step3);
        setAiState((prev) => ({ ...prev, step: "step3", step3Result: data.step3! }));
      } else {
        console.warn("[Dragop] Step 3 result missing in response");
        throw new Error("最終確認の結果が取得できませんでした。時間をおいて再試行してください。");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Dragop] Step 3 error:", err);
      setAiState((prev) => ({ ...prev, step: "step2", error: msg }));
    }
  }, [callAiApi, aiState.emailContext, aiState.step1Result, aiState.selectedAction, aiState.step2Result]);

  const handleAiAddTodo = useCallback((candidate: { text: string; notes?: string }) => {
    handleAddTodo(candidate.text, candidate.notes);
  }, [handleAddTodo]);

  const handleAiAddEvent = useCallback((candidate: { title: string; date: string; startTime: string; endTime?: string }) => {
    const date = new Date(candidate.date);
    handleAddEvent(date, {
      title: candidate.title,
      startTime: candidate.startTime,
      endTime: candidate.endTime,
    });
  }, [handleAddEvent]);

  const handleAiSend = useCallback(async () => {
    const p = getActiveProvider();
    const token = p ? getSavedTokenFor(p) : null;
    if (!token || !p) {
      alert("メールを送信するにはログインが必要です。");
      return;
    }
    const to = aiState.emailContext?.senderEmail;
    const subject = aiState.editedSubject || aiState.step2Result?.replySubject || "";
    const body = aiState.editedDraft || aiState.step2Result?.draftReply || "";
    if (!to) {
      alert("宛先が見つかりません。");
      return;
    }
    setIsSendingMail(true);
    try {
      if (p === "gmail") {
        await sendGmailMessage(token, to, subject, body, aiState.emailContext?.threadId);
      } else {
        await sendOutlookMessage(token, to, subject, body, aiState.emailContext?.emailId);
      }
      setAiState(AI_INITIAL_STATE);
      alert("メールを送信しました。");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Dragop] Send failed:", err);
      alert(`メールの送信に失敗しました。\n\n${msg}`);
    } finally {
      setIsSendingMail(false);
    }
  }, [aiState.emailContext, aiState.editedSubject, aiState.editedDraft, aiState.step2Result]);

  const handleAiSaveDraft = useCallback(async () => {
    const p = getActiveProvider();
    const token = p ? getSavedTokenFor(p) : null;
    if (!token || !p) {
      alert("下書きを保存するにはログインが必要です。");
      return;
    }
    const to = aiState.emailContext?.senderEmail;
    const subject = aiState.editedSubject || aiState.step2Result?.replySubject || "";
    const body = aiState.editedDraft || aiState.step2Result?.draftReply || "";
    if (!to) {
      alert("宛先が見つかりません。");
      return;
    }
    setIsSendingMail(true);
    try {
      if (p === "gmail") {
        await createGmailDraft(token, to, subject, body, aiState.emailContext?.threadId);
      } else {
        await createOutlookDraft(token, to, subject, body, aiState.emailContext?.emailId);
      }
      setAiState(AI_INITIAL_STATE);
      alert("下書きとして保存しました。");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Dragop] Draft save failed:", err);
      alert(`下書きの保存に失敗しました。\n\n${msg}`);
    } finally {
      setIsSendingMail(false);
    }
  }, [aiState.emailContext, aiState.editedSubject, aiState.editedDraft, aiState.step2Result]);

  const handleAiReset = useCallback(() => {
    setAiState(AI_INITIAL_STATE);
  }, []);

  const handleAiBack = useCallback(() => {
    setAiState((prev) => {
      if (prev.step === "step3" || prev.step === "step3-loading") {
        return { ...prev, step: "step2", step3Result: null, error: null };
      }
      if (prev.step === "step2" || prev.step === "step2-loading") {
        return { ...prev, step: "step1", step2Result: null, editedDraft: null, selectedAction: null, error: null };
      }
      return AI_INITIAL_STATE;
    });
  }, []);

  // Compute saved providers for login screen (show restore options); re-run after full logout via savedProvidersVersion
  const [savedProviders, setSavedProviders] = useState<("outlook" | "gmail")[]>([]);

  useEffect(() => {
    setSavedProviders(getSavedProviders());
  }, [mailLoggedIn, savedProvidersVersion]);

  // Shared left sidebar props
  const leftSidebarProps = {
    isLoggedIn: mailLoggedIn,
    isLoading: mailLoading,
    mailProvider,
    emails,
    selectedEmailId,
    onSelectEmail: setSelectedEmailId,
    onLogin: handleMailLogin,
    onGmailAuth: handleGmailAuth,
    onOutlookAuth: handleOutlookAuth,
    onLogout: handleMailLogout,
    onFullLogout: handleFullLogout,
    onRestoreSession: handleRestoreSession,
    savedProviders,
    logoutMessage,
    onRefresh: handleRefresh,
    onMarkAsRead: handleMarkAsRead,
    onArchive: handleArchive,
    onLoadMore: handleLoadMore,
    isLoadingMore,
    hasMore: mailProvider === "outlook" ? outlookHasMore : !!nextPageToken,
    onSelectLabel: handleSelectLabel,
    onSearch: handleSearch,
    isSearching,
    isRefreshing,
    labels: gmailLabels,
    activeLabelId,
    activeLabelTotal,
  };

  const showOriginalMailPanel = aiState.step !== "idle" && aiMailContent.trim().length > 0;
  const showFinalCheckPanel = aiState.step === "step3-loading" || aiState.step === "step3";

  // Toggle state for unified side panel (元メール / 最終チェック)
  const [sideCardView, setSideCardView] = useState<"original" | "finalCheck">("original");

  // Auto-switch side card view based on step
  useEffect(() => {
    if (aiState.step === "step3" || aiState.step === "step3-loading") {
      setSideCardView("finalCheck");
    } else if (aiState.step === "step1" || aiState.step === "step2" || aiState.step === "step2-loading") {
      setSideCardView("original");
    }
  }, [aiState.step]);

  return (
    <div className="flex h-screen flex-col bg-surface transition-colors duration-300">
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left sidebar — mobile overlay */}
        <AnimatePresence>
          {leftOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setLeftOpen(false)}
                className="fixed inset-0 z-30 bg-black/40 lg:hidden"
              />
              <motion.div
                initial={{ x: -240 }}
                animate={{ x: 0 }}
                exit={{ x: -240 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-border-default bg-surface lg:hidden"
              >
                <LeftSidebar {...leftSidebarProps} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Left sidebar — desktop */}
        <div
          className="relative z-30 hidden shrink-0 border-r border-border-default bg-surface lg:block"
          style={{ width: leftWidth }}
        >
          <LeftSidebar {...leftSidebarProps} />

          {/* Mail preview — floating panel */}
          <AnimatePresence>
            {selectedEmail && (
              <MailPreview
                email={selectedEmail}
                onClose={() => setSelectedEmailId(null)}
              />
            )}
          </AnimatePresence>

          {/* Resize handle */}
          <div
            onMouseDown={handleResizeStart}
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-brand-blue/30 active:bg-brand-blue/50 transition-colors z-20"
          />
        </div>

        {/* Center workspace (expands with side cards) */}
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pt-14 pb-14 lg:px-6">
          <div className="mx-auto flex h-full w-full max-w-[1800px] justify-center gap-3 xl:gap-4">
            <AnimatePresence>
              {showOriginalMailPanel && (
                <motion.div
                  initial={{ width: 0, opacity: 0, x: -12 }}
                  animate={{ width: ORIGINAL_MAIL_PANEL_WIDTH, opacity: 1, x: 0 }}
                  exit={{ width: 0, opacity: 0, x: -12 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="hidden shrink-0 overflow-hidden rounded-2xl border border-border-default bg-white shadow-lg shadow-black/10 dark:bg-slate-950/70 dark:shadow-black/20 xl:flex flex-col"
                  style={{
                    marginTop: CENTER_CONTENT_TOP_OFFSET,
                    height: `calc(100% - ${CENTER_CONTENT_TOP_OFFSET}px)`,
                    minWidth: `${ORIGINAL_MAIL_PANEL_WIDTH}px`,
                    maxWidth: `${ORIGINAL_MAIL_PANEL_WIDTH}px`,
                  }}
                >
                  <div className="flex h-full min-h-0 w-full flex-col">
                    {/* Toggle header */}
                    <div className="flex items-center border-b border-border-default">
                      <button
                        onClick={() => setSideCardView("original")}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-colors ${
                          sideCardView === "original"
                            ? "bg-border-default/50 text-text-primary"
                            : "text-text-muted hover:bg-border-default/30"
                        }`}
                      >
                        <MailIcon className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium uppercase tracking-wider">元メール</span>
                      </button>
                      {showFinalCheckPanel && (
                        <button
                          onClick={() => setSideCardView("finalCheck")}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-colors ${
                            sideCardView === "finalCheck"
                              ? "bg-border-default/50 text-text-primary"
                              : "text-text-muted hover:bg-border-default/30"
                          }`}
                        >
                          <SparklesIcon className="h-3.5 w-3.5 text-brand-blue" />
                          <span className="text-xs font-medium uppercase tracking-wider">最終チェック</span>
                        </button>
                      )}
                    </div>

                    {/* Content area */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                      {sideCardView === "original" ? (
                        <div className="h-full overflow-y-auto p-3">
                          <div className="whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
                            {aiMailContent}
                          </div>
                        </div>
                      ) : (
                        <Step3Sidebar
                          result={aiState.step3Result}
                          isLoading={aiState.step === "step3-loading"}
                          onAddTodo={handleAiAddTodo}
                          onAddEvent={handleAiAddEvent}
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div
              className="min-w-0 flex-1 max-w-3xl shrink xl:max-w-none"
              style={{
                width: `min(100%, ${CENTER_EDITOR_WIDTH}px)`,
                maxWidth: `${CENTER_EDITOR_WIDTH}px`
              }}
            >
              <MainEditor
                onMailLoaded={handleMailLoaded}
                onAppleMailDrop={handleAppleMailDrop}
                aiState={aiState}
                onAiAnalyze={handleAiAnalyze}
                onAiSelectAction={handleAiSelectAction}
                onAiConfirm={handleAiConfirm}
                onAiEditDraft={handleAiEditDraft}
                onAiEditSubject={handleAiEditSubject}
                onAiAddTodo={handleAiAddTodo}
                onAiAddEvent={handleAiAddEvent}
                onAiSend={handleAiSend}
                onAiSaveDraft={handleAiSaveDraft}
                isSendingMail={isSendingMail}
                onAiReset={handleAiReset}
                onAiBack={handleAiBack}
                onMailContentChange={setAiMailContent}
              />
            </div>

          </div>
        </main>

        {/* Buttons to the left of calendar (always visible, outside sidebar) */}
        <div className="relative z-20 hidden shrink-0 flex-col items-center gap-2 px-2 pt-4 lg:flex">
          <ThemeToggle />
          <button
            onClick={() => setRightOpen(!rightOpen)}
            className="rounded-lg p-1.5 text-text-muted hover:bg-border-default hover:text-text-primary transition-colors"
            aria-label={rightOpen ? "右パネルを閉じる" : "右パネルを開く"}
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${rightOpen ? "rotate-0" : "rotate-180"}`} />
          </button>
        </div>

        {/* Right sidebar */}
        <AnimatePresence>
          {rightOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative z-20 hidden shrink-0 overflow-hidden border-l border-border-default bg-surface lg:block"
            >
              <div className="flex h-full flex-col">
                {/* Calendar */}
                <div className="px-4 pt-4">
                  <Calendar selectedDate={selectedDate} onSelectDate={handleSelectDate} />
                </div>
                <div className="flex-1 overflow-y-auto">
                  <RightSidebar
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectDate}
                    events={events}
                    isLoadingEvents={isLoadingEvents}
                    onUpdateEvent={handleUpdateEvent}
                    onDeleteEvent={handleDeleteEvent}
                    onAddEvent={handleAddEvent}
                    todos={todos}
                    isLoadingTodos={isLoadingTodos}
                    onAddTodo={handleAddTodo}
                    onToggleTodo={handleToggleTodo}
                    onUpdateTodo={handleUpdateTodo}
                    taskLists={taskLists}
                    activeTaskListId={activeTaskListId}
                    onSelectTaskList={handleSelectTaskList}
                    hideCalendar={true}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
