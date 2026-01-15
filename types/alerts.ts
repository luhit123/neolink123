/**
 * Clinical Alert Type Definitions
 * Types for real-time clinical alerts and notifications
 */

import { VitalSigns } from '../types';

// Alert Severity Levels
export enum AlertSeverity {
  INFO = 'info',           // Blue - informational, no action required
  WARNING = 'warning',     // Amber - requires attention soon
  CRITICAL = 'critical',   // Red - requires immediate attention
  EMERGENCY = 'emergency'  // Pulsing red - life-threatening, immediate action
}

// Alert Types
export enum AlertType {
  VITAL_ABNORMAL = 'vital_abnormal',           // Out of range vital sign
  DRUG_INTERACTION = 'drug_interaction',       // Medication conflict
  DETERIORATION = 'deterioration',             // Worsening clinical trend
  DOSING_ERROR = 'dosing_error',               // Weight/age inappropriate dose
  MISSING_FOLLOWUP = 'missing_followup',       // Overdue clinical check
  PROTOCOL_DEVIATION = 'protocol_deviation',   // Care deviates from guidelines
  CRITICAL_FINDING = 'critical_finding',       // AI detected critical issue
  SEPSIS_RISK = 'sepsis_risk',                 // Sepsis early warning
  RESPIRATORY_DISTRESS = 'respiratory_distress' // Respiratory deterioration
}

// Main Alert Interface
export interface ClinicalAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendation?: string;
  timestamp: string;

  // Context
  patientId?: string;
  patientName?: string;
  institutionId?: string;

  // Trigger details
  triggerVital?: keyof VitalSigns;
  triggerValue?: string | number;
  expectedRange?: { min: number; max: number };
  relatedMedications?: string[];

  // Status
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: string;
  dismissed: boolean;
  dismissedAt?: string;

  // AI metadata
  aiGenerated: boolean;
  aiConfidence?: number;
  aiModel?: 'medgemma' | 'gemini';

  // Additional context
  metadata?: Record<string, any>;
}

// Alert Threshold Configuration
export interface AlertThreshold {
  vital: keyof VitalSigns;
  condition: 'above' | 'below' | 'outside_range';
  value: number | [number, number]; // Single value or [min, max] range
  severity: AlertSeverity;
  message: string;
  recommendation?: string;
}

// Age-specific vital ranges for alert detection
export interface AgeSpecificVitalRanges {
  ageGroup: 'preterm' | 'newborn' | 'infant' | 'toddler' | 'child';
  ageRangeDescription: string;
  ranges: {
    temperature: { min: number; max: number; criticalMin: number; criticalMax: number };
    hr: { min: number; max: number; criticalMin: number; criticalMax: number };
    rr: { min: number; max: number; criticalMin: number; criticalMax: number };
    spo2: { min: number; criticalMin: number };
    bp_systolic?: { min: number; max: number };
    bp_diastolic?: { min: number; max: number };
    crt: { max: number; criticalMax: number };
  };
}

// Predefined age-specific vital ranges for NICU/PICU
export const NEONATAL_VITAL_RANGES: AgeSpecificVitalRanges[] = [
  {
    ageGroup: 'preterm',
    ageRangeDescription: 'Preterm (<37 weeks)',
    ranges: {
      temperature: { min: 36.5, max: 37.5, criticalMin: 35.5, criticalMax: 38.5 },
      hr: { min: 120, max: 170, criticalMin: 100, criticalMax: 200 },
      rr: { min: 40, max: 60, criticalMin: 30, criticalMax: 80 },
      spo2: { min: 90, criticalMin: 85 },
      crt: { max: 3, criticalMax: 5 }
    }
  },
  {
    ageGroup: 'newborn',
    ageRangeDescription: 'Newborn (0-28 days)',
    ranges: {
      temperature: { min: 36.5, max: 37.5, criticalMin: 35.5, criticalMax: 38.5 },
      hr: { min: 100, max: 160, criticalMin: 80, criticalMax: 200 },
      rr: { min: 30, max: 60, criticalMin: 20, criticalMax: 70 },
      spo2: { min: 92, criticalMin: 88 },
      crt: { max: 3, criticalMax: 5 }
    }
  },
  {
    ageGroup: 'infant',
    ageRangeDescription: 'Infant (1-12 months)',
    ranges: {
      temperature: { min: 36.5, max: 37.5, criticalMin: 35.5, criticalMax: 39 },
      hr: { min: 80, max: 140, criticalMin: 60, criticalMax: 180 },
      rr: { min: 25, max: 50, criticalMin: 15, criticalMax: 60 },
      spo2: { min: 94, criticalMin: 90 },
      bp_systolic: { min: 70, max: 100 },
      crt: { max: 2, criticalMax: 4 }
    }
  },
  {
    ageGroup: 'toddler',
    ageRangeDescription: 'Toddler (1-3 years)',
    ranges: {
      temperature: { min: 36.5, max: 37.5, criticalMin: 35.5, criticalMax: 39.5 },
      hr: { min: 70, max: 120, criticalMin: 50, criticalMax: 160 },
      rr: { min: 20, max: 40, criticalMin: 12, criticalMax: 50 },
      spo2: { min: 95, criticalMin: 92 },
      bp_systolic: { min: 80, max: 110 },
      crt: { max: 2, criticalMax: 4 }
    }
  },
  {
    ageGroup: 'child',
    ageRangeDescription: 'Child (3-12 years)',
    ranges: {
      temperature: { min: 36.5, max: 37.5, criticalMin: 35, criticalMax: 40 },
      hr: { min: 60, max: 100, criticalMin: 40, criticalMax: 140 },
      rr: { min: 16, max: 30, criticalMin: 10, criticalMax: 40 },
      spo2: { min: 96, criticalMin: 93 },
      bp_systolic: { min: 90, max: 120 },
      crt: { max: 2, criticalMax: 3 }
    }
  }
];

// Drug Interaction Alert
export interface DrugInteractionAlert extends ClinicalAlert {
  drug1: string;
  drug2: string;
  interactionType: 'contraindicated' | 'major' | 'moderate' | 'minor';
  clinicalEffect: string;
}

// Deterioration Alert
export interface DeteriorationAlert extends ClinicalAlert {
  affectedVitals: string[];
  trendDirection: 'worsening' | 'fluctuating';
  trendDuration: string; // e.g., "last 6 hours"
  previousValues: { vital: string; value: string; timestamp: string }[];
  currentValues: { vital: string; value: string; timestamp: string }[];
}

// Alert History Entry (for audit)
export interface AlertHistoryEntry {
  alertId: string;
  action: 'created' | 'acknowledged' | 'dismissed' | 'escalated';
  timestamp: string;
  userId: string;
  userName: string;
  notes?: string;
}

// Alert Statistics (for dashboard)
export interface AlertStatistics {
  totalAlerts: number;
  byType: Record<AlertType, number>;
  bySeverity: Record<AlertSeverity, number>;
  acknowledgedCount: number;
  avgAcknowledgmentTime: number; // in seconds
  topTriggers: { trigger: string; count: number }[];
}

// Alert Configuration (per institution)
export interface AlertConfiguration {
  institutionId: string;
  enabled: boolean;
  customThresholds: AlertThreshold[];
  notificationPreferences: {
    showBanner: boolean;
    playSound: boolean;
    sendNotification: boolean;
  };
  autoAcknowledgeAfter?: number; // minutes
  escalationRules?: EscalationRule[];
}

export interface EscalationRule {
  afterMinutes: number;
  escalateTo: string; // role or user
  notifyMethod: 'inApp' | 'email' | 'sms';
}

// Helper function to get vital ranges by age
export function getVitalRangesByAge(age: number, ageUnit: string): AgeSpecificVitalRanges {
  // Convert to days for comparison
  let ageInDays = age;
  if (ageUnit === 'weeks') ageInDays = age * 7;
  else if (ageUnit === 'months') ageInDays = age * 30;
  else if (ageUnit === 'years') ageInDays = age * 365;

  if (ageInDays < 0) return NEONATAL_VITAL_RANGES[0]; // preterm
  if (ageInDays <= 28) return NEONATAL_VITAL_RANGES[1]; // newborn
  if (ageInDays <= 365) return NEONATAL_VITAL_RANGES[2]; // infant
  if (ageInDays <= 1095) return NEONATAL_VITAL_RANGES[3]; // toddler (1-3 years)
  return NEONATAL_VITAL_RANGES[4]; // child
}

// Helper to determine alert severity based on vital value
export function getVitalAlertSeverity(
  vital: keyof VitalSigns,
  value: number,
  ranges: AgeSpecificVitalRanges['ranges']
): AlertSeverity | null {
  const range = ranges[vital as keyof typeof ranges];
  if (!range) return null;

  // Check for critical levels first
  if ('criticalMin' in range && value < range.criticalMin) return AlertSeverity.CRITICAL;
  if ('criticalMax' in range && value > range.criticalMax) return AlertSeverity.CRITICAL;

  // Check for warning levels
  if ('min' in range && value < range.min) return AlertSeverity.WARNING;
  if ('max' in range && value > range.max) return AlertSeverity.WARNING;

  return null; // Within normal range
}
