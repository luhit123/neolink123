import { GoogleGenAI } from '@google/genai';
import { Patient } from '../types';
import { AppContext, ChatMessage } from '../types/chat';
import { analyzeQueryIntent, retrieveRelevantData } from './smartDataRetrieval';
import { answerClinicalQuestion } from './geminiService';
import { getContextSummary } from './chatDataAggregator';

const getApiKey = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }
  return apiKey;
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

/**
 * IMPROVED: Smart query handler that retrieves only relevant data
 *
 * How it works:
 * 1. Analyze the user's question to understand what data they need
 * 2. Search the database and retrieve ONLY relevant patients
 * 3. Send only the relevant data to AI (not the entire database)
 * 4. AI formulates answer based on the focused dataset
 */
export async function handleComplexQuerySmart(
  query: string,
  context: AppContext,
  patients: Patient[],
  conversationHistory?: ChatMessage[]
): Promise<string> {
  try {
    const queryLower = query.toLowerCase();

    // Check if it's a general clinical question (not about the database)
    const isClinicalQuestion =
      !queryLower.includes('patient') &&
      !queryLower.includes('admission') &&
      !queryLower.includes('mortality') &&
      !queryLower.includes('death') &&
      !queryLower.includes('discharge') &&
      !queryLower.includes('unit') &&
      !queryLower.includes('nicu') &&
      !queryLower.includes('picu') &&
      !queryLower.includes('show') &&
      !queryLower.includes('how many') &&
      !queryLower.includes('list') &&
      !queryLower.includes('find') &&
      !queryLower.includes('today') &&
      !queryLower.includes('yesterday') &&
      (queryLower.includes('what is') ||
        queryLower.includes('how to') ||
        queryLower.includes('explain') ||
        queryLower.includes('why') ||
        queryLower.includes('treatment') ||
        queryLower.includes('symptom') ||
        queryLower.includes('complication'));

    if (isClinicalQuestion) {
      return await answerClinicalQuestionWithContext(query, context, patients, conversationHistory);
    }

    // For database queries: Use smart retrieval
    return await queryDatabaseSmart(query, patients, context, conversationHistory);
  } catch (error) {
    console.error('Error handling complex query:', error);
    throw new Error('Failed to process your query. Please try again.');
  }
}

/**
 * Smart database query with intelligent data retrieval
 */
async function queryDatabaseSmart(
  query: string,
  patients: Patient[],
  context: AppContext,
  conversationHistory?: ChatMessage[]
): Promise<string> {
  try {
    // Step 1: Analyze what data the user is asking for
    console.log('🔍 Step 1: Analyzing query intent...');
    const dataQuery = await analyzeQueryIntent(query);

    // Step 2: Retrieve only the relevant data
    console.log('📊 Step 2: Retrieving relevant data...');
    const { relevantPatients, summary } = retrieveRelevantData(patients, dataQuery);

    // Step 3: Build conversation context
    let historyContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = '\n\nPrevious conversation:\n';
      conversationHistory.slice(-4).forEach((msg) => {
        historyContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
    }

    const contextSummary = getContextSummary(context, patients);

    // Step 4: Create focused prompt with only relevant data
    console.log('🤖 Step 3: Generating AI response...');
    const prompt = `You are NeoLink AI, a clinical analytics assistant for a hospital's patient database.

IMPORTANT: You have access to REAL PATIENT DATA below. Answer based ONLY on this data.

${contextSummary}

=== RELEVANT PATIENT DATA FROM DATABASE ===
${summary}
=== END OF PATIENT DATA ===

${historyContext}

User Question: ${query}

INSTRUCTIONS:
1. Base your answer ONLY on the patient data provided above
2. If no patients match, clearly state "No patients found matching this criteria"
3. Include specific counts, statistics, and patient details from the actual data
4. Be concise and direct
5. Use bullet points or tables for clarity when listing multiple items

Provide a clear, data-driven answer.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    console.log('✅ Query completed successfully');
    return response.text;
  } catch (error) {
    console.error('Error in smart database query:', error);
    throw error;
  }
}

/**
 * Answer clinical questions with context awareness
 */
async function answerClinicalQuestionWithContext(
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

    return await answerClinicalQuestion(enhancedQuestion);
  } catch (error) {
    console.error('Error answering clinical question:', error);
    throw error;
  }
}

/**
 * BACKWARD COMPATIBILITY: Export with the same name as the old function
 * This allows existing code to work without changes
 */
export const handleComplexQuery = handleComplexQuerySmart;
