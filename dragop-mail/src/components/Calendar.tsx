"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fetchHolidaysForYear, isHoliday } from "@/lib/holidays";

interface CalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(d: Date) {
  return isSameDay(d, new Date());
}

function isSunday(d: Date) {
  return d.getDay() === 0;
}

function isSaturday(d: Date) {
  return d.getDay() === 6;
}

export function Calendar({ selectedDate, onSelectDate }: CalendarProps) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  const [holidays, setHolidays] = useState<Set<string>>(new Set());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  useEffect(() => {
    let cancelled = false;
    fetchHolidaysForYear(year).then((set) => {
      if (!cancelled) setHolidays(set);
    });
    return () => { cancelled = true; };
  }, [year]);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div>
      {/* Month nav */}
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-md p-1 text-text-muted hover:bg-border-default hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-text-primary">
          {year}年 {month + 1}月
        </span>
        <button onClick={nextMonth} className="rounded-md p-1 text-text-muted hover:bg-border-default hover:text-text-primary transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_LABELS.map((label, i) => (
          <div key={label} className={`text-center text-xs font-medium py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-text-muted"}`}>
            {label}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;

          const selected = isSameDay(date, selectedDate);
          const today = isToday(date);
          const sun = isSunday(date);
          const sat = isSaturday(date);
          const holiday = isHoliday(date, holidays);

          return (
            <button
              key={date.getDate()}
              onClick={() => onSelectDate(date)}
              className={`
                relative flex h-8 w-full items-center justify-center rounded-md text-xs font-medium transition-all
                ${selected
                  ? "bg-brand-blue text-white"
                  : today
                    ? "ring-1 ring-brand-blue text-brand-blue"
                    : holiday
                      ? "text-red-400 hover:bg-red-400/10"
                      : sun
                        ? "text-red-400 hover:bg-border-default"
                        : sat
                          ? "text-blue-400 hover:bg-border-default"
                          : "text-text-primary hover:bg-border-default"
                }
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
