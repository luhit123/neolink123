import React from 'react';

interface SimpleDateTimeInputProps {
  id: string;
  name: string;
  value: string; // ISO string or empty
  onChange: (isoString: string) => void;
  required?: boolean;
  max?: string;
  className?: string;
}

/**
 * Simple Date + Time Input using dropdowns
 * No scrolling issues - just tap and select
 */
const SimpleDateTimeInput: React.FC<SimpleDateTimeInputProps> = ({
  id,
  name,
  value,
  onChange,
  required = false,
  max,
  className = '',
}) => {
  // Parse current value
  const date = value ? new Date(value) : null;

  // Use LOCAL date methods to avoid timezone shift when displaying
  // toISOString() converts to UTC which shifts dates for times before UTC midnight
  const dateStr = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    : '';
  const hour24 = date ? date.getHours() : 12;
  const hour12 = hour24 % 12 || 12;
  const minute = date ? date.getMinutes() : 0;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';

  // Update handler
  const updateDateTime = (newDate: string, newHour12: number, newMinute: number, newAmpm: string) => {
    if (!newDate) {
      onChange('');
      return;
    }

    let hour24 = newHour12;
    if (newAmpm === 'PM' && newHour12 !== 12) hour24 = newHour12 + 12;
    if (newAmpm === 'AM' && newHour12 === 12) hour24 = 0;

    // Parse date parts to avoid timezone issues with new Date(string)
    const [year, month, day] = newDate.split('-').map(Number);
    const dt = new Date(year, month - 1, day, hour24, newMinute, 0, 0);
    onChange(dt.toISOString());
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {/* Date Input */}
      <input
        type="date"
        id={id}
        name={name}
        value={dateStr}
        onChange={(e) => updateDateTime(e.target.value, hour12, minute, ampm)}
        required={required}
        max={max?.slice(0, 10)}
        className="flex-1 min-w-[140px] px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Hour Dropdown */}
      <select
        value={hour12}
        onChange={(e) => updateDateTime(dateStr, Number(e.target.value), minute, ampm)}
        className="w-16 px-2 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>

      <span className="flex items-center text-slate-600 font-bold">:</span>

      {/* Minute Dropdown */}
      <select
        value={minute}
        onChange={(e) => updateDateTime(dateStr, hour12, Number(e.target.value), ampm)}
        className="w-16 px-2 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {Array.from({ length: 60 }, (_, i) => (
          <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
        ))}
      </select>

      {/* AM/PM Dropdown */}
      <select
        value={ampm}
        onChange={(e) => updateDateTime(dateStr, hour12, minute, e.target.value)}
        className="w-16 px-2 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export default SimpleDateTimeInput;
