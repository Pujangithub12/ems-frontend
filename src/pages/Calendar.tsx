import React, { useState } from "react";
import Calendar, { CalendarProps } from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { Calendar as CalendarIcon, Clock, ChevronRight, ChevronLeft, Bell } from "lucide-react";

const CalendarPage: React.FC = () => {
  const [value, setValue] = useState<Date>(new Date());

  const handleChange: CalendarProps["onChange"] = (nextValue) => {
    const nextDate = Array.isArray(nextValue) ? nextValue[0] : nextValue;
    if (nextDate) {
      setValue(nextDate);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm text-indigo-600">
          <CalendarIcon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Company Calendar</h2>
          <p className="text-sm text-slate-500 font-medium">Keep track of important dates and deadlines.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Calendar Card */}
        <div className="lg:col-span-8 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden p-6 lg:p-8">
          <div className="calendar-container custom-calendar">
            <Calendar 
              onChange={handleChange} 
              value={value}
              className="w-full border-none font-sans"
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
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-indigo-600 rounded-[32px] p-8 text-white shadow-xl shadow-indigo-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest opacity-80">Timeline</span>
            </div>
            
            <h3 className="text-3xl font-bold leading-tight">
              {value.toLocaleDateString(undefined, { day: "numeric", month: "long" })}
            </h3>
            <p className="text-lg opacity-80 font-medium mt-1">
              {value.toLocaleDateString(undefined, { weekday: "long", year: "numeric" })}
            </p>

            <div className="mt-10 pt-8 border-t border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <p className="text-sm font-medium">Standard Working Hours</p>
              </div>
              <p className="text-xs opacity-60 ml-5 italic">09:00 AM - 05:00 PM (GMT+5:45)</p>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500" />
              Upcoming Events
            </h4>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <CalendarIcon className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-slate-500 text-sm font-medium">No events scheduled for this date.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
