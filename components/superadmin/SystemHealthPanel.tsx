import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

interface SystemMetric {
  name: string;
  value: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  icon: React.ReactNode;
  description: string;
}

const SystemHealthPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [overallHealth, setOverallHealth] = useState<'excellent' | 'good' | 'warning' | 'critical'>('good');

  useEffect(() => {
    loadSystemMetrics();
  }, []);

  const loadSystemMetrics = async () => {
    try {
      // Fetch data to calculate metrics
      const [patientsSnap, institutionsSnap, usersSnap, medicationsSnap] = await Promise.all([
        getDocs(collection(db, 'patients')),
        getDocs(collection(db, 'institutions')),
        getDocs(collection(db, 'approved_users')),
        getDocs(collection(db, 'medications')),
      ]);

      const totalPatients = patientsSnap.size;
      const totalInstitutions = institutionsSnap.size;
      const totalUsers = usersSnap.size;
      const totalMedications = medicationsSnap.size;

      // Calculate system health metrics
      const databaseHealth = totalPatients > 0 ? 100 : 0;
      const userEngagement = (totalUsers / Math.max(totalInstitutions, 1)) * 20; // Users per institution
      const dataCompleteness = totalMedications > 50 ? 100 : (totalMedications / 50) * 100;
      const systemUptime = 99.9; // Mock uptime

      const calculatedMetrics: SystemMetric[] = [
        {
          name: 'Database Health',
          value: Math.min(databaseHealth, 100),
          status: databaseHealth > 90 ? 'excellent' : databaseHealth > 70 ? 'good' : databaseHealth > 50 ? 'warning' : 'critical',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          ),
          description: `${totalPatients} patients, ${totalInstitutions} institutions`,
        },
        {
          name: 'User Engagement',
          value: Math.min(userEngagement, 100),
          status: userEngagement > 80 ? 'excellent' : userEngagement > 60 ? 'good' : userEngagement > 40 ? 'warning' : 'critical',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
          description: `${totalUsers} active users across system`,
        },
        {
          name: 'Data Completeness',
          value: Math.min(dataCompleteness, 100),
          status: dataCompleteness > 90 ? 'excellent' : dataCompleteness > 70 ? 'good' : dataCompleteness > 50 ? 'warning' : 'critical',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          description: `${totalMedications} medications in database`,
        },
        {
          name: 'System Uptime',
          value: systemUptime,
          status: systemUptime > 99 ? 'excellent' : systemUptime > 95 ? 'good' : systemUptime > 90 ? 'warning' : 'critical',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
          description: 'Last 30 days availability',
        },
      ];

      setMetrics(calculatedMetrics);

      // Calculate overall health
      const avgHealth = calculatedMetrics.reduce((sum, m) => sum + m.value, 0) / calculatedMetrics.length;
      setOverallHealth(
        avgHealth > 90 ? 'excellent' : avgHealth > 70 ? 'good' : avgHealth > 50 ? 'warning' : 'critical'
      );
    } catch (error) {
      console.error('Error loading system metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'good':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'warning':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'good':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'critical':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-white/80 rounded-2xl border-2 border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="backdrop-blur-xl bg-white/80 rounded-2xl border-2 border-slate-200 shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className={`px-6 py-4 border-b-2 ${getStatusColor(overallHealth).replace('text-', 'border-').replace('bg-', '').replace('50', '200')}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${getStatusColor(overallHealth)}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">System Health</h3>
              <p className="text-xs text-slate-500">Real-time monitoring</p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full border-2 font-bold text-sm uppercase tracking-wide ${getStatusColor(overallHealth)}`}>
            {overallHealth}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="p-6 space-y-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-4 rounded-xl border-2 ${getStatusColor(metric.status)} transition-all hover:shadow-md`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getStatusColor(metric.status).replace('bg-', 'bg-gradient-to-br from-').replace('50', '100 to-').replace(' ', '-200 ')}`}>
                  {metric.icon}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{metric.name}</h4>
                  <p className="text-xs text-slate-500">{metric.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(metric.status)}
                <span className="text-2xl font-bold">{metric.value.toFixed(1)}%</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${metric.value}%` }}
                transition={{ duration: 1, delay: index * 0.1 }}
                className={`h-full rounded-full ${getStatusColor(metric.status).replace('text-', 'bg-').replace('bg-', 'bg-gradient-to-r from-').replace('50', '400 to-').replace(' ', '-600 ')}`}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-slate-50 border-t-2 border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
        <button
          onClick={loadSystemMetrics}
          className="flex items-center gap-1 px-3 py-1 bg-white rounded-lg border border-slate-300 hover:border-slate-400 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
    </motion.div>
  );
};

export default SystemHealthPanel;
