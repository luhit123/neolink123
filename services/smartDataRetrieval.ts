import { GoogleGenAI } from '@google/genai';
import { Patient, Unit } from '../types';

const getApiKey = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }
  return apiKey;
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export interface DataQuery {
  filters: {
    units?: Unit[];
    outcomes?: string[];
    birthWeightRange?: { min?: number; max?: number };
    ageRange?: { min?: number; max?: number; unit?: string };
    diagnosisKeywords?: string[];
    genders?: string[];
    dateRange?: { start?: Date; end?: Date };
  };
  aggregationType: 'individual' | 'summary' | 'statistics' | 'trends';
  limit?: number;
  sortBy?: string;
}

/**
 * Use AI to understand the user's question and determine what data to retrieve
 */
export async function analyzeQueryIntent(userQuery: string): Promise<DataQuery> {
  const prompt = `You are a data retrieval assistant. Analyze this user query and extract the data requirements in JSON format.

User Query: "${userQuery}"

Extract the following information and return ONLY valid JSON (no explanation):
{
  "filters": {
    "units": ["NICU", "PICU", "HDU", "WARD"] or null if not specified,
    "outcomes": ["In Progress", "Discharged", "Deceased", "Referred"] or null,
    "birthWeightRange": { "min": number, "max": number } or null,
    "ageRange": { "min": number, "max": number, "unit": "Days/Months/Years" } or null,
    "diagnosisKeywords": ["keyword1", "keyword2"] or null,
    "genders": ["Male", "Female"] or null,
    "dateRange": { "relative": "today/yesterday/last7days/last30days" } or null
  },
  "aggregationType": "individual" | "summary" | "statistics" | "trends",
  "limit": number (default 50),
  "sortBy": "admissionDate" | "birthWeight" | "age" | null
}

Guidelines:
- "individual": User wants specific patient details (e.g., "show me patients with...")
- "summary": User wants overview/counts (e.g., "how many patients...")
- "statistics": User wants analysis/percentages (e.g., "mortality rate...")
- "trends": User wants time-based patterns (e.g., "admissions today...")
- Extract medical abbreviations: ELBW (<1kg), VLBW (<1.5kg), LBW (<2.5kg)
- For relative dates like "today", "yesterday", "last week", use dateRange.relative
- Only include filters that are explicitly mentioned or strongly implied

Return ONLY the JSON object, no other text.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    let jsonText = response.text.trim();

    // Clean up markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    const dataQuery: DataQuery = JSON.parse(jsonText);

    // Set defaults
    if (!dataQuery.limit) dataQuery.limit = 50;
    if (!dataQuery.aggregationType) dataQuery.aggregationType = 'summary';

    console.log('🔍 Query Analysis:', dataQuery);
    return dataQuery;
  } catch (error) {
    console.error('Error analyzing query intent:', error);
    // Fallback to basic query
    return {
      filters: {},
      aggregationType: 'summary',
      limit: 50,
    };
  }
}

/**
 * Intelligently retrieve only relevant data based on the query analysis
 */
export function retrieveRelevantData(
  patients: Patient[],
  dataQuery: DataQuery
): { relevantPatients: Patient[]; summary: string } {
  let filtered = [...patients];
  const filters = dataQuery.filters;

  // Apply unit filter
  if (filters.units && filters.units.length > 0) {
    filtered = filtered.filter((p) => filters.units!.includes(p.unit));
  }

  // Apply outcome filter
  if (filters.outcomes && filters.outcomes.length > 0) {
    filtered = filtered.filter((p) => filters.outcomes!.includes(p.outcome));
  }

  // Apply birth weight range
  if (filters.birthWeightRange) {
    filtered = filtered.filter((p) => {
      const weight = typeof p.birthWeight === 'string' ? parseFloat(p.birthWeight) : p.birthWeight;
      if (isNaN(weight)) return false;

      const min = filters.birthWeightRange!.min ?? 0;
      const max = filters.birthWeightRange!.max ?? Infinity;
      return weight >= min && weight <= max;
    });
  }

  // Apply age range
  if (filters.ageRange) {
    filtered = filtered.filter((p) => {
      // Convert age to days for comparison
      let ageInDays = p.age;
      if (p.ageUnit === 'Months') ageInDays = p.age * 30;
      if (p.ageUnit === 'Years') ageInDays = p.age * 365;

      const min = filters.ageRange!.min ?? 0;
      const max = filters.ageRange!.max ?? Infinity;
      return ageInDays >= min && ageInDays <= max;
    });
  }

  // Apply diagnosis keyword filter
  if (filters.diagnosisKeywords && filters.diagnosisKeywords.length > 0) {
    filtered = filtered.filter((p) => {
      const diagnosis = (p.diagnosis || '').toLowerCase();
      return filters.diagnosisKeywords!.some((keyword) =>
        diagnosis.includes(keyword.toLowerCase())
      );
    });
  }

  // Apply gender filter
  if (filters.genders && filters.genders.length > 0) {
    filtered = filtered.filter((p) => filters.genders!.includes(p.gender));
  }

  // Apply date range filter
  if (filters.dateRange) {
    const now = new Date();
    let startDate = new Date(0); // Default to beginning of time
    let endDate = now;

    if ('relative' in filters.dateRange) {
      const relative = (filters.dateRange as any).relative;
      switch (relative) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'yesterday':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setDate(endDate.getDate() - 1);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'last7days':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'last30days':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 30);
          break;
      }
    }

    filtered = filtered.filter((p) => {
      const admissionDate = new Date(p.admissionDate);
      return admissionDate >= startDate && admissionDate <= endDate;
    });
  }

  // Apply limit
  const limited = filtered.slice(0, dataQuery.limit || 50);

  // Generate summary based on aggregation type
  const summary = generateDataSummary(filtered, limited, dataQuery);

  console.log(`📊 Retrieved ${limited.length} of ${filtered.length} matching patients`);

  return {
    relevantPatients: limited,
    summary,
  };
}

/**
 * Generate a concise summary of the retrieved data
 */
function generateDataSummary(
  allMatching: Patient[],
  limited: Patient[],
  dataQuery: DataQuery
): string {
  const total = allMatching.length;

  if (total === 0) {
    return 'No patients found matching the specified criteria.';
  }

  let summary = `Found ${total} matching patients.\n\n`;

  switch (dataQuery.aggregationType) {
    case 'individual':
      summary += `Patient Details (showing ${limited.length}):\n`;
      limited.forEach((p, i) => {
        summary += `\n${i + 1}. ${p.name || 'Unknown'}
   - Age: ${p.age} ${p.ageUnit}, Gender: ${p.gender}
   - Unit: ${p.unit}, Outcome: ${p.outcome}
   - Diagnosis: ${p.diagnosis || 'N/A'}
   - Birth Weight: ${p.birthWeight || 'N/A'} kg
   - Admission Date: ${new Date(p.admissionDate).toLocaleDateString()}`;
      });
      if (total > limited.length) {
        summary += `\n\n... and ${total - limited.length} more patients`;
      }
      break;

    case 'summary':
      const outcomes = {
        'In Progress': allMatching.filter((p) => p.outcome === 'In Progress').length,
        Discharged: allMatching.filter((p) => p.outcome === 'Discharged').length,
        Deceased: allMatching.filter((p) => p.outcome === 'Deceased').length,
        Referred: allMatching.filter((p) => p.outcome === 'Referred').length,
      };

      summary += `Summary:\n`;
      summary += `- Total: ${total} patients\n`;
      summary += `- In Progress: ${outcomes['In Progress']} (${((outcomes['In Progress'] / total) * 100).toFixed(1)}%)\n`;
      summary += `- Discharged: ${outcomes.Discharged} (${((outcomes.Discharged / total) * 100).toFixed(1)}%)\n`;
      summary += `- Deceased: ${outcomes.Deceased} (${((outcomes.Deceased / total) * 100).toFixed(1)}%)\n`;
      summary += `- Referred: ${outcomes.Referred} (${((outcomes.Referred / total) * 100).toFixed(1)}%)`;
      break;

    case 'statistics':
      // Calculate detailed statistics
      const deceased = allMatching.filter((p) => p.outcome === 'Deceased').length;
      const mortalityRate = ((deceased / total) * 100).toFixed(1);

      const weights = allMatching
        .map((p) => (typeof p.birthWeight === 'string' ? parseFloat(p.birthWeight) : p.birthWeight))
        .filter((w) => !isNaN(w));

      const avgWeight = weights.length > 0
        ? (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(2)
        : 'N/A';

      const unitBreakdown = {
        NICU: allMatching.filter((p) => p.unit === 'NICU').length,
        PICU: allMatching.filter((p) => p.unit === 'PICU').length,
        HDU: allMatching.filter((p) => p.unit === 'HDU').length,
        WARD: allMatching.filter((p) => p.unit === 'WARD').length,
      };

      summary += `Statistics:\n`;
      summary += `- Total Patients: ${total}\n`;
      summary += `- Mortality Rate: ${mortalityRate}%\n`;
      summary += `- Average Birth Weight: ${avgWeight} kg\n`;
      summary += `\nUnit Distribution:\n`;
      Object.entries(unitBreakdown).forEach(([unit, count]) => {
        if (count > 0) {
          summary += `  - ${unit}: ${count} (${((count / total) * 100).toFixed(1)}%)\n`;
        }
      });
      break;

    case 'trends':
      // Group by admission date
      const dateGroups: Record<string, number> = {};
      allMatching.forEach((p) => {
        const date = new Date(p.admissionDate).toLocaleDateString();
        dateGroups[date] = (dateGroups[date] || 0) + 1;
      });

      summary += `Admission Trends:\n`;
      Object.entries(dateGroups)
        .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
        .slice(0, 10)
        .forEach(([date, count]) => {
          summary += `- ${date}: ${count} admissions\n`;
        });
      break;
  }

  return summary;
}
