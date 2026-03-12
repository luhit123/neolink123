import { Patient, PatientOutcome, Unit } from '../types';

export type CanonicalAdmissionType = 'Inborn' | 'Outborn' | 'Unknown';
export interface AnalyticsDateRange {
  startDate: Date;
  endDate: Date;
}

const OUTCOME_MAP: Record<string, PatientOutcome> = {
  'in progress': 'In Progress',
  inprogress: 'In Progress',
  admitted: 'In Progress',
  active: 'In Progress',
  ongoing: 'In Progress',

  discharged: 'Discharged',
  discharge: 'Discharged',
  'normal discharge': 'Discharged',
  lama: 'Discharged',
  dama: 'Discharged',
  dor: 'Discharged',

  referred: 'Referred',
  referral: 'Referred',
  transferred: 'Referred',
  transfer: 'Referred',

  deceased: 'Deceased',
  death: 'Deceased',
  dead: 'Deceased',
  expired: 'Deceased',

  'step down': 'Step Down',
  stepdown: 'Step Down',
  'step-down': 'Step Down',
  step_down: 'Step Down',
};

const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
};

export const parseAnalyticsDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  // Firestore timestamp support
  if (typeof value === 'object' && value && 'toDate' in value && typeof (value as any).toDate === 'function') {
    const converted = (value as any).toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
  }

  const parsed = new Date(value as any);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getCanonicalOutcome = (patient: Partial<Patient>): PatientOutcome => {
  const raw = normalizeText(patient.outcome);
  const compact = raw.replace(/[\s_-]/g, '');
  const mappedOutcome = (raw && OUTCOME_MAP[raw])
    ? OUTCOME_MAP[raw]
    : (compact && OUTCOME_MAP[compact])
      ? OUTCOME_MAP[compact]
      : null;

  const inferredRawOutcome = (() => {
    if (mappedOutcome) return mappedOutcome;
    if (raw.includes('deceas') || raw.includes('death') || raw.includes('died') || raw.includes('expire') || raw.includes('succumb')) {
      return 'Deceased' as PatientOutcome;
    }
    if (raw.includes('step') && raw.includes('down')) {
      return 'Step Down' as PatientOutcome;
    }
    if (raw.includes('refer') || raw.includes('transfer')) {
      return 'Referred' as PatientOutcome;
    }
    if (raw.includes('discharg') || raw.includes('lama') || raw.includes('dama') || raw.includes('dor')) {
      return 'Discharged' as PatientOutcome;
    }
    if (raw.includes('progress') || raw.includes('active') || raw.includes('admit') || raw.includes('ongoing')) {
      return 'In Progress' as PatientOutcome;
    }
    return null;
  })();

  const hasDeathEvidence = !!(patient.dateOfDeath || patient.savedDeathCertificate || patient.diagnosisAtDeath || patient.aiInterpretedDeathDiagnosis);
  const hasReferralEvidence = !!(patient.referredTo || patient.referralReason);
  const hasDischargeEvidence = !!(patient.finalDischargeDate || patient.dischargeDateTime || patient.savedDischargeSummary || patient.dischargeSavedAt);
  const hasStepDownEvidence = !!(patient.isStepDown || (patient.stepDownDate && !patient.readmissionFromStepDown));

  if (inferredRawOutcome === 'Deceased' || hasDeathEvidence) {
    return 'Deceased';
  }

  if (inferredRawOutcome === 'Referred' || hasReferralEvidence) {
    return 'Referred';
  }

  if (inferredRawOutcome === 'Discharged' || hasDischargeEvidence) {
    return 'Discharged';
  }

  if (inferredRawOutcome === 'Step Down') {
    return 'Step Down';
  }

  if (inferredRawOutcome === 'In Progress') {
    return 'In Progress';
  }

  // When outcome text is absent/ambiguous, avoid inferring discharge from
  // legacy `releaseDate` alone because many active records carry stale release
  // timestamps. Prefer stronger clinical artifacts.
  if (hasStepDownEvidence) return 'Step Down';
  return 'In Progress';
};

export const getCanonicalAdmissionType = (patient: Partial<Patient>): CanonicalAdmissionType => {
  const candidates = [
    patient.admissionType,
    (patient as any).nicuAdmissionType,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (!normalized) continue;
    if (normalized.includes('inborn')) return 'Inborn';
    if (normalized.includes('outborn')) return 'Outborn';

    const compact = normalized.replace(/[\s_-]/g, '');
    if (compact.includes('inborn')) return 'Inborn';
    if (compact.includes('outborn')) return 'Outborn';
  }

  return 'Unknown';
};

export const getPatientAdmissionDate = (patient: Partial<Patient>): Date | null => {
  return parseAnalyticsDate(patient.admissionDateTime || patient.admissionDate);
};

export const getPatientDeathDate = (patient: Partial<Patient>): Date | null => {
  return parseAnalyticsDate(
    patient.dateOfDeath ||
    patient.savedDeathCertificate?.dateOfDeath ||
    patient.releaseDate ||
    patient.dischargeDateTime ||
    patient.finalDischargeDate
  );
};

export const getPatientDischargeDate = (patient: Partial<Patient>): Date | null => {
  return parseAnalyticsDate(patient.finalDischargeDate || patient.dischargeDateTime || patient.releaseDate);
};

export const getPatientOutcomeDate = (patient: Partial<Patient>): Date | null => {
  const outcome = getCanonicalOutcome(patient);
  if (outcome === 'Deceased') return getPatientDeathDate(patient);
  if (outcome === 'Step Down') return parseAnalyticsDate(patient.stepDownDate);
  if (outcome === 'Discharged') return getPatientDischargeDate(patient);
  if (outcome === 'Referred') return parseAnalyticsDate(patient.releaseDate || patient.dischargeDateTime);
  return null;
};

export const getPatientOperationalEndDate = (patient: Partial<Patient>): Date | null => {
  const outcome = getCanonicalOutcome(patient);

  // Step down is a care transition, not a hospital exit. Keep those patients
  // visible in operational lists until a terminal outcome is recorded.
  if (outcome === 'Discharged' || outcome === 'Deceased' || outcome === 'Referred') {
    return getPatientOutcomeDate(patient);
  }

  return null;
};

export const isPatientActiveDuringRange = (
  patient: Partial<Patient>,
  range: AnalyticsDateRange | null
): boolean => {
  if (!range) return true;

  const admissionDate = getPatientAdmissionDate(patient);
  if (!admissionDate) return false;

  const operationalEndDate = getPatientOperationalEndDate(patient);
  return admissionDate <= range.endDate && (!operationalEndDate || operationalEndDate >= range.startDate);
};

export const isPatientAdmittedWithinRange = (
  patient: Partial<Patient>,
  range: AnalyticsDateRange | null
): boolean => {
  if (!range) return true;
  const admissionDate = getPatientAdmissionDate(patient);
  if (!admissionDate) return false;
  return admissionDate >= range.startDate && admissionDate <= range.endDate;
};

export const matchesAdmissionTypeFilter = (
  patient: Partial<Patient>,
  filter: 'All' | 'Inborn' | 'Outborn' | 'all' | 'inborn' | 'outborn'
): boolean => {
  const normalizedFilter = String(filter).toLowerCase();
  if (normalizedFilter === 'all') return true;

  const canonicalType = getCanonicalAdmissionType(patient);
  if (normalizedFilter === 'inborn') return canonicalType === 'Inborn';
  if (normalizedFilter === 'outborn') return canonicalType === 'Outborn';
  return true;
};

export const matchesRegistryUnit = (
  patient: Partial<Patient>,
  unit: Unit
): boolean => {
  return patient.unit === unit || (!!patient.stepDownDate && patient.stepDownFrom === unit);
};

export const toAnalyticsPatient = (patient: Patient): Patient => {
  const outcome = getCanonicalOutcome(patient);
  const admissionType = getCanonicalAdmissionType(patient);
  const deathDate = getPatientDeathDate(patient);

  return {
    ...patient,
    outcome,
    admissionType: admissionType === 'Unknown' ? patient.admissionType : (admissionType as any),
    dateOfDeath: patient.dateOfDeath || (outcome === 'Deceased' && deathDate ? deathDate.toISOString() : patient.dateOfDeath),
    releaseDate: patient.releaseDate || (outcome === 'Deceased' && deathDate ? deathDate.toISOString() : patient.releaseDate),
  };
};

export const toAnalyticsPatients = (patients: Patient[]): Patient[] => {
  return patients.map(toAnalyticsPatient);
};

export const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

export const calculatePercentage = (
  numerator: number,
  denominator: number,
  decimals = 1
): number => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  const raw = (numerator / denominator) * 100;
  const clamped = clampPercent(raw);
  const factor = 10 ** decimals;
  return Math.round(clamped * factor) / factor;
};

export const formatPercentage = (
  numerator: number,
  denominator: number,
  decimals = 1
): string => {
  return calculatePercentage(numerator, denominator, decimals).toFixed(decimals);
};
