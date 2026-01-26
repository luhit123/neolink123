import { GoogleGenAI } from '@google/genai';
import { Patient } from '../types';
import { AppContext, ChatMessage } from '../types/chat';
import { answerClinicalQuestion } from './openaiService';

const getApiKey = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }
  return apiKey;
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

/**
 * FLEXIBLE DATABASE SEARCH
 *
 * This approach:
 * 1. Always includes a comprehensive database summary
 * 2. Uses AI to search through and analyze ALL your data
 * 3. Formulates answers based on what's actually in the database
 * 4. Never returns "no patients found" - always gives context
 */

export async function handleComplexQuery(
  query: string,
  context: AppContext,
  patients: Patient[],
  conversationHistory?: ChatMessage[]
): Promise<string> {
  try {
    const queryLower = query.toLowerCase();

    // Check if it's a pure clinical question (not about the database)
    const isClinicalQuestion =
      !queryLower.includes('patient') &&
      !queryLower.includes('admission') &&
      !queryLower.includes('mortality') &&
      !queryLower.includes('death') &&
      !queryLower.includes('discharge') &&
      !queryLower.includes('unit') &&
      !queryLower.includes('nicu') &&
      !queryLower.includes('picu') &&
      !queryLower.includes('hdu') &&
      !queryLower.includes('ward') &&
      !queryLower.includes('show') &&
      !queryLower.includes('how many') &&
      !queryLower.includes('list') &&
      !queryLower.includes('find') &&
      !queryLower.includes('today') &&
      !queryLower.includes('yesterday') &&
      !queryLower.includes('count') &&
      !queryLower.includes('rate') &&
      (queryLower.includes('what is') ||
        queryLower.includes('how to') ||
        queryLower.includes('explain') ||
        queryLower.includes('why') ||
        queryLower.includes('treatment') ||
        queryLower.includes('symptom'));

    if (isClinicalQuestion) {
      return await answerClinicalQuestionWithContext(query, context, patients, conversationHistory);
    }

    // For database queries: Use comprehensive data analysis
    return await queryDatabaseComprehensive(query, patients, context, conversationHistory);
  } catch (error) {
    console.error('Error handling complex query:', error);
    throw new Error('Failed to process your query. Please try again.');
  }
}

/**
 * Creates a comprehensive, searchable database summary
 * AI can read and analyze this to answer ANY question about the data
 */
function createComprehensiveDatabaseSummary(patients: Patient[]): string {
  if (patients.length === 0) {
    return 'Database is empty - no patients found.';
  }

  const summary: string[] = [];

  summary.push(`=== COMPLETE DATABASE SUMMARY ===`);
  summary.push(`Total Patients in Database: ${patients.length}\n`);

  // 1. OUTCOMES BREAKDOWN
  const outcomes = {
    'In Progress': patients.filter(p => p.outcome === 'In Progress'),
    'Discharged': patients.filter(p => p.outcome === 'Discharged'),
    'Deceased': patients.filter(p => p.outcome === 'Deceased'),
    'Referred': patients.filter(p => p.outcome === 'Referred'),
  };

  summary.push(`--- OUTCOMES ---`);
  Object.entries(outcomes).forEach(([outcome, pats]) => {
    const percentage = ((pats.length / patients.length) * 100).toFixed(1);
    summary.push(`${outcome}: ${pats.length} patients (${percentage}%)`);
  });
  summary.push('');

  // 2. UNIT BREAKDOWN
  const units = {
    'NICU': patients.filter(p => p.unit === 'NICU'),
    'PICU': patients.filter(p => p.unit === 'PICU'),
    'HDU': patients.filter(p => p.unit === 'HDU'),
    'WARD': patients.filter(p => p.unit === 'WARD'),
  };

  summary.push(`--- UNITS ---`);
  Object.entries(units).forEach(([unit, pats]) => {
    if (pats.length > 0) {
      const percentage = ((pats.length / patients.length) * 100).toFixed(1);
      const deceased = pats.filter(p => p.outcome === 'Deceased').length;
      const mortalityRate = pats.length > 0 ? ((deceased / pats.length) * 100).toFixed(1) : '0';

      summary.push(`${unit}: ${pats.length} patients (${percentage}%)`);
      summary.push(`  - Mortality: ${deceased} deaths (${mortalityRate}% mortality rate)`);
      summary.push(`  - Discharged: ${pats.filter(p => p.outcome === 'Discharged').length}`);
      summary.push(`  - In Progress: ${pats.filter(p => p.outcome === 'In Progress').length}`);
    }
  });
  summary.push('');

  // 3. BIRTH WEIGHT CATEGORIES
  const weights = patients.map(p => {
    const w = typeof p.birthWeight === 'string' ? parseFloat(p.birthWeight) : p.birthWeight;
    return { patient: p, weight: isNaN(w) ? null : w };
  }).filter(x => x.weight !== null);

  const elbw = weights.filter(x => x.weight! < 1);
  const vlbw = weights.filter(x => x.weight! >= 1 && x.weight! < 1.5);
  const lbw = weights.filter(x => x.weight! >= 1.5 && x.weight! < 2.5);
  const normal = weights.filter(x => x.weight! >= 2.5);

  summary.push(`--- BIRTH WEIGHT CATEGORIES ---`);
  summary.push(`ELBW (<1kg): ${elbw.length} patients`);
  summary.push(`  - Deceased: ${elbw.filter(x => x.patient.outcome === 'Deceased').length} (${elbw.length > 0 ? ((elbw.filter(x => x.patient.outcome === 'Deceased').length / elbw.length) * 100).toFixed(1) : 0}% mortality)`);
  summary.push(`VLBW (1-1.5kg): ${vlbw.length} patients`);
  summary.push(`  - Deceased: ${vlbw.filter(x => x.patient.outcome === 'Deceased').length} (${vlbw.length > 0 ? ((vlbw.filter(x => x.patient.outcome === 'Deceased').length / vlbw.length) * 100).toFixed(1) : 0}% mortality)`);
  summary.push(`LBW (1.5-2.5kg): ${lbw.length} patients`);
  summary.push(`  - Deceased: ${lbw.filter(x => x.patient.outcome === 'Deceased').length} (${lbw.length > 0 ? ((lbw.filter(x => x.patient.outcome === 'Deceased').length / lbw.length) * 100).toFixed(1) : 0}% mortality)`);
  summary.push(`Normal (≥2.5kg): ${normal.length} patients`);
  summary.push(`  - Deceased: ${normal.filter(x => x.patient.outcome === 'Deceased').length} (${normal.length > 0 ? ((normal.filter(x => x.patient.outcome === 'Deceased').length / normal.length) * 100).toFixed(1) : 0}% mortality)`);
  summary.push('');

  // 4. ADMISSION DATE RANGES & TIME-BASED ANALYSIS
  const dates = patients.map(p => new Date(p.admissionDate)).filter(d => !isNaN(d.getTime()));
  if (dates.length > 0) {
    dates.sort((a, b) => a.getTime() - b.getTime());
    const earliest = dates[0];
    const latest = dates[dates.length - 1];

    summary.push(`--- TIME RANGE ---`);
    summary.push(`Earliest Admission: ${earliest.toLocaleDateString()}`);
    summary.push(`Latest Admission: ${latest.toLocaleDateString()}`);
    summary.push('');

    // Monthly breakdown
    const monthlyData: Record<string, Patient[]> = {};
    patients.forEach(p => {
      const date = new Date(p.admissionDate);
      if (!isNaN(date.getTime())) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')} (${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()})`;
        if (!monthlyData[monthKey]) monthlyData[monthKey] = [];
        monthlyData[monthKey].push(p);
      }
    });

    summary.push(`--- MONTHLY BREAKDOWN ---`);
    Object.entries(monthlyData)
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([month, pats]) => {
        const deceased = pats.filter(p => p.outcome === 'Deceased').length;
        const discharged = pats.filter(p => p.outcome === 'Discharged').length;
        const referred = pats.filter(p => p.outcome === 'Referred').length;
        const inProgress = pats.filter(p => p.outcome === 'In Progress').length;
        const mortalityRate = ((deceased / pats.length) * 100).toFixed(1);

        summary.push(`${month}: ${pats.length} total admissions`);
        summary.push(`  - Deceased: ${deceased} (${mortalityRate}% mortality)`);
        summary.push(`  - Discharged: ${discharged}`);
        summary.push(`  - Referred: ${referred}`);
        summary.push(`  - In Progress: ${inProgress}`);
      });
    summary.push('');

    // Recent admissions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentAdmissions = patients.filter(p => {
      const date = new Date(p.admissionDate);
      return date >= thirtyDaysAgo;
    });

    if (recentAdmissions.length > 0) {
      summary.push(`--- RECENT ACTIVITY (Last 30 Days) ---`);
      summary.push(`Total Admissions: ${recentAdmissions.length}`);
      summary.push(`- Deceased: ${recentAdmissions.filter(p => p.outcome === 'Deceased').length}`);
      summary.push(`- Discharged: ${recentAdmissions.filter(p => p.outcome === 'Discharged').length}`);
      summary.push(`- Referred: ${recentAdmissions.filter(p => p.outcome === 'Referred').length}`);
      summary.push(`- In Progress: ${recentAdmissions.filter(p => p.outcome === 'In Progress').length}`);
      summary.push('');
    }
  }

  // 5. TOP DIAGNOSES
  const diagnoses: Record<string, number> = {};
  patients.forEach(p => {
    if (p.diagnosis && p.diagnosis.trim()) {
      const diag = p.diagnosis.trim();
      diagnoses[diag] = (diagnoses[diag] || 0) + 1;
    }
  });

  const topDiagnoses = Object.entries(diagnoses)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (topDiagnoses.length > 0) {
    summary.push(`--- TOP 10 DIAGNOSES ---`);
    topDiagnoses.forEach(([diag, count]) => {
      summary.push(`${diag}: ${count} patients`);
    });
    summary.push('');
  }

  // 6. GENDER BREAKDOWN
  const genders = {
    'Male': patients.filter(p => p.gender === 'Male').length,
    'Female': patients.filter(p => p.gender === 'Female').length,
  };

  summary.push(`--- GENDER DISTRIBUTION ---`);
  Object.entries(genders).forEach(([gender, count]) => {
    const percentage = ((count / patients.length) * 100).toFixed(1);
    summary.push(`${gender}: ${count} (${percentage}%)`);
  });
  summary.push('');

  summary.push(`=== END DATABASE SUMMARY ===\n`);

  return summary.join('\n');
}

/**
 * Get detailed patient list for specific queries
 */
function getDetailedPatientList(patients: Patient[], limit: number = 50): string {
  if (patients.length === 0) return '';

  const limited = patients.slice(0, limit);
  const details: string[] = [];

  details.push(`\n--- DETAILED PATIENT LIST (Showing ${limited.length} of ${patients.length}) ---`);

  limited.forEach((p, i) => {
    details.push(`\n${i + 1}. ${p.name || 'Unknown'}`);
    details.push(`   Unit: ${p.unit} | Outcome: ${p.outcome}`);
    details.push(`   Age: ${p.age} ${p.ageUnit} | Gender: ${p.gender}`);
    details.push(`   Birth Weight: ${p.birthWeight || 'N/A'} kg`);
    details.push(`   Diagnosis: ${p.diagnosis || 'N/A'}`);
    details.push(`   Admitted: ${new Date(p.admissionDate).toLocaleDateString()}`);
  });

  if (patients.length > limit) {
    details.push(`\n... and ${patients.length - limit} more patients`);
  }

  return details.join('\n');
}

/**
 * Query database with comprehensive data access
 */
async function queryDatabaseComprehensive(
  query: string,
  patients: Patient[],
  context: AppContext,
  conversationHistory?: ChatMessage[]
): Promise<string> {
  try {
    console.log('📊 Querying database with', patients.length, 'patients...');

    // Create comprehensive database summary
    const dbSummary = createComprehensiveDatabaseSummary(patients);

    // Build conversation history
    let historyContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = '\n\nPrevious conversation context:\n';
      conversationHistory.slice(-4).forEach((msg) => {
        historyContext += `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}\n`;
      });
    }

    // Context summary
    let contextSummary = `Current Context: Page=${context.currentPage}`;
    if (context.selectedUnit) contextSummary += `, Unit=${context.selectedUnit}`;
    if (context.activeFilters?.unit) contextSummary += `, Filtered to unit: ${context.activeFilters.unit}`;
    if (context.activeFilters?.outcome) contextSummary += `, Filtered to outcome: ${context.activeFilters.outcome}`;

    // Check if user wants detailed patient list
    const queryLower = query.toLowerCase();
    const wantsDetailedList =
      queryLower.includes('show me') ||
      queryLower.includes('list') ||
      queryLower.includes('who are') ||
      queryLower.includes('which patients');

    let detailedList = '';
    if (wantsDetailedList) {
      detailedList = getDetailedPatientList(patients, 30);
    }

    // Build the AI prompt
    const prompt = `You are NeoLink AI, a clinical data analysis assistant with access to a hospital's complete patient database.

${contextSummary}

${dbSummary}${detailedList}

${historyContext}

User Question: "${query}"

INSTRUCTIONS:
1. The database summary above contains ALL the data you need to answer the question
2. Search through the data systematically to find relevant information
3. Calculate any rates, percentages, or statistics needed
4. If the user asks about a specific time period (like "December") and that data exists, focus on it
5. If the user asks about something that doesn't exist in the data, clearly state that and provide the closest relevant information
6. Be specific with numbers - cite exact counts and percentages from the data
7. If asked to list patients, use the detailed list provided
8. Format your response clearly with bullet points or tables where appropriate

IMPORTANT: Base your answer ONLY on the actual data provided above. Do not make assumptions or provide generic medical information unless specifically asked.

Provide a clear, data-driven answer:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    console.log('✅ Query completed successfully');
    return response.text;
  } catch (error) {
    console.error('Error in comprehensive database query:', error);
    throw error;
  }
}

/**
 * Answer clinical questions with context
 */
async function answerClinicalQuestionWithContext(
  question: string,
  context: AppContext,
  patients: Patient[],
  conversationHistory?: ChatMessage[]
): Promise<string> {
  try {
    let historyContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = '\n\nPrevious conversation:\n';
      conversationHistory.slice(-4).forEach((msg) => {
        historyContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 150)}...\n`;
      });
    }

    const enhancedQuestion = `Context: The user is viewing a medical dashboard with ${patients.length} patients.

${historyContext}

User Question: ${question}

Please provide a clear, evidence-based clinical answer.`;

    return await answerClinicalQuestion(enhancedQuestion);
  } catch (error) {
    console.error('Error answering clinical question:', error);
    throw error;
  }
}
