import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface AdvancedAnalyticsDashboardProps {
  institutionId?: string;
}

const AdvancedAnalyticsDashboard: React.FC<AdvancedAnalyticsDashboardProps> = ({ institutionId }) => {
  const [loading, setLoading] = useState(true);
  const [admissionTrends, setAdmissionTrends] = useState<any[]>([]);
  const [outcomeDistribution, setOutcomeDistribution] = useState<any[]>([]);
  const [institutionComparison, setInstitutionComparison] = useState<any[]>([]);
  const [unitDistribution, setUnitDistribution] = useState<any[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<any[]>([]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  useEffect(() => {
    loadAnalyticsData();
  }, [institutionId]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      const [patientsSnap, institutionsSnap] = await Promise.all([
        getDocs(collection(db, 'patients')),
        getDocs(collection(db, 'institutions')),
      ]);

      const patients = patientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const institutions = institutionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 1. Outcome Distribution
      const outcomes = patients.reduce((acc: any, p: any) => {
        acc[p.outcome] = (acc[p.outcome] || 0) + 1;
        return acc;
      }, {});

      const outcomeData = Object.entries(outcomes).map(([name, value]) => ({
        name,
        value,
        percentage: ((value as number / patients.length) * 100).toFixed(1),
      }));
      setOutcomeDistribution(outcomeData);

      // 2. Unit Distribution
      const units = patients.reduce((acc: any, p: any) => {
        const unit = p.unit || 'Unknown';
        acc[unit] = (acc[unit] || 0) + 1;
        return acc;
      }, {});

      const unitData = Object.entries(units).map(([name, value]) => ({
        name: name.replace('Intensive Care Unit', 'ICU').replace('Special New Born Care Unit', 'SNCU'),
        value,
        fullName: name,
      }));
      setUnitDistribution(unitData);

      // 3. Institution Comparison
      const instStats = institutions.map((inst: any) => {
        const instPatients = patients.filter((p: any) => p.institutionId === inst.id);
        const active = instPatients.filter((p: any) => p.outcome === 'In Progress').length;
        const discharged = instPatients.filter((p: any) => p.outcome === 'Discharged').length;
        const deceased = instPatients.filter((p: any) => p.outcome === 'Deceased').length;

        return {
          name: inst.name.length > 15 ? inst.name.substring(0, 15) + '...' : inst.name,
          fullName: inst.name,
          Active: active,
          Discharged: discharged,
          Deceased: deceased,
          Total: instPatients.length,
        };
      }).sort((a, b) => b.Total - a.Total).slice(0, 10);

      setInstitutionComparison(instStats);

      // 4. Monthly Admission Trends (last 6 months)
      const now = new Date();
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const monthPatients = patients.filter((p: any) => {
          const admDate = new Date(p.admissionDate);
          return admDate >= monthDate && admDate <= monthEnd;
        });

        const admissions = monthPatients.length;
        const discharged = monthPatients.filter((p: any) => p.outcome === 'Discharged').length;
        const deceased = monthPatients.filter((p: any) => p.outcome === 'Deceased').length;

        monthlyData.push({
          month: monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          Admissions: admissions,
          Discharged: discharged,
          Deceased: deceased,
        });
      }
      setMonthlyTrends(monthlyData);

      // 5. Daily Admission Trends (last 30 days)
      const dailyData = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayPatients = patients.filter((p: any) => {
          const admDate = new Date(p.admissionDate);
          return admDate >= date && admDate < nextDate;
        });

        dailyData.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          Admissions: dayPatients.length,
          fullDate: date.toLocaleDateString(),
        });
      }
      setAdmissionTrends(dailyData);

    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl border-2 border-slate-200 p-6 animate-pulse">
            <div className="h-64 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Monthly Trends & Outcome Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Admission Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-xl bg-white/90 rounded-2xl border-2 border-blue-200 shadow-xl overflow-hidden"
        >
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-b-2 border-blue-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Monthly Admission Trends
            </h3>
            <p className="text-xs text-slate-500">Last 6 months comparison</p>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyTrends}>
                <defs>
                  <linearGradient id="colorAdmissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDischarged" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="Admissions" stroke="#3b82f6" fill="url(#colorAdmissions)" strokeWidth={2} />
                <Area type="monotone" dataKey="Discharged" stroke="#10b981" fill="url(#colorDischarged)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Outcome Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="backdrop-blur-xl bg-white/90 rounded-2xl border-2 border-green-200 shadow-xl overflow-hidden"
        >
          <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              Patient Outcome Distribution
            </h3>
            <p className="text-xs text-slate-500">System-wide outcomes</p>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={outcomeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {outcomeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Row 2: Institution Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="backdrop-blur-xl bg-white/90 rounded-2xl border-2 border-purple-200 shadow-xl overflow-hidden"
      >
        <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b-2 border-purple-200">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Institution Performance Comparison
          </h3>
          <p className="text-xs text-slate-500">Top 10 institutions by patient load</p>
        </div>
        <div className="p-6">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={institutionComparison} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis dataKey="name" type="category" width={120} stroke="#64748b" style={{ fontSize: '10px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Active" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Discharged" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Deceased" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Row 3: Daily Trends & Unit Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Admission Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="backdrop-blur-xl bg-white/90 rounded-2xl border-2 border-orange-200 shadow-xl overflow-hidden"
        >
          <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b-2 border-orange-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Daily Admission Trends
            </h3>
            <p className="text-xs text-slate-500">Last 30 days activity</p>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={admissionTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '10px' }} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="Admissions" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#f59e0b', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Unit Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="backdrop-blur-xl bg-white/90 rounded-2xl border-2 border-cyan-200 shadow-xl overflow-hidden"
        >
          <div className="px-6 py-4 bg-gradient-to-r from-cyan-50 to-teal-50 border-b-2 border-cyan-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Unit Distribution
            </h3>
            <p className="text-xs text-slate-500">Patients across units</p>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={unitDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '11px' }} angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]}>
                  {unitDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;
