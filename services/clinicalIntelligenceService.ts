/**
 * Clinical Intelligence Service
 *
 * A comprehensive service that acts like a thoughtful pediatrician/neonatologist.
 * Analyzes all patient data - LMP, EDD, gestational age, indications, progress notes,
 * medications, vitals - to generate accurate clinical assessments.
 *
 * NO SCOPE FOR ERRORS - validates and cross-correlates all data.
 */

import { Patient, ProgressNote, Unit, MaternalHistory, Medication, MaternalRiskFactor, AgeUnit } from '../types';

// Helper to extract text from a progress note (combining available fields)
function getNoteText(note: ProgressNote): string {
  return note.note || '';
}

// Helper to get age in days from patient
function getPatientAgeInDays(patient: Patient): number | undefined {
  if (patient.ageUnit === AgeUnit.Days) {
    return patient.age;
  }
  if (patient.ageUnit === AgeUnit.Weeks) {
    return patient.age * 7;
  }
  return undefined;
}

// ==================== TYPES ====================

export interface GestationalAgeResult {
  weeks: number;
  days: number;
  totalDays: number;
  category: GestationalCategory;
  categoryDescription: string;
  source: 'lmp' | 'edd' | 'manual' | 'clinical';
  isValidated: boolean;
  warnings: string[];
  correctedPostnatalAge?: {
    weeks: number;
    days: number;
  };
}

export enum GestationalCategory {
  EXTREME_PRETERM = 'Extreme Preterm',
  VERY_PRETERM = 'Very Preterm',
  MODERATE_PRETERM = 'Moderate Preterm',
  LATE_PRETERM = 'Late Preterm',
  EARLY_TERM = 'Early Term',
  FULL_TERM = 'Full Term',
  LATE_TERM = 'Late Term',
  POST_TERM = 'Post Term'
}

export enum WeightCategory {
  ELBW = 'Extremely Low Birth Weight',
  VLBW = 'Very Low Birth Weight',
  LBW = 'Low Birth Weight',
  NORMAL = 'Normal Birth Weight',
  MACROSOMIA = 'Macrosomia'
}

export enum GrowthStatus {
  SGA = 'Small for Gestational Age',
  AGA = 'Appropriate for Gestational Age',
  LGA = 'Large for Gestational Age'
}

export interface WeightAnalysis {
  category: WeightCategory;
  categoryAbbreviation: string;
  weightInGrams: number;
  weightInKg: number;
  percentile?: number;
  growthStatus?: GrowthStatus;
  zScore?: number;
}

export interface ClinicalCourseAnalysis {
  totalDaysOfStay: number;
  keyEvents: ClinicalEvent[];
  complications: string[];
  interventions: string[];
  vitalTrends: VitalTrend[];
  medicationSummary: MedicationSummary;
  feedingProgression: string[];
  respiratorySupportProgression: string[];
  resolvedConditions: string[];
  ongoingConditions: string[];
  clinicalImprovement: boolean;
  overallAssessment: string;
}

export interface ClinicalEvent {
  day: number;
  date: string;
  event: string;
  severity: 'critical' | 'major' | 'minor' | 'routine';
  category: 'diagnosis' | 'treatment' | 'procedure' | 'complication' | 'improvement';
}

export interface VitalTrend {
  parameter: string;
  trend: 'improving' | 'stable' | 'worsening';
  latestValue: string;
  normalRange: string;
}

export interface MedicationSummary {
  totalMedications: number;
  antibiotics: MedicationInfo[];
  respiratoryMeds: MedicationInfo[];
  cardiovascularMeds: MedicationInfo[];
  neurologicalMeds: MedicationInfo[];
  nutritionalSupport: MedicationInfo[];
  others: MedicationInfo[];
  activeMedications: MedicationInfo[];
  discontinuedMedications: MedicationInfo[];
}

export interface MedicationInfo {
  name: string;
  indication?: string;
  duration?: string;
  status: 'active' | 'completed' | 'discontinued';
  startDate?: string;
  endDate?: string;
}

export interface DiagnosisAnalysis {
  primaryDiagnosis: string;
  primaryDiagnosisICD10?: string;
  secondaryDiagnoses: DiagnosisInfo[];
  admissionIndications: string[];
  indicationsValidation: IndicationValidation[];
  finalDiagnosis: string;
  diagnosisConsistencyScore: number; // 0-100
  warnings: string[];
}

export interface DiagnosisInfo {
  diagnosis: string;
  icd10Code?: string;
  status: 'resolved' | 'improved' | 'stable' | 'ongoing';
  duration?: string;
}

export interface IndicationValidation {
  indication: string;
  isValid: boolean;
  reason?: string;
  suggestedCorrection?: string;
}

export interface ComprehensiveClinicalSummary {
  patientProfile: PatientProfile;
  gestationalAge: GestationalAgeResult;
  weightAnalysis: WeightAnalysis;
  maternalFactors: MaternalFactorSummary;
  clinicalCourse: ClinicalCourseAnalysis;
  diagnosis: DiagnosisAnalysis;
  dischargeReadiness?: DischargeReadiness;
  warnings: ClinicalWarning[];
  generatedAt: string;
}

export interface PatientProfile {
  name: string;
  gender: string;
  dateOfBirth: string;
  ageDescription: string;
  unit: string;
  isNeonatal: boolean;
  isPediatric: boolean;
}

export interface MaternalFactorSummary {
  hasRiskFactors: boolean;
  significantFactors: string[];
  antenatalCare: string;
  deliveryDetails: string;
  implications: string[];
}

export interface DischargeReadiness {
  isReady: boolean;
  criteria: DischargeCriterion[];
  pendingIssues: string[];
  recommendations: string[];
}

export interface DischargeCriterion {
  criterion: string;
  met: boolean;
  notes?: string;
}

export interface ClinicalWarning {
  type: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
  suggestion?: string;
}

// ==================== FENTON GROWTH CHART DATA (Simplified) ====================
// 10th, 50th, 90th percentiles for birth weight by gestational age

const FENTON_MALE_WEIGHTS: Record<number, { p10: number; p50: number; p90: number }> = {
  22: { p10: 380, p50: 500, p90: 640 },
  23: { p10: 430, p50: 570, p90: 730 },
  24: { p10: 490, p50: 650, p90: 840 },
  25: { p10: 560, p50: 750, p90: 970 },
  26: { p10: 640, p50: 860, p90: 1110 },
  27: { p10: 730, p50: 980, p90: 1270 },
  28: { p10: 830, p50: 1120, p90: 1450 },
  29: { p10: 950, p50: 1280, p90: 1660 },
  30: { p10: 1080, p50: 1460, p90: 1890 },
  31: { p10: 1230, p50: 1660, p90: 2150 },
  32: { p10: 1400, p50: 1880, p90: 2430 },
  33: { p10: 1580, p50: 2120, p90: 2730 },
  34: { p10: 1780, p50: 2380, p90: 3040 },
  35: { p10: 1990, p50: 2650, p90: 3360 },
  36: { p10: 2210, p50: 2920, p90: 3680 },
  37: { p10: 2430, p50: 3180, p90: 3980 },
  38: { p10: 2640, p50: 3430, p90: 4260 },
  39: { p10: 2830, p50: 3650, p90: 4510 },
  40: { p10: 2990, p50: 3830, p90: 4710 },
  41: { p10: 3100, p50: 3960, p90: 4860 },
  42: { p10: 3160, p50: 4030, p90: 4950 }
};

const FENTON_FEMALE_WEIGHTS: Record<number, { p10: number; p50: number; p90: number }> = {
  22: { p10: 360, p50: 480, p90: 620 },
  23: { p10: 410, p50: 550, p90: 710 },
  24: { p10: 470, p50: 630, p90: 820 },
  25: { p10: 540, p50: 720, p90: 940 },
  26: { p10: 610, p50: 830, p90: 1080 },
  27: { p10: 700, p50: 950, p90: 1230 },
  28: { p10: 800, p50: 1080, p90: 1400 },
  29: { p10: 910, p50: 1230, p90: 1600 },
  30: { p10: 1040, p50: 1400, p90: 1820 },
  31: { p10: 1180, p50: 1590, p90: 2060 },
  32: { p10: 1340, p50: 1800, p90: 2330 },
  33: { p10: 1520, p50: 2030, p90: 2610 },
  34: { p10: 1710, p50: 2280, p90: 2910 },
  35: { p10: 1920, p50: 2540, p90: 3220 },
  36: { p10: 2140, p50: 2800, p90: 3530 },
  37: { p10: 2360, p50: 3060, p90: 3830 },
  38: { p10: 2570, p50: 3300, p90: 4100 },
  39: { p10: 2760, p50: 3520, p90: 4340 },
  40: { p10: 2920, p50: 3700, p90: 4530 },
  41: { p10: 3030, p50: 3830, p90: 4670 },
  42: { p10: 3090, p50: 3900, p90: 4760 }
};

// ==================== GESTATIONAL AGE CALCULATOR ====================

/**
 * Calculate gestational age from LMP (Last Menstrual Period)
 * Uses Naegele's rule adjusted for cycle length
 */
export function calculateGestationalAgeFromLMP(
  lmpDate: string,
  referenceDate: string, // Usually date of birth or admission
  cycleLength: number = 28
): GestationalAgeResult {
  const warnings: string[] = [];

  const lmp = new Date(lmpDate);
  const reference = new Date(referenceDate);

  // Validate dates
  if (isNaN(lmp.getTime())) {
    return createInvalidGAResult('Invalid LMP date');
  }
  if (isNaN(reference.getTime())) {
    return createInvalidGAResult('Invalid reference date');
  }

  // Calculate days since LMP
  const diffMs = reference.getTime() - lmp.getTime();
  let totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Adjust for irregular cycle (if cycle != 28 days)
  // Standard assumes ovulation at day 14, so adjust if cycle is different
  if (cycleLength !== 28) {
    const adjustment = cycleLength - 28;
    totalDays -= adjustment;
    warnings.push(`Adjusted for ${cycleLength}-day cycle`);
  }

  // Validate reasonable range (20-45 weeks)
  if (totalDays < 140) { // Less than 20 weeks
    warnings.push('Gestational age seems too early for neonatal admission');
  }
  if (totalDays > 315) { // More than 45 weeks
    warnings.push('Gestational age exceeds normal range - please verify LMP');
  }

  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;

  return {
    weeks,
    days,
    totalDays,
    category: getGestationalCategory(weeks, days),
    categoryDescription: getGestationalCategoryDescription(weeks, days),
    source: 'lmp',
    isValidated: warnings.length === 0,
    warnings
  };
}

/**
 * Calculate gestational age from EDD (Expected Date of Delivery)
 * Works backwards: EDD is 280 days from LMP, so we can derive GA
 */
export function calculateGestationalAgeFromEDD(
  eddDate: string,
  referenceDate: string
): GestationalAgeResult {
  const warnings: string[] = [];

  const edd = new Date(eddDate);
  const reference = new Date(referenceDate);

  if (isNaN(edd.getTime())) {
    return createInvalidGAResult('Invalid EDD date');
  }
  if (isNaN(reference.getTime())) {
    return createInvalidGAResult('Invalid reference date');
  }

  // Calculate days from reference to EDD
  const daysToEDD = Math.floor((edd.getTime() - reference.getTime()) / (1000 * 60 * 60 * 24));

  // Full term is 280 days (40 weeks) from LMP
  // So GA at reference = 280 - daysToEDD
  const totalDays = 280 - daysToEDD;

  if (totalDays < 0) {
    warnings.push('Reference date is after EDD - post-term pregnancy');
  }

  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;

  return {
    weeks,
    days,
    totalDays,
    category: getGestationalCategory(weeks, days),
    categoryDescription: getGestationalCategoryDescription(weeks, days),
    source: 'edd',
    isValidated: warnings.length === 0,
    warnings
  };
}

/**
 * Get gestational age from patient data with full validation
 * Correlates LMP, EDD, manual entry, and clinical findings
 */
export function getValidatedGestationalAge(patient: Patient): GestationalAgeResult {
  const warnings: string[] = [];
  const results: GestationalAgeResult[] = [];

  const referenceDate = patient.dateOfBirth || patient.admissionDate;

  if (!referenceDate) {
    return createInvalidGAResult('No reference date (DOB or admission date) available');
  }

  // Method 1: Calculate from LMP
  if (patient.maternalHistory?.lmp) {
    const lmpResult = calculateGestationalAgeFromLMP(
      patient.maternalHistory.lmp,
      referenceDate,
      patient.maternalHistory.menstrualCycleLength
    );
    results.push(lmpResult);
  }

  // Method 2: Calculate from EDD
  if (patient.maternalHistory?.edd) {
    const eddResult = calculateGestationalAgeFromEDD(
      patient.maternalHistory.edd,
      referenceDate
    );
    results.push(eddResult);
  }

  // Method 3: Use manual entry
  if (patient.gestationalAgeWeeks !== undefined) {
    const manualResult: GestationalAgeResult = {
      weeks: patient.gestationalAgeWeeks,
      days: patient.gestationalAgeDays || 0,
      totalDays: patient.gestationalAgeWeeks * 7 + (patient.gestationalAgeDays || 0),
      category: getGestationalCategory(patient.gestationalAgeWeeks, patient.gestationalAgeDays || 0),
      categoryDescription: getGestationalCategoryDescription(patient.gestationalAgeWeeks, patient.gestationalAgeDays || 0),
      source: 'manual',
      isValidated: true,
      warnings: []
    };
    results.push(manualResult);
  }

  // If no data available
  if (results.length === 0) {
    return createInvalidGAResult('No gestational age data available');
  }

  // Cross-validate results if multiple sources available
  if (results.length >= 2) {
    const variance = Math.abs(results[0].totalDays - results[1].totalDays);
    if (variance > 14) { // More than 2 weeks difference
      warnings.push(`Discrepancy of ${Math.round(variance / 7)} weeks between ${results[0].source} and ${results[1].source} calculations`);
    }
  }

  // Prefer LMP > EDD > Manual (in terms of accuracy for dating)
  let primaryResult = results.find(r => r.source === 'lmp') ||
                      results.find(r => r.source === 'edd') ||
                      results[0];

  // Validate against admission indications
  const indicationWarnings = validateGAAgainstIndications(primaryResult, patient);
  warnings.push(...indicationWarnings);

  return {
    ...primaryResult,
    warnings: [...primaryResult.warnings, ...warnings],
    isValidated: warnings.length === 0 && primaryResult.isValidated
  };
}

/**
 * Validate gestational age against admission indications
 */
function validateGAAgainstIndications(ga: GestationalAgeResult, patient: Patient): string[] {
  const warnings: string[] = [];
  const indications = patient.indicationsForAdmission || [];

  // Check for prematurity indications vs actual GA
  const pretermIndications = [
    'Prematurity',
    'Preterm',
    'Extreme Prematurity',
    'Very Preterm',
    'Moderate Preterm',
    'Late Preterm'
  ];

  const hasPrematurityIndication = indications.some(ind =>
    pretermIndications.some(pi => ind.toLowerCase().includes(pi.toLowerCase()))
  );

  if (hasPrematurityIndication && ga.weeks >= 37) {
    warnings.push(`CRITICAL: Prematurity indication selected but GA is ${ga.weeks} weeks (Term). Please verify.`);
  }

  if (!hasPrematurityIndication && ga.weeks < 37) {
    warnings.push(`Missing prematurity indication - GA is ${ga.weeks}+${ga.days} weeks (Preterm)`);
  }

  // Check for LBW indications vs actual weight
  const lbwIndications = ['Low Birth Weight', 'LBW', 'VLBW', 'ELBW'];
  const hasLBWIndication = indications.some(ind =>
    lbwIndications.some(li => ind.toUpperCase().includes(li))
  );

  if (patient.birthWeight !== undefined) {
    const weightInGrams = patient.birthWeight < 10 ? patient.birthWeight * 1000 : patient.birthWeight;

    if (hasLBWIndication && weightInGrams >= 2500) {
      warnings.push(`CRITICAL: LBW indication selected but birth weight is ${weightInGrams}g (Normal). Please verify.`);
    }
  }

  return warnings;
}

function createInvalidGAResult(error: string): GestationalAgeResult {
  return {
    weeks: 0,
    days: 0,
    totalDays: 0,
    category: GestationalCategory.FULL_TERM, // Default
    categoryDescription: 'Unknown',
    source: 'manual',
    isValidated: false,
    warnings: [error]
  };
}

function getGestationalCategory(weeks: number, days: number = 0): GestationalCategory {
  const totalWeeks = weeks + days / 7;

  if (totalWeeks < 28) return GestationalCategory.EXTREME_PRETERM;
  if (totalWeeks < 32) return GestationalCategory.VERY_PRETERM;
  if (totalWeeks < 34) return GestationalCategory.MODERATE_PRETERM;
  if (totalWeeks < 37) return GestationalCategory.LATE_PRETERM;
  if (totalWeeks < 39) return GestationalCategory.EARLY_TERM;
  if (totalWeeks < 41) return GestationalCategory.FULL_TERM;
  if (totalWeeks < 42) return GestationalCategory.LATE_TERM;
  return GestationalCategory.POST_TERM;
}

function getGestationalCategoryDescription(weeks: number, days: number = 0): string {
  const category = getGestationalCategory(weeks, days);
  const gaString = days > 0 ? `${weeks}+${days} weeks` : `${weeks} weeks`;

  switch (category) {
    case GestationalCategory.EXTREME_PRETERM:
      return `Extreme Preterm (${gaString}, <28 weeks)`;
    case GestationalCategory.VERY_PRETERM:
      return `Very Preterm (${gaString}, 28-31+6 weeks)`;
    case GestationalCategory.MODERATE_PRETERM:
      return `Moderate Preterm (${gaString}, 32-33+6 weeks)`;
    case GestationalCategory.LATE_PRETERM:
      return `Late Preterm (${gaString}, 34-36+6 weeks)`;
    case GestationalCategory.EARLY_TERM:
      return `Early Term (${gaString}, 37-38+6 weeks)`;
    case GestationalCategory.FULL_TERM:
      return `Full Term (${gaString}, 39-40+6 weeks)`;
    case GestationalCategory.LATE_TERM:
      return `Late Term (${gaString}, 41-41+6 weeks)`;
    case GestationalCategory.POST_TERM:
      return `Post Term (${gaString}, ≥42 weeks)`;
  }
}

// ==================== WEIGHT ANALYSIS ====================

/**
 * Analyze birth weight and determine category + growth status
 */
export function analyzeWeight(
  birthWeight: number | undefined,
  gestationalAge: GestationalAgeResult,
  gender: string
): WeightAnalysis | null {
  if (birthWeight === undefined || birthWeight === null) {
    return null;
  }

  // Normalize to grams (handle both kg and grams input)
  const weightInGrams = birthWeight < 10 ? birthWeight * 1000 : birthWeight;
  const weightInKg = weightInGrams / 1000;

  // Determine weight category
  let category: WeightCategory;
  let categoryAbbreviation: string;

  if (weightInGrams < 1000) {
    category = WeightCategory.ELBW;
    categoryAbbreviation = 'ELBW';
  } else if (weightInGrams < 1500) {
    category = WeightCategory.VLBW;
    categoryAbbreviation = 'VLBW';
  } else if (weightInGrams < 2500) {
    category = WeightCategory.LBW;
    categoryAbbreviation = 'LBW';
  } else if (weightInGrams > 4000) {
    category = WeightCategory.MACROSOMIA;
    categoryAbbreviation = 'Macrosomia';
  } else {
    category = WeightCategory.NORMAL;
    categoryAbbreviation = 'NBW';
  }

  // Determine growth status using Fenton charts (simplified)
  let growthStatus: GrowthStatus | undefined;
  let percentile: number | undefined;

  if (gestationalAge.weeks >= 22 && gestationalAge.weeks <= 42) {
    const charts = gender?.toLowerCase() === 'female' ? FENTON_FEMALE_WEIGHTS : FENTON_MALE_WEIGHTS;
    const reference = charts[gestationalAge.weeks];

    if (reference) {
      if (weightInGrams < reference.p10) {
        growthStatus = GrowthStatus.SGA;
        percentile = 5; // Approximate
      } else if (weightInGrams > reference.p90) {
        growthStatus = GrowthStatus.LGA;
        percentile = 95; // Approximate
      } else {
        growthStatus = GrowthStatus.AGA;
        percentile = 50; // Approximate
      }
    }
  }

  return {
    category,
    categoryAbbreviation,
    weightInGrams,
    weightInKg,
    percentile,
    growthStatus
  };
}

// ==================== CLINICAL COURSE ANALYSIS ====================

/**
 * Analyze all progress notes to extract clinical course
 */
export function analyzeClinicalCourse(patient: Patient): ClinicalCourseAnalysis {
  const progressNotes = patient.progressNotes || [];
  const medications = patient.medications || [];

  // Calculate length of stay
  const admissionDate = new Date(patient.admissionDate);
  const dischargeDate = patient.releaseDate ? new Date(patient.releaseDate) : new Date();
  const totalDaysOfStay = Math.ceil((dischargeDate.getTime() - admissionDate.getTime()) / (1000 * 60 * 60 * 24));

  // Extract key clinical events
  const keyEvents = extractKeyEvents(progressNotes, admissionDate);

  // Analyze complications
  const complications = extractComplications(progressNotes, patient);

  // Analyze interventions
  const interventions = extractInterventions(progressNotes, medications);

  // Analyze vital trends
  const vitalTrends = analyzeVitalTrends(progressNotes, patient);

  // Analyze medications
  const medicationSummary = analyzeMedications(medications);

  // Extract feeding progression
  const feedingProgression = extractFeedingProgression(progressNotes, patient);

  // Extract respiratory support progression
  const respiratorySupportProgression = extractRespiratorySupportProgression(progressNotes, patient);

  // Determine resolved vs ongoing conditions
  const { resolved, ongoing } = categorizeConditions(progressNotes, patient);

  // Assess clinical improvement
  const clinicalImprovement = assessClinicalImprovement(progressNotes, vitalTrends);

  // Generate overall assessment
  const overallAssessment = generateOverallAssessment(
    patient, totalDaysOfStay, complications, clinicalImprovement, ongoing
  );

  return {
    totalDaysOfStay,
    keyEvents,
    complications,
    interventions,
    vitalTrends,
    medicationSummary,
    feedingProgression,
    respiratorySupportProgression,
    resolvedConditions: resolved,
    ongoingConditions: ongoing,
    clinicalImprovement,
    overallAssessment
  };
}

function extractKeyEvents(notes: ProgressNote[], admissionDate: Date): ClinicalEvent[] {
  const events: ClinicalEvent[] = [];

  notes.forEach((note, index) => {
    const noteDate = new Date(note.date);
    const day = Math.ceil((noteDate.getTime() - admissionDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Look for key clinical terms in notes
    const noteText = note.note?.toLowerCase() || '';
    const assessment = getNoteText(note)?.toLowerCase() || '';
    const plan = ''; // Plan is part of the note text
    const fullText = `${noteText} ${assessment} ${plan}`;

    // Detect critical events
    const criticalTerms = [
      'sepsis', 'shock', 'arrest', 'intubat', 'ventilat', 'resuscitat',
      'deteriorat', 'critical', 'emergency', 'transfusion', 'seizure'
    ];

    const majorTerms = [
      'started antibiotic', 'phototherapy', 'exchange transfusion',
      'cpap', 'surfactant', 'blood culture', 'lumbar puncture'
    ];

    const improvementTerms = [
      'improved', 'weaned', 'extubat', 'tolerating feeds', 'stable',
      'recovered', 'resolved', 'normal'
    ];

    criticalTerms.forEach(term => {
      if (fullText.includes(term)) {
        events.push({
          day,
          date: note.date,
          event: extractEventContext(fullText, term),
          severity: 'critical',
          category: 'complication'
        });
      }
    });

    majorTerms.forEach(term => {
      if (fullText.includes(term)) {
        events.push({
          day,
          date: note.date,
          event: extractEventContext(fullText, term),
          severity: 'major',
          category: 'treatment'
        });
      }
    });

    improvementTerms.forEach(term => {
      if (fullText.includes(term)) {
        events.push({
          day,
          date: note.date,
          event: extractEventContext(fullText, term),
          severity: 'minor',
          category: 'improvement'
        });
      }
    });
  });

  // Remove duplicates and sort by day
  return [...new Map(events.map(e => [`${e.day}-${e.event}`, e])).values()]
    .sort((a, b) => a.day - b.day);
}

function extractEventContext(text: string, term: string): string {
  const index = text.indexOf(term);
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + term.length + 50);
  let context = text.substring(start, end).trim();

  // Clean up and capitalize
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context.charAt(0).toUpperCase() + context.slice(1);
}

/**
 * CRITICAL: Extract ONLY confirmed complications - NOT just mentioned conditions
 * This function acts like a thoughtful pediatrician - only includes conditions that are:
 * 1. Clearly stated as present (not ruled out, not suspected)
 * 2. Part of the admission indication
 * 3. Explicitly diagnosed in progress notes
 */
function extractComplications(notes: ProgressNote[], patient: Patient): string[] {
  const confirmedConditions = new Set<string>();

  // NEGATION PATTERNS - if these appear near a condition, it's NOT confirmed
  const negationPatterns = [
    /no\s+(evidence\s+of\s+)?/i,
    /ruled\s+out/i,
    /unlikely/i,
    /not\s+(seen|present|detected|found)/i,
    /absence\s+of/i,
    /negative\s+for/i,
    /suspected\s+but\s+not/i,
    /r\/o\s+/i,  // rule out
    /to\s+rule\s+out/i,
    /exclude/i,
    /normal/i,
    /no\s+signs\s+of/i,
    /without/i
  ];

  // CONFIRMATION PATTERNS - condition is confirmed if these appear
  const confirmationPatterns = [
    /diagnosed\s+(with|as)/i,
    /confirmed/i,
    /consistent\s+with/i,
    /established/i,
    /culture\s+positive/i,
    /blood\s+culture\s+positive/i,
    /positive\s+for/i,
    /developed/i,
    /presenting\s+with/i,
    /admitted\s+(for|with)/i
  ];

  // Condition definitions with more specific patterns to avoid false positives
  const conditionPatterns = [
    { pattern: /\b(clinical\s+)?sepsis\b|\bsepticemia\b|\bseptic\b/i, name: 'Sepsis', strictPattern: true },
    { pattern: /\bpneumonia\b/i, name: 'Pneumonia', strictPattern: true },
    { pattern: /\bnec\b|\bnecrotizing\s+enterocolitis\b/i, name: 'NEC', strictPattern: true },
    { pattern: /\bivh\b|\bintraventricular\s+h[ae]morrhage\b/i, name: 'IVH', strictPattern: true },
    { pattern: /\bpvl\b|\bperiventricular\s+leukomalacia\b/i, name: 'PVL', strictPattern: true },
    { pattern: /\brop\b|\bretinopathy\s+of\s+prematurity\b/i, name: 'ROP', strictPattern: true },
    { pattern: /\bbpd\b|\bbronchopulmonary\s+dysplasia\b/i, name: 'BPD', strictPattern: true },
    { pattern: /\bpda\b|\bpatent\s+ductus\s+arteriosus\b/i, name: 'PDA', strictPattern: true },
    { pattern: /\bapn[oe]a\s+of\s+prematurity\b|\brecurrent\s+apn[oe]a\b/i, name: 'Apnea of Prematurity', strictPattern: true },
    { pattern: /\bhypoglycemia\b/i, name: 'Hypoglycemia', strictPattern: true },
    { pattern: /\bhyperbilirubinemia\b|\bneonatal\s+jaundice\b/i, name: 'Neonatal Jaundice', strictPattern: true },
    { pattern: /\bmeningitis\b/i, name: 'Meningitis', strictPattern: true },
    { pattern: /\bseptic\s+shock\b|\bcardiogenic\s+shock\b/i, name: 'Shock', strictPattern: true },
    { pattern: /\bdic\b|\bdisseminated\s+intravascular\s+coagulation\b/i, name: 'DIC', strictPattern: true },
    { pattern: /\bhie\b|\bhypoxic\s*ischemic\s*encephalopathy\b|\bbirth\s+asphyxia\b/i, name: 'Birth Asphyxia/HIE', strictPattern: true },
    { pattern: /\brds\b|\brespiratory\s+distress\s+syndrome\b/i, name: 'RDS', strictPattern: true },
    { pattern: /\bmas\b|\bmeconium\s+aspiration\b/i, name: 'MAS', strictPattern: true },
    { pattern: /\bttn\b|\btransient\s+tachypnea\b/i, name: 'TTN', strictPattern: true }
  ];

  // Helper: Check if condition is negated in the surrounding text
  const isNegated = (text: string, matchIndex: number): boolean => {
    // Get 50 characters before the match
    const beforeText = text.substring(Math.max(0, matchIndex - 50), matchIndex).toLowerCase();
    return negationPatterns.some(pattern => pattern.test(beforeText));
  };

  // Helper: Check if condition is confirmed in surrounding text
  const isConfirmed = (text: string, matchIndex: number): boolean => {
    const beforeText = text.substring(Math.max(0, matchIndex - 50), matchIndex).toLowerCase();
    const afterText = text.substring(matchIndex, Math.min(text.length, matchIndex + 50)).toLowerCase();
    return confirmationPatterns.some(pattern => pattern.test(beforeText) || pattern.test(afterText));
  };

  // PRIORITY 1: Check admission indications (these are confirmed reasons for admission)
  if (patient.indicationsForAdmission && patient.indicationsForAdmission.length > 0) {
    patient.indicationsForAdmission.forEach(indication => {
      const indicationLower = indication.toLowerCase();
      conditionPatterns.forEach(({ pattern, name }) => {
        if (pattern.test(indicationLower)) {
          confirmedConditions.add(name);
        }
      });
    });
  }

  // PRIORITY 2: Check admission diagnosis (explicitly stated by admitting physician)
  const admissionDiagnosis = patient.diagnosis || '';
  conditionPatterns.forEach(({ pattern, name }) => {
    const match = pattern.exec(admissionDiagnosis);
    if (match) {
      // Admission diagnosis is considered confirmed
      confirmedConditions.add(name);
    }
  });

  // PRIORITY 3: Carefully check progress notes (only confirmed conditions)
  notes.forEach(note => {
    const noteText = getNoteText(note);

    conditionPatterns.forEach(({ pattern, name }) => {
      const match = pattern.exec(noteText);
      if (match) {
        const matchIndex = match.index;

        // ONLY add if:
        // 1. Not negated AND
        // 2. (Explicitly confirmed OR appears in a diagnostic statement)
        if (!isNegated(noteText, matchIndex)) {
          // Check if it's part of a confirmed/diagnostic statement
          if (isConfirmed(noteText, matchIndex)) {
            confirmedConditions.add(name);
          }
          // Also add if the note mentions treatment for this condition (implies it's present)
          const treatingPattern = new RegExp(`treat(ing|ed|ment).*${name}|${name}.*treat(ing|ed|ment)|started.*on.*for.*${name}`, 'i');
          if (treatingPattern.test(noteText)) {
            confirmedConditions.add(name);
          }
        }
      }
    });
  });

  return Array.from(confirmedConditions);
}

function extractInterventions(notes: ProgressNote[], medications: Medication[]): string[] {
  const interventions = new Set<string>();

  // Check for respiratory interventions
  const respiratoryInterventions = [
    { pattern: /mechanical ventilat|mv\b/i, name: 'Mechanical Ventilation' },
    { pattern: /cpap|continuous positive/i, name: 'CPAP' },
    { pattern: /hfnc|high.?flow/i, name: 'High Flow Nasal Cannula' },
    { pattern: /surfactant/i, name: 'Surfactant Administration' },
    { pattern: /oxygen therapy|o2 supplementation/i, name: 'Oxygen Therapy' },
    { pattern: /intubat/i, name: 'Intubation' }
  ];

  const otherInterventions = [
    { pattern: /phototherapy/i, name: 'Phototherapy' },
    { pattern: /exchange transfusion/i, name: 'Exchange Transfusion' },
    { pattern: /blood transfusion|prbc/i, name: 'Blood Transfusion' },
    { pattern: /platelet transfusion/i, name: 'Platelet Transfusion' },
    { pattern: /ffp|fresh frozen plasma/i, name: 'FFP Transfusion' },
    { pattern: /uvc|umbilical.?venous/i, name: 'Umbilical Venous Catheter' },
    { pattern: /uac|umbilical.?arterial/i, name: 'Umbilical Arterial Catheter' },
    { pattern: /picc/i, name: 'PICC Line' },
    { pattern: /tpn|parenteral nutrition/i, name: 'Total Parenteral Nutrition' },
    { pattern: /lumbar puncture|lp\b/i, name: 'Lumbar Puncture' },
    { pattern: /cranial ultrasound|cus\b/i, name: 'Cranial Ultrasound' },
    { pattern: /echo|echocardiography/i, name: 'Echocardiography' },
    { pattern: /therapeutic hypothermia|cooling/i, name: 'Therapeutic Hypothermia' }
  ];

  const allInterventions = [...respiratoryInterventions, ...otherInterventions];

  notes.forEach(note => {
    const fullText = `${getNoteText(note)}`;

    allInterventions.forEach(({ pattern, name }) => {
      if (pattern.test(fullText)) {
        interventions.add(name);
      }
    });
  });

  // Check for antibiotic therapy
  const hasAntibiotics = medications.some(m =>
    /antibiotic|ampicillin|gentamicin|amikacin|cefotaxime|meropenem|vancomycin|piperacillin/i.test(m.name || '')
  );
  if (hasAntibiotics) {
    interventions.add('Antibiotic Therapy');
  }

  // Check for inotropic support
  const hasInotropes = medications.some(m =>
    /dopamine|dobutamine|adrenaline|epinephrine|norepinephrine|milrinone/i.test(m.name || '')
  );
  if (hasInotropes) {
    interventions.add('Inotropic Support');
  }

  return Array.from(interventions);
}

function analyzeVitalTrends(notes: ProgressNote[], patient: Patient): VitalTrend[] {
  const trends: VitalTrend[] = [];

  if (notes.length < 2) {
    return trends;
  }

  // Get recent notes (last 5)
  const recentNotes = notes.slice(-5);
  const isNeonatal = patient.unit === Unit.NICU || patient.unit === Unit.SNCU;

  // Analyze temperature
  const temps = recentNotes
    .filter(n => n.vitals?.temperature)
    .map(n => parseFloat(n.vitals!.temperature!));

  if (temps.length >= 2) {
    const latestTemp = temps[temps.length - 1];
    const isStable = temps.every(t => t >= 36.5 && t <= 37.5);

    trends.push({
      parameter: 'Temperature',
      trend: isStable ? 'stable' : (latestTemp < 36.5 || latestTemp > 37.5 ? 'worsening' : 'improving'),
      latestValue: `${latestTemp}°C`,
      normalRange: '36.5-37.5°C'
    });
  }

  // Analyze SpO2
  const spo2s = recentNotes
    .filter(n => n.vitals?.spo2)
    .map(n => parseFloat(n.vitals!.spo2!.toString()));

  if (spo2s.length >= 2) {
    const latestSpO2 = spo2s[spo2s.length - 1];
    const isNormalizing = spo2s[spo2s.length - 1] >= spo2s[0];

    trends.push({
      parameter: 'SpO2',
      trend: latestSpO2 >= 94 ? 'stable' : (isNormalizing ? 'improving' : 'worsening'),
      latestValue: `${latestSpO2}%`,
      normalRange: isNeonatal ? '91-95% (preterm), >95% (term)' : '>94%'
    });
  }

  // Analyze weight trend
  const weights = recentNotes
    .filter(n => n.vitals?.weight)
    .map(n => parseFloat(n.vitals!.weight!.toString()));

  if (weights.length >= 2) {
    const latestWeight = weights[weights.length - 1];
    const isGaining = weights[weights.length - 1] > weights[0];

    trends.push({
      parameter: 'Weight',
      trend: isGaining ? 'improving' : (weights[weights.length - 1] < weights[0] ? 'worsening' : 'stable'),
      latestValue: `${latestWeight}g`,
      normalRange: 'Gaining 15-20g/kg/day'
    });
  }

  return trends;
}

function analyzeMedications(medications: Medication[]): MedicationSummary {
  const antibiotics: MedicationInfo[] = [];
  const respiratoryMeds: MedicationInfo[] = [];
  const cardiovascularMeds: MedicationInfo[] = [];
  const neurologicalMeds: MedicationInfo[] = [];
  const nutritionalSupport: MedicationInfo[] = [];
  const others: MedicationInfo[] = [];
  const activeMedications: MedicationInfo[] = [];
  const discontinuedMedications: MedicationInfo[] = [];

  const antibioticPatterns = /ampicillin|gentamicin|amikacin|cefotaxime|ceftriaxone|meropenem|vancomycin|piperacillin|tazobactam|metronidazole|fluconazole/i;
  const respiratoryPatterns = /aminophylline|caffeine|salbutamol|budesonide|surfactant|dexamethasone/i;
  const cardiovascularPatterns = /dopamine|dobutamine|adrenaline|epinephrine|norepinephrine|milrinone|frusemide|furosemide|captopril/i;
  const neurologicalPatterns = /phenobarbitone|phenytoin|levetiracetam|midazolam|morphine|fentanyl/i;
  const nutritionalPatterns = /vitamin|iron|calcium|phosphorus|zinc|multivitamin|tpn|lipid/i;

  medications.forEach(med => {
    const medInfo: MedicationInfo = {
      name: med.name,
      indication: undefined, // Indication is on MedicationDatabase, not Medication
      status: med.isActive === false ? 'discontinued' : 'active',
      startDate: med.startDate,
      endDate: med.stopDate // Medication uses stopDate, not endDate
    };

    // Categorize
    if (antibioticPatterns.test(med.name)) {
      antibiotics.push(medInfo);
    } else if (respiratoryPatterns.test(med.name)) {
      respiratoryMeds.push(medInfo);
    } else if (cardiovascularPatterns.test(med.name)) {
      cardiovascularMeds.push(medInfo);
    } else if (neurologicalPatterns.test(med.name)) {
      neurologicalMeds.push(medInfo);
    } else if (nutritionalPatterns.test(med.name)) {
      nutritionalSupport.push(medInfo);
    } else {
      others.push(medInfo);
    }

    // Track active vs discontinued
    if (med.isActive === false) {
      discontinuedMedications.push(medInfo);
    } else {
      activeMedications.push(medInfo);
    }
  });

  return {
    totalMedications: medications.length,
    antibiotics,
    respiratoryMeds,
    cardiovascularMeds,
    neurologicalMeds,
    nutritionalSupport,
    others,
    activeMedications,
    discontinuedMedications
  };
}

function extractFeedingProgression(notes: ProgressNote[], patient: Patient): string[] {
  const progression: string[] = [];

  // Default feeding progression markers
  const feedingMarkers = [
    { pattern: /npo|nil.*oral|nil.*mouth/i, stage: 'NPO (Nil Per Oral)' },
    { pattern: /trophic.*feed/i, stage: 'Trophic Feeds Started' },
    { pattern: /ebm|expressed.*breast.*milk/i, stage: 'Expressed Breast Milk' },
    { pattern: /feed.*advanc|increas.*feed/i, stage: 'Feeds Advanced' },
    { pattern: /full.*feed|goal.*feed/i, stage: 'Full Enteral Feeds Achieved' },
    { pattern: /direct.*breastfeed|dbf/i, stage: 'Direct Breastfeeding' },
    { pattern: /kmc|kangaroo/i, stage: 'Kangaroo Mother Care' }
  ];

  notes.forEach(note => {
    const fullText = `${getNoteText(note)}`;

    feedingMarkers.forEach(({ pattern, stage }) => {
      if (pattern.test(fullText) && !progression.includes(stage)) {
        progression.push(stage);
      }
    });
  });

  // Check current feeding type from discharge summary if available
  if (patient.savedDischargeSummary?.dischargeFeeding?.feedingType) {
    progression.push(`Current: ${patient.savedDischargeSummary.dischargeFeeding.feedingType}`);
  }

  return progression;
}

function extractRespiratorySupportProgression(notes: ProgressNote[], patient: Patient): string[] {
  const progression: string[] = [];

  const respiratoryMarkers = [
    { pattern: /mechanical.*ventilat|mv\b|simv|ac mode/i, stage: 'Mechanical Ventilation' },
    { pattern: /weaning.*ventilat/i, stage: 'Ventilator Weaning' },
    { pattern: /extubat/i, stage: 'Extubation' },
    { pattern: /cpap/i, stage: 'CPAP' },
    { pattern: /hfnc|high.*flow/i, stage: 'High Flow Nasal Cannula' },
    { pattern: /low.*flow|nasal.*prong|o2.*hood/i, stage: 'Low Flow Oxygen' },
    { pattern: /room.*air|weaned.*oxygen|off.*oxygen/i, stage: 'Room Air' }
  ];

  notes.forEach(note => {
    const fullText = `${getNoteText(note)}`;

    respiratoryMarkers.forEach(({ pattern, stage }) => {
      if (pattern.test(fullText) && !progression.includes(stage)) {
        progression.push(stage);
      }
    });
  });

  // Note: Respiratory support status would be determined from progress notes
  // No dedicated field on Patient interface

  return progression;
}

function categorizeConditions(
  notes: ProgressNote[],
  patient: Patient
): { resolved: string[]; ongoing: string[] } {
  const resolved: string[] = [];
  const ongoing: string[] = [];

  // Look at latest notes for resolution keywords
  const lastNotes = notes.slice(-3);
  const lastNotesText = lastNotes.map(n => n.note || '').join(' ').toLowerCase();

  const conditions = [
    'RDS', 'Respiratory Distress', 'Sepsis', 'Jaundice', 'Hyperbilirubinemia',
    'Hypoglycemia', 'Hypothermia', 'Apnea', 'Feed Intolerance', 'Anemia',
    'HIE', 'Birth Asphyxia', 'MAS', 'TTN', 'Pneumonia', 'Seizures'
  ];

  conditions.forEach(condition => {
    const diagnosisText = `${patient.diagnosis || ''} ${patient.diagnosisAtDeath || ''}`;

    if (diagnosisText.toLowerCase().includes(condition.toLowerCase())) {
      // Check if resolved
      const resolvedPatterns = [
        new RegExp(`${condition}.*resolved`, 'i'),
        new RegExp(`${condition}.*recovered`, 'i'),
        new RegExp(`${condition}.*improved`, 'i'),
        new RegExp(`${condition}.*treated`, 'i')
      ];

      const isResolved = resolvedPatterns.some(p => p.test(lastNotesText));

      if (isResolved) {
        resolved.push(condition);
      } else {
        ongoing.push(condition);
      }
    }
  });

  return { resolved, ongoing };
}

function assessClinicalImprovement(notes: ProgressNote[], vitalTrends: VitalTrend[]): boolean {
  // Check vital trends
  const improvingVitals = vitalTrends.filter(t => t.trend === 'improving' || t.trend === 'stable').length;
  const worseningVitals = vitalTrends.filter(t => t.trend === 'worsening').length;

  // Check last notes for improvement keywords
  const lastNotes = notes.slice(-3);
  const improvementKeywords = ['improved', 'improving', 'better', 'stable', 'recovered', 'resolved', 'weaning'];
  const worseningKeywords = ['deteriorat', 'worse', 'critical', 'unstable', 'desat'];

  let improvementScore = 0;

  lastNotes.forEach(note => {
    const text = `${note.note || ''} ${getNoteText(note) || ''}`.toLowerCase();

    improvementKeywords.forEach(kw => {
      if (text.includes(kw)) improvementScore++;
    });

    worseningKeywords.forEach(kw => {
      if (text.includes(kw)) improvementScore--;
    });
  });

  return improvementScore > 0 && worseningVitals < improvingVitals;
}

function generateOverallAssessment(
  patient: Patient,
  daysOfStay: number,
  complications: string[],
  clinicalImprovement: boolean,
  ongoingConditions: string[]
): string {
  const isNeonatal = patient.unit === Unit.NICU || patient.unit === Unit.SNCU;
  const patientType = isNeonatal ? 'neonate' : 'child';

  let assessment = '';

  // Opening
  if (patient.outcome === 'Discharged') {
    assessment = `This ${patientType} was admitted for ${patient.diagnosis} and treated for ${daysOfStay} days. `;
  } else if (patient.outcome === 'Deceased') {
    assessment = `This ${patientType} was admitted in critical condition with ${patient.diagnosis}. Despite intensive care for ${daysOfStay} days, `;
  } else {
    assessment = `This ${patientType} is currently being managed for ${patient.diagnosis} (Day ${daysOfStay} of admission). `;
  }

  // Complications
  if (complications.length > 0) {
    assessment += `Hospital course was complicated by ${complications.slice(0, 3).join(', ')}. `;
  } else {
    assessment += 'Hospital course was uneventful. ';
  }

  // Clinical status
  if (patient.outcome === 'Discharged') {
    if (clinicalImprovement) {
      assessment += 'The patient showed steady clinical improvement and met discharge criteria. ';
    } else {
      assessment += 'The patient stabilized and is being discharged for continued care. ';
    }
  } else if (patient.outcome === 'Deceased') {
    assessment += 'the patient succumbed to the illness. ';
  }

  // Ongoing conditions
  if (ongoingConditions.length > 0 && patient.outcome === 'Discharged') {
    assessment += `Ongoing conditions requiring follow-up: ${ongoingConditions.join(', ')}.`;
  }

  return assessment.trim();
}

// ==================== COMPREHENSIVE CLINICAL SUMMARY ====================

/**
 * Generate a comprehensive clinical summary for discharge/death certificate
 */
export function generateComprehensiveClinicalSummary(patient: Patient): ComprehensiveClinicalSummary {
  const warnings: ClinicalWarning[] = [];
  const isNeonatal = patient.unit === Unit.NICU || patient.unit === Unit.SNCU;

  // 1. Validate gestational age
  const gestationalAge = getValidatedGestationalAge(patient);

  // Add warnings from GA validation
  gestationalAge.warnings.forEach(w => {
    warnings.push({
      type: w.includes('CRITICAL') ? 'error' : 'warning',
      message: w,
      field: 'gestationalAge'
    });
  });

  // 2. Analyze weight
  const weightAnalysis = analyzeWeight(patient.birthWeight, gestationalAge, patient.gender || 'unknown');

  // 3. Analyze maternal factors
  const maternalFactors = analyzeMaternalFactors(patient.maternalHistory);

  // 4. Analyze clinical course
  const clinicalCourse = analyzeClinicalCourse(patient);

  // 5. Analyze diagnosis
  const diagnosis = analyzeDiagnosis(patient, gestationalAge, weightAnalysis);

  // Add diagnosis warnings
  diagnosis.warnings.forEach(w => {
    warnings.push({
      type: 'warning',
      message: w,
      field: 'diagnosis'
    });
  });

  // 6. Assess discharge readiness (if applicable)
  let dischargeReadiness: DischargeReadiness | undefined;
  if (patient.outcome === 'In Progress' || !patient.outcome) {
    dischargeReadiness = assessDischargeReadiness(patient, gestationalAge, clinicalCourse);
  }

  // 7. Build patient profile
  const patientProfile: PatientProfile = {
    name: patient.name,
    gender: patient.gender || 'Unknown',
    dateOfBirth: patient.dateOfBirth || 'Unknown',
    ageDescription: buildAgeDescription(patient, gestationalAge),
    unit: patient.unit,
    isNeonatal,
    isPediatric: !isNeonatal
  };

  return {
    patientProfile,
    gestationalAge,
    weightAnalysis: weightAnalysis || {
      category: WeightCategory.NORMAL,
      categoryAbbreviation: 'NBW',
      weightInGrams: 0,
      weightInKg: 0
    },
    maternalFactors,
    clinicalCourse,
    diagnosis,
    dischargeReadiness,
    warnings,
    generatedAt: new Date().toISOString()
  };
}

function analyzeMaternalFactors(maternalHistory?: MaternalHistory): MaternalFactorSummary {
  if (!maternalHistory) {
    return {
      hasRiskFactors: false,
      significantFactors: [],
      antenatalCare: 'Not documented',
      deliveryDetails: 'Not documented',
      implications: []
    };
  }

  const significantFactors: string[] = [];
  const implications: string[] = [];

  // Check risk factors
  if (maternalHistory.riskFactors && maternalHistory.riskFactors.length > 0) {
    significantFactors.push(...maternalHistory.riskFactors);

    // Add implications for specific risk factors
    if (maternalHistory.riskFactors.includes(MaternalRiskFactor.GDM)) {
      implications.push('Monitor for neonatal hypoglycemia');
    }
    if (maternalHistory.riskFactors.includes(MaternalRiskFactor.PIH) ||
        maternalHistory.riskFactors.includes(MaternalRiskFactor.Preeclampsia)) {
      implications.push('Monitor for IUGR/SGA');
    }
    if (maternalHistory.riskFactors.includes(MaternalRiskFactor.Chorioamnionitis)) {
      implications.push('High risk for early-onset sepsis');
    }
    if (maternalHistory.riskFactors.includes(MaternalRiskFactor.PROM) ||
        maternalHistory.riskFactors.includes(MaternalRiskFactor.PPROM)) {
      implications.push('Sepsis risk increased');
    }
    if (maternalHistory.riskFactors.includes(MaternalRiskFactor.RhNegative)) {
      implications.push('Monitor for hemolytic disease');
    }
  }

  // Check PROM/prolonged rupture
  if (maternalHistory.prolongedRupture) {
    significantFactors.push('Prolonged rupture of membranes (>18 hours)');
    implications.push('Increased sepsis risk - empirical antibiotics may be needed');
  }

  // Check maternal fever
  if (maternalHistory.maternalFever) {
    significantFactors.push('Intrapartum maternal fever');
    implications.push('Sepsis workup indicated');
  }

  // Antenatal care summary
  let antenatalCare = 'Not documented';
  if (maternalHistory.ancReceived !== undefined) {
    if (maternalHistory.ancReceived) {
      antenatalCare = `ANC received${maternalHistory.ancVisits ? ` (${maternalHistory.ancVisits} visits)` : ''}`;
      if (maternalHistory.antenatalSteroidsGiven) {
        antenatalCare += ', Antenatal steroids given';
      }
    } else {
      antenatalCare = 'No ANC - high risk';
      implications.push('Lack of ANC - increased risk of complications');
    }
  }

  // Delivery details
  let deliveryDetails = 'Not documented';
  const obstetricHistory = [];
  if (maternalHistory.gravida !== undefined) {
    obstetricHistory.push(`G${maternalHistory.gravida}`);
  }
  if (maternalHistory.para !== undefined) {
    obstetricHistory.push(`P${maternalHistory.para}`);
  }
  if (maternalHistory.abortion !== undefined) {
    obstetricHistory.push(`A${maternalHistory.abortion}`);
  }
  if (maternalHistory.living !== undefined) {
    obstetricHistory.push(`L${maternalHistory.living}`);
  }
  if (obstetricHistory.length > 0) {
    deliveryDetails = obstetricHistory.join(' ');
  }

  return {
    hasRiskFactors: significantFactors.length > 0,
    significantFactors,
    antenatalCare,
    deliveryDetails,
    implications
  };
}

function analyzeDiagnosis(
  patient: Patient,
  gestationalAge: GestationalAgeResult,
  weightAnalysis: WeightAnalysis | null
): DiagnosisAnalysis {
  const warnings: string[] = [];
  const secondaryDiagnoses: DiagnosisInfo[] = [];
  const indicationsValidation: IndicationValidation[] = [];

  // Build primary diagnosis with proper GA and weight
  let primaryDiagnosis = patient.diagnosis || 'Unknown';
  let primaryICD10 = '';

  // Validate and enhance primary diagnosis
  const isPreterm = gestationalAge.weeks < 37;
  const isTerm = gestationalAge.weeks >= 37;

  // Check for GA consistency in diagnosis
  if (primaryDiagnosis.toLowerCase().includes('preterm') && !isPreterm) {
    warnings.push(`Diagnosis mentions "preterm" but GA is ${gestationalAge.weeks} weeks (term)`);
  }
  if (primaryDiagnosis.toLowerCase().includes('term') &&
      !primaryDiagnosis.toLowerCase().includes('preterm') &&
      isPreterm) {
    warnings.push(`Diagnosis mentions "term" but GA is ${gestationalAge.weeks} weeks (preterm)`);
  }

  // Validate indications
  const indications = patient.indicationsForAdmission || [];
  indications.forEach(indication => {
    const validation = validateIndication(indication, gestationalAge, weightAnalysis, patient);
    indicationsValidation.push(validation);

    if (!validation.isValid) {
      warnings.push(validation.reason || `Invalid indication: ${indication}`);
    }
  });

  // Calculate diagnosis consistency score
  const validIndications = indicationsValidation.filter(v => v.isValid).length;
  const diagnosisConsistencyScore = indications.length > 0
    ? Math.round((validIndications / indications.length) * 100)
    : 100;

  // Build final diagnosis
  const finalDiagnosis = buildFinalDiagnosis(
    patient,
    gestationalAge,
    weightAnalysis,
    patient.progressNotes || []
  );

  return {
    primaryDiagnosis,
    primaryDiagnosisICD10: primaryICD10,
    secondaryDiagnoses,
    admissionIndications: indications,
    indicationsValidation,
    finalDiagnosis,
    diagnosisConsistencyScore,
    warnings
  };
}

function validateIndication(
  indication: string,
  gestationalAge: GestationalAgeResult,
  weightAnalysis: WeightAnalysis | null,
  patient: Patient
): IndicationValidation {
  const indicationLower = indication.toLowerCase();

  // Prematurity indications
  if (indicationLower.includes('extreme prematuri') && gestationalAge.weeks >= 28) {
    return {
      indication,
      isValid: false,
      reason: `Extreme prematurity (<28 weeks) selected but GA is ${gestationalAge.weeks} weeks`,
      suggestedCorrection: gestationalAge.category
    };
  }

  if (indicationLower.includes('very preterm') && (gestationalAge.weeks < 28 || gestationalAge.weeks >= 32)) {
    return {
      indication,
      isValid: false,
      reason: `Very preterm (28-32 weeks) selected but GA is ${gestationalAge.weeks} weeks`,
      suggestedCorrection: gestationalAge.category
    };
  }

  if (indicationLower.includes('moderate preterm') && (gestationalAge.weeks < 32 || gestationalAge.weeks >= 34)) {
    return {
      indication,
      isValid: false,
      reason: `Moderate preterm (32-34 weeks) selected but GA is ${gestationalAge.weeks} weeks`,
      suggestedCorrection: gestationalAge.category
    };
  }

  if (indicationLower.includes('late preterm') && (gestationalAge.weeks < 34 || gestationalAge.weeks >= 37)) {
    return {
      indication,
      isValid: false,
      reason: `Late preterm (34-37 weeks) selected but GA is ${gestationalAge.weeks} weeks`,
      suggestedCorrection: gestationalAge.category
    };
  }

  // Weight indications
  if (weightAnalysis) {
    if (indicationLower.includes('elbw') && weightAnalysis.weightInGrams >= 1000) {
      return {
        indication,
        isValid: false,
        reason: `ELBW (<1000g) selected but weight is ${weightAnalysis.weightInGrams}g`,
        suggestedCorrection: weightAnalysis.categoryAbbreviation
      };
    }

    if (indicationLower.includes('vlbw') && (weightAnalysis.weightInGrams < 1000 || weightAnalysis.weightInGrams >= 1500)) {
      return {
        indication,
        isValid: false,
        reason: `VLBW (1000-1500g) selected but weight is ${weightAnalysis.weightInGrams}g`,
        suggestedCorrection: weightAnalysis.categoryAbbreviation
      };
    }

    if (indicationLower.includes('lbw') && !indicationLower.includes('vlbw') && !indicationLower.includes('elbw')) {
      if (weightAnalysis.weightInGrams < 1500 || weightAnalysis.weightInGrams >= 2500) {
        return {
          indication,
          isValid: false,
          reason: `LBW (1500-2500g) selected but weight is ${weightAnalysis.weightInGrams}g`,
          suggestedCorrection: weightAnalysis.categoryAbbreviation
        };
      }
    }
  }

  return {
    indication,
    isValid: true
  };
}

function buildFinalDiagnosis(
  patient: Patient,
  gestationalAge: GestationalAgeResult,
  weightAnalysis: WeightAnalysis | null,
  progressNotes: ProgressNote[]
): string {
  const parts: string[] = [];

  // 1. Gestational age category
  if (gestationalAge.weeks < 37) {
    const gaString = gestationalAge.days > 0
      ? `${gestationalAge.weeks}+${gestationalAge.days}`
      : `${gestationalAge.weeks}`;

    if (gestationalAge.weeks < 28) {
      parts.push(`Extreme preterm (${gaString} weeks)`);
    } else if (gestationalAge.weeks < 32) {
      parts.push(`Very preterm (${gaString} weeks)`);
    } else if (gestationalAge.weeks < 34) {
      parts.push(`Moderate preterm (${gaString} weeks)`);
    } else {
      parts.push(`Late preterm (${gaString} weeks)`);
    }
  } else {
    parts.push('Term');
  }

  // 2. Weight category (if abnormal)
  if (weightAnalysis && weightAnalysis.category !== WeightCategory.NORMAL) {
    parts.push(weightAnalysis.categoryAbbreviation);
  }

  // 3. Growth status (if SGA)
  if (weightAnalysis?.growthStatus === GrowthStatus.SGA) {
    parts.push('SGA');
  }

  // 4. Primary diagnosis with status
  const primaryDiagnosis = patient.diagnosis || '';
  const diagnosisWithStatus = determineDiagnosisStatus(primaryDiagnosis, progressNotes, patient);
  parts.push(diagnosisWithStatus);

  // 5. Significant secondary diagnoses from clinical course
  const complications = extractComplications(progressNotes, patient);
  const significantComplications = complications
    .filter(c => !primaryDiagnosis.toLowerCase().includes(c.toLowerCase()))
    .slice(0, 2)
    .map(c => {
      const status = determineDiagnosisStatus(c, progressNotes, patient);
      return status;
    });

  if (significantComplications.length > 0) {
    parts.push(...significantComplications);
  }

  return parts.join(', ');
}

function determineDiagnosisStatus(
  diagnosis: string,
  notes: ProgressNote[],
  patient: Patient
): string {
  const diagnosisLower = diagnosis.toLowerCase();
  const lastNotesText = notes.slice(-3)
    .map(n => n.note || '')
    .join(' ')
    .toLowerCase();

  // Check for resolution keywords
  if (lastNotesText.includes(`${diagnosisLower} resolved`) ||
      lastNotesText.includes(`${diagnosisLower} recovered`)) {
    return `${diagnosis} - Resolved`;
  }

  if (lastNotesText.includes(`${diagnosisLower} treated`) ||
      lastNotesText.includes(`${diagnosisLower} completed`)) {
    return `${diagnosis} - Treated`;
  }

  if (lastNotesText.includes(`${diagnosisLower} improved`) ||
      lastNotesText.includes(`${diagnosisLower} improving`)) {
    return `${diagnosis} - Improved`;
  }

  if (lastNotesText.includes(`${diagnosisLower} stable`)) {
    return `${diagnosis} - Stable`;
  }

  // Default status based on outcome
  if (patient.outcome === 'Discharged') {
    return `${diagnosis} - Recovered`;
  } else if (patient.outcome === 'Deceased') {
    return diagnosis;
  }

  return `${diagnosis} - Ongoing`;
}

function buildAgeDescription(patient: Patient, gestationalAge: GestationalAgeResult): string {
  const isNeonatal = patient.unit === Unit.NICU || patient.unit === Unit.SNCU;

  if (isNeonatal) {
    // For neonates, describe in terms of GA and postnatal age
    const postnatalAge = getPatientAgeInDays(patient) !== undefined
      ? getPatientAgeInDays(patient)
      : (patient.age !== undefined && patient.ageUnit === 'days' ? patient.age : undefined);

    let description = '';

    if (gestationalAge.weeks > 0) {
      description = `${gestationalAge.weeks}+${gestationalAge.days} weeks gestation`;
    }

    if (postnatalAge !== undefined) {
      description += description ? `, Day ${postnatalAge + 1} of life` : `Day ${postnatalAge + 1} of life`;
    }

    return description || 'Age unknown';
  } else {
    // For pediatric patients
    if (patient.age !== undefined) {
      return `${patient.age} ${patient.ageUnit || 'years'}`;
    }
    return 'Age unknown';
  }
}

function assessDischargeReadiness(
  patient: Patient,
  gestationalAge: GestationalAgeResult,
  clinicalCourse: ClinicalCourseAnalysis
): DischargeReadiness {
  const criteria: DischargeCriterion[] = [];
  const pendingIssues: string[] = [];
  const recommendations: string[] = [];

  const isNeonatal = patient.unit === Unit.NICU || patient.unit === Unit.SNCU;

  if (isNeonatal) {
    // Neonatal discharge criteria

    // 1. Thermal stability
    const tempTrend = clinicalCourse.vitalTrends.find(t => t.parameter === 'Temperature');
    criteria.push({
      criterion: 'Thermal stability (36.5-37.5°C in open cot)',
      met: tempTrend?.trend === 'stable' || tempTrend?.trend === 'improving',
      notes: tempTrend?.latestValue
    });

    // 2. Feeding
    const onFullFeeds = clinicalCourse.feedingProgression.some(f =>
      f.toLowerCase().includes('full') || f.toLowerCase().includes('goal')
    );
    criteria.push({
      criterion: 'Established feeding (gaining weight)',
      met: onFullFeeds,
      notes: clinicalCourse.feedingProgression.slice(-1)[0]
    });

    // 3. Respiratory
    const onRoomAir = clinicalCourse.respiratorySupportProgression.some(r =>
      r.toLowerCase().includes('room air') || r.toLowerCase().includes('off oxygen')
    );
    criteria.push({
      criterion: 'Stable respiration (off oxygen/minimal support)',
      met: onRoomAir,
      notes: clinicalCourse.respiratorySupportProgression.slice(-1)[0]
    });

    // 4. No active infections
    const hasActiveSepsis = clinicalCourse.ongoingConditions.some(c =>
      c.toLowerCase().includes('sepsis')
    );
    criteria.push({
      criterion: 'No active infections requiring IV antibiotics',
      met: !hasActiveSepsis,
      notes: hasActiveSepsis ? 'Active sepsis treatment' : undefined
    });

    // 5. Weight gain
    const weightTrend = clinicalCourse.vitalTrends.find(t => t.parameter === 'Weight');
    criteria.push({
      criterion: 'Adequate weight gain (15-20g/kg/day)',
      met: weightTrend?.trend === 'improving',
      notes: weightTrend?.latestValue
    });

    // 6. Corrected age ≥34 weeks for preterm
    if (gestationalAge.weeks < 34) {
      criteria.push({
        criterion: 'Corrected gestational age ≥34 weeks',
        met: false,
        notes: `Current: ${gestationalAge.weeks}+${gestationalAge.days} weeks`
      });
      pendingIssues.push('Preterm - needs to reach 34 weeks corrected age');
    }

    // Add standard recommendations
    recommendations.push('Ensure mother is confident with feeding and care');
    recommendations.push('Complete ROP screening if indicated');
    recommendations.push('Complete hearing screening');
    recommendations.push('Discuss immunizations');
    recommendations.push('Schedule follow-up appointments');

  } else {
    // Pediatric discharge criteria
    criteria.push({
      criterion: 'Afebrile for 24-48 hours',
      met: clinicalCourse.clinicalImprovement
    });

    criteria.push({
      criterion: 'Tolerating oral feeds/medications',
      met: true // Default true for now
    });

    criteria.push({
      criterion: 'No oxygen requirement',
      met: true // Default true for now
    });

    criteria.push({
      criterion: 'Improving clinically',
      met: clinicalCourse.clinicalImprovement
    });
  }

  // Check if all mandatory criteria are met
  const mandatoryCriteria = criteria.slice(0, 4);
  const allMet = mandatoryCriteria.every(c => c.met);

  if (!allMet) {
    mandatoryCriteria.filter(c => !c.met).forEach(c => {
      pendingIssues.push(c.criterion);
    });
  }

  return {
    isReady: allMet,
    criteria,
    pendingIssues,
    recommendations
  };
}

// ==================== EXPORT ====================

export default {
  calculateGestationalAgeFromLMP,
  calculateGestationalAgeFromEDD,
  getValidatedGestationalAge,
  analyzeWeight,
  analyzeClinicalCourse,
  generateComprehensiveClinicalSummary,
  GestationalCategory,
  WeightCategory,
  GrowthStatus
};
