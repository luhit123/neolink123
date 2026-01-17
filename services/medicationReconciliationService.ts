import { Medication } from '../types';
import { ExtractedMedication, normalizeDrugName } from './medicationExtractionService';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ReconciliationResult {
  added: Medication[]; // Newly added medications
  updated: Medication[]; // Existing medications with updated dose/route/frequency
  stopped: Medication[]; // Medications marked as stopped
  unchanged: Medication[]; // Medications that remain the same
  errors: string[]; // Any errors or warnings
}

interface ReconciliationMetadata {
  addedBy: string;
  addedAt: string;
}

// ============================================================================
// LEVENSHTEIN DISTANCE (for fuzzy matching)
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching medication names (typo tolerance)
 * Distance ≤ 2 allows for minor typos
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

/**
 * Find existing medication that matches the given name
 * Uses exact match, normalized match, and fuzzy matching
 */
function findExactMatch(
  name: string,
  medications: Medication[]
): Medication | null {
  // Only search among active medications
  const activeMeds = medications.filter(m => m.isActive !== false);

  // 1. Exact case-insensitive match
  const exact = activeMeds.find(
    m => m.name.toLowerCase() === name.toLowerCase()
  );
  if (exact) {
    console.log(`✓ Exact match: "${name}" === "${exact.name}"`);
    return exact;
  }

  // 2. Normalized match (handles "Inj Ampicillin" → "Ampicillin")
  const normalizedName = normalizeDrugName(name);
  const normalized = activeMeds.find(
    m =>
      normalizeDrugName(m.name).toLowerCase() ===
      normalizedName.toLowerCase()
  );
  if (normalized) {
    console.log(
      `✓ Normalized match: "${name}" → "${normalized.name}"`
    );
    return normalized;
  }

  // 3. Fuzzy match (Levenshtein distance ≤ 2)
  // Catches typos: "Ampicilin" → "Ampicillin"
  const fuzzy = activeMeds.find(m => {
    const distance = levenshteinDistance(
      m.name.toLowerCase(),
      name.toLowerCase()
    );
    return distance <= 2;
  });

  if (fuzzy) {
    const distance = levenshteinDistance(
      fuzzy.name.toLowerCase(),
      name.toLowerCase()
    );
    console.log(
      `⚠️ Fuzzy match (distance=${distance}): "${name}" → "${fuzzy.name}"`
    );
    return fuzzy;
  }

  return null;
}

/**
 * Find all medications matching a given name (for stop commands)
 * Returns all matches for ambiguity handling
 */
function findAllMatches(
  name: string,
  medications: Medication[]
): Medication[] {
  const activeMeds = medications.filter(m => m.isActive !== false);
  const matches: Medication[] = [];
  const normalizedName = normalizeDrugName(name);

  for (const med of activeMeds) {
    const normalizedMedName = normalizeDrugName(med.name);

    // Exact or normalized match
    if (
      med.name.toLowerCase() === name.toLowerCase() ||
      normalizedMedName.toLowerCase() === normalizedName.toLowerCase()
    ) {
      matches.push(med);
      continue;
    }

    // Fuzzy match
    const distance = levenshteinDistance(
      normalizedMedName.toLowerCase(),
      normalizedName.toLowerCase()
    );
    if (distance <= 2) {
      matches.push(med);
    }
  }

  return matches;
}

// ============================================================================
// MAIN RECONCILIATION FUNCTION
// ============================================================================

/**
 * Reconcile extracted medications with existing patient medication list
 *
 * Algorithm:
 * 1. Process STOP commands first (mark medications as inactive)
 * 2. Process extracted medications (add new or update existing)
 * 3. Return detailed results with added/updated/stopped/unchanged lists
 */
export async function reconcileMedications(
  extractedMeds: ExtractedMedication[],
  existingMeds: Medication[],
  stoppedMedNames: string[],
  metadata: ReconciliationMetadata
): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    added: [],
    updated: [],
    stopped: [],
    unchanged: [],
    errors: []
  };

  // Create working copy of existing medications
  const workingMeds = [...existingMeds];

  console.log('🔄 Starting reconciliation:', {
    extracted: extractedMeds.length,
    existing: existingMeds.length,
    toStop: stoppedMedNames.length
  });

  // ============================================================================
  // STEP 1: PROCESS STOP COMMANDS FIRST
  // ============================================================================

  for (const stoppedName of stoppedMedNames) {
    const normalizedStop = normalizeDrugName(stoppedName);
    const matches = findAllMatches(normalizedStop, workingMeds);

    if (matches.length === 0) {
      result.errors.push(
        `Cannot stop "${stoppedName}": not found in active medications`
      );
      console.warn(`⚠️ Cannot find medication to stop: "${stoppedName}"`);
      continue;
    }

    if (matches.length === 1) {
      // Perfect - stop this medication
      const med = matches[0];
      med.isActive = false;
      med.stopDate = metadata.addedAt;
      med.stoppedBy = metadata.addedBy;
      med.stoppedAt = metadata.addedAt;
      result.stopped.push(med);
      console.log(`✓ Stopped: ${med.name}`);
    } else {
      // Multiple matches - stop most recently added
      matches.sort(
        (a, b) =>
          new Date(b.addedAt || 0).getTime() -
          new Date(a.addedAt || 0).getTime()
      );
      const med = matches[0];
      med.isActive = false;
      med.stopDate = metadata.addedAt;
      med.stoppedBy = metadata.addedBy;
      med.stoppedAt = metadata.addedAt;
      result.stopped.push(med);
      result.errors.push(
        `Ambiguous stop command for "${stoppedName}" (${matches.length} matches). Stopped most recent: "${med.name}"`
      );
      console.warn(
        `⚠️ Multiple matches for "${stoppedName}", stopped most recent: ${med.name}`
      );
    }
  }

  // ============================================================================
  // STEP 2: PROCESS EXTRACTED MEDICATIONS (ADD/UPDATE)
  // ============================================================================

  for (const extracted of extractedMeds) {
    // Skip if this is a stop command (already processed)
    if (extracted.action === 'stop') {
      continue;
    }

    const normalizedName = normalizeDrugName(extracted.name);

    // Find matching existing medication
    const match = findExactMatch(normalizedName, workingMeds);

    if (match && match.isActive !== false) {
      // Medication exists and is active

      if (extracted.action === 'continue') {
        // Just continuing - no changes needed
        result.unchanged.push(match);
        console.log(`→ Continuing: ${match.name} (no changes)`);
      } else {
        // Update dose/route/frequency (preserve startDate and original metadata)
        const originalStartDate = match.startDate;
        const originalAddedBy = match.addedBy;
        const originalAddedAt = match.addedAt;

        match.dose = extracted.dose;
        if (extracted.route) match.route = extracted.route;
        if (extracted.frequency) match.frequency = extracted.frequency;

        // Preserve original start metadata
        match.startDate = originalStartDate;
        match.addedBy = originalAddedBy;
        match.addedAt = originalAddedAt;

        // Track who updated it
        match.lastUpdatedBy = metadata.addedBy;
        match.lastUpdatedAt = metadata.addedAt;

        result.updated.push(match);
        console.log(
          `✓ Updated: ${match.name} (dose: ${extracted.dose}${extracted.route ? ', route: ' + extracted.route : ''}${extracted.frequency ? ', freq: ' + extracted.frequency : ''})`
        );
      }
    } else {
      // Medication doesn't exist or was previously stopped - add as new
      const newMed: Medication = {
        name: normalizedName,
        dose: extracted.dose,
        route: extracted.route,
        frequency: extracted.frequency,
        startDate: metadata.addedAt,
        isActive: true,
        addedBy: metadata.addedBy,
        addedAt: metadata.addedAt
      };

      workingMeds.push(newMed);
      result.added.push(newMed);
      console.log(
        `✓ Added: ${newMed.name} ${newMed.dose}${newMed.route ? ' ' + newMed.route : ''}${newMed.frequency ? ' ' + newMed.frequency : ''}`
      );
    }
  }

  // ============================================================================
  // STEP 3: COLLECT UNCHANGED MEDICATIONS
  // ============================================================================

  // Any medication not in added/updated/stopped is unchanged
  for (const med of workingMeds) {
    if (
      !result.added.includes(med) &&
      !result.updated.includes(med) &&
      !result.stopped.includes(med)
    ) {
      result.unchanged.push(med);
    }
  }

  // ============================================================================
  // LOGGING
  // ============================================================================

  console.log('✅ Reconciliation complete:', {
    added: result.added.length,
    updated: result.updated.length,
    stopped: result.stopped.length,
    unchanged: result.unchanged.length,
    errors: result.errors.length
  });

  if (result.errors.length > 0) {
    console.warn('⚠️ Reconciliation errors:', result.errors);
  }

  return result;
}

// ============================================================================
// UTILITY: Get all medications after reconciliation
// ============================================================================

/**
 * Helper to get complete medication list after reconciliation
 * Combines added, updated, stopped, and unchanged into single array
 */
export function getMedicationsAfterReconciliation(
  result: ReconciliationResult
): Medication[] {
  return [
    ...result.added,
    ...result.updated,
    ...result.stopped,
    ...result.unchanged
  ];
}
