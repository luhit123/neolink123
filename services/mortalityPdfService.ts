import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient } from '../types';

export interface MortalityReportOptions {
  patients: Patient[];
  institutionName: string;
  timeRange: string;
  unit: string;
  birthType?: string;
  totalAdmissions?: number;
  analysisType?: string;
  analysisData?: any;
  includeCharts?: boolean;
  includeSummary?: boolean;
  includePatientList?: boolean;
  includeCausesBreakdown?: boolean;
  includeAIAnalysis?: boolean;
  aiAnalysis?: string;
}

/**
 * Generate comprehensive mortality analytics PDF
 */
export const generateMortalityPDF = async (options: MortalityReportOptions) => {
  const {
    patients,
    institutionName,
    timeRange,
    unit,
    birthType,
    totalAdmissions,
    analysisType,
    analysisData,
    includeCharts = true,
    includeSummary = true,
    includePatientList = true,
    includeCausesBreakdown = true,
    includeAIAnalysis = true,
    aiAnalysis
  } = options;

  const doc = new jsPDF();
  let yPos = 20;

  // Professional color scheme - Navy Blue
  const primaryColor = [25, 55, 109]; // Navy Blue
  const accentColor = [14, 116, 144]; // Teal

  // Header with professional styling
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 35, 'F');

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  const mainTitle = (analysisData && analysisData.title) || 'Mortality Analytics Report';
  doc.text(mainTitle, 105, 15, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(institutionName, 105, 23, { align: 'center' });

  doc.setFontSize(10);
  let subtitle = '';
  if (analysisType && analysisData) {
    // For analytics reports, show unit and time range
    subtitle = `${unit} • ${timeRange}`;
  } else {
    subtitle = birthType && birthType !== 'all'
      ? `${unit} • ${birthType.charAt(0).toUpperCase() + birthType.slice(1)} • ${timeRange}`
      : `${unit} • ${timeRange}`;
  }
  doc.text(subtitle, 105, 29, { align: 'center' });

  doc.setTextColor(0);
  yPos = 45;

  // If this is a specific analysis export, only show that analysis
  if (analysisType && analysisData) {
    // Show only the specific analysis
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(15, yPos - 3, 180, 8, 'F');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(analysisData.title?.toUpperCase() || analysisType.toUpperCase(), 20, yPos + 2);
    doc.setTextColor(0);
    yPos += 12;

    // Generate analysis table with category-specific mortality rates
    const distribution = analysisData.distribution || {};
    const allPatients = analysisData.allPatients || [];

    // Calculate category distribution in all patients
    const getCategoryForPatient = (patient: Patient, type: string): string => {
      if (type === 'birthWeight') {
        const weight = patient.birthWeight || 0;
        if (weight < 1.0) return 'Extremely Low Birth Weight (<1kg)';
        if (weight < 1.5) return 'Very Low Birth Weight (1-1.5kg)';
        if (weight < 2.5) return 'Low Birth Weight (1.5-2.5kg)';
        return 'Normal Birth Weight (>2.5kg)';
      } else if (type === 'durationOfStay') {
        const admission = new Date(patient.admissionDate);
        const release = patient.dateOfDeath ? new Date(patient.dateOfDeath) :
                       patient.releaseDate ? new Date(patient.releaseDate) : new Date();
        const days = Math.ceil((release.getTime() - admission.getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 1) return '0-1 days';
        if (days <= 3) return '2-3 days';
        if (days <= 7) return '4-7 days';
        if (days <= 14) return '8-14 days';
        if (days <= 30) return '15-30 days';
        return '>30 days';
      } else if (type === 'birthToAdmission') {
        const birth = new Date(patient.dateOfBirth || patient.admissionDate);
        const admission = new Date(patient.admissionDate);
        const hours = Math.floor((admission.getTime() - birth.getTime()) / (1000 * 60 * 60));
        if (hours < 1) return '<1 hour';
        if (hours < 6) return '1-6 hours';
        if (hours < 24) return '6-24 hours';
        if (hours < 72) return '1-3 days';
        return '>3 days';
      } else if (type === 'referralSource') {
        return patient.referredFrom || 'Not Specified';
      } else if (type === 'diagnosis') {
        const diagnosis = patient.aiInterpretedDeathDiagnosis || patient.diagnosisAtDeath || 'Unknown';
        return diagnosis.split('.')[0].split(',')[0].trim();
      } else if (type === 'gender') {
        return patient.gender || 'Unknown';
      }
      return 'Unknown';
    };

    // Count total admissions per category
    const totalAdmissionsPerCategory: { [key: string]: number } = {};
    allPatients.forEach((patient: Patient) => {
      const category = getCategoryForPatient(patient, analysisData.type);
      totalAdmissionsPerCategory[category] = (totalAdmissionsPerCategory[category] || 0) + 1;
    });

    const analysisRows = Object.entries(distribution)
      .sort((a: any, b: any) => b[1] - a[1])
      .map(([category, deathCount]: [string, any]) => {
        const totalInCategory = totalAdmissionsPerCategory[category] || deathCount;
        const mortalityRate = totalInCategory > 0 ? ((deathCount / totalInCategory) * 100).toFixed(1) : '0.0';
        const percentOfDeaths = patients.length > 0 ? ((deathCount / patients.length) * 100).toFixed(1) : '0.0';
        return [
          category,
          totalInCategory.toString(),
          deathCount.toString(),
          `${mortalityRate}%`,
          `${percentOfDeaths}%`
        ];
      });

    autoTable(doc, {
      startY: yPos,
      head: [['Category', 'Total Admissions', 'Deaths', 'Mortality Rate', '% of Total Deaths']],
      body: analysisRows,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' },
        4: { cellWidth: 30, halign: 'center' }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Add NeolinkAI branding footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(
        'Generated by NeolinkAI - Advanced Healthcare Analytics',
        105,
        293,
        { align: 'center' }
      );
    }

    return doc;
  }

  // Summary Statistics (for standard reports only)
  if (includeSummary) {
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(15, yPos - 3, 180, 8, 'F');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTIVE SUMMARY', 20, yPos + 2);
    doc.setTextColor(0);
    yPos += 12;

    const totalDeaths = patients.length;
    const admissions = totalAdmissions || totalDeaths; // Use provided value or default to deaths
    const mortalityRate = admissions > 0 ? ((totalDeaths / admissions) * 100).toFixed(2) : '0.00';

    const summaryData = [
      ['Total Admissions (Period)', admissions.toString()],
      ['Total Deaths', totalDeaths.toString()],
      ['Mortality Rate', `${mortalityRate}%`],
      ['Time Period', timeRange],
      ['Unit/Department', unit],
      ...(birthType && birthType !== 'all' ? [['Birth Type Filter', birthType.charAt(0).toUpperCase() + birthType.slice(1)]] : []),
      ['Report Generated', new Date().toLocaleString()]
    ];

    autoTable(doc, {
      startY: yPos,
      body: summaryData,
      theme: 'striped',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70, fillColor: [240, 240, 240] },
        1: { cellWidth: 110 }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Causes of Death Breakdown
  if (includeCausesBreakdown) {
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(15, yPos - 3, 180, 8, 'F');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('TOP CAUSES OF DEATH', 20, yPos + 2);
    doc.setTextColor(0);
    yPos += 12;

    const causesMap = new Map<string, number>();
    patients.forEach(p => {
      const diagnosis = p.aiInterpretedDeathDiagnosis || p.diagnosisAtDeath || 'Unknown';
      const cause = diagnosis.split('.')[0].split(',')[0].trim();
      causesMap.set(cause, (causesMap.get(cause) || 0) + 1);
    });

    const causesData = Array.from(causesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cause, count], index) => [
        (index + 1).toString(),
        cause,
        count.toString(),
        `${((count / patients.length) * 100).toFixed(1)}%`
      ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Rank', 'Cause of Death', 'Count', '%']],
      body: causesData,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 110 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Detailed Patient List
  if (includePatientList) {
    patients.forEach((patient, index) => {
      // Start new page for each patient
      doc.addPage();
      yPos = 20;

      // Patient header
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(15, yPos - 3, 180, 10, 'F');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(`PATIENT ${index + 1}: ${patient.name.toUpperCase()}`, 20, yPos + 4);
      doc.setTextColor(0);
      yPos += 15;

      // Demographics Section
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos - 2, 180, 6, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Demographics & Birth Details', 20, yPos + 2);
      yPos += 8;

      const demographicsData = [
        ['Name', patient.name],
        ['Age', `${patient.age} ${patient.ageUnit}`],
        ['Gender', patient.gender],
        ['Birth Type', patient.birthType || 'Not recorded'],
        ['Birth Weight', patient.birthWeight ? `${patient.birthWeight} kg` : 'Not recorded'],
        ['Father\'s Name', patient.fatherName || 'Not recorded'],
        ['Mother\'s Name', patient.motherName || 'Not recorded'],
        ['Address', patient.address || 'Not recorded'],
        ['Contact', patient.mobileNumber || 'Not recorded']
      ];

      autoTable(doc, {
        startY: yPos,
        body: demographicsData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 45, fillColor: [250, 250, 250] },
          1: { cellWidth: 135 }
        }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Admission Details Section
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos - 2, 180, 6, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Admission Details', 20, yPos + 2);
      yPos += 8;

      const daysInUnit = patient.dateOfDeath && patient.admissionDate
        ? Math.ceil((new Date(patient.dateOfDeath).getTime() - new Date(patient.admissionDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const admissionData = [
        ['Admission Date', new Date(patient.admissionDate).toLocaleDateString()],
        ['Admission Time', new Date(patient.admissionDate).toLocaleTimeString()],
        ['Unit', patient.unit],
        ['Referred From', patient.referredFrom || 'Not recorded'],
        ['Days in Unit', daysInUnit !== null ? `${daysInUnit} days` : 'N/A']
      ];

      autoTable(doc, {
        startY: yPos,
        body: admissionData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 45, fillColor: [250, 250, 250] },
          1: { cellWidth: 135 }
        }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Indication for Admission
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos - 2, 180, 6, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Indication for Admission', 20, yPos + 2);
      yPos += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      if (patient.indicationsForAdmission && patient.indicationsForAdmission.length > 0) {
        patient.indicationsForAdmission.forEach((indication, idx) => {
          const indicationText = `${idx + 1}. ${indication}`;
          const lines = doc.splitTextToSize(indicationText, 170);
          lines.forEach((line: string) => {
            if (yPos > 275) {
              doc.addPage();
              yPos = 20;
            }
            doc.text(line, 20, yPos);
            yPos += 5;
          });
        });
      } else if (patient.diagnosis) {
        const lines = doc.splitTextToSize(patient.diagnosis, 170);
        lines.forEach((line: string) => {
          if (yPos > 275) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, 20, yPos);
          yPos += 5;
        });
      } else {
        doc.setFont('helvetica', 'italic');
        doc.text('Not recorded', 20, yPos);
        yPos += 5;
      }

      yPos += 5;

      // Final Diagnosis Section
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos - 2, 180, 6, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Final Diagnosis & Outcome', 20, yPos + 2);
      yPos += 8;

      const outcomeData = [
        ['Date of Death', patient.dateOfDeath ? new Date(patient.dateOfDeath).toLocaleDateString() : 'Not recorded'],
        ['Time of Death', patient.dateOfDeath ? new Date(patient.dateOfDeath).toLocaleTimeString() : 'Not recorded']
      ];

      autoTable(doc, {
        startY: yPos,
        body: outcomeData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 45, fillColor: [250, 250, 250] },
          1: { cellWidth: 135 }
        }
      });

      yPos = (doc as any).lastAutoTable.finalY + 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Diagnosis at Death:', 20, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'normal');
      const diagnosisText = patient.diagnosisAtDeath || 'Not recorded';
      const diagLines = doc.splitTextToSize(diagnosisText, 170);
      diagLines.forEach((line: string) => {
        if (yPos > 275) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, 20, yPos);
        yPos += 4;
      });

      if (patient.aiInterpretedDeathDiagnosis) {
        yPos += 4;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(14, 116, 144);
        doc.text('AI-Interpreted Diagnosis:', 20, yPos);
        doc.setTextColor(0);
        yPos += 5;

        doc.setFont('helvetica', 'normal');
        const aiDiagLines = doc.splitTextToSize(patient.aiInterpretedDeathDiagnosis, 170);
        aiDiagLines.forEach((line: string) => {
          if (yPos > 275) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, 20, yPos);
          yPos += 4;
        });
      }
    });
  }

  // AI Analysis
  if (includeAIAnalysis && aiAnalysis) {
    doc.addPage();
    yPos = 20;

    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(15, yPos - 3, 180, 8, 'F');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('AI-POWERED ANALYSIS', 20, yPos + 2);
    doc.setTextColor(0);
    yPos += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(aiAnalysis.replace(/[#*]/g, ''), 170);
    lines.forEach((line: string) => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, 20, yPos);
      yPos += 5;
    });
  }

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount} • ${institutionName} • Confidential Medical Report`,
      105,
      287,
      { align: 'center' }
    );
    // NeolinkAI branding
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(
      'Generated by NeolinkAI - Advanced Healthcare Analytics',
      105,
      293,
      { align: 'center' }
    );
  }

  return doc;
};

/**
 * Generate concise individual patient death summary PDF
 */
export const generateIndividualMortalityPDF = async (
  patient: Patient,
  institutionName: string,
  aiAnalysis?: string
) => {
  const doc = new jsPDF();
  let yPos = 20;

  // Professional color scheme
  const primaryColor = [25, 55, 109]; // Navy Blue
  const accentColor = [14, 116, 144]; // Teal

  // Header with professional styling
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 30, 'F');

  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Death Summary Report', 105, 14, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(institutionName, 105, 22, { align: 'center' });

  doc.setTextColor(0);
  yPos = 40;

  const daysInUnit = patient.dateOfDeath && patient.admissionDate
    ? Math.ceil((new Date(patient.dateOfDeath).getTime() - new Date(patient.admissionDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // SECTION 1: PATIENT DEMOGRAPHICS
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(15, yPos - 3, 180, 8, 'F');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('PATIENT DEMOGRAPHICS', 20, yPos + 2);
  doc.setTextColor(0);
  yPos += 10;

  const demographicsData = [
    ['Patient Name', patient.name || 'Not recorded'],
    ['Age', `${patient.age} ${patient.ageUnit}`],
    ['Gender', patient.gender || 'Not recorded'],
    ['Birth Type', patient.birthType || 'Not specified'],
    ['Birth Weight', patient.birthWeight ? `${patient.birthWeight} kg` : 'Not recorded'],
    ['Father\'s Name', patient.fatherName || 'Not recorded'],
    ['Mother\'s Name', patient.motherName || 'Not recorded'],
    ['Address', patient.address || 'Not recorded'],
    ['Mobile Number', patient.mobileNumber || 'Not recorded']
  ];

  autoTable(doc, {
    startY: yPos,
    body: demographicsData,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, fillColor: [245, 245, 245] },
      1: { cellWidth: 120 }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // SECTION 2: ADMISSION DETAILS
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFillColor(37, 99, 235);
  doc.rect(15, yPos - 3, 180, 8, 'F');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('ADMISSION DETAILS', 20, yPos + 2);
  doc.setTextColor(0);
  yPos += 10;

  const admissionData = [
    ['Admission Date', new Date(patient.admissionDate).toLocaleDateString()],
    ['Admission Time', new Date(patient.admissionDate).toLocaleTimeString()],
    ['Unit', patient.unit || 'Not recorded'],
    ['Referred From', patient.referredFrom || 'Not recorded'],
    ['Days in Unit', daysInUnit !== null ? `${daysInUnit} days` : 'N/A']
  ];

  autoTable(doc, {
    startY: yPos,
    body: admissionData,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, fillColor: [245, 245, 245] },
      1: { cellWidth: 120 }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // SECTION 3: INDICATION FOR ADMISSION
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFillColor(16, 185, 129);
  doc.rect(15, yPos - 3, 180, 8, 'F');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('INDICATION FOR ADMISSION', 20, yPos + 2);
  doc.setTextColor(0);
  yPos += 10;

  if (patient.indicationsForAdmission && patient.indicationsForAdmission.length > 0) {
    const indicationData = patient.indicationsForAdmission.map((indication, index) => [
      `${index + 1}.`,
      indication
    ]);

    autoTable(doc, {
      startY: yPos,
      body: indicationData,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10, fontStyle: 'bold' },
        1: { cellWidth: 160 }
      }
    });
    yPos = (doc as any).lastAutoTable.finalY + 12;
  } else if (patient.diagnosis) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const diagLines = doc.splitTextToSize(patient.diagnosis, 170);
    diagLines.forEach((line: string) => {
      doc.text(line, 20, yPos);
      yPos += 5;
    });
    yPos += 7;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('Not recorded', 20, yPos);
    yPos += 12;
  }

  // SECTION 4: INITIAL VITAL SIGNS
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFillColor(245, 158, 11);
  doc.rect(15, yPos - 3, 180, 8, 'F');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('INITIAL VITAL SIGNS', 20, yPos + 2);
  doc.setTextColor(0);
  yPos += 10;

  if (patient.vitalSigns && Object.values(patient.vitalSigns).some(v => v)) {
    const vitalsData = [
      ['Heart Rate', patient.vitalSigns.hr || 'Not recorded', 'bpm'],
      ['Blood Pressure', patient.vitalSigns.bp || 'Not recorded', 'mmHg'],
      ['Respiratory Rate', patient.vitalSigns.rr || 'Not recorded', 'breaths/min'],
      ['Temperature', patient.vitalSigns.temp || 'Not recorded', '°C'],
      ['SpO2', patient.vitalSigns.spo2 || 'Not recorded', '%']
    ];

    autoTable(doc, {
      startY: yPos,
      body: vitalsData,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50, fillColor: [245, 245, 245] },
        1: { cellWidth: 70, halign: 'center' },
        2: { cellWidth: 50, halign: 'center', textColor: [100, 100, 100] }
      }
    });
    yPos = (doc as any).lastAutoTable.finalY + 12;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No vital signs recorded', 20, yPos);
    yPos += 12;
  }

  // SECTION 5: MEDICATIONS & TREATMENT
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFillColor(168, 85, 247);
  doc.rect(15, yPos - 3, 180, 8, 'F');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('MEDICATIONS & TREATMENT', 20, yPos + 2);
  doc.setTextColor(0);
  yPos += 10;

  if (patient.medications) {
    const medLines = patient.medications.split('\n').filter(m => m.trim());
    const medicationData = medLines.map((med, index) => [
      `${index + 1}.`,
      med.trim()
    ]);

    autoTable(doc, {
      startY: yPos,
      body: medicationData,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10, fontStyle: 'bold' },
        1: { cellWidth: 160 }
      }
    });
    yPos = (doc as any).lastAutoTable.finalY + 5;
  }

  if (patient.treatment) {
    if (!patient.medications) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    } else {
      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Additional Treatment:', 20, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
    }
    const treatmentLines = doc.splitTextToSize(patient.treatment, 170);
    treatmentLines.forEach((line: string) => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, 20, yPos);
      yPos += 5;
    });
  }

  if (!patient.medications && !patient.treatment) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No medications or treatment recorded', 20, yPos);
  }

  yPos += 12;

  // SECTION 6: CLINICAL COURSE / PROGRESS NOTES
  if (patient.progressNotes && patient.progressNotes.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(59, 130, 246);
    doc.rect(15, yPos - 3, 180, 8, 'F');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('CLINICAL COURSE & PROGRESS NOTES', 20, yPos + 2);
    doc.setTextColor(0);
    yPos += 10;

    const sortedNotes = [...patient.progressNotes].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedNotes.forEach((note, index) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      // Note header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(37, 99, 235);
      const noteDate = new Date(note.date);
      doc.text(
        `${noteDate.toLocaleDateString()} ${noteDate.toLocaleTimeString()}`,
        20,
        yPos
      );
      doc.setTextColor(0);
      yPos += 5;

      // Note content
      doc.setFont('helvetica', 'normal');
      const noteLines = doc.splitTextToSize(note.note, 165);
      noteLines.forEach((line: string) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, 25, yPos);
        yPos += 4;
      });

      // Note vitals if available
      if (note.vitals && Object.values(note.vitals).some(v => v)) {
        yPos += 2;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const noteVitals = [];
        if (note.vitals.hr) noteVitals.push(`HR: ${note.vitals.hr}`);
        if (note.vitals.bp) noteVitals.push(`BP: ${note.vitals.bp}`);
        if (note.vitals.rr) noteVitals.push(`RR: ${note.vitals.rr}`);
        if (note.vitals.temp) noteVitals.push(`Temp: ${note.vitals.temp}°C`);
        if (note.vitals.spo2) noteVitals.push(`SpO2: ${note.vitals.spo2}%`);
        doc.text(`Vitals: ${noteVitals.join(', ')}`, 25, yPos);
        doc.setTextColor(0);
        doc.setFontSize(9);
        yPos += 5;
      }

      yPos += 3;
    });

    yPos += 5;
  }

  // SECTION 7: FINAL DIAGNOSIS & OUTCOME
  if (yPos > 230) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(15, yPos - 3, 180, 8, 'F');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('FINAL DIAGNOSIS & OUTCOME', 20, yPos + 2);
  doc.setTextColor(0);
  yPos += 10;

  const outcomeData = [
    ['Date of Death', patient.dateOfDeath ? new Date(patient.dateOfDeath).toLocaleDateString() : 'Not recorded'],
    ['Time of Death', patient.dateOfDeath ? new Date(patient.dateOfDeath).toLocaleTimeString() : 'Not recorded'],
    ['Total Days in Unit', daysInUnit !== null ? `${daysInUnit} days` : 'N/A']
  ];

  autoTable(doc, {
    startY: yPos,
    body: outcomeData,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, fillColor: [245, 245, 245] },
      1: { cellWidth: 120 }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Diagnosis at Death
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Diagnosis at Death:', 20, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  if (patient.diagnosisAtDeath) {
    const diagLines = doc.splitTextToSize(patient.diagnosisAtDeath, 170);
    diagLines.forEach((line: string) => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, 20, yPos);
      yPos += 5;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.text('Not recorded', 20, yPos);
    yPos += 5;
  }

  // AI Interpreted Diagnosis
  if (patient.aiInterpretedDeathDiagnosis) {
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(37, 99, 235);
    doc.text('AI-Interpreted Diagnosis:', 20, yPos);
    doc.setTextColor(0);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const aiDiagLines = doc.splitTextToSize(patient.aiInterpretedDeathDiagnosis, 170);
    aiDiagLines.forEach((line: string) => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, 20, yPos);
      yPos += 5;
    });
  }

  // SECTION 8: AI CLINICAL ANALYSIS (if available)
  if (aiAnalysis) {
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(37, 99, 235);
    doc.rect(15, yPos - 3, 180, 8, 'F');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('AI CLINICAL ANALYSIS', 20, yPos + 2);
    doc.setTextColor(0);
    yPos += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const analysisLines = doc.splitTextToSize(aiAnalysis.replace(/[#*]/g, ''), 170);
    analysisLines.forEach((line: string) => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, 20, yPos);
      yPos += 5;
    });
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount} • ${institutionName} • Death Summary - Confidential`,
      105,
      287,
      { align: 'center' }
    );
    // NeolinkAI branding
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(
      'Generated by NeolinkAI - Advanced Healthcare Analytics',
      105,
      293,
      { align: 'center' }
    );
  }

  return doc;
};

/**
 * Export data as CSV
 */
export const exportMortalityCSV = (patients: Patient[], filename: string = 'mortality-data.csv') => {
  const headers = [
    'Name',
    'Age',
    'Age Unit',
    'Gender',
    'Unit',
    'Admission Date',
    'Date of Death',
    'Days in Unit',
    'Diagnosis at Death',
    'AI Interpreted Diagnosis'
  ];

  const rows = patients.map(p => {
    const daysInUnit = p.dateOfDeath && p.admissionDate
      ? Math.ceil((new Date(p.dateOfDeath).getTime() - new Date(p.admissionDate).getTime()) / (1000 * 60 * 60 * 24))
      : '';

    return [
      p.name,
      p.age,
      p.ageUnit,
      p.gender,
      p.unit,
      new Date(p.admissionDate).toLocaleDateString(),
      p.dateOfDeath ? `${new Date(p.dateOfDeath).toLocaleDateString()} ${new Date(p.dateOfDeath).toLocaleTimeString()}` : '',
      daysInUnit,
      (p.diagnosisAtDeath || '').replace(/,/g, ';').replace(/\n/g, ' '),
      (p.aiInterpretedDeathDiagnosis || '').replace(/,/g, ';').replace(/\n/g, ' ')
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

/**
 * Export data as JSON
 */
export const exportMortalityJSON = (patients: Patient[], filename: string = 'mortality-data.json') => {
  const data = patients.map(p => ({
    name: p.name,
    age: p.age,
    ageUnit: p.ageUnit,
    gender: p.gender,
    unit: p.unit,
    admissionDate: p.admissionDate,
    dateOfDeath: p.dateOfDeath,
    diagnosisAtDeath: p.diagnosisAtDeath,
    aiInterpretedDeathDiagnosis: p.aiInterpretedDeathDiagnosis,
    progressNotes: p.progressNotes
  }));

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};
