import { Medication } from '../types';
import { GoogleGenAI } from '@google/genai';

// Initialize Neolink AI (powered by Gemini)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

// ============================================================================
// INTERFACES
// ============================================================================

export interface ExtractedMedication {
  name: string;
  dose: string;
  route?: string;
  frequency?: string;
  action: 'add' | 'continue' | 'stop' | 'update';
  confidence: number; // 0.0-1.0
  extractedFrom: string; // Original text snippet
}

export interface MedicationExtractionResult {
  medications: ExtractedMedication[];
  stoppedMedications: string[]; // Names only
  totalFound: number;
  confidence: number; // Overall confidence
  method: 'ai' | 'regex';
  processingTime: number; // milliseconds
}

interface ExtractionContext {
  age: number;
  ageUnit: string;
  unit: string;
  diagnosis: string;
  currentMedications: Medication[];
}

// ============================================================================
// DRUG NAME NORMALIZATION
// ============================================================================

/**
 * Normalize drug names for consistent matching
 * - Remove prefixes (Inj., Tab., Syp.)
 * - Remove dose info from name
 * - Standardize case
 * - Handle common abbreviations
 */
export function normalizeDrugName(name: string): string {
  if (!name) return '';

  // Remove prefixes: "Inj.", "Tab.", "Syp.", "Cap."
  name = name.replace(/^(Inj\.?|Tab\.?|Syp\.?|Cap\.?)\s+/i, '').trim();

  // Remove dose info from name: "Ampicillin 100mg" → "Ampicillin"
  name = name.replace(/\s+\d+\s*(mg|mcg|ml|g|units?).*/i, '').trim();

  // Remove trailing words like "injection", "tablet"
  name = name.replace(/\s+(injection|tablet|syrup|capsule)$/i, '').trim();

  // Standardize case: "ampicillin" → "Ampicillin"
  name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

  // Handle common abbreviations
  const aliases: Record<string, string> = {
    'Amp': 'Ampicillin',
    'Gent': 'Gentamicin',
    'Vanco': 'Vancomycin',
    'Cef': 'Cefotaxime',
    'Mero': 'Meropenem',
    'Metro': 'Metronidazole',
    'Dopa': 'Dopamine',
    'Dob': 'Dobutamine',
    'Epi': 'Epinephrine',
    'Norepi': 'Norepinephrine',
    'Phenobarb': 'Phenobarbital',
    'Pheny': 'Phenytoin',
    'Furo': 'Furosemide',
    'Caff': 'Caffeine'
  };

  return aliases[name] || name;
}

// ============================================================================
// STOP COMMAND DETECTION
// ============================================================================

/**
 * Detect stop/discontinue commands in clinical text
 * Patterns: "stop ampicillin", "discontinue gentamicin", "DC vancomycin", etc.
 */
function detectStopCommands(text: string): string[] {
  const stopCommands: string[] = [];

  const patterns = [
    // "Stop [medication]"
    /\b(stop|discontinue|dc|d\/c|hold|cease)\s+([A-Za-z][A-Za-z\s\-]+?)(?=\s|$|,|\.|\n)/gi,

    // "[medication] stopped"
    /\b([A-Za-z][A-Za-z\s\-]+?)\s+(stopped|discontinued|held|dc'd)(?=\s|$|,|\.|\n)/gi,

    // "Stop: [medication]"
    /\b(stop|discontinue|dc|hold):\s*([A-Za-z][A-Za-z\s\-]+?)(?=\s|$|,|\.|\n)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Extract medication name (different capture group based on pattern)
      let medName = match[2] || match[1];

      // Clean up
      medName = medName.trim();
      medName = medName.replace(/\s+(today|now|immediately|asap)$/i, '');

      // Only add if name is reasonable length (3+ characters)
      if (medName.length >= 3) {
        stopCommands.push(normalizeDrugName(medName));
      }
    }
  }

  // Remove duplicates
  return [...new Set(stopCommands)];
}

// ============================================================================
// AI EXTRACTION (Neolink AI)
// ============================================================================

/**
 * Extract medications using Neolink AI
 */
async function extractWithAI(
  noteText: string,
  context: ExtractionContext
): Promise<{ medications: ExtractedMedication[]; stoppedMedications: string[] } | null> {
  if (!genAI) {
    console.warn('⚠️ Neolink AI not configured');
    return null;
  }

  try {
    const prompt = `You are an expert NICU/PICU clinical pharmacist. Extract ALL medications mentioned in this clinical note with precise details.

Patient Context:
- Age: ${context.age} ${context.ageUnit}
- Unit: ${context.unit}
- Primary Diagnosis: ${context.diagnosis}

Clinical Note:
"""
${noteText}
"""

INSTRUCTIONS:
1. Extract EVERY medication mentioned (including IV fluids, blood products)
2. For each medication, identify:
   - Exact name (generic preferred)
   - Dose with units (e.g., "100mg/kg", "5mg")
   - Route (IV, PO, IM, SC, etc.)
   - Frequency (q12h, BD, TID, continuous, etc.)
   - Action: "add" (new), "continue" (ongoing), "stop" (discontinue)
3. Recognize all formats:
   - Traditional: "Inj Ampicillin 100mg/kg IV q12h"
   - Natural: "Start gentamicin 4mg/kg IV daily"
   - Shorthand: "Continue caffeine 5mg"
   - Stop commands: "Stop ampicillin", "Discontinue vancomycin"
4. For stopped medications, also list them separately in stoppedMedications array

Return ONLY valid JSON (no markdown, no explanations):
{
  "medications": [
    {
      "name": "Ampicillin",
      "dose": "100mg/kg",
      "route": "IV",
      "frequency": "q12h",
      "action": "add",
      "confidence": 0.95,
      "extractedFrom": "Inj Ampicillin 100mg/kg IV q12h"
    }
  ],
  "stoppedMedications": ["Gentamicin", "Vancomycin"]
}

IMPORTANT:
- Return ONLY JSON, no markdown code blocks
- confidence: 0.0-1.0 (how certain you are about this extraction)
- If no medications found, return empty arrays
- Normalize drug names (Amp → Ampicillin)
- Include exact text snippet in extractedFrom`;

    // Use the correct API pattern for @google/genai package
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    const responseText = result.text;

    // Clean response (remove markdown code blocks if present)
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Parse JSON
    const parsed = JSON.parse(cleanedText);

    // Validate structure
    if (!parsed.medications || !Array.isArray(parsed.medications)) {
      throw new Error('Invalid AI response structure');
    }

    // Normalize all medication names
    parsed.medications = parsed.medications.map((med: ExtractedMedication) => ({
      ...med,
      name: normalizeDrugName(med.name)
    }));

    parsed.stoppedMedications = (parsed.stoppedMedications || []).map(
      (name: string) => normalizeDrugName(name)
    );

    console.log('✅ AI extraction successful:', {
      found: parsed.medications.length,
      stopped: parsed.stoppedMedications.length
    });

    return parsed;
  } catch (error) {
    console.error('❌ AI extraction failed:', error);
    return null;
  }
}

// ============================================================================
// REGEX FALLBACK EXTRACTION
// ============================================================================

/**
 * Fallback regex-based extraction (enhanced from existing VoiceClinicalNote.tsx)
 */
function extractWithRegex(noteText: string): {
  medications: ExtractedMedication[];
  stoppedMedications: string[];
} {
  const medications: ExtractedMedication[] = [];

  // Find MEDICATIONS section (typically in PLAN)
  const medicationsMatch = noteText.match(
    /Medications?:\s*([\s\S]*?)(?=\n\n|IV Fluids?:|Feeds?:|Nutrition:|Monitoring:|IMPRESSION|PLAN|Investigations?:|Labs?:|$)/i
  );

  if (!medicationsMatch) {
    console.log('⚠️ No MEDICATIONS section found in note');
    return { medications: [], stoppedMedications: detectStopCommands(noteText) };
  }

  const medicationsText = medicationsMatch[1];
  const lines = medicationsText.split('\n');

  // Enhanced regex pattern
  const medicationRegex =
    /^(?:[\-\*•]\s*)?(?:Inj\.?|Tab\.?|Syp\.?|Cap\.?)?\s*([A-Za-z][A-Za-z\s\-\/]+?)(?:\s+(\d+(?:\.\d+)?(?:\s*(?:mg|mcg|g|ml|units?|%))?(?:\s*\/\s*kg)?(?:\s*\/\s*dose)?(?:\s*\/\s*day)?))?\s*(?:(IV|PO|IM|SC|PR|NG|SL|Inhalation|Topical|Rectal))?\s*(?:(q\d+h|Q\d+H|BD|TDS|TID|QID|OD|PRN|Continuous|STAT|Once|Daily))?\s*(?:\(Day\s*\d+)?/i;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.length < 3) continue;

    const match = medicationRegex.exec(trimmedLine);

    if (match) {
      const [, name, dose, route, frequency] = match;

      if (name && name.trim().length >= 3) {
        medications.push({
          name: normalizeDrugName(name.trim()),
          dose: dose?.trim() || 'As prescribed',
          route: route?.toUpperCase(),
          frequency: frequency?.toLowerCase(),
          action: 'add',
          confidence: 0.8, // Regex is less confident than AI
          extractedFrom: trimmedLine
        });
      }
    } else {
      // Fallback: Try to extract just the drug name
      const simpleName = trimmedLine
        .replace(/^[\-\*•]\s*/, '')
        .replace(/^(Inj\.?|Tab\.?|Syp\.?|Cap\.?)\s+/i, '')
        .replace(/\s+\d+.*/,' ')
        .trim();

      if (simpleName.length >= 3 && simpleName.length < 50) {
        medications.push({
          name: normalizeDrugName(simpleName),
          dose: 'As prescribed',
          action: 'add',
          confidence: 0.6, // Lower confidence for simple extraction
          extractedFrom: trimmedLine
        });
      }
    }
  }

  const stoppedMedications = detectStopCommands(noteText);

  console.log('✅ Regex extraction:', {
    found: medications.length,
    stopped: stoppedMedications.length
  });

  return { medications, stoppedMedications };
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract medications from clinical note text
 * Tries AI first, falls back to regex if AI fails
 */
export async function extractMedicationsFromNote(
  noteText: string,
  context: ExtractionContext
): Promise<MedicationExtractionResult> {
  const startTime = Date.now();

  // Validate input
  if (!noteText || noteText.trim().length === 0) {
    return {
      medications: [],
      stoppedMedications: [],
      totalFound: 0,
      confidence: 0,
      method: 'regex',
      processingTime: Date.now() - startTime
    };
  }

  // Try AI extraction first
  const aiResult = await extractWithAI(noteText, context);

  if (aiResult && aiResult.medications.length > 0) {
    // AI succeeded
    const avgConfidence =
      aiResult.medications.reduce((sum, med) => sum + med.confidence, 0) /
      aiResult.medications.length;

    return {
      medications: aiResult.medications,
      stoppedMedications: aiResult.stoppedMedications,
      totalFound: aiResult.medications.length + aiResult.stoppedMedications.length,
      confidence: avgConfidence,
      method: 'ai',
      processingTime: Date.now() - startTime
    };
  }

  // Fallback to regex
  console.log('⚠️ Falling back to regex extraction');
  const regexResult = extractWithRegex(noteText);

  const avgConfidence =
    regexResult.medications.length > 0
      ? regexResult.medications.reduce((sum, med) => sum + med.confidence, 0) /
        regexResult.medications.length
      : 0;

  return {
    medications: regexResult.medications,
    stoppedMedications: regexResult.stoppedMedications,
    totalFound: regexResult.medications.length + regexResult.stoppedMedications.length,
    confidence: avgConfidence,
    method: 'regex',
    processingTime: Date.now() - startTime
  };
}
