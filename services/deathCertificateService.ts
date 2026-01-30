import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Patient,
  DeathCertificate,
  DeathCertificateOptions,
  CauseOfDeathPartI,
  CauseOfDeathPartII,
  Unit,
  MannerOfDeath,
  PlaceOfDeath,
  DeathClassification,
  PerinatalDeathType,
  NHMDeathCategory,
  AutopsyStatus
} from '../types';
import { getFormattedAge } from '../utils/ageCalculator';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
    lastAutoTable: { finalY: number };
  }
}

// ==================== PDF STYLING CONSTANTS ====================
const COLORS = {
  primary: [30, 58, 138] as [number, number, number],      // Deep Blue (official)
  secondary: [100, 116, 139] as [number, number, number],  // Slate
  dark: [15, 23, 42] as [number, number, number],          // Slate 900
  light: [248, 250, 252] as [number, number, number],      // Slate 50
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  red: [185, 28, 28] as [number, number, number],          // Red 700
  amber: [180, 83, 9] as [number, number, number],         // Amber 700
  border: [203, 213, 225] as [number, number, number],     // Slate 300
};

const FONTS = {
  title: 14,
  subtitle: 11,
  heading: 10,
  body: 9,
  small: 8,
  tiny: 7,
};

const MARGINS = {
  left: 12,
  right: 12,
  top: 10,
  bottom: 15,
};

// ==================== HELPER FUNCTIONS ====================

function formatDate(date: string | undefined): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateTime(date: string | undefined, time?: string): string {
  if (!date) return 'N/A';
  const dateObj = new Date(date);
  const dateStr = dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  if (time) {
    return `${dateStr} at ${time}`;
  }
  return dateStr;
}

function formatTime(time: string | undefined): string {
  if (!time) return 'N/A';
  return time;
}

function calculateStayDuration(admission: string, death: string): string {
  const admDate = new Date(admission);
  const deathDate = new Date(death);
  const diffMs = deathDate.getTime() - admDate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffHours / 24);
  const hours = diffHours % 24;

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
}

function checkPageBreak(doc: jsPDF, currentY: number, requiredSpace: number = 40): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + requiredSpace > pageHeight - MARGINS.bottom) {
    doc.addPage();
    return MARGINS.top + 5;
  }
  return currentY;
}

function drawBorder(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.8);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

  doc.setLineWidth(0.3);
  doc.rect(7, 7, pageWidth - 14, pageHeight - 14);
}

function addSectionHeader(doc: jsPDF, title: string, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...COLORS.primary);
  doc.rect(MARGINS.left, y, pageWidth - MARGINS.left - MARGINS.right, 6, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(FONTS.heading);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), MARGINS.left + 3, y + 4.3);

  doc.setTextColor(...COLORS.dark);
  return y + 9;
}

function addLabelValue(doc: jsPDF, label: string, value: string | undefined, x: number, y: number, labelWidth: number = 40): number {
  if (!value) return y;

  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.secondary);
  doc.text(`${label}:`, x, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);

  // Handle long text with wrapping
  const maxWidth = doc.internal.pageSize.getWidth() - x - labelWidth - MARGINS.right;
  const lines = doc.splitTextToSize(String(value), maxWidth);
  doc.text(lines, x + labelWidth, y);

  return y + (lines.length * 4);
}

// ==================== MAIN PDF GENERATION ====================

export function generateDeathCertificatePDF(certificate: DeathCertificate, patient: Patient): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const isNeonatal = patient.unit === Unit.NICU || patient.unit === Unit.SNCU;

  // Draw border
  drawBorder(doc);

  let y = MARGINS.top + 5;

  // ==================== HEADER ====================
  // Government Header
  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  doc.text('FORM NO. 4', pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Main Title
  doc.setFontSize(FONTS.title);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('MEDICAL CERTIFICATE OF CAUSE OF DEATH', pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLORS.secondary);
  doc.text('(As per Registration of Births and Deaths Act, 1969 & WHO ICD-10 Guidelines)', pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Hospital Name
  doc.setFontSize(FONTS.subtitle);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(certificate.hospitalName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4;

  if (certificate.hospitalAddress) {
    doc.setFontSize(FONTS.small);
    doc.setFont('helvetica', 'normal');
    doc.text(certificate.hospitalAddress, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }

  // Registration/Certificate Number
  if (certificate.certificateNumber || certificate.registrationNumber) {
    doc.setFontSize(FONTS.small);
    doc.setFont('helvetica', 'bold');
    const certNo = certificate.certificateNumber || certificate.registrationNumber;
    doc.text(`Certificate No: ${certNo}`, pageWidth - MARGINS.right, y, { align: 'right' });
  }
  y += 5;

  // Horizontal line
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(MARGINS.left, y, pageWidth - MARGINS.right, y);
  y += 5;

  // ==================== SECTION 1: PATIENT IDENTIFICATION ====================
  y = addSectionHeader(doc, '1. Particulars of the Deceased', y);

  const col1 = MARGINS.left + 2;
  const col2 = pageWidth / 2;

  y = addLabelValue(doc, 'Name', certificate.patientName, col1, y);
  y = addLabelValue(doc, 'Gender', certificate.gender, col1, y);
  y = addLabelValue(doc, 'Date of Birth', formatDate(certificate.dateOfBirth), col1, y);
  y = addLabelValue(doc, 'Age at Death', certificate.ageAtDeath, col1, y);

  if (certificate.motherName) {
    y = addLabelValue(doc, "Mother's Name", certificate.motherName, col1, y);
  }
  if (certificate.fatherName) {
    y = addLabelValue(doc, "Father's Name", certificate.fatherName, col1, y);
  }

  // Address
  const address = [
    certificate.permanentAddress,
    certificate.village,
    certificate.tehsil,
    certificate.district,
    certificate.state,
    certificate.pinCode
  ].filter(Boolean).join(', ');
  if (address) {
    y = addLabelValue(doc, 'Address', address, col1, y, 35);
  }

  // IDs
  if (certificate.ntid) {
    y = addLabelValue(doc, 'NTID', certificate.ntid, col1, y);
  }
  if (certificate.uhid) {
    y = addLabelValue(doc, 'UHID', certificate.uhid, col1, y);
  }
  y += 3;

  // ==================== SECTION 2: ADMISSION & DEATH DETAILS ====================
  y = checkPageBreak(doc, y, 50);
  y = addSectionHeader(doc, '2. Admission & Death Details', y);

  y = addLabelValue(doc, 'Date of Admission', formatDateTime(certificate.dateOfAdmission, certificate.timeOfAdmission), col1, y);
  y = addLabelValue(doc, 'Date of Death', formatDateTime(certificate.dateOfDeath, certificate.timeOfDeath), col1, y);
  y = addLabelValue(doc, 'Duration of Stay', certificate.totalStayDuration, col1, y);
  y = addLabelValue(doc, 'Place of Death', certificate.placeOfDeath, col1, y);

  if (certificate.admissionType) {
    y = addLabelValue(doc, 'Admission Type', certificate.admissionType, col1, y);
  }
  if (certificate.referringHospital) {
    y = addLabelValue(doc, 'Referred From', certificate.referringHospital, col1, y);
  }
  y += 3;

  // ==================== SECTION 3: NEONATAL DETAILS (if applicable) ====================
  if (isNeonatal) {
    y = checkPageBreak(doc, y, 50);
    y = addSectionHeader(doc, '3. Neonatal Details', y);

    if (certificate.birthWeight) {
      y = addLabelValue(doc, 'Birth Weight', `${certificate.birthWeight} grams`, col1, y);
    }
    if (certificate.gestationalAge) {
      y = addLabelValue(doc, 'Gestational Age', certificate.gestationalAge, col1, y);
    }
    if (certificate.apgarScore) {
      y = addLabelValue(doc, 'APGAR Score', certificate.apgarScore, col1, y);
    }
    if (certificate.modeOfDelivery) {
      y = addLabelValue(doc, 'Mode of Delivery', certificate.modeOfDelivery, col1, y);
    }
    if (certificate.placeOfDelivery) {
      y = addLabelValue(doc, 'Place of Delivery', certificate.placeOfDelivery, col1, y);
    }
    if (certificate.resuscitationAtBirth) {
      y = addLabelValue(doc, 'Resuscitation at Birth', 'Yes - ' + (certificate.resuscitationDetails || ''), col1, y);
    }
    if (certificate.maternalHistory) {
      y = addLabelValue(doc, 'Maternal History', certificate.maternalHistory, col1, y, 35);
    }
    y += 3;
  }

  // ==================== SECTION 4: CAUSE OF DEATH (WHO ICD-10 Format) ====================
  y = checkPageBreak(doc, y, 80);
  const sectionNum = isNeonatal ? '4' : '3';
  y = addSectionHeader(doc, `${sectionNum}. Cause of Death (As per WHO ICD-10 Guidelines)`, y);

  // Part I Header
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Part I - Disease or condition directly leading to death:', col1, y);
  y += 5;

  // Create cause of death table
  const causeData: any[][] = [];
  const cod = certificate.causeOfDeathPartI;

  // Line (a) - Immediate Cause
  causeData.push([
    '(a) Immediate Cause',
    cod.immediateCause || '',
    cod.immediateCauseICD10 || '',
    cod.immediateCauseDuration || ''
  ]);

  // Line (b) - Antecedent Cause
  if (cod.antecedentCause) {
    causeData.push([
      '(b) due to (or as a consequence of)',
      cod.antecedentCause,
      cod.antecedentCauseICD10 || '',
      cod.antecedentCauseDuration || ''
    ]);
  }

  // Line (c) - Underlying Cause
  if (cod.underlyingCause) {
    causeData.push([
      '(c) due to (or as a consequence of)',
      cod.underlyingCause,
      cod.underlyingCauseICD10 || '',
      cod.underlyingCauseDuration || ''
    ]);
  }

  // Line (d) - Additional
  if (cod.additionalCause) {
    causeData.push([
      '(d) due to (or as a consequence of)',
      cod.additionalCause,
      cod.additionalCauseICD10 || '',
      cod.additionalCauseDuration || ''
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [['', 'Cause of Death', 'ICD-10 Code', 'Duration']],
    body: causeData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontSize: FONTS.small,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: FONTS.body,
      textColor: COLORS.dark
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 70 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 30, halign: 'center' }
    },
    margin: { left: MARGINS.left, right: MARGINS.right }
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // Part II - Contributing Conditions
  if (certificate.causeOfDeathPartII && certificate.causeOfDeathPartII.contributingConditions.length > 0) {
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(FONTS.body);
    doc.setFont('helvetica', 'bold');
    doc.text('Part II - Other significant conditions contributing to death:', col1, y);
    y += 5;

    const partIIData = certificate.causeOfDeathPartII.contributingConditions.map((c, i) => [
      `${i + 1}.`,
      c.condition,
      c.icd10Code || '',
      c.duration || ''
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Contributing Condition', 'ICD-10 Code', 'Duration']],
      body: partIIData,
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.secondary,
        textColor: COLORS.white,
        fontSize: FONTS.small
      },
      bodyStyles: {
        fontSize: FONTS.body,
        textColor: COLORS.dark
      },
      margin: { left: MARGINS.left, right: MARGINS.right }
    });

    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // Manner of Death
  y = checkPageBreak(doc, y, 20);
  doc.setFillColor(248, 250, 252);
  doc.rect(MARGINS.left, y - 2, pageWidth - MARGINS.left - MARGINS.right, 10, 'F');
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'bold');
  doc.text('Manner of Death:', col1, y + 3);
  doc.setFont('helvetica', 'normal');
  doc.text(certificate.mannerOfDeath || MannerOfDeath.Natural, col1 + 35, y + 3);
  y += 12;

  // ==================== SECTION 5: CLINICAL SUMMARY ====================
  y = checkPageBreak(doc, y, 60);
  const clinicalSectionNum = isNeonatal ? '5' : '4';
  y = addSectionHeader(doc, `${clinicalSectionNum}. Clinical Course & Treatment`, y);

  // Diagnosis
  y = addLabelValue(doc, 'Admission Diagnosis', certificate.admissionDiagnosis, col1, y, 40);
  y = addLabelValue(doc, 'Final Diagnosis', certificate.finalDiagnosis, col1, y, 40);
  y += 2;

  // Clinical Summary
  if (certificate.clinicalCourseSummary) {
    doc.setFontSize(FONTS.body);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.secondary);
    doc.text('Clinical Course Summary:', col1, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);
    const summaryLines = doc.splitTextToSize(certificate.clinicalCourseSummary, pageWidth - MARGINS.left - MARGINS.right - 4);

    // Print each line with page break check for long clinical summaries
    const lineHeight = 4;
    for (let i = 0; i < summaryLines.length; i++) {
      y = checkPageBreak(doc, y, lineHeight + 2);
      doc.text(summaryLines[i], col1, y);
      y += lineHeight;
    }
    y += 3;
  }

  // Treatment Provided
  if (certificate.treatmentProvided && certificate.treatmentProvided.length > 0) {
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(FONTS.body);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.secondary);
    doc.text('Treatment Provided:', col1, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);
    certificate.treatmentProvided.forEach((treatment, i) => {
      y = checkPageBreak(doc, y, 6);
      doc.text(`${i + 1}. ${treatment}`, col1 + 3, y);
      y += 4;
    });
    y += 2;
  }

  // Terminal Events
  if (certificate.terminalEvents) {
    doc.setFontSize(FONTS.body);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.secondary);
    y = checkPageBreak(doc, y, 10);
    doc.text('Terminal Events:', col1, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);
    const terminalLines = doc.splitTextToSize(certificate.terminalEvents, pageWidth - MARGINS.left - MARGINS.right - 4);
    const lineHeight = 4;
    for (let i = 0; i < terminalLines.length; i++) {
      y = checkPageBreak(doc, y, lineHeight + 2);
      doc.text(terminalLines[i], col1, y);
      y += lineHeight;
    }
    y += 2;
  }

  // Resuscitation
  if (certificate.resuscitationAttempted !== undefined) {
    y = addLabelValue(doc, 'Resuscitation Attempted', certificate.resuscitationAttempted ? 'Yes' : 'No', col1, y);
    if (certificate.resuscitationAttempted && certificate.resuscitationDuration) {
      y = addLabelValue(doc, 'Duration of Resuscitation', certificate.resuscitationDuration, col1, y);
    }
  }

  // Autopsy
  y = addLabelValue(doc, 'Autopsy', certificate.autopsyStatus || AutopsyStatus.NotPerformed, col1, y);
  if (certificate.autopsyFindings) {
    y = addLabelValue(doc, 'Autopsy Findings', certificate.autopsyFindings, col1, y, 35);
  }
  y += 3;

  // ==================== SECTION 6: NHM CLASSIFICATION (for pediatric/neonatal) ====================
  if (certificate.nhmDeathCategory || certificate.perinatalDeathType || certificate.deathClassification) {
    y = checkPageBreak(doc, y, 40);
    const nhmSectionNum = isNeonatal ? '6' : '5';
    y = addSectionHeader(doc, `${nhmSectionNum}. NHM Child Death Review Classification`, y);

    if (certificate.deathClassification) {
      y = addLabelValue(doc, 'Death Classification', certificate.deathClassification, col1, y);
    }
    if (certificate.perinatalDeathType) {
      y = addLabelValue(doc, 'Perinatal Death Type', certificate.perinatalDeathType, col1, y);
    }
    if (certificate.nhmDeathCategory) {
      y = addLabelValue(doc, 'NHM Category', certificate.nhmDeathCategory, col1, y);
    }

    // NHM Notifications
    doc.setFontSize(FONTS.small);
    if (certificate.nhmCDRFormCompleted) {
      y = addLabelValue(doc, 'CDR Form', `Completed (${certificate.nhmCDRFormNumber || 'No.'})`, col1, y);
    }
    if (certificate.deathNotifiedToASHA) {
      doc.text('[x] Death notified to ASHA', col1, y);
      y += 4;
    }
    if (certificate.deathNotifiedToCMO) {
      doc.text('[x] Death notified to CMO', col1, y);
      y += 4;
    }
    y += 3;
  }

  // ==================== SECTION 7: CERTIFICATION ====================
  y = checkPageBreak(doc, y, 80);
  const certSectionNum = isNeonatal ? '7' : '6';
  y = addSectionHeader(doc, `${certSectionNum}. Certification`, y);

  // Doctor In Charge (from admission form)
  if (patient.doctorInCharge) {
    doc.setFontSize(FONTS.body);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Doctor In Charge:', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(patient.doctorInCharge, col1 + 35, y);
    y += 6;
  }

  // Certification Statement
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLORS.dark);
  const certStatement = `I hereby certify that I attended the deceased during the last illness and that to the best of my knowledge and belief the cause of death and the particulars stated above are correct.`;
  const certLines = doc.splitTextToSize(certStatement, pageWidth - MARGINS.left - MARGINS.right - 4);
  doc.text(certLines, col1, y);
  y += certLines.length * 4 + 8;

  // Generated By
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Generated By:', col1, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${certificate.certifiedBy} (${certificate.certifierDesignation})`, col1 + 28, y);
  y += 5;
  doc.text(`Date: ${formatDate(certificate.certificationDate)}`, col1, y);
  y += 10;

  // Signature Area - Two columns
  const signY = y;

  // Left: Doctor on Duty (blank for signature)
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Name & Signature of Doctor on Duty:', col1, signY);

  // Blank line for name
  doc.setDrawColor(...COLORS.dark);
  doc.line(col1, signY + 10, col1 + 55, signY + 10);
  doc.setFontSize(FONTS.tiny);
  doc.setTextColor(...COLORS.secondary);
  doc.text('Name', col1, signY + 14);

  // Blank line for signature
  doc.line(col1, signY + 24, col1 + 55, signY + 24);
  doc.text('Signature & Stamp', col1 + 10, signY + 28);

  // Right: Death Summary Given To / Guardian signature
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  if (certificate.deathSummaryGivenTo) {
    doc.text('Death Summary Given To:', col2, signY);

    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${certificate.deathSummaryGivenTo}`, col2, signY + 5);
    if (certificate.relationToDeceased) {
      doc.text(`Relation: ${certificate.relationToDeceased}`, col2, signY + 9);
    }

    // Signature line for family
    doc.setDrawColor(...COLORS.dark);
    doc.line(col2, signY + 24, col2 + 55, signY + 24);
    doc.setFontSize(FONTS.tiny);
    doc.setTextColor(...COLORS.secondary);
    doc.text('Signature of Recipient', col2 + 8, signY + 28);
  } else {
    doc.text('Signature of Receiving Guardian:', col2, signY);

    // Blank line for name
    doc.setDrawColor(...COLORS.dark);
    doc.line(col2, signY + 10, col2 + 55, signY + 10);
    doc.setFontSize(FONTS.tiny);
    doc.setTextColor(...COLORS.secondary);
    doc.text('Name', col2, signY + 14);

    // Blank line for signature
    doc.line(col2, signY + 24, col2 + 55, signY + 24);
    doc.text('Signature', col2 + 15, signY + 28);
  }

  y = signY + 35;

  // ==================== FOOTER ====================
  y = checkPageBreak(doc, y, 25);

  // Horizontal line
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(MARGINS.left, y, pageWidth - MARGINS.right, y);
  y += 4;

  // Footer text
  doc.setFontSize(FONTS.tiny);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLORS.secondary);
  doc.text('This certificate should be sent to the Registrar of Births and Deaths along with Death Report (Form 2).', pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text('This document is generated as per the Registration of Births and Deaths Act, 1969 (India) and WHO ICD-10 Guidelines.', pageWidth / 2, y, { align: 'center' });
  y += 4;

  // NeoLink AI Branding
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('Generated by NeoLink AI Healthcare Platform', pageWidth / 2, y, { align: 'center' });

  // Page number
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(FONTS.tiny);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.secondary);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
    drawBorder(doc);
  }

  return doc;
}

// ==================== CREATE DEATH CERTIFICATE FROM PATIENT ====================

export function createDeathCertificateFromPatient(
  patient: Patient,
  options: DeathCertificateOptions
): DeathCertificate {
  const now = new Date();
  const deathDate = patient.dateOfDeath || patient.releaseDate || now.toISOString();
  const admissionDate = patient.admissionDate;

  // Calculate age at death
  let ageAtDeath = getFormattedAge(patient.dateOfBirth || '', deathDate);
  if (patient.ageInDays !== undefined && patient.ageInDays < 28) {
    ageAtDeath = `${patient.ageInDays} days`;
  }

  const certificate: DeathCertificate = {
    // Hospital Details
    hospitalName: options.hospitalName,
    hospitalAddress: options.hospitalAddress,
    hospitalPhone: options.hospitalPhone,
    hospitalRegistrationNo: options.hospitalRegistrationNo,

    // Patient Identification
    patientId: patient.id,
    patientName: patient.name,
    ntid: patient.ntid,
    uhid: patient.uhid,
    ipNumber: patient.ipNumber,

    // Demographics
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth,
    ageAtDeath: ageAtDeath,
    ageInDays: patient.ageInDays,

    // Address
    permanentAddress: patient.address,
    village: patient.village,
    district: patient.district,
    state: patient.state,
    pinCode: patient.pinCode,

    // Parent Details
    motherName: patient.motherName,
    fatherName: patient.fatherName,
    parentContact: patient.parentPhone || patient.parentMobile,

    // Admission Details
    dateOfAdmission: admissionDate,
    admissionType: patient.admissionType,
    referringHospital: patient.referringHospital,
    referringDistrict: patient.referringDistrict,

    // Death Details
    dateOfDeath: deathDate,
    timeOfDeath: patient.timeOfDeath || formatTime(new Date(deathDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })),
    placeOfDeath: options.placeOfDeath || PlaceOfDeath.Hospital,
    totalStayDuration: calculateStayDuration(admissionDate, deathDate),

    // Classification
    mannerOfDeath: options.mannerOfDeath || MannerOfDeath.Natural,
    deathClassification: options.deathClassification,
    perinatalDeathType: options.perinatalDeathType,
    nhmDeathCategory: options.nhmDeathCategory,

    // Diagnosis
    admissionDiagnosis: patient.diagnosis,
    primaryDiagnosis: patient.diagnosis,
    finalDiagnosis: patient.finalDiagnosis || patient.diagnosis,

    // Neonatal Details
    birthWeight: patient.birthWeight,
    gestationalAge: patient.gestationalAge,
    gestationalAgeWeeks: patient.gestationalAgeWeeks,
    apgarScore: patient.apgarScore,
    modeOfDelivery: patient.modeOfDelivery,
    placeOfDelivery: patient.placeOfDelivery,
    resuscitationAtBirth: patient.resuscitationRequired,
    resuscitationDetails: patient.resuscitationDetails,
    maternalHistory: patient.maternalHistory,

    // Cause of Death
    causeOfDeathPartI: options.causeOfDeathPartI,
    causeOfDeathPartII: options.causeOfDeathPartII,

    // AI Analysis
    aiCauseOfDeathAnalysis: options.aiCauseOfDeathAnalysis,
    aiSuggestedICD10Codes: options.aiSuggestedICD10Codes,
    aiDeathSummary: options.aiDeathSummary,

    // Clinical Summary
    clinicalCourseSummary: options.clinicalCourseSummary,
    treatmentProvided: options.treatmentProvided,

    // Terminal Events
    terminalEvents: options.terminalEvents,
    resuscitationAttempted: options.resuscitationAttempted,
    resuscitationDuration: options.resuscitationDuration,

    // Autopsy
    autopsyStatus: options.autopsyStatus || AutopsyStatus.NotPerformed,

    // Certification
    certifiedBy: options.certifiedBy,
    certifierDesignation: options.certifierDesignation,
    certifierRegistrationNo: options.certifierRegistrationNo,
    certificationDate: now.toISOString(),

    // Death Summary Given To
    deathSummaryGivenTo: options.deathSummaryGivenTo,
    relationToDeceased: options.relationToDeceased,

    // NHM
    nhmCDRFormCompleted: options.nhmCDRFormCompleted,
    deathNotifiedToASHA: options.deathNotifiedToASHA,
    deathNotifiedToCMO: options.deathNotifiedToCMO,

    // Metadata
    createdAt: now.toISOString(),
    createdBy: options.certifiedBy,
    isDraft: true
  };

  return certificate;
}

// ==================== DOWNLOAD & PREVIEW ====================

export function downloadDeathCertificatePDF(certificate: DeathCertificate, patient: Patient): void {
  const doc = generateDeathCertificatePDF(certificate, patient);
  const fileName = `MCCD_${patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

export function previewDeathCertificatePDF(certificate: DeathCertificate, patient: Patient): string {
  const doc = generateDeathCertificatePDF(certificate, patient);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
