/**
 * Microsoft To Do API via Microsoft Graph v1.0
 * Follows the same pattern as gtasks.ts.
 */

const GRAPH_API = "https://graph.microsoft.com/v1.0/me/todo";

/* ---------- Types ---------- */

export interface MsTaskList {
  id: string;
  displayName: string;
}

export interface MsTaskItem {
  id: string;
  title: string;
  status: "notStarted" | "inProgress" | "completed" | "waitingOnOthers" | "deferred";
  body?: { content: string; contentType: string };
  dueDateTime?: { dateTime: string; timeZone: string };
  completedDateTime?: { dateTime: string; timeZone: string };
}

/* ---------- Task Lists ---------- */

/**
 * Get all task lists.
 */
export async function fetchMsTaskLists(accessToken: string): Promise<MsTaskList[]> {
  const res = await fetch(`${GRAPH_API}/lists`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`MS Tasks API lists error: ${res.status}`);
  const data = await res.json();
  return (data.value || []) as MsTaskList[];
}

/**
 * Get the default task list ID (first one).
 */
export async function getDefaultMsTaskListId(accessToken: string): Promise<string> {
  const lists = await fetchMsTaskLists(accessToken);
  return lists[0]?.id ?? "";
}

/* ---------- Tasks ---------- */

/**
 * Fetch tasks from a list.
 * Returns incomplete tasks first, then recently completed.
 */
export async function fetchMsTasks(
  accessToken: string,
  maxResults = 30,
  listId?: string,
): Promise<MsTaskItem[]> {
  const resolvedListId = listId ?? await getDefaultMsTaskListId(accessToken);
  if (!resolvedListId) return [];

  const params = new URLSearchParams({
    $top: String(maxResults),
    $orderby: "status,createdDateTime desc",
  });

  const res = await fetch(`${GRAPH_API}/lists/${encodeURIComponent(resolvedListId)}/tasks?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn("[Dragop] MS Tasks API error:", res.status, text);
    throw new Error(`MS Tasks API error: ${res.status}`);
  }

  const data = await res.json();
  const tasks = ((data.value || []) as MsTaskItem[]).filter((t) => t.title?.trim());

  // Sort: incomplete first, then completed
  return tasks.sort((a, b) => {
    const aComplete = a.status === "completed" ? 1 : 0;
    const bComplete = b.status === "completed" ? 1 : 0;
    if (aComplete !== bComplete) return aComplete - bComplete;
    return 0;
  });
}

/**
 * Add a new task.
 */
export async function addMsTask(
  accessToken: string,
  title: string,
  listId?: string,
  notes?: string,
): Promise<MsTaskItem> {
  const resolvedListId = listId ?? await getDefaultMsTaskListId(accessToken);

  const res = await fetch(`${GRAPH_API}/lists/${encodeURIComponent(resolvedListId)}/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      status: "notStarted",
      ...(notes ? { body: { content: notes, contentType: "text" } } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MS Tasks API add error: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Toggle task completion status.
 */
export async function toggleMsTask(
  accessToken: string,
  taskId: string,
  currentlyCompleted: boolean,
  listId?: string,
): Promise<MsTaskItem> {
  const resolvedListId = listId ?? await getDefaultMsTaskListId(accessToken);
  const newStatus = currentlyCompleted ? "notStarted" : "completed";

  const res = await fetch(`${GRAPH_API}/lists/${encodeURIComponent(resolvedListId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: newStatus }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MS Tasks API toggle error: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Update a task's title and/or notes (body).
 */
export async function updateMsTask(
  accessToken: string,
  taskId: string,
  updates: { title?: string; notes?: string },
  listId?: string,
): Promise<MsTaskItem> {
  const resolvedListId = listId ?? await getDefaultMsTaskListId(accessToken);

  const body: Record<string, unknown> = {};
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.notes !== undefined) body.body = { content: updates.notes, contentType: "text" };

  const res = await fetch(`${GRAPH_API}/lists/${encodeURIComponent(resolvedListId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MS Tasks API update error: ${res.status} ${text}`);
  }

  return res.json();
}
