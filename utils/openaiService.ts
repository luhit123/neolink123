import { Patient, ReferralDetails, ProgressNote, Medication } from '../types';

// Get OpenAI API key from environment variables
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_MODEL = 'gpt-5.2'; // Primary model

interface ReferralLetterParams {
  patient: Patient;
  referralDetails: ReferralDetails;
  fromInstitutionName: string;
  fromInstitutionAddress?: string;
  toInstitutionName: string;
  toInstitutionAddress?: string;
  referredBy: string;
  referredByRole: string;
  referralDate: string;
}

/**
 * Format progress notes into a readable summary for AI
 */
function formatProgressNotes(notes: ProgressNote[]): string {
  if (!notes || notes.length === 0) return 'No progress notes recorded.';

  // Sort notes by date (most recent last)
  const sortedNotes = [...notes].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return sortedNotes.slice(-10).map((note, index) => {
    const date = new Date(note.date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    let noteText = `Day ${index + 1} (${date}):`;

    if (note.note) {
      noteText += ` ${note.note}`;
    }

    if (note.vitals) {
      const vitalsParts = Object.entries(note.vitals)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k}: ${v}`);
      if (vitalsParts.length > 0) {
        noteText += ` Vitals: ${vitalsParts.join(', ')}.`;
      }
    }

    if (note.medications && note.medications.length > 0) {
      const meds = note.medications.map(m => `${m.name} ${m.dose}`).join(', ');
      noteText += ` Medications: ${meds}.`;
    }

    if (note.examination) {
      const examParts = Object.entries(note.examination)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k}: ${v}`);
      if (examParts.length > 0) {
        noteText += ` Examination: ${examParts.join(', ')}.`;
      }
    }

    return noteText;
  }).join('\n');
}

/**
 * Extract all unique medications from progress notes
 */
function extractAllMedications(notes: ProgressNote[]): Medication[] {
  if (!notes) return [];

  const medicationMap = new Map<string, Medication>();

  notes.forEach(note => {
    if (note.medications) {
      note.medications.forEach(med => {
        const key = `${med.name}-${med.dose}`;
        if (!medicationMap.has(key)) {
          medicationMap.set(key, med);
        }
      });
    }
  });

  return Array.from(medicationMap.values());
}

/**
 * Helper function to call OpenAI API
 */
async function callOpenAI(prompt: string, systemPrompt?: string, maxTokens: number = 2048): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Please add VITE_OPENAI_API_KEY to your .env file.');
  }

  // Determine if this is a newer model that uses max_completion_tokens
  const isNewerModel = OPENAI_MODEL.startsWith('gpt-5') || OPENAI_MODEL.startsWith('o1') || OPENAI_MODEL.startsWith('o3');
  const tokenParam = isNewerModel ? 'max_completion_tokens' : 'max_tokens';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        [tokenParam]: maxTokens
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API Error:', error);

      // Fallback to GPT-4o if GPT-5.2 is not available or incompatible
      if (error.error?.code === 'model_not_found' || error.error?.message?.includes('not supported')) {
        console.warn('GPT-5.2 not available or incompatible, falling back to GPT-4o...');
        const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: prompt }
            ],
            temperature: 0.4,
            max_tokens: maxTokens
          })
        });

        if (!fallbackResponse.ok) {
          throw new Error('OpenAI API request failed');
        }

        const fallbackData = await fallbackResponse.json();
        return fallbackData.choices?.[0]?.message?.content?.trim() || '';
      }

      throw new Error(error.error?.message || 'OpenAI API request failed');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('OpenAI request failed:', error);
    throw error;
  }
}

/**
 * Generate a professional medical referral letter using OpenAI GPT-5.2
 */
export async function generateReferralLetter(params: ReferralLetterParams): Promise<string> {
  const {
    patient,
    referralDetails,
    fromInstitutionName,
    referredBy,
    referredByRole,
    referralDate
  } = params;

  // Format patient age
  const patientAge = `${patient.age} ${patient.ageUnit}`;

  // Calculate duration of stay
  const admissionDate = new Date(patient.admissionDate);
  const today = new Date();
  const daysOfStay = Math.ceil((today.getTime() - admissionDate.getTime()) / (1000 * 60 * 60 * 24));

  // Format vital signs if available
  const vitalSignsText = referralDetails.vitalSignsAtReferral
    ? Object.entries(referralDetails.vitalSignsAtReferral)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key.toUpperCase()}: ${value}`)
      .join(', ')
    : 'Not recorded';

  // Format treatments provided
  const treatmentsText = referralDetails.treatmentsProvided.length > 0
    ? referralDetails.treatmentsProvided.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : 'None specified';

  // Format progress notes for comprehensive history
  const progressNotesText = formatProgressNotes(patient.progressNotes);

  // Extract all medications given during the stay
  const allMedications = extractAllMedications(patient.progressNotes);
  const medicationsText = allMedications.length > 0
    ? allMedications.map(m => `- ${m.name} ${m.dose}${m.route ? ` (${m.route})` : ''}${m.frequency ? ` ${m.frequency}` : ''}`).join('\n')
    : 'No medications recorded';

  // Create the comprehensive prompt
  const prompt = `You are a medical professional writing a comprehensive clinical summary for a patient referral document. Based on the following complete patient information, generate a detailed but well-organized clinical summary that covers the ENTIRE patient journey from admission to referral.

=== PATIENT INFORMATION ===
Name: ${patient.name}
Age: ${patientAge}
Gender: ${patient.gender}
Unit: ${patient.unit}
Institution: ${fromInstitutionName}

=== ADMISSION DETAILS ===
Date of Admission: ${new Date(patient.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
Duration of Stay: ${daysOfStay} days
Admission Diagnosis: ${patient.diagnosis}

=== CLINICAL COURSE / PROGRESS NOTES ===
${progressNotesText}

=== MEDICATIONS GIVEN DURING STAY ===
${medicationsText}

=== CURRENT STATUS AT REFERRAL ===
Current Diagnosis: ${referralDetails.diagnosisAtReferral}
Current Condition: ${referralDetails.conditionAtReferral}
Current Vitals: ${vitalSignsText}
Treatments Provided: ${treatmentsText}
${referralDetails.investigationsPerformed ? `Investigations: ${referralDetails.investigationsPerformed}` : ''}
${referralDetails.recommendedTreatment ? `Recommended Treatment: ${referralDetails.recommendedTreatment}` : ''}

=== REASON FOR REFERRAL ===
${referralDetails.reasonForReferral}

=== INSTRUCTIONS ===
Generate a COMPREHENSIVE clinical summary that includes:

1. **Admission Summary**: Why the patient was admitted, with what condition and initial diagnosis.

2. **Course of Treatment**: What treatments/procedures were performed during the stay, key medications given.

3. **Clinical Progress**: How the patient progressed day by day (improving, worsening, complications).

4. **Current Status**: Patient's condition at the time of referral.

5. **Reason for Referral**: Why the patient is being referred, what specialized care is needed.

Write in a professional medical narrative format (not bullet points). Keep it detailed but concise (6-8 sentences). Use plain text only - NO markdown, NO bold, NO bullet points, NO asterisks. The summary should give the receiving institution a complete picture of the patient's journey and why this referral is necessary.`;

  const systemPrompt = 'You are a senior medical professional specializing in pediatric and neonatal care. Generate professional, accurate medical documentation.';

  try {
    const generatedText = await callOpenAI(prompt, systemPrompt);
    return generatedText;
  } catch (error) {
    console.error('Error generating referral letter:', error);
    throw new Error(`Failed to generate referral letter: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a concise clinical summary using OpenAI GPT-5.2
 */
export async function generateClinicalSummary(
  diagnosis: string,
  treatmentsProvided: string[],
  condition: string,
  investigations?: string
): Promise<string> {
  const prompt = `Generate a concise clinical summary (2-3 sentences) based on:

Diagnosis: ${diagnosis}
Current Condition: ${condition}
Treatments Given: ${treatmentsProvided.join(', ')}
${investigations ? `Investigations: ${investigations}` : ''}

Make it professional and medically accurate, suitable for a referral letter.`;

  try {
    const summary = await callOpenAI(prompt, undefined, 256);
    return summary;
  } catch (error) {
    console.error('Error generating clinical summary:', error);
    throw error;
  }
}

/**
 * Test if OpenAI API key is configured and working
 */
export async function testOpenAIConnection(): Promise<boolean> {
  if (!OPENAI_API_KEY) {
    return false;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      })
    });

    return response.ok;
  } catch (error) {
    console.error('OpenAI connection test failed:', error);
    return false;
  }
}

// Keep backward compatibility - export with old name too
export const testGeminiConnection = testOpenAIConnection;
