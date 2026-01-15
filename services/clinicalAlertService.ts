/**
 * Clinical Alert Service
 * Real-time detection of clinical alerts including vital abnormalities,
 * drug interactions, and clinical deterioration patterns
 */

import {
  ClinicalAlert,
  AlertSeverity,
  AlertType,
  AlertStatistics,
  getVitalRangesByAge,
  getVitalAlertSeverity,
  AgeSpecificVitalRanges
} from '../types/alerts';
import { AIClinicalAlert, PatientContext } from '../types/medgemma';
import { VitalSigns, Patient, Medication, ProgressNote } from '../types';
import { aiProvider } from './aiProviderService';
import { v4 as uuidv4 } from 'uuid';

// In-memory alert store (can be persisted to Firestore)
const activeAlerts: Map<string, ClinicalAlert> = new Map();
const alertHistory: ClinicalAlert[] = [];

// Alert listeners for real-time UI updates
type AlertListener = (alert: ClinicalAlert) => void;
const alertListeners: Set<AlertListener> = new Set();

/**
 * Subscribe to alert events
 */
export const subscribeToAlerts = (listener: AlertListener): (() => void) => {
  alertListeners.add(listener);
  return () => alertListeners.delete(listener);
};

/**
 * Notify all listeners of a new alert
 */
const notifyListeners = (alert: ClinicalAlert): void => {
  alertListeners.forEach(listener => {
    try {
      listener(alert);
    } catch (error) {
      console.error('Alert listener error:', error);
    }
  });
};

/**
 * Generate unique alert ID
 */
const generateAlertId = (): string => {
  return `alert_${uuidv4()}`;
};

/**
 * Create a clinical alert
 */
const createAlert = (
  type: AlertType,
  severity: AlertSeverity,
  title: string,
  message: string,
  options: Partial<ClinicalAlert> = {}
): ClinicalAlert => {
  const alert: ClinicalAlert = {
    id: generateAlertId(),
    type,
    severity,
    title,
    message,
    timestamp: new Date().toISOString(),
    acknowledged: false,
    dismissed: false,
    aiGenerated: options.aiGenerated || false,
    ...options
  };

  // Store alert
  activeAlerts.set(alert.id, alert);
  alertHistory.push(alert);

  // Notify listeners
  notifyListeners(alert);

  console.log(`[ClinicalAlert] ${severity.toUpperCase()}: ${title}`);

  return alert;
};

/**
 * Check vitals for abnormalities based on patient age
 */
export const checkVitalsOnEntry = async (
  vitals: VitalSigns,
  patient: Patient
): Promise<ClinicalAlert[]> => {
  const alerts: ClinicalAlert[] = [];

  // Get age-specific ranges
  const ranges = getVitalRangesByAge(patient.age, patient.ageUnit);

  // Check each vital sign
  const vitalChecks: { key: keyof VitalSigns; label: string; unit: string }[] = [
    { key: 'temperature', label: 'Temperature', unit: '°C' },
    { key: 'hr', label: 'Heart Rate', unit: 'bpm' },
    { key: 'rr', label: 'Respiratory Rate', unit: '/min' },
    { key: 'spo2', label: 'SpO2', unit: '%' },
    { key: 'crt', label: 'CRT', unit: 'sec' }
  ];

  for (const check of vitalChecks) {
    const value = vitals[check.key];
    if (value === undefined || value === null || value === '') continue;

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) continue;

    const severity = getVitalAlertSeverity(check.key, numValue, ranges.ranges);

    if (severity) {
      const range = ranges.ranges[check.key as keyof typeof ranges.ranges];
      const expectedRange = range ? { min: (range as any).min || 0, max: (range as any).max || 999 } : undefined;

      const alert = createAlert(
        AlertType.VITAL_ABNORMAL,
        severity === AlertSeverity.CRITICAL ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        `Abnormal ${check.label}`,
        `${check.label} of ${numValue}${check.unit} is ${severity === AlertSeverity.CRITICAL ? 'critically ' : ''}outside normal range for ${ranges.ageRangeDescription}`,
        {
          patientId: patient.id,
          patientName: patient.name,
          triggerVital: check.key,
          triggerValue: numValue,
          expectedRange,
          recommendation: getVitalRecommendation(check.key, numValue, severity, ranges)
        }
      );

      alerts.push(alert);
    }
  }

  // Check blood pressure if available
  if (vitals.bp) {
    const bpMatch = vitals.bp.match(/(\d+)\/(\d+)/);
    if (bpMatch) {
      const systolic = parseInt(bpMatch[1]);
      const diastolic = parseInt(bpMatch[2]);

      // Check against age-specific BP ranges if available
      const bpRange = ranges.ranges.bp_systolic;
      if (bpRange && (systolic < bpRange.min || systolic > bpRange.max)) {
        const alert = createAlert(
          AlertType.VITAL_ABNORMAL,
          AlertSeverity.WARNING,
          'Abnormal Blood Pressure',
          `Systolic BP of ${systolic}mmHg is outside normal range (${bpRange.min}-${bpRange.max}) for ${ranges.ageRangeDescription}`,
          {
            patientId: patient.id,
            patientName: patient.name,
            triggerVital: 'bp',
            triggerValue: vitals.bp
          }
        );
        alerts.push(alert);
      }
    }
  }

  return alerts;
};

/**
 * Get recommendation based on vital abnormality
 */
const getVitalRecommendation = (
  vital: keyof VitalSigns,
  value: number,
  severity: AlertSeverity,
  ranges: AgeSpecificVitalRanges
): string => {
  const recommendations: Record<string, { high: string; low: string; critical: string }> = {
    temperature: {
      high: 'Consider antipyretics, ensure hydration, investigate source of fever',
      low: 'Warm baby, check for sepsis signs, ensure adequate clothing/incubator temperature',
      critical: 'Immediate intervention required. Possible sepsis workup if fever, active warming if hypothermic'
    },
    hr: {
      high: 'Assess for pain, fever, dehydration, or sepsis. Consider cardiac evaluation if persistent',
      low: 'Check for apnea, assess circulation, consider cardiac monitoring',
      critical: 'Immediate cardiac assessment required. Consider resuscitation protocols'
    },
    rr: {
      high: 'Assess respiratory effort, check for distress signs, consider chest X-ray',
      low: 'Stimulate baby, assess for apnea, consider respiratory support',
      critical: 'Immediate respiratory assessment. Consider oxygen/ventilation support'
    },
    spo2: {
      high: 'Review oxygen delivery, may need to reduce FiO2',
      low: 'Increase oxygen support, assess airway, consider escalation of respiratory care',
      critical: 'Immediate respiratory intervention. Check airway, increase oxygen, consider intubation'
    },
    crt: {
      high: 'Assess perfusion, check for dehydration or shock',
      low: 'Normal perfusion',
      critical: 'Signs of poor perfusion. Consider fluid bolus, assess for shock'
    }
  };

  const rec = recommendations[vital];
  if (!rec) return 'Monitor closely and reassess';

  if (severity === AlertSeverity.CRITICAL) return rec.critical;

  const range = ranges.ranges[vital as keyof typeof ranges.ranges];
  if (!range) return 'Monitor closely';

  const isHigh = 'max' in range && value > range.max;
  return isHigh ? rec.high : rec.low;
};

/**
 * Check for medication interactions
 */
export const checkMedicationInteractions = async (
  medications: Medication[],
  patient: Patient
): Promise<ClinicalAlert[]> => {
  if (medications.length < 2) return [];

  const alerts: ClinicalAlert[] = [];

  // Use AI provider to check interactions
  try {
    const context: PatientContext = {
      age: patient.age,
      ageUnit: patient.ageUnit,
      gender: patient.gender,
      weight: patient.birthWeight || patient.weightOnAdmission,
      diagnosis: patient.diagnosis,
      unit: patient.unit || 'NICU',
      currentMedications: medications
    };

    const aiAlerts = await aiProvider.checkMedicationInteractions(medications, context);

    for (const aiAlert of aiAlerts) {
      const alert = createAlert(
        AlertType.DRUG_INTERACTION,
        aiAlert.severity === 'critical' ? AlertSeverity.CRITICAL :
          aiAlert.severity === 'warning' ? AlertSeverity.WARNING : AlertSeverity.INFO,
        aiAlert.title,
        aiAlert.message,
        {
          patientId: patient.id,
          patientName: patient.name,
          relatedMedications: aiAlert.relatedMedications,
          recommendation: aiAlert.recommendation,
          aiGenerated: true,
          aiConfidence: aiAlert.confidence,
          aiModel: 'medgemma'
        }
      );
      alerts.push(alert);
    }
  } catch (error) {
    console.warn('AI medication interaction check failed:', error);
    // Fall back to basic interaction checking
    alerts.push(...checkBasicInteractions(medications, patient));
  }

  return alerts;
};

/**
 * Basic drug interaction checking (fallback)
 */
const checkBasicInteractions = (medications: Medication[], patient: Patient): ClinicalAlert[] => {
  const alerts: ClinicalAlert[] = [];

  // Common neonatal drug interactions
  const knownInteractions: { drugs: [string, string]; severity: AlertSeverity; message: string }[] = [
    {
      drugs: ['aminophylline', 'caffeine'],
      severity: AlertSeverity.WARNING,
      message: 'Both are methylxanthines - may cause additive CNS stimulation and tachycardia'
    },
    {
      drugs: ['gentamicin', 'furosemide'],
      severity: AlertSeverity.WARNING,
      message: 'Increased risk of ototoxicity and nephrotoxicity'
    },
    {
      drugs: ['vancomycin', 'gentamicin'],
      severity: AlertSeverity.WARNING,
      message: 'Increased risk of nephrotoxicity - monitor renal function closely'
    },
    {
      drugs: ['phenobarbital', 'phenytoin'],
      severity: AlertSeverity.WARNING,
      message: 'Both CNS depressants - may cause excessive sedation'
    },
    {
      drugs: ['indomethacin', 'ibuprofen'],
      severity: AlertSeverity.CRITICAL,
      message: 'Do not use together - both are NSAIDs for PDA closure'
    }
  ];

  const medNames = medications.map(m => m.name.toLowerCase());

  for (const interaction of knownInteractions) {
    const [drug1, drug2] = interaction.drugs;
    if (medNames.some(m => m.includes(drug1)) && medNames.some(m => m.includes(drug2))) {
      alerts.push(createAlert(
        AlertType.DRUG_INTERACTION,
        interaction.severity,
        `Drug Interaction: ${drug1} + ${drug2}`,
        interaction.message,
        {
          patientId: patient.id,
          patientName: patient.name,
          relatedMedications: [drug1, drug2]
        }
      ));
    }
  }

  return alerts;
};

/**
 * Detect clinical deterioration from progress notes
 */
export const detectDeterioration = async (
  patient: Patient,
  recentNotes: ProgressNote[]
): Promise<ClinicalAlert[]> => {
  const alerts: ClinicalAlert[] = [];

  if (recentNotes.length < 2) return alerts;

  // Sort notes by date (newest first)
  const sortedNotes = [...recentNotes].sort((a, b) =>
    new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime()
  );

  // Compare recent vitals for trends
  const recentVitals = sortedNotes.slice(0, 5).map(note => note.vitals).filter(Boolean);

  if (recentVitals.length >= 2) {
    // Check for worsening SpO2 trend
    const spo2Values = recentVitals
      .map(v => parseFloat(String(v?.spo2 || '')))
      .filter(v => !isNaN(v));

    if (spo2Values.length >= 3) {
      const isDecreasing = spo2Values.every((val, i) =>
        i === 0 || val <= spo2Values[i - 1]
      );

      if (isDecreasing && spo2Values[0] < spo2Values[spo2Values.length - 1] - 3) {
        alerts.push(createAlert(
          AlertType.DETERIORATION,
          AlertSeverity.WARNING,
          'Declining SpO2 Trend',
          `SpO2 has decreased from ${spo2Values[spo2Values.length - 1]}% to ${spo2Values[0]}% over recent assessments`,
          {
            patientId: patient.id,
            patientName: patient.name,
            recommendation: 'Review respiratory status, consider increasing oxygen support'
          }
        ));
      }
    }

    // Check for worsening tachycardia
    const hrValues = recentVitals
      .map(v => parseFloat(String(v?.hr || '')))
      .filter(v => !isNaN(v));

    if (hrValues.length >= 3) {
      const ranges = getVitalRangesByAge(patient.age, patient.ageUnit);
      const maxNormal = ranges.ranges.hr?.max || 160;

      const persistentTachycardia = hrValues.slice(0, 3).every(hr => hr > maxNormal);
      if (persistentTachycardia) {
        alerts.push(createAlert(
          AlertType.DETERIORATION,
          AlertSeverity.WARNING,
          'Persistent Tachycardia',
          `Heart rate consistently elevated (${hrValues.slice(0, 3).join(', ')} bpm) over recent assessments`,
          {
            patientId: patient.id,
            patientName: patient.name,
            recommendation: 'Assess for pain, fever, infection, or cardiac issues'
          }
        ));
      }
    }
  }

  // Use AI for more sophisticated deterioration detection
  try {
    const context: PatientContext = {
      age: patient.age,
      ageUnit: patient.ageUnit,
      gender: patient.gender,
      weight: patient.birthWeight || patient.weightOnAdmission,
      diagnosis: patient.diagnosis,
      unit: patient.unit || 'NICU',
      recentVitals: recentVitals as VitalSigns[]
    };

    if (recentVitals[0]) {
      const aiAlerts = await aiProvider.detectClinicalAlerts(recentVitals[0] as VitalSigns, context);

      for (const aiAlert of aiAlerts) {
        if (aiAlert.type === 'deterioration') {
          alerts.push(createAlert(
            AlertType.DETERIORATION,
            aiAlert.severity === 'critical' ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
            aiAlert.title,
            aiAlert.message,
            {
              patientId: patient.id,
              patientName: patient.name,
              recommendation: aiAlert.recommendation,
              aiGenerated: true,
              aiConfidence: aiAlert.confidence,
              aiModel: 'medgemma'
            }
          ));
        }
      }
    }
  } catch (error) {
    console.warn('AI deterioration detection failed:', error);
  }

  return alerts;
};

/**
 * Check for sepsis risk indicators
 */
export const checkSepsisRisk = async (
  vitals: VitalSigns,
  patient: Patient,
  clinicalFindings?: string
): Promise<ClinicalAlert[]> => {
  const alerts: ClinicalAlert[] = [];

  // Neonatal sepsis screening criteria
  const sepsisIndicators: string[] = [];

  // Temperature instability
  const temp = parseFloat(String(vitals.temperature || ''));
  if (!isNaN(temp)) {
    if (temp > 38.0) sepsisIndicators.push('Fever (>38°C)');
    if (temp < 36.0) sepsisIndicators.push('Hypothermia (<36°C)');
  }

  // Tachycardia/bradycardia
  const hr = parseFloat(String(vitals.hr || ''));
  const ranges = getVitalRangesByAge(patient.age, patient.ageUnit);
  if (!isNaN(hr)) {
    if (hr > (ranges.ranges.hr?.criticalMax || 200)) sepsisIndicators.push('Severe tachycardia');
    if (hr < (ranges.ranges.hr?.criticalMin || 80)) sepsisIndicators.push('Bradycardia');
  }

  // Respiratory distress
  const rr = parseFloat(String(vitals.rr || ''));
  if (!isNaN(rr) && rr > (ranges.ranges.rr?.max || 60)) {
    sepsisIndicators.push('Tachypnea');
  }

  // Poor perfusion
  const crt = parseFloat(String(vitals.crt || ''));
  if (!isNaN(crt) && crt > 3) {
    sepsisIndicators.push('Prolonged CRT');
  }

  // Low SpO2
  const spo2 = parseFloat(String(vitals.spo2 || ''));
  if (!isNaN(spo2) && spo2 < (ranges.ranges.spo2?.min || 92)) {
    sepsisIndicators.push('Hypoxemia');
  }

  // Check clinical findings for sepsis keywords
  if (clinicalFindings) {
    const sepsisKeywords = ['lethargy', 'poor feeding', 'apnea', 'mottled', 'irritable', 'hypotonia'];
    for (const keyword of sepsisKeywords) {
      if (clinicalFindings.toLowerCase().includes(keyword)) {
        sepsisIndicators.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    }
  }

  // Generate alert if multiple indicators present
  if (sepsisIndicators.length >= 2) {
    const severity = sepsisIndicators.length >= 4 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;

    alerts.push(createAlert(
      AlertType.SEPSIS_RISK,
      severity,
      'Sepsis Risk Alert',
      `Multiple sepsis indicators present: ${sepsisIndicators.join(', ')}`,
      {
        patientId: patient.id,
        patientName: patient.name,
        recommendation: 'Consider sepsis workup: CBC, CRP, blood culture, lumbar puncture if indicated. Start empirical antibiotics if clinical suspicion high.',
        metadata: { indicators: sepsisIndicators }
      }
    ));
  }

  return alerts;
};

/**
 * Acknowledge an alert
 */
export const acknowledgeAlert = (
  alertId: string,
  userId: string,
  userName: string
): boolean => {
  const alert = activeAlerts.get(alertId);
  if (!alert) return false;

  alert.acknowledged = true;
  alert.acknowledgedBy = userId;
  alert.acknowledgedByName = userName;
  alert.acknowledgedAt = new Date().toISOString();

  return true;
};

/**
 * Dismiss an alert
 */
export const dismissAlert = (alertId: string): boolean => {
  const alert = activeAlerts.get(alertId);
  if (!alert) return false;

  alert.dismissed = true;
  alert.dismissedAt = new Date().toISOString();
  activeAlerts.delete(alertId);

  return true;
};

/**
 * Get active alerts for a patient
 */
export const getPatientAlerts = (patientId: string): ClinicalAlert[] => {
  return Array.from(activeAlerts.values())
    .filter(alert => alert.patientId === patientId && !alert.dismissed)
    .sort((a, b) => {
      // Sort by severity (critical first) then by timestamp
      const severityOrder = { emergency: 0, critical: 1, warning: 2, info: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
};

/**
 * Get all active alerts
 */
export const getAllActiveAlerts = (): ClinicalAlert[] => {
  return Array.from(activeAlerts.values())
    .filter(alert => !alert.dismissed)
    .sort((a, b) => {
      const severityOrder = { emergency: 0, critical: 1, warning: 2, info: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
};

/**
 * Get alert statistics
 */
export const getAlertStatistics = (): AlertStatistics => {
  const allAlerts = alertHistory;

  const byType: Record<AlertType, number> = {} as Record<AlertType, number>;
  const bySeverity: Record<AlertSeverity, number> = {} as Record<AlertSeverity, number>;
  let acknowledgedCount = 0;
  let totalAckTime = 0;
  let ackCount = 0;

  for (const alert of allAlerts) {
    byType[alert.type] = (byType[alert.type] || 0) + 1;
    bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;

    if (alert.acknowledged) {
      acknowledgedCount++;
      if (alert.acknowledgedAt) {
        const ackTime = new Date(alert.acknowledgedAt).getTime() - new Date(alert.timestamp).getTime();
        totalAckTime += ackTime / 1000;
        ackCount++;
      }
    }
  }

  // Calculate top triggers
  const triggerCounts = new Map<string, number>();
  for (const alert of allAlerts) {
    if (alert.triggerVital) {
      const vitalKey = alert.triggerVital as string;
      triggerCounts.set(vitalKey, (triggerCounts.get(vitalKey) || 0) + 1);
    }
  }

  const topTriggers = Array.from(triggerCounts.entries())
    .map(([trigger, count]) => ({ trigger, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalAlerts: allAlerts.length,
    byType,
    bySeverity,
    acknowledgedCount,
    avgAcknowledgmentTime: ackCount > 0 ? totalAckTime / ackCount : 0,
    topTriggers
  };
};

/**
 * Clear all alerts (for testing)
 */
export const clearAllAlerts = (): void => {
  activeAlerts.clear();
  alertHistory.length = 0;
};

// Export service object
export const clinicalAlertService = {
  subscribe: subscribeToAlerts,
  checkVitals: checkVitalsOnEntry,
  checkMedications: checkMedicationInteractions,
  detectDeterioration,
  checkSepsisRisk,
  acknowledge: acknowledgeAlert,
  dismiss: dismissAlert,
  getPatientAlerts,
  getAllActive: getAllActiveAlerts,
  getStatistics: getAlertStatistics,
  clearAll: clearAllAlerts
};

export default clinicalAlertService;
