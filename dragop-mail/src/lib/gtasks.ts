/**
 * Google Tasks API utility
 * Requires scope: https://www.googleapis.com/auth/tasks
 */

const TASKS_API = "https://tasks.googleapis.com/tasks/v1";

export interface GTaskItem {
  id: string;
  title: string;
  status: "needsAction" | "completed";
  due?: string;      // RFC 3339 date
  notes?: string;
  updated?: string;
}

interface GTaskListResponse {
  items?: GTaskItem[];
  nextPageToken?: string;
}

export interface GTaskList {
  id: string;
  title: string;
}

interface GTaskListsResponse {
  items?: GTaskList[];
}

/**
 * Get all task lists.
 */
export async function fetchTaskLists(accessToken: string): Promise<GTaskList[]> {
  const res = await fetch(`${TASKS_API}/users/@me/lists?maxResults=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[Dragop] Tasks API lists error:", res.status, text);
    throw new Error(`Tasks API lists error: ${res.status} - ${text}`);
  }
  const data: GTaskListsResponse = await res.json();
  return data.items ?? [];
}

/**
 * Get the default task list ID (first one, usually "@default").
 */
export async function getDefaultTaskListId(accessToken: string): Promise<string> {
  try {
    const lists = await fetchTaskLists(accessToken);
    if (lists.length === 0) {
      console.warn("[Dragop] No task lists found, using @default");
      return "@default";
    }
    return lists[0]?.id ?? "@default";
  } catch (err) {
    console.error("[Dragop] Failed to get default task list ID:", err);
    throw err;
  }
}

/**
 * Fetch tasks from the default list.
 * Returns incomplete tasks first, then recently completed.
 */
export async function fetchTasks(
  accessToken: string,
  maxResults = 30,
  listId?: string,
): Promise<GTaskItem[]> {
  let resolvedListId: string;
  try {
    resolvedListId = listId ?? await getDefaultTaskListId(accessToken);
  } catch (err) {
    console.error("[Dragop] Failed to resolve task list ID:", err);
    throw new Error(`Failed to get task list: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Fetch incomplete tasks
  const incompleteParams = new URLSearchParams({
    maxResults: String(maxResults),
    showCompleted: "true",
    showHidden: "false",
  });

  const res = await fetch(`${TASKS_API}/lists/${encodeURIComponent(resolvedListId)}/tasks?${incompleteParams}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Dragop] Tasks API error:", res.status, text);
    throw new Error(`Tasks API error: ${res.status} - ${text}`);
  }

  const data: GTaskListResponse = await res.json();
  const tasks = (data.items ?? []).filter((t) => t.title?.trim());

  // Sort: incomplete first (by due date), then completed
  return tasks.sort((a, b) => {
    if (a.status !== b.status) return a.status === "needsAction" ? -1 : 1;
    // Within same status, sort by due date (if available)
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return 0;
  });
}

/**
 * Add a new task to the default list.
 */
export async function addTask(
  accessToken: string,
  title: string,
  listId?: string,
): Promise<GTaskItem> {
  let resolvedListId: string;
  try {
    resolvedListId = listId ?? await getDefaultTaskListId(accessToken);
  } catch (err) {
    console.error("[Dragop] Failed to resolve task list ID for add:", err);
    throw new Error(`Failed to get task list: ${err instanceof Error ? err.message : String(err)}`);
  }

  const res = await fetch(`${TASKS_API}/lists/${encodeURIComponent(resolvedListId)}/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, status: "needsAction" }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Dragop] Tasks API add error:", res.status, text);
    throw new Error(`Tasks API add error: ${res.status} - ${text}`);
  }

  return res.json();
}

/**
 * Toggle task completion status.
 */
export async function toggleTask(
  accessToken: string,
  taskId: string,
  currentlyCompleted: boolean,
  listId?: string,
): Promise<GTaskItem> {
  let resolvedListId: string;
  try {
    resolvedListId = listId ?? await getDefaultTaskListId(accessToken);
  } catch (err) {
    console.error("[Dragop] Failed to resolve task list ID for toggle:", err);
    throw new Error(`Failed to get task list: ${err instanceof Error ? err.message : String(err)}`);
  }
  const newStatus = currentlyCompleted ? "needsAction" : "completed";

  const res = await fetch(`${TASKS_API}/lists/${encodeURIComponent(resolvedListId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: newStatus,
      ...(newStatus === "needsAction" ? { completed: null } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Dragop] Tasks API toggle error:", res.status, text);
    throw new Error(`Tasks API toggle error: ${res.status} - ${text}`);
  }

  return res.json();
}

/**
 * Update a task's title and/or notes.
 */
export async function updateTask(
  accessToken: string,
  taskId: string,
  updates: { title?: string; notes?: string },
  listId?: string,
): Promise<GTaskItem> {
  let resolvedListId: string;
  try {
    resolvedListId = listId ?? await getDefaultTaskListId(accessToken);
  } catch (err) {
    console.error("[Dragop] Failed to resolve task list ID for update:", err);
    throw new Error(`Failed to get task list: ${err instanceof Error ? err.message : String(err)}`);
  }

  const res = await fetch(`${TASKS_API}/lists/${encodeURIComponent(resolvedListId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Dragop] Tasks API update error:", res.status, text);
    throw new Error(`Tasks API update error: ${res.status} - ${text}`);
  }

  return res.json();
}
