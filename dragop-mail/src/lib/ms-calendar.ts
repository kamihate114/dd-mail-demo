/**
 * Microsoft Calendar API via Microsoft Graph v1.0
 * Follows the same pattern as gcalendar.ts — returns ScheduleItem[].
 */
import { ScheduleItem } from "@/components/DaySchedule";

const GRAPH_API = "https://graph.microsoft.com/v1.0/me";

/* ---------- Types ---------- */

interface MsCalEvent {
  id: string;
  subject?: string;
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
  location?: { displayName?: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  categories?: string[];
}

/* ---------- Helpers ---------- */

const ROTATING_COLORS: ScheduleItem["color"][] = ["blue", "teal", "orange", "purple", "red"];

// MS Graph categories → our color scheme
const CATEGORY_COLOR_MAP: Record<string, ScheduleItem["color"]> = {
  Red: "red",
  Orange: "orange",
  Yellow: "orange",
  Green: "teal",
  Blue: "blue",
  Purple: "purple",
};

function formatTime(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function toISOLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toISOLocalDateTime(date: Date, hhmm: string): string {
  const [h, min] = hhmm.split(":").map(Number);
  const iso = toISOLocalDate(date);
  return `${iso}T${(h ?? 0).toString().padStart(2, "0")}:${(min ?? 0).toString().padStart(2, "0")}:00`;
}

function getColor(event: MsCalEvent, index: number): ScheduleItem["color"] {
  if (event.categories && event.categories.length > 0) {
    const cat = event.categories[0];
    for (const [key, color] of Object.entries(CATEGORY_COLOR_MAP)) {
      if (cat.toLowerCase().includes(key.toLowerCase())) return color;
    }
  }
  return ROTATING_COLORS[index % ROTATING_COLORS.length];
}

/* ---------- API Functions ---------- */

/**
 * Fetch Microsoft Calendar events for a given date.
 */
export async function fetchMsCalendarEvents(
  accessToken: string,
  date: Date,
): Promise<ScheduleItem[]> {
  const startDate = toISOLocalDate(date);
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);
  const endDate = toISOLocalDate(nextDate);

  const params = new URLSearchParams({
    startDateTime: `${startDate}T00:00:00`,
    endDateTime: `${endDate}T00:00:00`,
    $orderby: "start/dateTime",
    $top: "50",
    $select: "id,subject,start,end,location,isAllDay,isCancelled,categories",
  });

  const res = await fetch(`${GRAPH_API}/calendarview?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="Asia/Tokyo"',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn("[Dragop] MS Calendar API error:", res.status, text);
    throw new Error(`MS Calendar API error: ${res.status}`);
  }

  const data = await res.json();
  const events: MsCalEvent[] = data.value || [];

  return events
    .filter((e) => !e.isCancelled)
    .map((e, i): ScheduleItem => ({
      id: e.id,
      title: e.subject || "(タイトルなし)",
      startTime: e.isAllDay ? "終日" : formatTime(e.start?.dateTime || ""),
      endTime: e.isAllDay ? undefined : (e.end?.dateTime ? formatTime(e.end.dateTime) : undefined),
      location: e.location?.displayName || undefined,
      color: getColor(e, i),
    }));
}

/**
 * Fetch events for a month (for calendar dot indicators).
 */
export async function fetchMsCalendarBusyDates(
  accessToken: string,
  year: number,
  month: number,
): Promise<Set<string>> {
  const startDate = `${year}-${(month + 1).toString().padStart(2, "0")}-01`;
  const endMonth = new Date(year, month + 1, 0);
  const endDate = `${year}-${(month + 1).toString().padStart(2, "0")}-${endMonth.getDate().toString().padStart(2, "0")}`;

  const params = new URLSearchParams({
    startDateTime: `${startDate}T00:00:00`,
    endDateTime: `${endDate}T23:59:59`,
    $top: "200",
    $select: "start,isCancelled",
  });

  try {
    const res = await fetch(`${GRAPH_API}/calendarview?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="Asia/Tokyo"',
      },
    });
    if (!res.ok) return new Set();
    const data = await res.json();
    const dates = new Set<string>();
    for (const e of (data.value || []) as MsCalEvent[]) {
      if (e.isCancelled) continue;
      if (e.start?.dateTime) {
        dates.add(e.start.dateTime.slice(0, 10));
      }
    }
    return dates;
  } catch {
    return new Set();
  }
}

/**
 * Create a new calendar event.
 */
export async function createMsCalendarEvent(
  accessToken: string,
  date: Date,
  event: { title: string; startTime: string; endTime?: string },
): Promise<ScheduleItem> {
  const startTime = /^\d{1,2}:\d{2}$/.test(event.startTime) ? event.startTime : "09:00";
  const endTime = event.endTime && /^\d{1,2}:\d{2}$/.test(event.endTime) ? event.endTime : "10:00";

  const body = {
    subject: event.title.trim() || "（無題）",
    start: { dateTime: toISOLocalDateTime(date, startTime), timeZone: "Asia/Tokyo" },
    end: { dateTime: toISOLocalDateTime(date, endTime), timeZone: "Asia/Tokyo" },
  };

  const res = await fetch(`${GRAPH_API}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `MS Calendar create failed: ${res.status}`);
  }

  const data = (await res.json()) as MsCalEvent;
  return {
    id: data.id,
    title: data.subject || "（無題）",
    startTime: formatTime(data.start?.dateTime || ""),
    endTime: data.end?.dateTime ? formatTime(data.end.dateTime) : undefined,
    location: data.location?.displayName,
    color: "blue",
  };
}

/**
 * Update a calendar event.
 */
export async function updateMsCalendarEvent(
  accessToken: string,
  eventId: string,
  date: Date,
  updates: { title?: string; startTime?: string; endTime?: string },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (updates.title !== undefined) body.subject = updates.title;
  if (updates.startTime && /^\d{1,2}:\d{2}$/.test(updates.startTime)) {
    body.start = { dateTime: toISOLocalDateTime(date, updates.startTime), timeZone: "Asia/Tokyo" };
  }
  if (updates.endTime && /^\d{1,2}:\d{2}$/.test(updates.endTime)) {
    body.end = { dateTime: toISOLocalDateTime(date, updates.endTime), timeZone: "Asia/Tokyo" };
  }
  if (Object.keys(body).length === 0) return;

  const res = await fetch(`${GRAPH_API}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `MS Calendar update failed: ${res.status}`);
  }
}

/**
 * Delete a calendar event.
 */
export async function deleteMsCalendarEvent(
  accessToken: string,
  eventId: string,
): Promise<void> {
  const res = await fetch(`${GRAPH_API}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(text || `MS Calendar delete failed: ${res.status}`);
  }
}
