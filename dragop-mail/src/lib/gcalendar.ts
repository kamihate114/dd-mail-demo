import { ScheduleItem } from "@/components/DaySchedule";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// Google Calendar event color map (colorId → our color scheme)
const COLOR_MAP: Record<string, ScheduleItem["color"]> = {
  "1": "blue",    // Lavender
  "2": "teal",    // Sage
  "3": "purple",  // Grape
  "4": "red",     // Flamingo
  "5": "orange",  // Banana
  "6": "orange",  // Tangerine
  "7": "teal",    // Peacock
  "8": "blue",    // Graphite
  "9": "blue",    // Blueberry
  "10": "teal",   // Basil
  "11": "red",    // Tomato
};

const ROTATING_COLORS: ScheduleItem["color"][] = ["blue", "teal", "orange", "purple", "red"];

interface GCalEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  colorId?: string;
  status?: string;
}

interface GCalListResponse {
  items?: GCalEvent[];
}

function formatTime(isoOrDate: string | undefined): string {
  if (!isoOrDate) return "";
  const d = new Date(isoOrDate);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Fetch Google Calendar events for a given date.
 */
export async function fetchCalendarEvents(
  accessToken: string,
  date: Date,
): Promise<ScheduleItem[]> {
  const timeMin = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const timeMax = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  const res = await fetch(`${CALENDAR_API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn("[Dragop] Calendar API error:", res.status, text);
    throw new Error(`Calendar API error: ${res.status}`);
  }

  const data: GCalListResponse = await res.json();
  const events = data.items ?? [];

  return events
    .filter((e) => e.status !== "cancelled")
    .map((e, i): ScheduleItem => {
      const isAllDay = !e.start?.dateTime;
      return {
        id: e.id,
        title: e.summary || "(タイトルなし)",
        startTime: isAllDay ? "終日" : formatTime(e.start?.dateTime),
        endTime: isAllDay ? undefined : formatTime(e.end?.dateTime),
        location: e.location || undefined,
        color: e.colorId ? (COLOR_MAP[e.colorId] || "blue") : ROTATING_COLORS[i % ROTATING_COLORS.length],
      };
    });
}

/**
 * Fetch events for multiple dates (for calendar dot indicators).
 * Returns a Set of date strings (YYYY-MM-DD) that have events.
 */
export async function fetchCalendarBusyDates(
  accessToken: string,
  year: number,
  month: number,
): Promise<Set<string>> {
  const timeMin = new Date(year, month, 1, 0, 0, 0);
  const timeMax = new Date(year, month + 1, 0, 23, 59, 59);

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "200",
    fields: "items(start,status)",
  });

  try {
    const res = await fetch(`${CALENDAR_API}/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return new Set();
    const data: GCalListResponse = await res.json();
    const dates = new Set<string>();
    for (const e of data.items ?? []) {
      if (e.status === "cancelled") continue;
      const dateStr = e.start?.dateTime
        ? e.start.dateTime.slice(0, 10)
        : e.start?.date;
      if (dateStr) dates.add(dateStr);
    }
    return dates;
  } catch {
    return new Set();
  }
}

/**
 * Format local date+time as RFC3339 with timezone offset (e.g. 2024-02-08T17:00:00+09:00).
 */
function toRFC3339Local(date: Date, hhmm: string): string {
  const [h, min] = hhmm.split(":").map(Number);
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hh = (h ?? 0).toString().padStart(2, "0");
  const mm = (min ?? 0).toString().padStart(2, "0");
  const d = new Date(y, date.getMonth(), date.getDate(), h ?? 0, min ?? 0, 0);
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const oh = Math.floor(Math.abs(offsetMin) / 60)
    .toString()
    .padStart(2, "0");
  const om = (Math.abs(offsetMin) % 60).toString().padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}:00${sign}${oh}:${om}`;
}

/**
 * Update a calendar event (title and/or time).
 * startTime/endTime are "HH:mm"; date is the event date.
 */
export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  date: Date,
  updates: { title?: string; startTime?: string; endTime?: string },
): Promise<void> {
  const body: { summary?: string; start?: { dateTime: string; timeZone?: string }; end?: { dateTime: string; timeZone?: string } } = {};
  if (updates.title !== undefined) body.summary = updates.title;
  const hasStart = updates.startTime !== undefined && /^\d{1,2}:\d{2}$/.test(updates.startTime);
  const hasEnd = updates.endTime !== undefined && updates.endTime.trim() !== "" && /^\d{1,2}:\d{2}$/.test(updates.endTime);
  if (hasStart) body.start = { dateTime: toRFC3339Local(date, updates.startTime!) };
  if (hasEnd) body.end = { dateTime: toRFC3339Local(date, updates.endTime!) };
  if (Object.keys(body).length === 0) return;

  const url = `${CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn("[Dragop] Calendar PATCH error:", res.status, text);
    throw new Error(text || `Calendar update failed: ${res.status}`);
  }
}

/**
 * Create a new calendar event on the given date.
 * startTime/endTime are "HH:mm".
 */
export async function createCalendarEvent(
  accessToken: string,
  date: Date,
  event: { title: string; startTime: string; endTime?: string },
): Promise<ScheduleItem> {
  const startTime = /^\d{1,2}:\d{2}$/.test(event.startTime) ? event.startTime : "09:00";
  const endTime = event.endTime && /^\d{1,2}:\d{2}$/.test(event.endTime) ? event.endTime : "10:00";
  const body = {
    summary: event.title.trim() || "（無題）",
    start: { dateTime: toRFC3339Local(date, startTime) },
    end: { dateTime: toRFC3339Local(date, endTime) },
  };

  const res = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn("[Dragop] Calendar POST error:", res.status, text);
    throw new Error(text || `Calendar create failed: ${res.status}`);
  }
  const data = (await res.json()) as GCalEvent;
  return {
    id: data.id,
    title: data.summary || "（無題）",
    startTime: formatTime(data.start?.dateTime),
    endTime: data.end?.dateTime ? formatTime(data.end.dateTime) : undefined,
    location: data.location,
    color: data.colorId ? (COLOR_MAP[data.colorId] || "blue") : "blue",
  };
}

/**
 * Delete a calendar event.
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string,
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    console.warn("[Dragop] Calendar DELETE error:", res.status, text);
    throw new Error(text || `Calendar delete failed: ${res.status}`);
  }
}
