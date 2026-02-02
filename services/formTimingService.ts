/**
 * Form Timing Service
 * Tracks and stores form completion times for research and analytics
 */

import { collection, addDoc, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface FormTimingRecord {
  id?: string;
  // Form identification
  formType: 'admission' | 'clinical_note' | 'discharge' | 'observation';
  patientId?: string;
  patientName?: string;
  patientNtid?: string;

  // Institution info
  institutionId: string;
  institutionName: string;

  // User info
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;

  // Timing data
  startTime: string; // ISO string
  endTime: string; // ISO string
  durationSeconds: number;
  durationFormatted: string;

  // Context
  unit?: string; // NICU, PICU, etc.
  isEdit: boolean; // Was this editing an existing record?
  fieldsCompleted?: number; // Approximate number of fields filled

  // Metadata
  createdAt: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';

  // Performance category
  performanceCategory: 'lightning' | 'fast' | 'normal' | 'thorough' | 'detailed';
}

export interface TimingAnalytics {
  totalEntries: number;
  averageDuration: number;
  fastestEntry: number;
  slowestEntry: number;
  byFormType: Record<string, { count: number; avgDuration: number }>;
  byUser: Record<string, { count: number; avgDuration: number }>;
  byTimeOfDay: Record<string, number>;
  performanceDistribution: Record<string, number>;
}

/**
 * Get performance category based on duration
 */
export function getPerformanceCategory(seconds: number): FormTimingRecord['performanceCategory'] {
  if (seconds < 60) return 'lightning';
  if (seconds < 180) return 'fast';
  if (seconds < 300) return 'normal';
  if (seconds < 600) return 'thorough';
  return 'detailed';
}

/**
 * Format duration to human readable string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Detect device type
 */
export function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Save form timing record
 */
export async function saveFormTiming(record: Omit<FormTimingRecord, 'id' | 'createdAt' | 'performanceCategory' | 'durationFormatted' | 'deviceType'>): Promise<string | null> {
  try {
    const fullRecord: Omit<FormTimingRecord, 'id'> = {
      ...record,
      createdAt: new Date().toISOString(),
      performanceCategory: getPerformanceCategory(record.durationSeconds),
      durationFormatted: formatDuration(record.durationSeconds),
      deviceType: detectDeviceType()
    };

    const timingRef = collection(db, 'formTimings');
    const docRef = await addDoc(timingRef, fullRecord);

    console.log('⏱️ Form timing saved:', fullRecord.durationFormatted, '-', fullRecord.performanceCategory);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error saving form timing:', error);
    return null;
  }
}

/**
 * Get timing records for an institution
 */
export async function getInstitutionTimings(
  institutionId: string,
  formType?: FormTimingRecord['formType'],
  limitCount: number = 100
): Promise<FormTimingRecord[]> {
  try {
    const timingRef = collection(db, 'formTimings');
    let q = query(
      timingRef,
      where('institutionId', '==', institutionId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    let records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as FormTimingRecord));

    // Filter by form type if specified
    if (formType) {
      records = records.filter(r => r.formType === formType);
    }

    return records;
  } catch (error) {
    console.error('❌ Error fetching timings:', error);
    return [];
  }
}

/**
 * Get timing analytics for an institution
 */
export async function getTimingAnalytics(institutionId: string): Promise<TimingAnalytics | null> {
  try {
    const records = await getInstitutionTimings(institutionId, undefined, 500);

    if (records.length === 0) {
      return null;
    }

    const analytics: TimingAnalytics = {
      totalEntries: records.length,
      averageDuration: 0,
      fastestEntry: Infinity,
      slowestEntry: 0,
      byFormType: {},
      byUser: {},
      byTimeOfDay: {},
      performanceDistribution: {
        lightning: 0,
        fast: 0,
        normal: 0,
        thorough: 0,
        detailed: 0
      }
    };

    let totalDuration = 0;

    for (const record of records) {
      totalDuration += record.durationSeconds;
      analytics.fastestEntry = Math.min(analytics.fastestEntry, record.durationSeconds);
      analytics.slowestEntry = Math.max(analytics.slowestEntry, record.durationSeconds);

      // By form type
      if (!analytics.byFormType[record.formType]) {
        analytics.byFormType[record.formType] = { count: 0, avgDuration: 0 };
      }
      analytics.byFormType[record.formType].count++;
      analytics.byFormType[record.formType].avgDuration += record.durationSeconds;

      // By user
      const userKey = record.userEmail;
      if (!analytics.byUser[userKey]) {
        analytics.byUser[userKey] = { count: 0, avgDuration: 0 };
      }
      analytics.byUser[userKey].count++;
      analytics.byUser[userKey].avgDuration += record.durationSeconds;

      // By time of day
      const hour = new Date(record.startTime).getHours();
      const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
      analytics.byTimeOfDay[timeSlot] = (analytics.byTimeOfDay[timeSlot] || 0) + 1;

      // Performance distribution
      analytics.performanceDistribution[record.performanceCategory]++;
    }

    // Calculate averages
    analytics.averageDuration = Math.round(totalDuration / records.length);

    for (const formType of Object.keys(analytics.byFormType)) {
      analytics.byFormType[formType].avgDuration = Math.round(
        analytics.byFormType[formType].avgDuration / analytics.byFormType[formType].count
      );
    }

    for (const user of Object.keys(analytics.byUser)) {
      analytics.byUser[user].avgDuration = Math.round(
        analytics.byUser[user].avgDuration / analytics.byUser[user].count
      );
    }

    return analytics;
  } catch (error) {
    console.error('❌ Error calculating analytics:', error);
    return null;
  }
}

/**
 * Get user's personal timing stats
 */
export async function getUserTimingStats(userEmail: string, institutionId: string): Promise<{
  totalEntries: number;
  averageDuration: number;
  bestTime: number;
  recentTrend: 'improving' | 'stable' | 'slowing';
} | null> {
  try {
    const timingRef = collection(db, 'formTimings');
    const q = query(
      timingRef,
      where('institutionId', '==', institutionId),
      where('userEmail', '==', userEmail),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(doc => doc.data() as FormTimingRecord);

    if (records.length === 0) return null;

    const totalDuration = records.reduce((sum, r) => sum + r.durationSeconds, 0);
    const avgDuration = Math.round(totalDuration / records.length);
    const bestTime = Math.min(...records.map(r => r.durationSeconds));

    // Calculate trend (compare last 5 vs previous 5)
    let trend: 'improving' | 'stable' | 'slowing' = 'stable';
    if (records.length >= 10) {
      const recent5 = records.slice(0, 5);
      const previous5 = records.slice(5, 10);
      const recentAvg = recent5.reduce((sum, r) => sum + r.durationSeconds, 0) / 5;
      const previousAvg = previous5.reduce((sum, r) => sum + r.durationSeconds, 0) / 5;

      if (recentAvg < previousAvg * 0.9) trend = 'improving';
      else if (recentAvg > previousAvg * 1.1) trend = 'slowing';
    }

    return {
      totalEntries: records.length,
      averageDuration: avgDuration,
      bestTime,
      recentTrend: trend
    };
  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    return null;
  }
}
