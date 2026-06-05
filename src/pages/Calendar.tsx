import React, { useState, useEffect } from "react";
import Calendar, { CalendarProps } from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Bell, 
  Plus, 
  Trash2, 
  Loader2, 
  X, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";

type CalendarEvent = {
  id: number;
  title: string;
  date: string;
  type: string;
};

const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const [value, setValue] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin form state
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
      (event) => new Date(event.date).toDateString() === date.toDateString()
    );
  };

  const selectedDateEvents = getEventsForDate(value);

  // Tile content for calendar to show a dot if there's an event
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === "month") {
      const dayEvents = getEventsForDate(date);
      if (dayEvents.length > 0) {
        return (
          <div className="flex justify-center mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          </div>
        );
      }
    }
    return null;
  };

  return (
    <div className="pb-12 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex gap-3 items-center">
          <div className="p-3 text-indigo-600 bg-white rounded-2xl border shadow-sm border-slate-200">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Company Calendar</h2>
            <p className="text-sm font-medium text-slate-500">Keep track of important dates and deadlines.</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex gap-2 items-center px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl shadow-sm transition-all hover:bg-indigo-700 shadow-indigo-200"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? "Cancel" : "Add Event"}
          </button>
        )}
      </div>

      {showAddForm && isAdmin && (
        <div className="p-6 bg-white rounded-2xl border shadow-sm border-slate-200 animate-in fade-in slide-in-from-top-4">
          <form onSubmit={handleAddEvent} className="flex flex-col gap-4 items-end md:flex-row">
            <div className="flex-1 space-y-2 w-full">
              <label className="ml-1 text-xs font-bold tracking-widest uppercase text-slate-500">Event Title for {value.toLocaleDateString()}</label>
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Democracy Day, Office Holiday"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-2 text-sm shrink-0"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Event
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-8 items-start lg:grid-cols-12">
        {/* Calendar Card */}
        <div className="lg:col-span-8 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden p-6 lg:p-8">
          <div className="calendar-container custom-calendar">
            <Calendar 
              onChange={handleChange} 
              value={value}
              tileContent={tileContent}
              className="w-full font-sans border-none"
              nextLabel={<ChevronRight className="w-5 h-5" />}
              prevLabel={<ChevronLeft className="w-5 h-5" />}
              next2Label={null}
              prev2Label={null}
            />
          </div>

          <style>{`
            .custom-calendar.react-calendar {
              width: 100%;
              background: transparent;
              border: none;
              font-family: inherit;
            }
            .custom-calendar .react-calendar__navigation {
              margin-bottom: 2rem;
              display: flex;
              align-items: center;
              gap: 1rem;
            }
            .custom-calendar .react-calendar__navigation button {
              min-width: 44px;
              height: 44px;
              background: #f8fafc;
              border-radius: 12px;
              color: #1e293b;
              font-weight: 700;
              transition: all 0.2s;
            }
            .custom-calendar .react-calendar__navigation button:enabled:hover,
            .custom-calendar .react-calendar__navigation button:enabled:focus {
              background-color: #e2e8f0;
            }
            .custom-calendar .react-calendar__month-view__weekdays {
              font-weight: 700;
              text-transform: uppercase;
              font-size: 0.75rem;
              color: #94a3b8;
              margin-bottom: 1rem;
            }
            .custom-calendar .react-calendar__tile {
              padding: 1.25rem 0.5rem;
              border-radius: 16px;
              font-weight: 600;
              color: #475569;
              transition: all 0.2s;
              position: relative;
            }
            .custom-calendar .react-calendar__tile:enabled:hover,
            .custom-calendar .react-calendar__tile:enabled:focus {
              background-color: #f1f5f9;
              color: #4f46e5;
            }
            .custom-calendar .react-calendar__tile--now {
              background: #eef2ff !important;
              color: #4f46e5 !important;
            }
            .custom-calendar .react-calendar__tile--active {
              background: #4f46e5 !important;
              color: white !important;
              box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);
            }
            .custom-calendar .react-calendar__month-view__days__day--neighboringMonth {
              opacity: 0.3;
            }
          `}</style>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4 lg:col-span-4">
          <div className="p-6 text-white bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200">
            <div className="flex gap-3 items-center mb-4">
              <div className="p-2 rounded-xl backdrop-blur-sm bg-white/20">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold tracking-widest uppercase opacity-80">Timeline</span>
            </div>
            
            <h3 className="text-xl font-bold leading-tight">
              {value.toLocaleDateString(undefined, { day: "numeric", month: "long" })}
            </h3>
            <p className="text-sm opacity-80 font-medium mt-0.5">
              {value.toLocaleDateString(undefined, { weekday: "long", year: "numeric" })}
            </p>

            <div className="pt-4 mt-6 space-y-2 border-t border-white/10">
              <div className="flex gap-2 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <p className="text-xs font-medium">Standard Hours</p>
              </div>
              <p className="text-[10px] opacity-60 ml-3.5 italic">10:00 AM - 05:00 PM</p>
            </div>
          </div>

          <div className="p-6 bg-white rounded-3xl border shadow-sm border-slate-200">
            <h4 className="flex gap-2 items-center mb-6 text-sm font-bold tracking-widest uppercase text-slate-900">
              <Bell className="w-4 h-4 text-indigo-500" />
              Events today
            </h4>
            
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            ) : selectedDateEvents.length > 0 ? (
              <div className="space-y-4">
                {selectedDateEvents.map((event) => (
                  <div key={event.id} className="flex justify-between items-center p-4 rounded-2xl border bg-slate-50 border-slate-100 group">
                    <div className="flex gap-3 items-center">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                      <span className="text-sm font-bold text-slate-700">{event.title}</span>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        className="p-2 rounded-lg opacity-0 transition-all text-slate-400 hover:text-rose-600 hover:bg-rose-50 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col justify-center items-center py-8 text-center">
                <div className="flex justify-center items-center mb-4 w-12 h-12 rounded-full bg-slate-50">
                  <CalendarIcon className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">No events scheduled.</p>
              </div>
            )}

            <div className="pt-6 mt-8 border-t border-slate-100">
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Next Upcoming Events</h5>
              <div className="space-y-3">
                {events
                  .filter(e => new Date(e.date) >= new Date(new Date().setHours(0,0,0,0)))
                  .slice(0, 3)
                  .map(e => (
                    <div key={e.id} className="flex justify-between items-center text-xs">
                      <span className="font-medium text-slate-600">{e.title}</span>
                      <span className="font-bold text-slate-400">{new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
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
