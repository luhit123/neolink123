import { Patient, Unit } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
    lastAutoTable: { finalY: number };
  }
}

export type ReportType =
  | 'mortality_overview'
  | 'cause_analysis'
  | 'trend_analysis'
  | 'risk_factor'
  | 'quality_metrics'
  | 'comparative';

export interface ReportConfig {
  reportType: ReportType;
  institutionName: string;
  timeRange: string;
  unit: string;
  birthType: string;
  includeRecommendations: boolean;
  includeCharts: boolean;
  exportFormat: 'pdf' | 'excel';
  dataCategories?: string[];
}

interface ReportData {
  title: string;
  subtitle: string;
  generatedAt: string;
  institutionName: string;
  timeRange: string;
  filters: {
    unit: string;
    birthType: string;
  };
  summary: {
    totalAdmissions: number;
    totalDeaths: number;
    mortalityRate: number;
    survivalRate: number;
  };
  sections: ReportSection[];
  recommendations?: string[];
}

interface ReportSection {
  title: string;
  type: 'table' | 'chart' | 'text' | 'metrics';
  data: any;
}

// Calculate mortality statistics
const calculateStats = (patients: Patient[], deceasedPatients: Patient[]) => {
  const totalAdmissions = patients.length;
  const totalDeaths = deceasedPatients.length;
  const mortalityRate = totalAdmissions > 0 ? (totalDeaths / totalAdmissions) * 100 : 0;
  const survivalRate = totalAdmissions > 0 ? ((totalAdmissions - totalDeaths) / totalAdmissions) * 100 : 0;

  return { totalAdmissions, totalDeaths, mortalityRate, survivalRate };
};

// Extract causes from deceased patients
const extractCauses = (deceasedPatients: Patient[]) => {
  const causeMap = new Map<string, { count: number; icd10?: string }>();

  deceasedPatients.forEach((p) => {
    const cause =
      p.savedDeathCertificate?.causeOfDeathPartI?.immediateCause ||
      p.aiInterpretedDeathDiagnosis ||
      p.diagnosisAtDeath ||
      'Unknown';
    const icd10 = p.savedDeathCertificate?.causeOfDeathPartI?.immediateCauseICD10;
    const simplifiedCause = cause.split('.')[0].split(',')[0].trim();

    if (!causeMap.has(simplifiedCause)) {
      causeMap.set(simplifiedCause, { count: 0, icd10 });
    }
    const existing = causeMap.get(simplifiedCause)!;
    existing.count++;
    if (icd10 && !existing.icd10) existing.icd10 = icd10;
  });

  return Array.from(causeMap.entries())
    .map(([cause, data]) => ({
      cause,
      count: data.count,
      icd10: data.icd10 || 'N/A',
      percentage: deceasedPatients.length > 0 ? (data.count / deceasedPatients.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
};

// Calculate unit distribution
const calculateUnitDistribution = (deceasedPatients: Patient[]) => {
  const distribution: Record<string, number> = {};
  deceasedPatients.forEach((p) => {
    distribution[p.unit] = (distribution[p.unit] || 0) + 1;
  });
  return Object.entries(distribution).map(([unit, count]) => ({
    unit,
    count,
    percentage: deceasedPatients.length > 0 ? (count / deceasedPatients.length) * 100 : 0,
  }));
};

// Calculate birth weight distribution
const calculateBirthWeightDistribution = (deceasedPatients: Patient[]) => {
  const categories: Record<string, number> = {
    'Extremely Low (<1 kg)': 0,
    'Very Low (1-1.5 kg)': 0,
    'Low (1.5-2 kg)': 0,
    'Moderately Low (2-2.5 kg)': 0,
    'Normal (≥2.5 kg)': 0,
    Unknown: 0,
  };

  deceasedPatients.forEach((p) => {
    if (!p.birthWeight) {
      categories['Unknown']++;
      return;
    }
    const weight = parseFloat(p.birthWeight.toString());
    if (weight < 1) categories['Extremely Low (<1 kg)']++;
    else if (weight < 1.5) categories['Very Low (1-1.5 kg)']++;
    else if (weight < 2) categories['Low (1.5-2 kg)']++;
    else if (weight < 2.5) categories['Moderately Low (2-2.5 kg)']++;
    else categories['Normal (≥2.5 kg)']++;
  });

  return Object.entries(categories)
    .filter(([_, count]) => count > 0)
    .map(([category, count]) => ({
      category,
      count,
      percentage: deceasedPatients.length > 0 ? (count / deceasedPatients.length) * 100 : 0,
    }));
};

// Calculate duration of stay distribution
const calculateDurationDistribution = (deceasedPatients: Patient[]) => {
  const categories: Record<string, number> = {
    '<24 hours': 0,
    '1-3 days': 0,
    '3-7 days': 0,
    '1-2 weeks': 0,
    '2-4 weeks': 0,
    '>1 month': 0,
    Unknown: 0,
  };

  deceasedPatients.forEach((p) => {
    if (!p.dateOfDeath || !p.admissionDate) {
      categories['Unknown']++;
      return;
    }
    const days = Math.ceil(
      (new Date(p.dateOfDeath).getTime() - new Date(p.admissionDate).getTime()) /
      (1000 * 60 * 60 * 24)
    );
    if (days < 1) categories['<24 hours']++;
    else if (days <= 3) categories['1-3 days']++;
    else if (days <= 7) categories['3-7 days']++;
    else if (days <= 14) categories['1-2 weeks']++;
    else if (days <= 28) categories['2-4 weeks']++;
    else categories['>1 month']++;
  });

  return Object.entries(categories)
    .filter(([_, count]) => count > 0)
    .map(([duration, count]) => ({
      duration,
      count,
      percentage: deceasedPatients.length > 0 ? (count / deceasedPatients.length) * 100 : 0,
    }));
};

// Calculate MCCD completion stats
const calculateMCCDStats = (deceasedPatients: Patient[]) => {
  const withMCCD = deceasedPatients.filter((p) => p.savedDeathCertificate).length;
  const withICD10 = deceasedPatients.filter(
    (p) => p.savedDeathCertificate?.causeOfDeathPartI?.immediateCauseICD10
  ).length;
  const withAI = deceasedPatients.filter((p) => p.aiInterpretedDeathDiagnosis).length;

  return {
    total: deceasedPatients.length,
    withMCCD,
    withICD10,
    withAI,
    mccdCompletionRate: deceasedPatients.length > 0 ? (withMCCD / deceasedPatients.length) * 100 : 0,
    icd10Coverage: deceasedPatients.length > 0 ? (withICD10 / deceasedPatients.length) * 100 : 0,
  };
};

// Generate recommendations based on data
const generateRecommendations = (
  patients: Patient[],
  deceasedPatients: Patient[],
  stats: ReturnType<typeof calculateStats>
): string[] => {
  const recommendations: string[] = [];

  // Mortality rate recommendations
  if (stats.mortalityRate > 15) {
    recommendations.push(
      `High mortality rate (${stats.mortalityRate.toFixed(1)}%) - Conduct urgent mortality review and audit.`
    );
  } else if (stats.mortalityRate > 10) {
    recommendations.push(
      `Elevated mortality rate (${stats.mortalityRate.toFixed(1)}%) - Schedule monthly mortality meetings.`
    );
  }

  // Early death analysis
  const earlyDeaths = deceasedPatients.filter((p) => {
    if (!p.admissionDate || !p.dateOfDeath) return false;
    const hours =
      (new Date(p.dateOfDeath).getTime() - new Date(p.admissionDate).getTime()) / (1000 * 60 * 60);
    return hours < 24;
  }).length;

  if (earlyDeaths > 0 && deceasedPatients.length > 0) {
    const earlyDeathRate = (earlyDeaths / deceasedPatients.length) * 100;
    if (earlyDeathRate > 30) {
      recommendations.push(
        `${earlyDeathRate.toFixed(0)}% deaths within 24 hours - Review initial stabilization protocols and triage procedures.`
      );
    }
  }

  // MCCD completion
  const mccdStats = calculateMCCDStats(deceasedPatients);
  if (mccdStats.mccdCompletionRate < 100) {
    recommendations.push(
      `MCCD completion at ${mccdStats.mccdCompletionRate.toFixed(0)}% - Ensure all death certificates are completed for medico-legal compliance.`
    );
  }

  // Birth weight analysis for NICU
  const lowBirthWeightDeaths = deceasedPatients.filter((p) => {
    const weight = parseFloat(p.birthWeight?.toString() || '0');
    return weight > 0 && weight < 1.5;
  }).length;

  if (lowBirthWeightDeaths > 0) {
    recommendations.push(
      `${lowBirthWeightDeaths} deaths in very low birth weight category - Strengthen VLBW care protocols.`
    );
  }

  // Outborn deaths
  const outbornDeaths = deceasedPatients.filter((p) => {
    const admissionType = p.admissionType?.toLowerCase() || '';
    return admissionType.includes('outborn') || admissionType.includes('referred');
  }).length;

  if (outbornDeaths > 0 && deceasedPatients.length > 0) {
    const outbornRate = (outbornDeaths / deceasedPatients.length) * 100;
    if (outbornRate > 50) {
      recommendations.push(
        `${outbornRate.toFixed(0)}% deaths are outborn referrals - Coordinate with referring facilities on pre-transport stabilization.`
      );
    }
  }

  return recommendations;
};

// Build report data structure
const buildReportData = (
  patients: Patient[],
  deceasedPatients: Patient[],
  config: ReportConfig
): ReportData => {
  const stats = calculateStats(patients, deceasedPatients);
  const sections: ReportSection[] = [];

  // Report titles based on type
  const titles: Record<ReportType, { title: string; subtitle: string }> = {
    mortality_overview: {
      title: 'Mortality Overview Report',
      subtitle: 'Comprehensive mortality analysis with trends and distributions',
    },
    cause_analysis: {
      title: 'Cause of Death Analysis Report',
      subtitle: 'Detailed breakdown by ICD-10 codes and NHM categories',
    },
    trend_analysis: {
      title: 'Mortality Trend Analysis',
      subtitle: 'Temporal patterns and trend projections',
    },
    risk_factor: {
      title: 'Risk Factor Analysis Report',
      subtitle: 'Key risk factors contributing to mortality',
    },
    quality_metrics: {
      title: 'Quality Improvement Metrics',
      subtitle: 'Performance indicators and documentation compliance',
    },
    comparative: {
      title: 'Comparative Mortality Report',
      subtitle: 'Cross-unit and cross-category comparisons',
    },
  };

  // Build sections based on report type
  switch (config.reportType) {
    case 'mortality_overview':
      sections.push({
        title: 'Summary Metrics',
        type: 'metrics',
        data: stats,
      });
      sections.push({
        title: 'Unit Distribution',
        type: 'table',
        data: calculateUnitDistribution(deceasedPatients),
      });
      sections.push({
        title: 'Top Causes of Death',
        type: 'table',
        data: extractCauses(deceasedPatients).slice(0, 10),
      });
      break;

    case 'cause_analysis':
      sections.push({
        title: 'Causes of Death (All)',
        type: 'table',
        data: extractCauses(deceasedPatients),
      });
      break;

    case 'risk_factor':
      sections.push({
        title: 'Birth Weight Distribution',
        type: 'table',
        data: calculateBirthWeightDistribution(deceasedPatients),
      });
      sections.push({
        title: 'Duration of Stay',
        type: 'table',
        data: calculateDurationDistribution(deceasedPatients),
      });
      break;

    case 'quality_metrics':
      sections.push({
        title: 'Documentation Quality',
        type: 'metrics',
        data: calculateMCCDStats(deceasedPatients),
      });
      break;

    default:
      sections.push({
        title: 'Summary',
        type: 'metrics',
        data: stats,
      });
  }

  const recommendations = config.includeRecommendations
    ? generateRecommendations(patients, deceasedPatients, stats)
    : undefined;

  return {
    title: titles[config.reportType].title,
    subtitle: titles[config.reportType].subtitle,
    generatedAt: new Date().toLocaleString(),
    institutionName: config.institutionName,
    timeRange: config.timeRange,
    filters: {
      unit: config.unit,
      birthType: config.birthType,
    },
    summary: stats,
    sections,
    recommendations,
  };
};

// Generate PDF report using autoTable for reliable table rendering
const generatePDFReport = (data: ReportData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 20;

  try {
    // Header background
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(data.title || 'Mortality Report', margin, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(data.subtitle || '', margin, 23);

    doc.setFontSize(8);
    doc.text(`${data.institutionName || ''} | ${data.timeRange || ''} | Generated: ${data.generatedAt || new Date().toLocaleString()}`, margin, 30);

    y = 45;
    doc.setTextColor(0, 0, 0);

    // Summary Statistics Table using autoTable
    autoTable(doc, {
      startY: y,
      head: [['ADMISSIONS', 'DEATHS', 'MORTALITY RATE', 'SURVIVAL RATE']],
      body: [[
        String(data.summary?.totalAdmissions || 0),
        String(data.summary?.totalDeaths || 0),
        `${(data.summary?.mortalityRate || 0).toFixed(1)}%`,
        `${(data.summary?.survivalRate || 0).toFixed(1)}%`
      ]],
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 12,
        fontStyle: 'bold',
        halign: 'center'
      },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { textColor: [30, 41, 59] },
        1: { textColor: [220, 38, 38] },
        2: { textColor: [220, 38, 38] },
        3: { textColor: [22, 163, 74] }
      }
    });

    y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : y + 30;

    // Sections
    if (data.sections && data.sections.length > 0) {
      data.sections.forEach((section) => {
        // Section title
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(section.title || 'Section', margin, y);
        y += 8;

        if (section.type === 'table' && Array.isArray(section.data) && section.data.length > 0) {
          const tableData = section.data;
          const keys = Object.keys(tableData[0]);

          // Format table data
          const formattedBody = tableData.map((row: any) =>
            keys.map((key) => {
              let value = row[key];
              if (typeof value === 'number') {
                value = key.toLowerCase().includes('percentage') || key.toLowerCase().includes('rate')
                  ? `${value.toFixed(1)}%`
                  : value.toString();
              }
              return String(value || '').slice(0, 40);
            })
          );

          autoTable(doc, {
            startY: y,
            head: [keys.map(k => k.toUpperCase())],
            body: formattedBody,
            theme: 'striped',
            headStyles: {
              fillColor: [30, 41, 59],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8
            },
            bodyStyles: {
              fontSize: 8,
              textColor: [51, 65, 85]
            },
            margin: { left: margin, right: margin },
            styles: {
              overflow: 'linebreak',
              cellPadding: 2
            }
          });

          y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : y + 50;
        } else if (section.type === 'metrics' && section.data) {
          const metrics = section.data;
          const metricsBody = Object.entries(metrics).map(([key, value]) => {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
            let formattedValue = String(value || '');
            if (typeof value === 'number' && (key.includes('Rate') || key.includes('rate'))) {
              formattedValue = `${(value as number).toFixed(1)}%`;
            }
            return [formattedKey, formattedValue];
          });

          autoTable(doc, {
            startY: y,
            head: [['Metric', 'Value']],
            body: metricsBody,
            theme: 'striped',
            headStyles: {
              fillColor: [30, 41, 59],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 9
            },
            bodyStyles: {
              fontSize: 9,
              textColor: [51, 65, 85]
            },
            margin: { left: margin, right: margin }
          });

          y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : y + 30;
        }
      });
    }

    // Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      // Add page if needed
      if (y > pageHeight - 60) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(146, 64, 14);
      doc.text('Quality Improvement Recommendations', margin, y);
      y += 8;

      const recBody = data.recommendations.map((rec, idx) => [`${idx + 1}. ${rec}`]);

      autoTable(doc, {
        startY: y,
        body: recBody,
        theme: 'plain',
        bodyStyles: {
          fontSize: 9,
          textColor: [51, 65, 85],
          cellPadding: 3
        },
        margin: { left: margin, right: margin },
        styles: {
          overflow: 'linebreak'
        }
      });
    }

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${i} of ${pageCount} | NeoLink Medical Records System`,
        margin,
        pageHeight - 10
      );
      const instName = data.institutionName || '';
      if (instName) {
        doc.text(
          instName,
          pageWidth - margin - doc.getTextWidth(instName),
          pageHeight - 10
        );
      }
    }

  } catch (pdfError) {
    console.error('Error generating PDF content:', pdfError);
    // Add error message to PDF
    doc.setFontSize(12);
    doc.setTextColor(255, 0, 0);
    doc.text('Error generating report. Please try again.', 20, 50);
  }

  return doc;
};

// Generate Excel data (CSV format for simplicity)
const generateExcelReport = (data: ReportData): string => {
  let csv = '';

  // Header info
  csv += `"${data.title}"\n`;
  csv += `"${data.subtitle}"\n`;
  csv += `"Institution","${data.institutionName}"\n`;
  csv += `"Time Range","${data.timeRange}"\n`;
  csv += `"Generated","${data.generatedAt}"\n`;
  csv += '\n';

  // Summary
  csv += '"Summary Metrics"\n';
  csv += `"Total Admissions","${data.summary.totalAdmissions}"\n`;
  csv += `"Total Deaths","${data.summary.totalDeaths}"\n`;
  csv += `"Mortality Rate","${data.summary.mortalityRate.toFixed(2)}%"\n`;
  csv += `"Survival Rate","${data.summary.survivalRate.toFixed(2)}%"\n`;
  csv += '\n';

  // Sections
  data.sections.forEach((section) => {
    csv += `"${section.title}"\n`;

    if (section.type === 'table' && Array.isArray(section.data) && section.data.length > 0) {
      const keys = Object.keys(section.data[0]);
      csv += keys.map((k) => `"${k}"`).join(',') + '\n';

      section.data.forEach((row: any) => {
        csv +=
          keys
            .map((k) => {
              let value = row[k];
              if (typeof value === 'number' && (k.includes('percentage') || k.includes('rate'))) {
                value = `${value.toFixed(2)}%`;
              }
              return `"${String(value).replace(/"/g, '""')}"`;
            })
            .join(',') + '\n';
      });
    } else if (section.type === 'metrics') {
      Object.entries(section.data).forEach(([key, value]) => {
        let formattedValue = String(value);
        if (typeof value === 'number' && (key.includes('Rate') || key.includes('rate'))) {
          formattedValue = `${(value as number).toFixed(2)}%`;
        }
        csv += `"${key}","${formattedValue}"\n`;
      });
    }
    csv += '\n';
  });

  // Recommendations
  if (data.recommendations && data.recommendations.length > 0) {
    csv += '"Quality Improvement Recommendations"\n';
    data.recommendations.forEach((rec, idx) => {
      csv += `"${idx + 1}","${rec.replace(/"/g, '""')}"\n`;
    });
  }

  return csv;
};

// ==================== DOWNLOAD PDF (Using data URL to bypass service worker) ====================
export function downloadMortalityReportPDF(
  patients: Patient[],
  deceasedPatients: Patient[],
  config: ReportConfig
): void {
  console.log('=== PDF GENERATION START ===');

  try {
    console.log('Building report data...');
    const reportData = buildReportData(patients, deceasedPatients, config);
    console.log('Report data built:', reportData.title);

    console.log('Generating PDF document...');
    const doc = generatePDFReport(reportData);
    console.log('PDF document generated successfully');

    const fileName = `Mortality_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    console.log('Saving PDF as:', fileName);

    // Use blob URL to bypass service worker and ensure proper filename
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);

    // Create download link with blob URL
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.style.display = 'none';

    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();

    // Clean up blob URL after download
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 100);

    console.log('=== PDF DOWNLOAD INITIATED ===');
  } catch (error) {
    console.error('=== PDF GENERATION ERROR ===');
    console.error('Error details:', error);
    alert(`PDF generation failed: ${(error as Error)?.message || 'Unknown error'}`);
    throw error;
  }
}

// ==================== DOWNLOAD CSV/EXCEL ====================
export function downloadMortalityReportCSV(
  patients: Patient[],
  deceasedPatients: Patient[],
  config: ReportConfig
): void {
  console.log('=== CSV GENERATION START ===');

  try {
    const reportData = buildReportData(patients, deceasedPatients, config);
    const csv = generateExcelReport(reportData);
    const fileName = `Mortality_Report_${new Date().toISOString().split('T')[0]}.csv`;

    // Use data URL to bypass service worker
    const BOM = '\uFEFF';
    const csvContent = BOM + csv;
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);

    const link = document.createElement('a');
    link.href = dataUri;
    link.download = fileName;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);

    console.log('=== CSV DOWNLOAD INITIATED ===');
  } catch (error) {
    console.error('=== CSV GENERATION ERROR ===');
    console.error('Error details:', error);
    alert(`CSV generation failed: ${(error as Error)?.message || 'Unknown error'}`);
    throw error;
  }
}

// Legacy function for backwards compatibility
export const generateMortalityReport = async (
  patients: Patient[],
  deceasedPatients: Patient[],
  config: ReportConfig
): Promise<{
  data: ReportData;
  downloadPDF: () => void;
  downloadExcel: () => void;
}> => {
  const reportData = buildReportData(patients, deceasedPatients, config);

  return {
    data: reportData,
    downloadPDF: () => downloadMortalityReportPDF(patients, deceasedPatients, config),
    downloadExcel: () => downloadMortalityReportCSV(patients, deceasedPatients, config),
  };
};

export default generateMortalityReport;
