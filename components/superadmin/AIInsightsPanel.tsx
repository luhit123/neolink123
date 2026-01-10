import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

interface AIInsight {
  id: string;
  type: 'success' | 'warning' | 'info' | 'critical';
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon: React.ReactNode;
  priority: number;
}

const AIInsightsPanel: React.FC = () => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateInsights();
  }, []);

  const generateInsights = async () => {
    try {
      const [patientsSnap, institutionsSnap, usersSnap, medicationsSnap] = await Promise.all([
        getDocs(collection(db, 'patients')),
        getDocs(collection(db, 'institutions')),
        getDocs(collection(db, 'approved_users')),
        getDocs(collection(db, 'medications')),
      ]);

      const patients = patientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const institutions = institutionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const medications = medicationsSnap.size;

      const generatedInsights: AIInsight[] = [];

      // Insight 1: Active patients trend
      const activePatients = patients.filter((p: any) => p.outcome === 'In Progress').length;
      const totalPatients = patients.length;
      const activePercentage = totalPatients > 0 ? (activePatients / totalPatients) * 100 : 0;

      if (activePercentage > 70) {
        generatedInsights.push({
          id: 'active-patients-high',
          type: 'warning',
          title: 'High Patient Load Detected',
          description: `${activePercentage.toFixed(1)}% of patients are currently in progress. Consider resource allocation and bed management.`,
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          priority: 1,
        });
      }

      // Insight 2: Institution performance
      const institutionPerformance = institutions.map((inst: any) => {
        const instPatients = patients.filter((p: any) => p.institutionId === inst.id);
        const instActive = instPatients.filter((p: any) => p.outcome === 'In Progress').length;
        return {
          name: inst.name,
          total: instPatients.length,
          active: instActive,
        };
      }).sort((a, b) => b.active - a.active);

      if (institutionPerformance.length > 0 && institutionPerformance[0].active > 20) {
        generatedInsights.push({
          id: 'institution-capacity',
          type: 'info',
          title: 'Top Performing Institution',
          description: `${institutionPerformance[0].name} is managing ${institutionPerformance[0].active} active patients. Excellent capacity management!`,
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          ),
          priority: 3,
        });
      }

      // Insight 3: User engagement
      const avgUsersPerInst = users.length / Math.max(institutions.length, 1);
      if (avgUsersPerInst < 3) {
        generatedInsights.push({
          id: 'user-engagement-low',
          type: 'warning',
          title: 'Low User Engagement',
          description: `Average of ${avgUsersPerInst.toFixed(1)} users per institution. Consider onboarding more staff members.`,
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
          priority: 2,
        });
      }

      // Insight 4: Medication database
      if (medications < 50) {
        generatedInsights.push({
          id: 'medications-low',
          type: 'critical',
          title: 'Medication Database Needs Attention',
          description: `Only ${medications} medications in database. Seed with 100+ NICU/PICU medications for better clinical support.`,
          action: {
            label: 'Seed Database',
            onClick: () => {
              // Navigate to medications tab
              console.log('Navigate to medications tab');
            },
          },
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          ),
          priority: 1,
        });
      } else {
        generatedInsights.push({
          id: 'medications-good',
          type: 'success',
          title: 'Medication Database Complete',
          description: `${medications} medications available. Clinicians have comprehensive drug reference for clinical decisions.`,
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          priority: 4,
        });
      }

      // Insight 5: System growth
      const last7DaysPatients = patients.filter((p: any) => {
        const admissionDate = new Date(p.admissionDate);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return admissionDate >= sevenDaysAgo;
      }).length;

      if (last7DaysPatients > 10) {
        generatedInsights.push({
          id: 'growth-trend',
          type: 'success',
          title: 'Strong Growth Detected',
          description: `${last7DaysPatients} new patients admitted in the last 7 days. System adoption is accelerating!`,
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          ),
          priority: 3,
        });
      }

      // Sort by priority
      generatedInsights.sort((a, b) => a.priority - b.priority);

      setInsights(generatedInsights);
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-700',
          icon: 'text-green-600',
          badge: 'bg-green-100 text-green-700',
        };
      case 'warning':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-700',
          icon: 'text-orange-600',
          badge: 'bg-orange-100 text-orange-700',
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-700',
          icon: 'text-blue-600',
          badge: 'bg-blue-100 text-blue-700',
        };
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          icon: 'text-red-600',
          badge: 'bg-red-100 text-red-700',
        };
      default:
        return {
          bg: 'bg-slate-50',
          border: 'border-slate-200',
          text: 'text-slate-700',
          icon: 'text-slate-600',
          badge: 'bg-slate-100 text-slate-700',
        };
    }
  };

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-white/80 rounded-2xl border-2 border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/2"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-slate-200 rounded"></div>
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
      <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b-2 border-purple-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              AI-Powered Insights
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-bold">
                BETA
              </span>
            </h3>
            <p className="text-xs text-slate-500">Intelligent recommendations based on system data</p>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="p-6 space-y-4">
        {insights.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-slate-500 font-semibold">All systems optimal!</p>
            <p className="text-slate-400 text-sm">No critical insights at this time</p>
          </div>
        ) : (
          insights.map((insight, index) => {
            const styles = getTypeStyles(insight.type);
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-xl border-2 ${styles.bg} ${styles.border} transition-all hover:shadow-lg`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${styles.badge}`}>
                    {insight.icon}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold text-slate-900">{insight.title}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${styles.badge}`}>
                        {insight.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{insight.description}</p>

                    {insight.action && (
                      <button
                        onClick={insight.action.onClick}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${styles.badge} hover:shadow-md`}
                      >
                        {insight.action.label}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-slate-50 border-t-2 border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <span>AI analysis updated in real-time</span>
        <button
          onClick={generateInsights}
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

export default AIInsightsPanel;
