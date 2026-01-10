import { GoogleGenAI } from '@google/genai';
import { Patient, Unit } from '../types';
import { AppContext, ChatMessage } from '../types/chat';
import {
  getAnalyticsSummary,
  getPatientSummaries,
  getTrendsData,
  getOutcomeStats,
  parseQueryForCriteria,
  getContextSummary,
} from './chatDataAggregator';
import { answerClinicalQuestion } from './geminiService';

const getApiKey = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Missing VITE_GEMINI_API_KEY environment variable.');
    throw new Error('Gemini API key is not configured.');
  }
  return apiKey;
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

/**
 * Main router for handling complex queries
 */
export async function handleComplexQuery(
  query: string,
  context: AppContext,
  patients: Patient[],
  conversationHistory?: ChatMessage[]
): Promise<string> {
  try {
    const queryLower = query.toLowerCase();

    // Detect query type
    if (
      queryLower.includes('mortality') ||
      queryLower.includes('death') ||
      queryLower.includes('deceased') ||
      queryLower.includes('birth weight') ||
      queryLower.includes('elbw') ||
      queryLower.includes('vlbw') ||
      queryLower.includes('lbw') ||
      queryLower.includes('outcome')
    ) {
      return await queryAnalytics(query, patients, context, conversationHistory);
    }

    if (
      queryLower.includes('admission') ||
      queryLower.includes('admitted') ||
      queryLower.includes('trend') ||
      queryLower.includes('today') ||
      queryLower.includes('yesterday') ||
      queryLower.includes('last 7 days') ||
      queryLower.includes('last week') ||
      queryLower.includes('last month')
    ) {
      return await queryAnalytics(query, patients, context, conversationHistory);
    }

    if (
      queryLower.includes('patient') &&
      (queryLower.includes('list') ||
        queryLower.includes('show') ||
        queryLower.includes('find') ||
        queryLower.includes('search'))
    ) {
      return await queryPatientData(query, patients, context);
    }

    if (
      queryLower.includes('generate report') ||
      queryLower.includes('create report') ||
      queryLower.includes('summary') ||
      queryLower.includes('handoff')
    ) {
      return await generateCustomReport(query, patients, context);
    }

    // Default to clinical Q&A
    return await answerClinicalQuestionWithContext(query, context, patients, conversationHistory);
  } catch (error) {
    console.error('Error handling complex query:', error);
    throw new Error('Failed to process your query. Please try again.');
  }
}

/**
 * Handle analytics queries
 */
export async function queryAnalytics(
  question: string,
  patients: Patient[],
  context: AppContext,
  conversationHistory?: ChatMessage[]
): Promise<string> {
  try {
    const criteria = parseQueryForCriteria(question);

    // Check for period-based trends
    let trendsData = '';
    const queryLower = question.toLowerCase();
    if (queryLower.includes('today')) {
      trendsData = getTrendsData(patients, 'today');
    } else if (queryLower.includes('yesterday')) {
      trendsData = getTrendsData(patients, 'yesterday');
    } else if (queryLower.includes('last 7 days') || queryLower.includes('last week')) {
      trendsData = getTrendsData(patients, 'last7days');
    } else if (queryLower.includes('last month') || queryLower.includes('last 30 days')) {
      trendsData = getTrendsData(patients, 'last30days');
    }

    // If no specific time mentioned but query implies recent admissions, default to today
    if (!trendsData && (queryLower.includes('admitted') || queryLower.includes('admission'))) {
      trendsData = getTrendsData(patients, 'today');
    }

    // Get patient summaries if specific criteria detected
    let patientData = '';
    if (criteria.birthWeightLessThan || criteria.birthWeightGreaterThan || criteria.outcome) {
      // Filter patients by time period first if specified
      let timeFilteredPatients = patients;
      if (queryLower.includes('today')) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        timeFilteredPatients = patients.filter((p) => {
          const admissionDate = new Date(p.admissionDate);
          return admissionDate >= today;
        });
      } else if (queryLower.includes('yesterday')) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        timeFilteredPatients = patients.filter((p) => {
          const admissionDate = new Date(p.admissionDate);
          return admissionDate >= yesterday && admissionDate < today;
        });
      } else if (queryLower.includes('last 7 days') || queryLower.includes('last week')) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        timeFilteredPatients = patients.filter((p) => {
          const admissionDate = new Date(p.admissionDate);
          return admissionDate >= sevenDaysAgo;
        });
      }

      patientData = getPatientSummaries(timeFilteredPatients, criteria);
    }

    // Get outcome statistics
    let outcomeData = '';
    if (question.toLowerCase().includes('by unit')) {
      outcomeData = getOutcomeStats(patients, 'unit');
    } else if (question.toLowerCase().includes('by diagnosis')) {
      outcomeData = getOutcomeStats(patients, 'diagnosis');
    } else if (question.toLowerCase().includes('by birth weight') || question.toLowerCase().includes('weight')) {
      outcomeData = getOutcomeStats(patients, 'birthWeight');
    } else if (question.toLowerCase().includes('by gender')) {
      outcomeData = getOutcomeStats(patients, 'gender');
    }

    // Get analytics summary
    const analyticsSummary = getAnalyticsSummary(patients, context.activeFilters);
    const contextSummary = getContextSummary(context, patients);

    // Build conversation history context
    let historyContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = '\n\nPrevious conversation:\n';
      conversationHistory.slice(-4).forEach((msg) => {
        historyContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
    }

    const prompt = `You are NeoLink AI, a clinical analytics assistant for a hospital's patient database.

IMPORTANT: You have access to REAL PATIENT DATA below. Your response MUST be based ONLY on this actual data from the hospital's database. DO NOT provide generic medical information. If the data shows 0 patients matching the criteria, say so clearly.

${contextSummary}

=== ACTUAL PATIENT DATA FROM DATABASE ===
${analyticsSummary}

${trendsData ? `\n${trendsData}` : ''}

${patientData ? `\n${patientData}` : ''}

${outcomeData ? `\n${outcomeData}` : ''}
=== END OF PATIENT DATA ===

${historyContext}

User Question: ${question}

CRITICAL INSTRUCTIONS:
1. Base your answer ONLY on the patient data provided above
2. If no patients match the criteria, clearly state "No patients found matching this criteria in the database"
3. Include specific patient counts, names (if provided), and statistics from the actual data
4. Do NOT provide general medical knowledge unless specifically asked
5. If asked for patient details, list the actual patients from the data above

Provide a clear, concise answer with specific numbers from the database.`;

    // Debug logging
    console.log('🤖 AI Query Debug:', {
      question,
      hasTrendsData: !!trendsData,
      hasPatientData: !!patientData,
      hasOutcomeData: !!outcomeData,
      criteria,
      patientDataPreview: patientData ? patientData.substring(0, 200) + '...' : 'none',
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error('Error querying analytics:', error);
    throw error;
  }
}

/**
 * Query patient-specific data
 */
export async function queryPatientData(
  question: string,
  patients: Patient[],
  context: AppContext
): Promise<string> {
  try {
    const criteria = parseQueryForCriteria(question);
    const patientSummaries = getPatientSummaries(patients, criteria);
    const contextSummary = getContextSummary(context, patients);

    const prompt = `You are NeoLink AI, a clinical assistant. Based on the patient data below, answer the user's question.

${contextSummary}

${patientSummaries}

User Question: ${question}

Provide a clear, organized answer. If listing patients, group them by relevant characteristics.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error('Error querying patient data:', error);
    throw error;
  }
}

/**
 * Generate custom reports
 */
export async function generateCustomReport(
  reportRequest: string,
  patients: Patient[],
  context: AppContext
): Promise<string> {
  try {
    const analyticsSummary = getAnalyticsSummary(patients, context.activeFilters);
    const contextSummary = getContextSummary(context, patients);

    const prompt = `You are NeoLink AI, a clinical documentation assistant. Generate a professional report based on the user's request.

${contextSummary}

${analyticsSummary}

User Request: ${reportRequest}

Generate a well-structured, professional report. Include:
1. Executive Summary
2. Key Metrics
3. Analysis and Insights
4. Recommendations (if applicable)

Format the report professionally with clear sections.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error('Error generating custom report:', error);
    throw error;
  }
}

/**
 * Answer clinical questions with context awareness
 */
export async function answerClinicalQuestionWithContext(
  question: string,
  context: AppContext,
  patients: Patient[],
  conversationHistory?: ChatMessage[]
): Promise<string> {
  try {
    const contextSummary = getContextSummary(context, patients);

    // Build conversation history
    let historyContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = '\n\nPrevious conversation:\n';
      conversationHistory.slice(-4).forEach((msg) => {
        historyContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
    }

    const enhancedQuestion = `${contextSummary}

${historyContext}

User Question: ${question}

Please provide a clear, evidence-based answer. If the question relates to the current context or previous conversation, take that into account.`;

    // Use existing clinical Q&A function from geminiService
    return await answerClinicalQuestion(enhancedQuestion);
  } catch (error) {
    console.error('Error answering clinical question:', error);
    throw error;
  }
}
