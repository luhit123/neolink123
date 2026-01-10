import { Patient, Unit } from '../types';
import { AppContext } from '../types/chat';

/**
 * Get a summary of analytics data for AI queries
 */
export function getAnalyticsSummary(
  patients: Patient[],
  filters?: {
    unit?: Unit;
    outcome?: string;
    dateRange?: { start: string; end: string };
  }
): string {
  let filteredPatients = [...patients];

  // Apply filters
  if (filters?.unit) {
    filteredPatients = filteredPatients.filter((p) => p.unit === filters.unit);
  }
  if (filters?.outcome) {
    filteredPatients = filteredPatients.filter((p) => p.outcome === filters.outcome);
  }
  if (filters?.dateRange) {
    filteredPatients = filteredPatients.filter((p) => {
      const admissionDate = new Date(p.admissionDate);
      const start = new Date(filters.dateRange!.start);
      const end = new Date(filters.dateRange!.end);
      return admissionDate >= start && admissionDate <= end;
    });
  }

  const total = filteredPatients.length;
  const outcomes = {
    'In Progress': filteredPatients.filter((p) => p.outcome === 'In Progress').length,
    Discharged: filteredPatients.filter((p) => p.outcome === 'Discharged').length,
    Deceased: filteredPatients.filter((p) => p.outcome === 'Deceased').length,
    Referred: filteredPatients.filter((p) => p.outcome === 'Referred').length,
  };

  const units = {
    PICU: filteredPatients.filter((p) => p.unit === 'PICU').length,
    NICU: filteredPatients.filter((p) => p.unit === 'NICU').length,
    HDU: filteredPatients.filter((p) => p.unit === 'HDU').length,
    WARD: filteredPatients.filter((p) => p.unit === 'WARD').length,
  };

  const summary = `
Total Patients: ${total}
${filters?.unit ? `Unit: ${filters.unit}` : ''}
${filters?.outcome ? `Outcome Filter: ${filters.outcome}` : ''}
${filters?.dateRange ? `Date Range: ${filters.dateRange.start} to ${filters.dateRange.end}` : ''}

Outcomes:
- In Progress: ${outcomes['In Progress']} (${((outcomes['In Progress'] / total) * 100).toFixed(1)}%)
- Discharged: ${outcomes.Discharged} (${((outcomes.Discharged / total) * 100).toFixed(1)}%)
- Deceased: ${outcomes.Deceased} (${((outcomes.Deceased / total) * 100).toFixed(1)}%)
- Referred: ${outcomes.Referred} (${((outcomes.Referred / total) * 100).toFixed(1)}%)

Units Distribution:
- PICU: ${units.PICU}
- NICU: ${units.NICU}
- HDU: ${units.HDU}
- WARD: ${units.WARD}
  `.trim();

  return summary;
}

/**
 * Get patient summaries matching specific criteria
 */
export function getPatientSummaries(
  patients: Patient[],
  criteria?: {
    unit?: Unit;
    outcome?: string;
    diagnosisContains?: string;
    birthWeightLessThan?: number;
    birthWeightGreaterThan?: number;
    ageInDaysLessThan?: number;
    gender?: string;
  }
): string {
  let filtered = [...patients];

  if (criteria?.unit) {
    filtered = filtered.filter((p) => p.unit === criteria.unit);
  }
  if (criteria?.outcome) {
    filtered = filtered.filter((p) => p.outcome === criteria.outcome);
  }
  if (criteria?.diagnosisContains) {
    filtered = filtered.filter((p) =>
      p.diagnosis?.toLowerCase().includes(criteria.diagnosisContains!.toLowerCase())
    );
  }
  if (criteria?.birthWeightLessThan !== undefined) {
    filtered = filtered.filter((p) => {
      const weight = typeof p.birthWeight === 'string' ? parseFloat(p.birthWeight) : p.birthWeight;
      return weight < criteria.birthWeightLessThan!;
    });
  }
  if (criteria?.birthWeightGreaterThan !== undefined) {
    filtered = filtered.filter((p) => {
      const weight = typeof p.birthWeight === 'string' ? parseFloat(p.birthWeight) : p.birthWeight;
      return weight > criteria.birthWeightGreaterThan!;
    });
  }
  if (criteria?.ageInDaysLessThan !== undefined) {
    filtered = filtered.filter((p) => {
      if (p.ageUnit === 'Days') {
        return p.age < criteria.ageInDaysLessThan!;
      }
      return false;
    });
  }
  if (criteria?.gender) {
    filtered = filtered.filter((p) => p.gender === criteria.gender);
  }

  if (filtered.length === 0) {
    return 'No patients found matching the criteria.';
  }

  const summaries = filtered.slice(0, 20).map((p) => ({
    name: p.name || 'Unknown',
    age: `${p.age} ${p.ageUnit}`,
    gender: p.gender,
    diagnosis: p.diagnosis || 'N/A',
    birthWeight: p.birthWeight ? `${p.birthWeight} kg` : 'N/A',
    outcome: p.outcome,
    unit: p.unit,
  }));

  const summary = `
Found ${filtered.length} patients matching criteria:
${criteria?.birthWeightLessThan ? `Birth Weight < ${criteria.birthWeightLessThan} kg` : ''}
${criteria?.birthWeightGreaterThan ? `Birth Weight > ${criteria.birthWeightGreaterThan} kg` : ''}
${criteria?.outcome ? `Outcome: ${criteria.outcome}` : ''}
${criteria?.unit ? `Unit: ${criteria.unit}` : ''}

Showing first ${Math.min(filtered.length, 20)} patients:
${summaries
  .map(
    (s, i) =>
      `${i + 1}. ${s.name} - ${s.age}, ${s.gender}, ${s.diagnosis}, BW: ${s.birthWeight}, ${s.outcome}`
  )
  .join('\n')}
${filtered.length > 20 ? `\n... and ${filtered.length - 20} more patients` : ''}
  `.trim();

  return summary;
}

/**
 * Parse date from natural language query
 */
export function parseDateFromQuery(query: string): { start: Date; end: Date } | null {
  const queryLower = query.toLowerCase();

  // Month names
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];

  const currentYear = new Date().getFullYear();

  // Check for specific month
  for (let i = 0; i < months.length; i++) {
    if (queryLower.includes(months[i])) {
      // Check for year (e.g., "December 2023" or "December, 2023")
      const yearMatch = query.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;

      const start = new Date(year, i, 1); // First day of month
      const end = new Date(year, i + 1, 0, 23, 59, 59); // Last day of month

      return { start, end };
    }
  }

  // Check for "this month"
  if (queryLower.includes('this month')) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }

  // Check for "last month"
  if (queryLower.includes('last month')) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { start, end };
  }

  return null;
}

/**
 * Get trends data for a specific time period
 */
export function getTrendsData(
  patients: Patient[],
  period: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom',
  customDateRange?: { start: Date; end: Date }
): string {
  const now = new Date();
  const startDate = new Date();

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      now.setDate(now.getDate() - 1);
      now.setHours(23, 59, 59, 999);
      break;
    case 'last7days':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'last30days':
      startDate.setDate(startDate.getDate() - 30);
      break;
  }

  const filtered = patients.filter((p) => {
    const admissionDate = new Date(p.admissionDate);
    return admissionDate >= startDate && admissionDate <= now;
  });

  const admissions = filtered.length;
  const discharges = filtered.filter((p) => p.outcome === 'Discharged').length;
  const deaths = filtered.filter((p) => p.outcome === 'Deceased').length;
  const referred = filtered.filter((p) => p.outcome === 'Referred').length;

  const summary = `
Trends for ${period}:
- Total Admissions: ${admissions}
- Discharges: ${discharges}
- Deaths: ${deaths}
- Referrals: ${referred}
- Mortality Rate: ${admissions > 0 ? ((deaths / admissions) * 100).toFixed(1) : 0}%
  `.trim();

  return summary;
}

/**
 * Get outcome statistics grouped by a specific field
 */
export function getOutcomeStats(
  patients: Patient[],
  groupBy: 'unit' | 'diagnosis' | 'birthWeight' | 'gender'
): string {
  const stats: Record<string, { total: number; outcomes: Record<string, number> }> = {};

  patients.forEach((p) => {
    let key: string;
    switch (groupBy) {
      case 'unit':
        key = p.unit || 'Unknown';
        break;
      case 'diagnosis':
        key = p.diagnosis || 'Unknown';
        break;
      case 'birthWeight':
        const weight =
          typeof p.birthWeight === 'string' ? parseFloat(p.birthWeight) : p.birthWeight;
        if (weight < 1) key = '<1kg';
        else if (weight < 1.5) key = '1-1.5kg';
        else if (weight < 2.5) key = '1.5-2.5kg';
        else key = '>=2.5kg';
        break;
      case 'gender':
        key = p.gender || 'Unknown';
        break;
      default:
        key = 'Unknown';
    }

    if (!stats[key]) {
      stats[key] = { total: 0, outcomes: {} };
    }

    stats[key].total++;
    const outcome = p.outcome || 'Unknown';
    stats[key].outcomes[outcome] = (stats[key].outcomes[outcome] || 0) + 1;
  });

  let summary = `Outcome Statistics grouped by ${groupBy}:\n\n`;

  Object.entries(stats).forEach(([key, data]) => {
    summary += `${key}: ${data.total} patients\n`;
    Object.entries(data.outcomes).forEach(([outcome, count]) => {
      const percentage = ((count / data.total) * 100).toFixed(1);
      summary += `  - ${outcome}: ${count} (${percentage}%)\n`;
    });
    summary += '\n';
  });

  return summary.trim();
}

/**
 * Parse user query to extract data criteria
 */
export function parseQueryForCriteria(query: string): {
  birthWeightLessThan?: number;
  birthWeightGreaterThan?: number;
  outcome?: string;
  unit?: Unit;
  diagnosisContains?: string;
} {
  const criteria: any = {};

  // Birth weight patterns - including ELBW, VLBW, LBW
  const bwLessThan = query.match(/birth\s*weight\s*[<]\s*(\d+\.?\d*)/i);
  const bwGreaterThan = query.match(/birth\s*weight\s*[>]\s*(\d+\.?\d*)/i);

  if (bwLessThan) {
    criteria.birthWeightLessThan = parseFloat(bwLessThan[1]);
  }
  if (bwGreaterThan) {
    criteria.birthWeightGreaterThan = parseFloat(bwGreaterThan[1]);
  }

  // ELBW = Extremely Low Birth Weight < 1kg
  if (query.toLowerCase().includes('elbw') || query.toLowerCase().includes('extremely low birth weight')) {
    criteria.birthWeightLessThan = 1;
  }

  // VLBW = Very Low Birth Weight < 1.5kg
  if (query.toLowerCase().includes('vlbw') || query.toLowerCase().includes('very low birth weight')) {
    criteria.birthWeightLessThan = 1.5;
  }

  // LBW = Low Birth Weight < 2.5kg
  if (query.toLowerCase().includes('lbw') || query.toLowerCase().includes('low birth weight')) {
    criteria.birthWeightLessThan = 2.5;
  }

  // Outcome patterns
  if (query.toLowerCase().includes('mortality') || query.toLowerCase().includes('deceased')) {
    criteria.outcome = 'Deceased';
  } else if (query.toLowerCase().includes('discharged')) {
    criteria.outcome = 'Discharged';
  } else if (query.toLowerCase().includes('referred')) {
    criteria.outcome = 'Referred';
  }

  // Unit patterns
  if (query.toUpperCase().includes('PICU')) criteria.unit = 'PICU';
  if (query.toUpperCase().includes('NICU')) criteria.unit = 'NICU';
  if (query.toUpperCase().includes('HDU')) criteria.unit = 'HDU';
  if (query.toUpperCase().includes('WARD')) criteria.unit = 'WARD';

  return criteria;
}

/**
 * Create context summary for AI
 */
export function getContextSummary(context: AppContext, patients: Patient[]): string {
  let summary = `Current Context:\n`;
  summary += `- Page: ${context.currentPage}\n`;

  if (context.selectedUnit) {
    summary += `- Selected Unit: ${context.selectedUnit}\n`;
  }

  if (context.selectedPatient) {
    summary += `- Selected Patient: ${context.selectedPatient.name}\n`;
  }

  if (context.activeFilters) {
    summary += `- Active Filters:\n`;
    Object.entries(context.activeFilters).forEach(([key, value]) => {
      if (value) {
        summary += `  - ${key}: ${JSON.stringify(value)}\n`;
      }
    });
  }

  if (context.visibleData?.patientCount !== undefined) {
    summary += `- Visible Patients: ${context.visibleData.patientCount}\n`;
  }

  return summary;
}
