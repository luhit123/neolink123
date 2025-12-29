import React, { useMemo } from 'react';
import { Patient } from '../types';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface TimeBasedAnalyticsProps {
  patients: Patient[];
}

const TimeBasedAnalytics: React.FC<TimeBasedAnalyticsProps> = ({ patients }) => {
  // Month-wise data for the last 12 months
  const monthWiseData = useMemo(() => {
    const months = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleString('default', { month: 'short', year: '2-digit' });

      const monthPatients = patients.filter(p => {
        const admissionDate = new Date(p.admissionDate);
        return admissionDate.getFullYear() === date.getFullYear() &&
          admissionDate.getMonth() === date.getMonth();
      });

      months.push({
        month: monthName,
        admissions: monthPatients.length,
        discharged: monthPatients.filter(p => p.outcome === 'Discharged').length,
        referred: monthPatients.filter(p => p.outcome === 'Referred').length,
        deaths: monthPatients.filter(p => p.outcome === 'Deceased').length,
        inProgress: monthPatients.filter(p => p.outcome === 'In Progress').length
      });
    }

    return months;
  }, [patients]);

  // Day-wise data for the last 30 days
  const dayWiseData = useMemo(() => {
    const days = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayPatients = patients.filter(p => {
        const admissionDate = new Date(p.admissionDate);
        return admissionDate >= date && admissionDate < nextDate;
      });

      days.push({
        day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        admissions: dayPatients.length,
        deaths: dayPatients.filter(p => p.outcome === 'Deceased').length
      });
    }

    return days;
  }, [patients]);

  // Year-wise data
  const yearWiseData = useMemo(() => {
    const years = new Map<number, { admissions: number; discharged: number; referred: number; deaths: number }>();

    patients.forEach(p => {
      const year = new Date(p.admissionDate).getFullYear();
      if (!years.has(year)) {
        years.set(year, { admissions: 0, discharged: 0, referred: 0, deaths: 0 });
      }
      const yearData = years.get(year)!;
      yearData.admissions++;
      if (p.outcome === 'Discharged') yearData.discharged++;
      if (p.outcome === 'Referred') yearData.referred++;
      if (p.outcome === 'Deceased') yearData.deaths++;
    });

    return Array.from(years.entries())
      .map(([year, data]) => ({ year: year.toString(), ...data }))
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [patients]);


  // Diagnosis Distribution
  const diagnosisData = useMemo(() => {
    const diagnosisCounts: { [key: string]: number } = {};
    patients.forEach(p => {
      const diagnosis = p.diagnosis || 'Unknown';
      diagnosisCounts[diagnosis] = (diagnosisCounts[diagnosis] || 0) + 1;
    });

    return Object.entries(diagnosisCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 diagnoses
  }, [patients]);

  // Length of Stay Histogram
  const lengthOfStayData = useMemo(() => {
    const ranges = [
      { range: '0-3 Days', count: 0 },
      { range: '4-7 Days', count: 0 },
      { range: '8-14 Days', count: 0 },
      { range: '15-30 Days', count: 0 },
      { range: '30+ Days', count: 0 },
    ];

    patients.forEach(p => {
      const start = new Date(p.admissionDate);
      const end = p.releaseDate ? new Date(p.releaseDate) : new Date();
      const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (days <= 3) ranges[0].count++;
      else if (days <= 7) ranges[1].count++;
      else if (days <= 14) ranges[2].count++;
      else if (days <= 30) ranges[3].count++;
      else ranges[4].count++;
    });

    return ranges;
  }, [patients]);


  return (
    <div className="space-y-6">
      {/* Bed Occupancy is handled in parent, but we can put other general stats here */}

      {/* Diagnosis & Length of Stay */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Diagnoses */}
        <div className="bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-700">
          <h3 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">🦠</span> Top Diagnoses
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diagnosisData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 10 }} hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fontSize: 11 }} width={120} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} />
                <Bar dataKey="count" name="Patients" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20}>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Length of Stay */}
        <div className="bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-700">
          <h3 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">⏱️</span> Length of Stay
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lengthOfStayData}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} vertical={false} />
                <XAxis dataKey="range" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} />
                <Bar dataKey="count" name="Patients" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Month-wise Analytics */}
      <div className="bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-700">
        <h3 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">📅</span>
          Month-wise Analytics (Last 12 Months)
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Admissions Trend */}
          <div className="bg-slate-700/30 p-4 rounded-lg">
            <h4 className="text-sm md:text-base font-semibold text-slate-300 mb-3">Monthly Admissions Trend</h4>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthWiseData}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="admissions" name="Admissions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Outcomes Breakdown */}
          <div className="bg-slate-700/30 p-4 rounded-lg">
            <h4 className="text-sm md:text-base font-semibold text-slate-300 mb-3">Monthly Outcomes</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthWiseData}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="discharged" name="Discharged" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="referred" name="Referred" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="deaths" name="Deaths" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Day-wise Analytics (Last 30 Days) */}
      <div className="bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-700">
        <h3 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Daily Analytics (Last 30 Days)
        </h3>

        <div className="bg-slate-700/30 p-4 rounded-lg">
          <h4 className="text-sm md:text-base font-semibold text-slate-300 mb-3">Daily Admissions & Mortality</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dayWiseData}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="admissions" name="Admissions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="deaths" name="Deaths" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Year-wise Analytics */}
      {yearWiseData.length > 1 && (
        <div className="bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-700">
          <h3 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">📈</span>
            Year-wise Analytics
          </h3>

          <div className="bg-slate-700/30 p-4 rounded-lg">
            <h4 className="text-sm md:text-base font-semibold text-slate-300 mb-3">Yearly Comparison</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={yearWiseData}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="admissions" name="Total Admissions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="discharged" name="Discharged" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="referred" name="Referred" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="deaths" name="Deaths" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeBasedAnalytics;
