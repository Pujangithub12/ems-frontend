import React, { useState, useEffect } from "react";
import Calendar, { CalendarProps } from "react-calendar";
import "react-calendar/dist/Calendar.css";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Loader2,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";

type CalendarEvent = {
  id: number;
  title: string;
  date: string;
  type: string;
};

const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`text-[10px] tracking-[0.1em] uppercase text-slate-400 ${className}`}
    style={{ fontFamily: "'JetBrains Mono', monospace" }}
  >
    {children}
  </div>
);

const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const [value, setValue] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === "admin";

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await api.get<CalendarEvent[]>("/api/events");
      setEvents(response.data);
    } catch (err: any) {
      setError("Failed to load calendar events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleChange: CalendarProps["onChange"] = (nextValue) => {
    const nextDate = Array.isArray(nextValue) ? nextValue[0] : nextValue;
    if (nextDate) {
      setValue(nextDate);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSubmitting(true);
    try {
      await api.post("/api/events", {
        title: newTitle,
        date: value.toISOString(),
        type: "holiday",
      });
      setNewTitle("");
      setShowAddForm(false);
      fetchEvents();
    } catch (err: any) {
      alert("Failed to add event.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await api.delete(`/api/events/${id}`);
      fetchEvents();
    } catch (err: any) {
      alert("Failed to delete event.");
    }
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(
      (event) => new Date(event.date).toDateString() === date.toDateString(),
    );
  };

  const selectedDateEvents = getEventsForDate(value);

  // 1. Tile content to show a dot if there's an event
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === "month") {
      const dayEvents = getEventsForDate(date);
      if (dayEvents.length > 0) {
        return (
          <div className="flex justify-center mt-1">
            <div className="w-1 h-1 bg-blue-900 rounded-full" />
          </div>
        );
      }
    }
    return null;
  };

  // 2. Tile class name to make Saturdays and Holidays red
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === "month") {
      const isSaturday = date.getDay() === 6; // 6 = Saturday
      const hasEvent = getEventsForDate(date).length > 0;

      if (isSaturday || hasEvent) {
        return "holiday-tile";
      }
    }
    return null;
  };

  return (
    <div className="max-w-6xl px-6 py-8 mx-auto lg:px-8 lg:py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Eyebrow>Schedule & Deadlines</Eyebrow>
          <h2 className="font-semibold mt-1 text-[28px] tracking-tight text-slate-900">
            Company Calendar
          </h2>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
          >
            {showAddForm ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {showAddForm ? "Cancel" : "Add Event"}
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && isAdmin && (
        <div className="p-5 mb-6 bg-white border rounded-md border-slate-200">
          <form
            onSubmit={handleAddEvent}
            className="flex flex-col gap-4 md:flex-row md:items-end"
          >
            <div className="flex-1">
              <Eyebrow className="mb-1.5">
                Event Title for {value.toLocaleDateString()}
              </Eyebrow>
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Democracy Day, Office Holiday"
                className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-70 transition-colors"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{" "}
              Save Event
            </button>
          </form>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Calendar Grid */}
        <div className="p-6 bg-white border rounded-md lg:col-span-8 border-slate-200">
          <Calendar
            onChange={handleChange}
            value={value}
            tileContent={tileContent}
            tileClassName={tileClassName} // Added to apply custom classes to specific days
            className="w-full custom-calendar"
            nextLabel={<ChevronRight className="w-4 h-4" />}
            prevLabel={<ChevronLeft className="w-4 h-4" />}
            next2Label={null}
            prev2Label={null}
          />
          <style>{`
            .custom-calendar.react-calendar {
              width: 100%;
              background: transparent;
              border: none;
              font-family: inherit;
            }
            .custom-calendar .react-calendar__navigation {
              margin-bottom: 1.5rem;
              display: flex;
              align-items: center;
            }
            .custom-calendar .react-calendar__navigation__label {
              font-weight: 600;
              font-size: 15px;
              color: #0f172a;
              flex-grow: 1;
              text-align: left;
              padding-left: 8px;
            }
            .custom-calendar .react-calendar__navigation__arrow {
              min-width: 32px;
              height: 32px;
              background: transparent;
              border-radius: 4px;
              color: #475569;
              transition: all 0.15s;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .custom-calendar .react-calendar__navigation__arrow:enabled:hover {
              background-color: #f1f5f9;
            }
            .custom-calendar .react-calendar__month-view__weekdays {
              font-family: 'JetBrains Mono', monospace;
              font-weight: 500;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.05em;
              color: #94a3b8;
              margin-bottom: 0.5rem;
              text-align: center;
            }
            .custom-calendar .react-calendar__month-view__weekdays__weekday {
              padding: 0.5rem 0;
            }
            .custom-calendar .react-calendar__month-view__weekdays__weekday abbr {
              text-decoration: none;
            }
            .custom-calendar .react-calendar__tile {
              padding: 0.75rem 0.5rem;
              border-radius: 4px;
              font-weight: 500;
              font-size: 13px;
              color: #334155;
              transition: all 0.15s;
              text-align: center;
              max-height: 60px;
            }
            .custom-calendar .react-calendar__tile:enabled:hover {
              background-color: #f8fafc;
              color: #0f172a;
            }
            .custom-calendar .react-calendar__tile--now {
              background: #eff6ff !important;
              color: #1e3a8a !important;
              font-weight: 600;
            }
            .custom-calendar .react-calendar__tile--active {
              background: #1e3a8a !important;
              color: white !important;
            }
            .custom-calendar .react-calendar__month-view__days__day--neighboringMonth {
              color: #cbd5e1;
            }
            .custom-calendar .react-calendar__month-view__days__day--weekend {
              color: #334155;
            }

            /* --- NEW CSS FOR HOLIDAYS & SATURDAYS --- */
            .custom-calendar .holiday-tile {
              color: #b91c1c !important; /* Red-700 from ERP palette */
              font-weight: 600 !important;
            }
            /* Keep selected/active day white even if it's a holiday */
            .custom-calendar .holiday-tile.react-calendar__tile--active {
              color: #ffffff !important;
            }
            /* Style for "Today" if it happens to be a holiday/Saturday */
            .custom-calendar .holiday-tile.react-calendar__tile--now {
              color: #b91c1c !important;
              background: #fef2f2 !important; /* Light red background */
            }
            /* Dim the red color for days belonging to previous/next months */
            .custom-calendar .holiday-tile.react-calendar__month-view__days__day--neighboringMonth {
              color: #fca5a5 !important; /* Lighter red */
              opacity: 0.7;
            }
          `}</style>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:col-span-4">
          {/* Selected Date */}
          <div className="p-5 bg-white border rounded-md border-slate-200">
            <Eyebrow>Selected Date</Eyebrow>
            <h3 className="font-semibold mt-2 text-[22px] tracking-tight text-slate-900">
              {value.toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
              })}
            </h3>
            <p className="text-slate-500 text-[13px] mt-0.5">
              {value.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
              })}
            </p>

            <div className="pt-4 mt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 text-slate-600 text-[12px]">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-900" />
                Standard Hours: 10:00 AM - 05:00 PM
              </div>
            </div>
          </div>

          {/* Events Today */}
          <div className="overflow-hidden bg-white border rounded-md border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200">
              <Eyebrow>Events for this day</Eyebrow>
              <div className="font-semibold mt-0.5 text-[15px] text-slate-900">
                {selectedDateEvents.length} scheduled
              </div>
            </div>

            <div className="p-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8">
                  <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
                  <div
                    className="text-[11px] text-slate-400 tracking-[0.1em] uppercase"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Loading
                  </div>
                </div>
              ) : selectedDateEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 transition-colors border rounded border-slate-200 hover:bg-slate-50 group"
                    >
                      <div className="flex items-center min-w-0 gap-3">
                        <div className="flex-shrink-0 w-1 h-8 bg-blue-900 rounded-full" />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-slate-900 truncate">
                            {event.title}
                          </div>
                          <div className="text-[11px] text-slate-500 capitalize">
                            {event.type}
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="flex items-center justify-center w-10 h-10 mb-2 rounded bg-slate-100">
                    <CalendarIcon className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-slate-500 text-[12px]">
                    No events scheduled.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming */}
          <div className="overflow-hidden bg-white border rounded-md border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200">
              <Eyebrow>Upcoming</Eyebrow>
            </div>
            <div className="p-5">
              <div className="space-y-3">
                {events
                  .filter(
                    (e) =>
                      new Date(e.date) >=
                      new Date(new Date().setHours(0, 0, 0, 0)),
                  )
                  .slice(0, 4)
                  .map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between text-[13px]"
                    >
                      <span className="pr-2 font-medium truncate text-slate-700">
                        {e.title}
                      </span>
                      <span
                        className="text-slate-400 whitespace-nowrap"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                        }}
                      >
                        {new Date(e.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
