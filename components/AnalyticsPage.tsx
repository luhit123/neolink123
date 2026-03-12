import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Patient, Unit } from '../types';
import { DateFilterValue } from './DateFilter';
import DateFilter from './DateFilter';
import UnitSelection from './UnitSelection';
import NicuViewSelection from './NicuViewSelection';
import { IconArrowLeft, IconChartBar, IconTrendingUp, IconCalendarStats, IconReportAnalytics } from '@tabler/icons-react';
import {
  calculatePercentage,
  getCanonicalOutcome,
  getPatientAdmissionDate,
  getPatientDeathDate,
  isPatientActiveDuringRange,
  matchesAdmissionTypeFilter,
  parseAnalyticsDate,
  toAnalyticsPatients,
} from '../utils/analytics';

// Lazy load heavy analytics components - only load when their tab is active
const AdvancedAnalytics = React.lazy(() => import('./AdvancedAnalytics'));
const TimeBasedAnalytics = React.lazy(() => import('./TimeBasedAnalytics'));

interface AnalyticsPageProps {
  institutionId: string;
  selectedUnit: Unit;
  onSelectUnit: (unit: Unit) => void;
  enabledFacilities: Unit[];
  onBack: () => void;
  institutionName?: string;
}

type AnalyticsView = 'overview' | 'trends' | 'mortality' | 'reports';

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  institutionId,
  selectedUnit,
  onSelectUnit,
  enabledFacilities,
  onBack,
  institutionName
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ period: 'This Month' });
  const [nicuView, setNicuView] = useState<'All' | 'Inborn' | 'Outborn'>('All');
  const [activeView, setActiveView] = useState<AnalyticsView>('overview');
  const [institutionShiftStartTime, setInstitutionShiftStartTime] = useState<string>('00:00');

  const normalizedPatients = useMemo(() => toAnalyticsPatients(patients), [patients]);

  // Load institution settings (shift start time)
  useEffect(() => {
    if (!institutionId) return;

    const loadSettings = async () => {
      try {
        const instDoc = await getDoc(doc(db, 'institutions', institutionId));
        if (instDoc.exists()) {
          const data = instDoc.data();
          if (data.shiftStartTime) {
            setInstitutionShiftStartTime(data.shiftStartTime);
          }
        }
      } catch (err) {
        console.error('Error loading institution settings:', err);
      }
    };
    loadSettings();
  }, [institutionId]);

  // Load patients only when analytics page is opened
  useEffect(() => {
    if (!institutionId) {
      setPatients([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('📊 Analytics: Loading patients for institution:', institutionId);

    const patientsRef = collection(db, 'patients');
    const q = query(patientsRef, where('institutionId', '==', institutionId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allPatients = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        } as Patient));

        setPatients(allPatients);
        setLoading(false);
        console.log('📊 Analytics: Loaded', allPatients.length, 'patients');
      },
      (error) => {
        console.error('❌ Analytics: Error loading patients:', error);
        setPatients([]);
        setLoading(false);
      }
    );

    return () => {
      console.log('📊 Analytics: Cleanup - unsubscribing from patients');
      unsubscribe();
    };
  }, [institutionId]);

  const getDateRange = (period: string, customDates?: { startDate?: string; endDate?: string }) => {
    let startDate: Date;
    let endDate: Date;
    const now = new Date();
    const [shiftHour, shiftMinute] = institutionShiftStartTime.split(':').map(Number);

    const periodIsMonth = /\d{4}-\d{2}/.test(period);

    if (periodIsMonth) {
      const [year, month] = period.split('-').map(Number);
      startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      switch (period) {
        case 'Today':
          if (institutionShiftStartTime === '00:00') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          } else {
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            if (currentHour < shiftHour || (currentHour === shiftHour && currentMinute < shiftMinute)) {
              startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, shiftHour, shiftMinute, 0, 0);
            } else {
              startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), shiftHour, shiftMinute, 0, 0);
            }
          }
          endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000 - 1);
          break;
        case 'This Week':
          if (institutionShiftStartTime === '00:00') {
            const day = now.getDay();
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day, 0, 0, 0, 0);
          } else {
            const day = now.getDay();
            startDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
            startDate.setHours(shiftHour, shiftMinute, 0, 0);
          }
          endDate = new Date();
          break;
        case 'This Month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1, shiftHour, shiftMinute, 0, 0);
          endDate = new Date();
          break;
        case 'Custom':
          if (customDates?.startDate && customDates?.endDate) {
            startDate = new Date(customDates.startDate);
            startDate.setHours(shiftHour, shiftMinute, 0, 0);
            endDate = new Date(customDates.endDate);
            endDate.setHours(shiftHour, shiftMinute, 0, 0);
            endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1);
          } else {
            startDate = new Date(0);
            endDate = new Date();
          }
          break;
        default:
          startDate = new Date(0);
          endDate = new Date();
      }
    }

    return { startDate, endDate };
  };

  const baseUnitPatients = useMemo(() => {
    let filtered = normalizedPatients.filter(p => p.unit === selectedUnit);

    if ((selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && nicuView !== 'All') {
      filtered = filtered.filter(p => matchesAdmissionTypeFilter(p, nicuView));
    }

    return filtered;
  }, [normalizedPatients, selectedUnit, nicuView]);

  // Keep analytics operational counts aligned with dashboard/registry:
  // include anyone active during the selected period (overlap), not only admitted within period.
  const unitPatients = useMemo(() => {
    if (dateFilter.period === 'All Time') return baseUnitPatients;

    if (dateFilter.period === 'Custom' && (!dateFilter.startDate || !dateFilter.endDate)) {
      return baseUnitPatients;
    }

    let filtered = baseUnitPatients;

    if (dateFilter.period !== 'All Time') {
      const { startDate, endDate } = getDateRange(dateFilter.period, {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate
      });

      filtered = filtered.filter(p => {
        return isPatientActiveDuringRange(p, { startDate, endDate });
      });
    }

    return filtered;
  }, [baseUnitPatients, dateFilter, institutionShiftStartTime]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = unitPatients.length;
    const deceased = unitPatients.filter(p => getCanonicalOutcome(p) === 'Deceased').length;
    const discharged = unitPatients.filter(p => getCanonicalOutcome(p) === 'Discharged').length;
    const referred = unitPatients.filter(p => getCanonicalOutcome(p) === 'Referred').length;
    const inProgress = unitPatients.filter(p => getCanonicalOutcome(p) === 'In Progress').length;
    let stepDown = 0;
    if (dateFilter.period === 'All Time') {
      stepDown = unitPatients.filter(p => p.stepDownDate).length;
    } else {
      const { startDate, endDate } = getDateRange(dateFilter.period, {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate
      });
      stepDown = unitPatients.filter(p => {
        const d = parseAnalyticsDate(p.stepDownDate);
        return d ? d >= startDate && d <= endDate : false;
      }).length;
    }
    const mortalityRate = calculatePercentage(deceased, total, 1);
    const dischargeRate = calculatePercentage(discharged, total, 1);
    const referralRate = calculatePercentage(referred, total, 1);
    const survivalRate = calculatePercentage(total - deceased, total, 1);

    return { total, deceased, discharged, referred, inProgress, stepDown, mortalityRate, dischargeRate, referralRate, survivalRate };
  }, [unitPatients, dateFilter, institutionShiftStartTime]);

  const viewTabs = [
    { id: 'overview' as const, label: 'Overview', icon: IconChartBar },
    { id: 'trends' as const, label: 'Trends', icon: IconTrendingUp },
    { id: 'mortality' as const, label: 'Mortality', icon: IconCalendarStats },
    { id: 'reports' as const, label: 'Reports', icon: IconReportAnalytics },
  ];

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="sticky top-0 z-40 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                <IconArrowLeft size={22} className="text-slate-600 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Analytics & Insights</h1>
                {institutionName && <p className="text-xs text-slate-500 dark:text-slate-400">{institutionName}</p>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading analytics data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Top Row - Back and Title */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <IconArrowLeft size={22} className="text-slate-600 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Analytics & Insights
                </h1>
                {institutionName && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{institutionName}</p>
                )}
              </div>
            </div>

            {/* Date Filter */}
            <DateFilter onFilterChange={setDateFilter} />
          </div>

          {/* Unit Selection Row */}
          <div className="flex items-center gap-3 flex-wrap">
            <UnitSelection
              selectedUnit={selectedUnit}
              onSelectUnit={onSelectUnit}
              availableUnits={enabledFacilities}
            />
            {selectedUnit === Unit.NICU && (
              <>
                <div className="h-5 w-px bg-slate-300 dark:bg-slate-600"></div>
                <NicuViewSelection selectedView={nicuView} onSelectView={setNicuView} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Summary Bar */}
      <div className="bg-gradient-to-r from-slate-50 via-blue-50/50 to-emerald-50/60 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm md:text-base font-semibold text-slate-800 dark:text-slate-200">Operational Snapshot</h2>
            <span className="text-[10px] md:text-xs font-medium text-slate-500 dark:text-slate-400">{dateFilter.period}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 md:gap-3">
            <div className="text-center p-2.5 rounded-xl bg-white/85 dark:bg-slate-800/60 border border-blue-100 dark:border-blue-800/40 shadow-sm">
              <p className="text-lg md:text-xl font-black text-blue-600 dark:text-blue-400">{stats.total}</p>
              <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400">Total</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-white/85 dark:bg-slate-800/60 border border-emerald-100 dark:border-emerald-800/40 shadow-sm">
              <p className="text-lg md:text-xl font-black text-emerald-600 dark:text-emerald-400">{stats.inProgress}</p>
              <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400">Active</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-white/85 dark:bg-slate-800/60 border border-green-100 dark:border-green-800/40 shadow-sm">
              <p className="text-lg md:text-xl font-black text-green-600 dark:text-green-400">{stats.discharged}</p>
              <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400">Discharged</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-white/85 dark:bg-slate-800/60 border border-amber-100 dark:border-amber-800/40 shadow-sm">
              <p className="text-lg md:text-xl font-black text-amber-600 dark:text-amber-400">{stats.referred}</p>
              <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400">Referred</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-white/85 dark:bg-slate-800/60 border border-sky-100 dark:border-sky-800/40 shadow-sm">
              <p className="text-lg md:text-xl font-black text-sky-600 dark:text-sky-400">{stats.stepDown}</p>
              <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400">Step Down</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-white/85 dark:bg-slate-800/60 border border-red-100 dark:border-red-800/40 shadow-sm">
              <p className="text-lg md:text-xl font-black text-red-600 dark:text-red-400">{stats.deceased}</p>
              <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400">Deaths</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-white/85 dark:bg-slate-800/60 border border-rose-100 dark:border-rose-800/40 shadow-sm">
              <p className="text-lg md:text-xl font-black text-rose-600 dark:text-rose-400">{stats.mortalityRate.toFixed(1)}%</p>
              <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400">Mortality</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-white/85 dark:bg-slate-800/60 border border-teal-100 dark:border-teal-800/40 shadow-sm">
              <p className="text-lg md:text-xl font-black text-teal-600 dark:text-teal-400">{stats.survivalRate.toFixed(1)}%</p>
              <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400">Survival</p>
            </div>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {viewTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeView === tab.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 pb-24">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeView === 'overview' && (
            <React.Suspense fallback={
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3"></div>
                  <p className="text-sm text-slate-500">Loading analytics...</p>
                </div>
              </div>
            }>
              <AdvancedAnalytics
                patients={unitPatients}
                selectedUnit={selectedUnit}
                dateFilter={dateFilter}
              />
            </React.Suspense>
          )}

          {activeView === 'trends' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <IconTrendingUp size={24} className="text-blue-500" />
                Time-Based Trends
              </h2>
              <React.Suspense fallback={
                <div className="flex items-center justify-center min-h-[30vh]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              }>
                <TimeBasedAnalytics
                  patients={unitPatients}
                  period={dateFilter.period}
                  startDate={dateFilter.startDate}
                  endDate={dateFilter.endDate}
                />
              </React.Suspense>
            </div>
          )}

          {activeView === 'mortality' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  <IconCalendarStats size={24} className="text-red-500" />
                  Mortality Analysis
                </h2>

                {/* Mortality Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 rounded-xl p-4 border border-red-200 dark:border-red-800/50">
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.deceased}</p>
                    <p className="text-sm text-red-700 dark:text-red-300">Total Deaths</p>
                  </div>
                  <div className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/30 dark:to-rose-800/20 rounded-xl p-4 border border-rose-200 dark:border-rose-800/50">
                    <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{stats.mortalityRate.toFixed(1)}%</p>
                    <p className="text-sm text-rose-700 dark:text-rose-300">Mortality Rate</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800/50">
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">Total Admitted</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-800/50">
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.survivalRate.toFixed(1)}%</p>
                    <p className="text-sm text-green-700 dark:text-green-300">Survival Rate</p>
                  </div>
                </div>

                <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                  stats.total === 0
                    ? 'bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                    : stats.deceased === 0
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200'
                    : 'bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                }`}>
                  <p className="font-semibold">
                    {stats.total === 0
                      ? 'No admissions in current filters.'
                      : stats.deceased === 0
                        ? 'No deaths detected in current filters.'
                        : 'Survival and mortality are filter-based metrics.'}
                  </p>
                  <p className="text-xs mt-1">
                    {stats.total === 0
                      ? 'Adjust date/unit filters to see mortality and survival rates.'
                      : `Current calculation: Survival = (${stats.total} - ${stats.deceased}) / ${stats.total} = ${stats.survivalRate.toFixed(1)}%`}
                  </p>
                </div>

                {/* Deceased Patients List */}
                {stats.deceased > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Recent Deaths</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {unitPatients
                        .filter(p => getCanonicalOutcome(p) === 'Deceased')
                        .sort((a, b) => {
                          const dateA = getPatientDeathDate(a)?.getTime() || 0;
                          const dateB = getPatientDeathDate(b)?.getTime() || 0;
                          return dateB - dateA;
                        })
                        .slice(0, 10)
                        .map((patient, index) => (
                          <div key={patient.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-slate-500 w-6">{index + 1}</span>
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{patient.name}</p>
                                <p className="text-xs text-slate-500">
                                  {patient.age} {patient.ageUnit} | {patient.gender}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500">
                                {getPatientDeathDate(patient)?.toLocaleDateString() || 'N/A'}
                              </p>
                              {patient.diagnosisAtDeath && (
                                <p className="text-xs text-red-500 max-w-48 truncate">{patient.diagnosisAtDeath}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === 'reports' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <IconReportAnalytics size={24} className="text-purple-500" />
                Analytics Reports
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Summary Report Card */}
                <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800/50">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Summary Statistics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Total Admitted</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{stats.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Currently Active</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{stats.inProgress}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Discharged</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">{stats.discharged}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Referred Out</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">{stats.referred}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Step Down</span>
                      <span className="font-semibold text-sky-600 dark:text-sky-400">{stats.stepDown}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-700">
                      <span className="text-slate-600 dark:text-slate-400">Deceased</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">{stats.deceased}</span>
                    </div>
                  </div>
                </div>

                {/* Rates Report Card */}
                <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800/50">
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">Key Rates</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600 dark:text-slate-400">Discharge Rate</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {stats.dischargeRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${stats.dischargeRate}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600 dark:text-slate-400">Referral Rate</span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {stats.referralRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${stats.referralRate}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600 dark:text-slate-400">Mortality Rate</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">{stats.mortalityRate.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full transition-all"
                          style={{ width: `${stats.mortalityRate}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600 dark:text-slate-400">Survival Rate</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {stats.survivalRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${stats.survivalRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
