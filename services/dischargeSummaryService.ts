import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import {
  Patient,
  DischargeSummary,
  Unit,
  VaccinationType,
  FeedingType,
  DischargeVitals,
  DischargeFeeding,
  DischargeMedication,
  NHMFollowUpSchedule,
  DischargeScreenings,
  ScreeningStatus,
  DischargeType
} from '../types';
import { getFormattedAge } from '../utils/ageCalculator';

// ==================== UNICODE DETECTION HELPER ====================
// Check if text contains non-Latin characters (Indic scripts, etc.)
function containsNonLatinCharacters(text: string): boolean {
  // Regex to detect Devanagari and other Indic scripts
  const indicScriptRegex = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u1000-\u109F\u1780-\u17FF\u0600-\u06FF\u0750-\u077F]/;
  return indicScriptRegex.test(text);
}

// ==================== BILINGUAL TEXT RENDERER ====================
// Renders bilingual text (English + Indic script) as an image using html2canvas
async function renderBilingualTextAsImage(
  items: string[],
  title: string,
  isWarning: boolean = false
): Promise<HTMLCanvasElement | null> {
  // Create a temporary container
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 540px;
    padding: 16px;
    background: ${isWarning ? '#FEF2F2' : '#FFFFFF'};
    font-family: 'Noto Sans', 'Noto Sans Devanagari', 'Arial Unicode MS', system-ui, -apple-system, sans-serif;
    font-size: 11px;
    line-height: 1.5;
    color: ${isWarning ? '#991B1B' : '#1E293B'};
  `;

  // Add title
  const titleEl = document.createElement('div');
  titleEl.style.cssText = `
    font-weight: bold;
    font-size: 12px;
    margin-bottom: 12px;
    padding: 6px 10px;
    background: ${isWarning ? '#DC2626' : '#F59E0B'};
    color: white;
    border-radius: 4px;
  `;
  titleEl.textContent = title;
  container.appendChild(titleEl);

  // Add items
  items.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.style.cssText = `
      margin-bottom: 10px;
      padding-left: 8px;
      border-left: 2px solid ${isWarning ? '#DC2626' : '#F59E0B'};
    `;

    // Split by newline to separate English and regional text
    const lines = item.split('\n');
    lines.forEach((line, lineIndex) => {
      const lineEl = document.createElement('div');
      lineEl.style.cssText = lineIndex === 0
        ? 'font-weight: 500; color: #1E293B;'
        : 'color: #475569; margin-top: 2px;';
      lineEl.textContent = isWarning ? `• ${line}` : `${index + 1}. ${line}`;
      if (lineIndex > 0) lineEl.textContent = `   ${line}`;
      itemEl.appendChild(lineEl);
    });

    container.appendChild(itemEl);
  });

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: isWarning ? '#FEF2F2' : '#FFFFFF',
    });
    return canvas;
  } catch (error) {
    console.error('Error rendering bilingual text:', error);
    return null;
  } finally {
    document.body.removeChild(container);
  }
}

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
    lastAutoTable: { finalY: number };
  }
}

// ==================== PDF STYLING CONSTANTS ====================
const COLORS = {
  primary: [41, 98, 255] as [number, number, number],      // Blue
  secondary: [100, 116, 139] as [number, number, number],  // Slate
  success: [34, 197, 94] as [number, number, number],      // Green
  warning: [245, 158, 11] as [number, number, number],     // Amber
  danger: [239, 68, 68] as [number, number, number],       // Red
  dark: [30, 41, 59] as [number, number, number],          // Slate 800
  light: [248, 250, 252] as [number, number, number],      // Slate 50
  white: [255, 255, 255] as [number, number, number],
  pink: [236, 72, 153] as [number, number, number],        // Pink for maternal
  nicuBlue: [14, 165, 233] as [number, number, number],    // Sky blue for NICU
  picuPurple: [139, 92, 246] as [number, number, number],  // Violet for PICU
};

const FONTS = {
  title: 16,
  subtitle: 12,
  heading: 11,
  body: 9,
  small: 8,
};

const MARGINS = {
  left: 15,
  right: 15,
  top: 15,
  bottom: 20,
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

function formatDateTime(date: string | undefined): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getUnitColor(unit: Unit): [number, number, number] {
  switch (unit) {
    case Unit.NICU:
    case Unit.SNCU:
      return COLORS.nicuBlue;
    case Unit.PICU:
      return COLORS.picuPurple;
    default:
      return COLORS.primary;
  }
}

function addPageHeader(doc: jsPDF, summary: DischargeSummary, unit: Unit) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const unitColor = getUnitColor(unit);

  // Header background - taller to accommodate branding
  doc.setFillColor(...unitColor);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // NeoLink AI Branding (top right corner)
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('NeoLink AI', pageWidth - MARGINS.right, 6, { align: 'right' });
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  doc.text('Advanced Healthcare Analytics', pageWidth - MARGINS.right, 9, { align: 'right' });

  // Hospital Name
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(FONTS.title);
  doc.setFont('helvetica', 'bold');
  doc.text(summary.hospitalName || 'Hospital Name', pageWidth / 2, 14, { align: 'center' });

  // Hospital Address
  if (summary.hospitalAddress) {
    doc.setFontSize(FONTS.small);
    doc.setFont('helvetica', 'normal');
    doc.text(summary.hospitalAddress, pageWidth / 2, 20, { align: 'center' });
  }

  // Document Title
  const isNICU = unit === Unit.NICU || unit === Unit.SNCU;
  const title = isNICU ? 'NEONATAL DISCHARGE SUMMARY' : 'PEDIATRIC ICU DISCHARGE SUMMARY';
  doc.setFontSize(FONTS.subtitle);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, summary.hospitalAddress ? 28 : 24, { align: 'center' });

  // Subtitle
  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'italic');
  doc.text('(As per NHM Guidelines)', pageWidth / 2, summary.hospitalAddress ? 32 : 28, { align: 'center' });

  // Reset text color
  doc.setTextColor(...COLORS.dark);
}

function addSectionHeader(doc: jsPDF, title: string, y: number, color: [number, number, number] = COLORS.primary): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...color);
  doc.rect(MARGINS.left, y, pageWidth - MARGINS.left - MARGINS.right, 6, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(FONTS.heading);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), MARGINS.left + 3, y + 4.5);

  doc.setTextColor(...COLORS.dark);
  return y + 10;
}

function addDataRow(doc: jsPDF, label: string, value: string | number | undefined, x: number, y: number, labelWidth: number = 45): number {
  if (value === undefined || value === null || value === '') return y;

  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.secondary);
  doc.text(`${label}:`, x, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  doc.text(String(value), x + labelWidth, y);

  return y + 5;
}

function checkPageBreak(doc: jsPDF, currentY: number, requiredSpace: number = 40): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + requiredSpace > pageHeight - MARGINS.bottom) {
    doc.addPage();
    return MARGINS.top;
  }
  return currentY;
}

// ==================== MAIN PDF GENERATION ====================

export async function generateDischargeSummaryPDF(summary: DischargeSummary, patient: Patient): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const isNICU = patient.unit === Unit.NICU || patient.unit === Unit.SNCU;
  const unitColor = getUnitColor(patient.unit);

  // Add page header
  addPageHeader(doc, summary, patient.unit);

  let y = 42; // Start after header (header is 35mm tall)

  // ==================== DISCHARGE TYPE BANNER ====================
  const dischargeType = summary.dischargeType || DischargeType.Normal;
  const isDAMAorLAMA = dischargeType === DischargeType.DAMA || dischargeType === DischargeType.LAMA || dischargeType === DischargeType.DOR;

  // Discharge Type Box
  const typeBoxHeight = isDAMAorLAMA ? 18 : 10;
  const typeBoxColor: [number, number, number] =
    dischargeType === DischargeType.Normal ? [34, 197, 94] : // Green
    dischargeType === DischargeType.DOR ? [245, 158, 11] : // Amber
    dischargeType === DischargeType.DAMA ? [239, 68, 68] : // Red
    dischargeType === DischargeType.LAMA ? [220, 38, 38] : // Dark Red
    [100, 116, 139]; // Slate

  doc.setFillColor(...typeBoxColor);
  doc.roundedRect(MARGINS.left, y, pageWidth - MARGINS.left - MARGINS.right, typeBoxHeight, 2, 2, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`TYPE OF DISCHARGE: ${dischargeType.toUpperCase()}`, pageWidth / 2, y + 6, { align: 'center' });

  if (isDAMAorLAMA) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const warningText = dischargeType === DischargeType.DAMA
      ? 'Patient discharged against medical advice. Treatment incomplete. Risks explained to patient party.'
      : dischargeType === DischargeType.DOR
      ? 'Patient discharged on request of patient party before completing treatment.'
      : 'Patient left against medical advice without medical clearance.';
    doc.text(warningText, pageWidth / 2, y + 12, { align: 'center' });

    if (summary.damaReason) {
      doc.setFontSize(7);
      doc.text(`Reason: ${summary.damaReason}`, pageWidth / 2, y + 16, { align: 'center' });
    }
  }

  y += typeBoxHeight + 5;

  // ==================== PATIENT IDENTIFICATION ====================
  y = addSectionHeader(doc, 'Patient Information', y, unitColor);

  // Two-column layout for basic info
  const col1X = MARGINS.left;
  const col2X = pageWidth / 2 + 5;

  y = addDataRow(doc, 'Patient Name', summary.patientName, col1X, y);
  let y2 = addDataRow(doc, 'NTID', summary.ntid, col2X, y - 5);

  y = addDataRow(doc, 'Date of Birth', formatDate(summary.dateOfBirth), col1X, y);
  y2 = addDataRow(doc, 'Gender', summary.gender, col2X, y - 5);

  y = addDataRow(doc, 'Age', getFormattedAge(patient.dateOfBirth, patient.age, patient.ageUnit), col1X, y);
  y2 = addDataRow(doc, 'Birth Weight', summary.birthWeight ? `${summary.birthWeight} kg` : undefined, col2X, y - 5);

  if (isNICU) {
    y = addDataRow(doc, 'Gestational Age', summary.gestationalAge, col1X, y);
    y2 = addDataRow(doc, 'GA Category', summary.gestationalAgeCategory, col2X, y - 5);
  }

  y = Math.max(y, y2);

  // Patient Address
  if (summary.patientAddress) {
    y += 2;
    doc.setFontSize(FONTS.body);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.secondary);
    doc.text('Address:', col1X, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);
    const addressText = doc.splitTextToSize(summary.patientAddress, pageWidth - MARGINS.left - MARGINS.right - 10);
    doc.text(addressText, col1X + 3, y);
    y += addressText.length * 4;
  }

  y += 3;

  // ==================== ADMISSION & DISCHARGE DETAILS ====================
  y = checkPageBreak(doc, y);
  y = addSectionHeader(doc, 'Admission & Discharge Details', y, unitColor);

  y = addDataRow(doc, 'Admission Date', formatDateTime(summary.admissionDate), col1X, y);
  y2 = addDataRow(doc, 'Discharge Date', formatDateTime(summary.dischargeDate), col2X, y - 5);

  y = addDataRow(doc, 'Total Stay', `${summary.totalStayDays} days`, col1X, y);
  // Add Admission Type (Inborn/Outborn)
  y2 = addDataRow(doc, 'Admission Type', summary.admissionType, col2X, y - 5);

  y = addDataRow(doc, 'Mode of Delivery', summary.modeOfDelivery, col1X, y);
  y2 = addDataRow(doc, 'Place of Delivery', summary.placeOfDelivery, col2X, y - 5);

  if (summary.indicationsForAdmission && summary.indicationsForAdmission.length > 0) {
    y = Math.max(y, y2);
    y = addDataRow(doc, 'Indications', summary.indicationsForAdmission.join(', '), col1X, y, 30);
  }

  y = Math.max(y, y2) + 3;

  // ==================== MATERNAL HISTORY (NICU/SNCU only) ====================
  if (isNICU && (summary.motherName || summary.maternalAge || patient.maternalHistory)) {
    y = checkPageBreak(doc, y);
    y = addSectionHeader(doc, 'Maternal History', y, COLORS.pink);

    y = addDataRow(doc, "Mother's Name", summary.motherName, col1X, y);
    y2 = addDataRow(doc, "Father's Name", summary.fatherName, col2X, y - 5);

    y = addDataRow(doc, 'Maternal Age', summary.maternalAge ? `${summary.maternalAge} years` : undefined, col1X, y);
    y2 = addDataRow(doc, 'Blood Group', summary.bloodGroup, col2X, y - 5);

    if (patient.maternalHistory) {
      const mh = patient.maternalHistory;
      y = addDataRow(doc, 'Obstetric History', `G${mh.gravida || 0} P${mh.para || 0} A${mh.abortion || 0} L${mh.living || 0}`, col1X, y);
      y2 = addDataRow(doc, 'ANC Visits', mh.ancVisits?.toString(), col2X, y - 5);

      y = addDataRow(doc, 'Antenatal Steroids', mh.antenatalSteroidsGiven ? 'Yes' : 'No', col1X, y);

      if (mh.riskFactors && mh.riskFactors.length > 0) {
        y = y + 2;
        doc.setFontSize(FONTS.body);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.secondary);
        doc.text('Risk Factors:', col1X, y);
        y += 4;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.dark);
        const riskText = mh.riskFactors.join(', ');
        const splitRisk = doc.splitTextToSize(riskText, pageWidth - MARGINS.left - MARGINS.right - 10);
        doc.text(splitRisk, col1X + 3, y);
        y += splitRisk.length * 4;
      }
    }

    y = Math.max(y, y2) + 3;
  }

  // ==================== DIAGNOSES ====================
  y = checkPageBreak(doc, y);
  y = addSectionHeader(doc, 'Diagnosis', y, unitColor);

  // Final Diagnosis (AI-generated or manually entered)
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Final Diagnosis:', col1X, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  const finalDiagnosisText = summary.finalDiagnosis || summary.primaryDiagnosis;
  const finalDiagText = doc.splitTextToSize(finalDiagnosisText, pageWidth - MARGINS.left - MARGINS.right - 10);
  doc.text(finalDiagText, col1X + 3, y);
  y += finalDiagText.length * 4 + 2;

  // Show admission diagnosis if different from final
  if (summary.finalDiagnosis && summary.primaryDiagnosis && summary.finalDiagnosis !== summary.primaryDiagnosis) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.secondary);
    doc.text('Admission Diagnosis:', col1X, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);
    const admDiagText = doc.splitTextToSize(summary.primaryDiagnosis, pageWidth - MARGINS.left - MARGINS.right - 10);
    doc.text(admDiagText, col1X + 3, y);
    y += admDiagText.length * 4 + 2;
  }

  if (summary.secondaryDiagnoses && summary.secondaryDiagnoses.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Secondary Diagnoses:', col1X, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    summary.secondaryDiagnoses.forEach((diag, index) => {
      doc.text(`${index + 1}. ${diag}`, col1X + 3, y);
      y += 4;
    });
  }

  if (summary.icd10Codes && summary.icd10Codes.length > 0) {
    y += 2;
    doc.setFontSize(FONTS.small);
    doc.setTextColor(...COLORS.secondary);
    doc.text(`ICD-10 Codes: ${summary.icd10Codes.join(', ')}`, col1X, y);
    y += 4;
  }

  y += 3;

  // ==================== CLINICAL COURSE ====================
  y = checkPageBreak(doc, y, 50);
  y = addSectionHeader(doc, 'Clinical Course Summary', y, unitColor);

  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);

  const courseSummary = doc.splitTextToSize(summary.clinicalCourseSummary, pageWidth - MARGINS.left - MARGINS.right - 5);
  doc.text(courseSummary, col1X, y);
  y += courseSummary.length * 4 + 5;

  if (summary.proceduresPerformed && summary.proceduresPerformed.length > 0) {
    y = checkPageBreak(doc, y);
    doc.setFont('helvetica', 'bold');
    doc.text('Procedures Performed:', col1X, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    summary.proceduresPerformed.forEach((proc, index) => {
      doc.text(`${index + 1}. ${proc}`, col1X + 3, y);
      y += 4;
    });
    y += 2;
  }

  // ==================== DISCHARGE VITALS & ANTHROPOMETRY ====================
  y = checkPageBreak(doc, y);
  y = addSectionHeader(doc, 'Discharge Vitals & Anthropometry', y, COLORS.success);

  const vitals = summary.dischargeVitals;
  y = addDataRow(doc, 'Weight', `${vitals.weight} kg`, col1X, y);
  y2 = addDataRow(doc, 'Length', vitals.length ? `${vitals.length} cm` : undefined, col2X, y - 5);

  y = addDataRow(doc, 'Head Circ.', vitals.headCircumference ? `${vitals.headCircumference} cm` : undefined, col1X, y);
  y2 = addDataRow(doc, 'Temperature', vitals.temperature, col2X, y - 5);

  y = addDataRow(doc, 'Heart Rate', vitals.heartRate, col1X, y);
  y2 = addDataRow(doc, 'Resp. Rate', vitals.respiratoryRate, col2X, y - 5);

  y = addDataRow(doc, 'SpO2', vitals.spo2, col1X, y);
  y2 = addDataRow(doc, 'BP', vitals.bloodPressure, col2X, y - 5);

  if (summary.weightGain !== undefined) {
    y = addDataRow(doc, 'Weight Gain', `${summary.weightGain > 0 ? '+' : ''}${summary.weightGain} kg during stay`, col1X, y);
  }

  y = Math.max(y, y2) + 3;

  // ==================== CONDITION AT DISCHARGE ====================
  y = checkPageBreak(doc, y);
  y = addSectionHeader(doc, 'Condition at Discharge', y, COLORS.success);

  y = addDataRow(doc, 'Overall Condition', summary.conditionAtDischarge, col1X, y);
  y2 = addDataRow(doc, 'General Condition', summary.generalCondition, col2X, y - 5);

  y = addDataRow(doc, 'Activity', summary.activity, col1X, y);

  if (isNICU) {
    y2 = addDataRow(doc, 'Sucking Reflex', summary.suckingReflex, col2X, y - 5);
  }

  y = Math.max(y, y2) + 3;

  // ==================== FEEDING AT DISCHARGE ====================
  y = checkPageBreak(doc, y);
  y = addSectionHeader(doc, 'Feeding at Discharge', y, COLORS.warning);

  const feeding = summary.dischargeFeeding;
  y = addDataRow(doc, 'Feeding Type', feeding.feedingType, col1X, y);
  y2 = addDataRow(doc, 'Volume', feeding.feedingVolume, col2X, y - 5);

  y = addDataRow(doc, 'Frequency', feeding.feedingFrequency, col1X, y);
  y2 = addDataRow(doc, 'Calories', feeding.calories, col2X, y - 5);

  if (feeding.specialInstructions) {
    y = Math.max(y, y2) + 2;
    doc.setFontSize(FONTS.body);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...COLORS.secondary);
    const feedInstr = doc.splitTextToSize(`Note: ${feeding.specialInstructions}`, pageWidth - MARGINS.left - MARGINS.right - 10);
    doc.text(feedInstr, col1X, y);
    y += feedInstr.length * 4;
  }

  y = Math.max(y, y2) + 5;

  // ==================== TREATMENT RECEIVED ====================
  if (summary.treatmentReceived && summary.treatmentReceived.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y = addSectionHeader(doc, 'Treatment Received During Hospital Stay', y, COLORS.secondary);

    doc.setFontSize(FONTS.body);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);

    summary.treatmentReceived.forEach((treatment, index) => {
      y = checkPageBreak(doc, y);
      doc.text(`${index + 1}. ${treatment}`, col1X + 3, y);
      y += 4;
    });

    y += 3;
  }

  // ==================== FOLLOW-UP MEDICATIONS ====================
  if (summary.dischargeMedications && summary.dischargeMedications.length > 0) {
    y = checkPageBreak(doc, y, 40);
    y = addSectionHeader(doc, 'Follow-up Medications (To Take Home)', y, COLORS.primary);

    const medHeaders = [['#', 'Medication', 'Frequency', 'Duration']];
    const medData = summary.dischargeMedications.map((med, index) => [
      (index + 1).toString(),
      med.name,
      med.frequency,
      med.duration || 'As directed'
    ]);

    autoTable(doc, {
      startY: y,
      head: medHeaders,
      body: medData,
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontSize: FONTS.small,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: FONTS.small,
        textColor: COLORS.dark,
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 70 },
        2: { cellWidth: 40 },
        3: { cellWidth: 50 },
      },
      margin: { left: MARGINS.left, right: MARGINS.right },
    });

    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // ==================== VACCINATIONS ====================
  if (summary.vaccinationsGiven && summary.vaccinationsGiven.length > 0) {
    y = checkPageBreak(doc, y);
    y = addSectionHeader(doc, 'Vaccinations Given', y, COLORS.success);

    summary.vaccinationsGiven.forEach((vax, index) => {
      const date = summary.vaccinationDates?.[vax];
      doc.setFontSize(FONTS.body);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.dark);
      doc.text(`${index + 1}. ${vax}${date ? ` (${formatDate(date)})` : ''}`, col1X + 3, y);
      y += 4;
    });

    if (summary.pendingVaccinations && summary.pendingVaccinations.length > 0) {
      y += 2;
      doc.setTextColor(...COLORS.warning);
      doc.setFont('helvetica', 'bold');
      doc.text('Pending Vaccinations:', col1X, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.text(summary.pendingVaccinations.join(', '), col1X + 3, y);
      y += 5;
    }

    y += 3;
  }

  // ==================== SCREENINGS ====================
  if (summary.screenings) {
    y = checkPageBreak(doc, y);
    y = addSectionHeader(doc, 'Screenings', y, unitColor);

    const scr = summary.screenings;

    if (scr.hearingScreenDone !== undefined) {
      y = addDataRow(doc, 'Hearing Screen', scr.hearingScreenResult || (scr.hearingScreenDone ? 'Done' : 'Not Done'), col1X, y);
    }

    if (scr.metabolicScreenDone !== undefined) {
      y = addDataRow(doc, 'Metabolic Screen', scr.metabolicScreenResult || (scr.metabolicScreenDone ? 'Done' : 'Not Done'), col1X, y);
    }

    if (scr.ropScreeningDone !== undefined) {
      y = addDataRow(doc, 'ROP Screening', scr.ropScreeningResult || (scr.ropScreeningDone ? 'Done' : 'Not Done'), col1X, y);
      if (scr.nextRopScreeningDate) {
        y = addDataRow(doc, 'Next ROP Screen', formatDate(scr.nextRopScreeningDate), col1X, y);
      }
    }

    if (scr.carSeatTestDone !== undefined) {
      y = addDataRow(doc, 'Car Seat Test', scr.carSeatTestResult || (scr.carSeatTestDone ? 'Done' : 'Not Done'), col1X, y);
    }

    y += 3;
  }

  // ==================== NHM FOLLOW-UP SCHEDULE ====================
  if (isNICU) {
    y = checkPageBreak(doc, y, 60);
    y = addSectionHeader(doc, 'Follow-Up Schedule (As per NHM Guidelines)', y, COLORS.primary);

    // Home visits section
    doc.setFontSize(FONTS.body);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Home Visits by ASHA (HBNC Program):', col1X, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONTS.small);
    const homeVisitDays = ['Day 3', 'Day 7', 'Day 14', 'Day 21', 'Day 28', 'Day 42'];
    const homeVisitText = homeVisitDays.join('  |  ');
    doc.text(homeVisitText, col1X + 3, y);
    y += 6;

    // Facility follow-up section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONTS.body);
    doc.text('Facility Follow-Up Visits:', col1X, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONTS.small);
    const facilityVisits = ['3 Months', '6 Months', '9 Months', '1 Year'];
    const facilityVisitText = facilityVisits.join('  |  ');
    doc.text(facilityVisitText, col1X + 3, y);
    y += 6;

    // Assessment at each visit
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONTS.body);
    doc.text('At Each Visit, Assess:', col1X, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONTS.small);
    const assessments = [
      'Weight gain and growth',
      'Feeding adequacy',
      'Developmental milestones',
      'Immunization status',
      'Any danger signs'
    ];
    assessments.forEach(item => {
      doc.text(`• ${item}`, col1X + 3, y);
      y += 4;
    });

    // Special follow-up if needed
    if (summary.nhmFollowUpSchedule?.specialFollowUp) {
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FONTS.body);
      doc.setTextColor(...COLORS.warning);
      doc.text('Special Follow-Up Required:', col1X, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONTS.small);
      doc.setTextColor(...COLORS.dark);
      doc.text(summary.nhmFollowUpSchedule.specialFollowUp, col1X + 3, y);
      y += 5;
    }

    y += 3;
  }

  // ==================== DISCHARGE ADVICE & WARNING SIGNS ====================
  // Check if any text contains non-Latin characters (Hindi, Bengali, etc.)
  const adviceHasNonLatin = summary.dischargeAdvice?.some(a => containsNonLatinCharacters(a)) || false;
  const warningsHasNonLatin = summary.warningSignsToWatch?.some(w => containsNonLatinCharacters(w)) || false;

  y = checkPageBreak(doc, y, 50);

  // Render discharge advice
  if (summary.dischargeAdvice && summary.dischargeAdvice.length > 0) {
    if (adviceHasNonLatin) {
      // Use html2canvas for bilingual text (supports Indic scripts)
      const adviceCanvas = await renderBilingualTextAsImage(
        summary.dischargeAdvice,
        'DISCHARGE ADVICE',
        false
      );
      if (adviceCanvas) {
        const imgWidth = pageWidth - MARGINS.left - MARGINS.right;
        const imgHeight = (adviceCanvas.height * imgWidth) / adviceCanvas.width;

        // Check if we need a new page
        if (y + imgHeight > doc.internal.pageSize.getHeight() - MARGINS.bottom) {
          doc.addPage();
          y = MARGINS.top;
        }

        const imgData = adviceCanvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', MARGINS.left, y, imgWidth, imgHeight);
        y += imgHeight + 5;
      }
    } else {
      // Standard rendering for English-only text
      y = addSectionHeader(doc, 'Discharge Advice', y, COLORS.warning);
      summary.dischargeAdvice.forEach((advice, index) => {
        y = checkPageBreak(doc, y);
        doc.setFontSize(FONTS.body);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.dark);
        const adviceText = doc.splitTextToSize(`${index + 1}. ${advice}`, pageWidth - MARGINS.left - MARGINS.right - 10);
        doc.text(adviceText, col1X + 3, y);
        y += adviceText.length * 4;
      });
      y += 3;
    }
  }

  // Render warning signs
  if (summary.warningSignsToWatch && summary.warningSignsToWatch.length > 0) {
    if (warningsHasNonLatin) {
      // Use html2canvas for bilingual text (supports Indic scripts)
      const warningsCanvas = await renderBilingualTextAsImage(
        summary.warningSignsToWatch,
        'WARNING SIGNS - BRING BABY IMMEDIATELY IF:',
        true
      );
      if (warningsCanvas) {
        const imgWidth = pageWidth - MARGINS.left - MARGINS.right;
        const imgHeight = (warningsCanvas.height * imgWidth) / warningsCanvas.width;

        // Check if we need a new page
        if (y + imgHeight > doc.internal.pageSize.getHeight() - MARGINS.bottom) {
          doc.addPage();
          y = MARGINS.top;
        }

        const imgData = warningsCanvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', MARGINS.left, y, imgWidth, imgHeight);
        y += imgHeight + 5;
      }
    } else {
      // Standard rendering for English-only text
      y = checkPageBreak(doc, y, 40);

      // Red warning box
      doc.setFillColor(...COLORS.danger);
      doc.rect(MARGINS.left, y, pageWidth - MARGINS.left - MARGINS.right, 7, 'F');

      doc.setTextColor(...COLORS.white);
      doc.setFontSize(FONTS.heading);
      doc.setFont('helvetica', 'bold');
      doc.text('WARNING SIGNS - BRING BABY IMMEDIATELY IF:', MARGINS.left + 3, y + 5);
      y += 10;

      // Warning signs list with red border
      doc.setDrawColor(...COLORS.danger);
      doc.setLineWidth(0.5);
      const warningStartY = y;

      summary.warningSignsToWatch.forEach((sign, index) => {
        doc.setFontSize(FONTS.body);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.danger);
        doc.text(`• ${sign}`, MARGINS.left + 5, y);
        y += 4;
      });

      y += 2;
      doc.rect(MARGINS.left, warningStartY - 3, pageWidth - MARGINS.left - MARGINS.right, y - warningStartY + 3, 'S');
      y += 5;
    }
  }

  // ==================== EMERGENCY CONTACT ====================
  if (summary.emergencyContact || summary.hospitalHelpline) {
    y = checkPageBreak(doc, y);
    y = addSectionHeader(doc, 'Emergency Contact', y, COLORS.danger);

    if (summary.hospitalHelpline) {
      y = addDataRow(doc, 'Hospital Helpline', summary.hospitalHelpline, col1X, y);
    }
    if (summary.emergencyContact) {
      y = addDataRow(doc, 'Emergency Contact', summary.emergencyContact, col1X, y);
    }
    if (summary.primaryCarePhysician) {
      y = addDataRow(doc, 'Primary Care Doctor', summary.primaryCarePhysician, col1X, y);
    }
    y += 5;
  }

  // ==================== SIGNATURE SECTION ====================
  y = checkPageBreak(doc, y, 50);

  // Horizontal line
  doc.setDrawColor(...COLORS.secondary);
  doc.setLineWidth(0.3);
  doc.line(MARGINS.left, y, pageWidth - MARGINS.right, y);
  y += 8;

  // Doctor In Charge (from admission form)
  if (patient.doctorInCharge) {
    doc.setFontSize(FONTS.body);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Doctor In Charge:', col1X, y);
    doc.setFont('helvetica', 'normal');
    doc.text(patient.doctorInCharge, col1X + 35, y);
    y += 6;
  }

  // Generated By
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Generated By:', col1X, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${summary.preparedBy} (${summary.preparedByRole})`, col1X + 28, y);

  y += 10;

  // Signature section - Two columns
  // Left: Doctor on Duty (blank for signature)
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Name & Signature of Doctor on Duty:', col1X, y);
  y += 6;

  // Blank line for name
  doc.setDrawColor(...COLORS.dark);
  doc.line(col1X, y + 6, col1X + 60, y + 6);
  doc.setFontSize(FONTS.small);
  doc.setTextColor(...COLORS.secondary);
  doc.text('Name', col1X, y + 10);

  // Blank line for signature
  doc.line(col1X, y + 20, col1X + 60, y + 20);
  doc.text('Signature', col1X, y + 24);

  // Right: Guardian signature
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Signature of Receiving Guardian:', col2X, y - 6);

  // Blank line for guardian signature
  doc.setDrawColor(...COLORS.dark);
  doc.line(col2X, y + 6, col2X + 60, y + 6);
  doc.setFontSize(FONTS.small);
  doc.setTextColor(...COLORS.secondary);
  doc.text('Name', col2X, y + 10);

  doc.line(col2X, y + 20, col2X + 60, y + 20);
  doc.text('Signature', col2X, y + 24);

  y += 30;

  // Generated timestamp and branding
  doc.setFontSize(FONTS.small);
  doc.setTextColor(...COLORS.secondary);
  doc.text(`Generated on: ${formatDateTime(summary.generatedAt)}`, col1X, y);

  // NeoLink AI Branding
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...unitColor);
  doc.text('NeoLink AI', pageWidth - MARGINS.right, y, { align: 'right' });
  y += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.secondary);
  doc.text('Advanced Healthcare Analytics', pageWidth - MARGINS.right, y, { align: 'right' });

  // ==================== AI DISCLAIMER WARNING ====================
  y = checkPageBreak(doc, y, 25);
  y += 8;

  // AI Warning Box
  const warningBoxY = y;
  const warningBoxHeight = 16;
  doc.setFillColor(255, 251, 235); // Light amber background
  doc.setDrawColor(245, 158, 11); // Amber border
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGINS.left, warningBoxY, pageWidth - MARGINS.left - MARGINS.right, warningBoxHeight, 2, 2, 'FD');

  // Warning icon and text
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9); // Amber dark text
  doc.text('⚠ AI-ASSISTED DOCUMENT DISCLAIMER', MARGINS.left + 3, warningBoxY + 5);

  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 53, 15); // Amber darker text
  const disclaimerText = 'This discharge summary contains AI-generated content (clinical summary, advice, and warning signs). While AI assists in documentation, all medical decisions and content have been reviewed and approved by the attending physician. The treating doctor remains solely responsible for patient care and the accuracy of this document.';
  const splitDisclaimer = doc.splitTextToSize(disclaimerText, pageWidth - MARGINS.left - MARGINS.right - 8);
  doc.text(splitDisclaimer, MARGINS.left + 3, warningBoxY + 9);

  y = warningBoxY + warningBoxHeight + 5;

  // Add page numbers and footer branding
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 8;
    doc.setFontSize(FONTS.small);
    doc.setTextColor(...COLORS.secondary);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
    // Footer branding
    doc.setFontSize(6);
    doc.text('NeoLink AI - Advanced Healthcare Analytics', pageWidth / 2, footerY + 4, { align: 'center' });
  }

  return doc;
}

// ==================== CREATE DISCHARGE SUMMARY FROM PATIENT ====================

export function createDischargeSummaryFromPatient(
  patient: Patient,
  additionalData: Partial<DischargeSummary>
): DischargeSummary {
  const admissionDate = new Date(patient.admissionDate);
  const dischargeDate = patient.releaseDate ? new Date(patient.releaseDate) : new Date();
  const totalStayDays = Math.ceil((dischargeDate.getTime() - admissionDate.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate weight gain
  const weightGain = patient.weightOnDischarge && patient.birthWeight
    ? Number((patient.weightOnDischarge - patient.birthWeight).toFixed(3))
    : undefined;

  // Format gestational age
  const gestationalAge = patient.gestationalAgeWeeks !== undefined && patient.gestationalAgeDays !== undefined
    ? `${patient.gestationalAgeWeeks}+${patient.gestationalAgeDays} weeks`
    : undefined;

  // Check if NICU/SNCU
  const isNICU = patient.unit === Unit.NICU || patient.unit === Unit.SNCU;

  // Default follow-up medications - ONLY Vitamin D3 for all NICU/SNCU babies
  // Other medications should be manually added if needed for follow-up
  const defaultFollowUpMedications: DischargeMedication[] = isNICU ? [
    {
      name: 'Vitamin D3 Drops (400 IU/mL)',
      frequency: '1 mL once daily',
      duration: 'Up to 1 year of age',
      instructions: 'Give orally with feeding'
    }
  ] : [];

  // Default NHM follow-up schedule for NICU/SNCU
  const defaultNHMSchedule: NHMFollowUpSchedule = {
    homeVisits: {
      day3: true,
      day7: true,
      day14: true,
      day21: true,
      day28: true,
      day42: true
    },
    facilityVisits: {
      month3: true,
      month6: true,
      month9: true,
      year1: true
    },
    specialFollowUp: undefined,
    additionalInstructions: undefined
  };

  // Determine admission type (Inborn/Outborn)
  const admissionType = patient.admissionType
    ? (patient.admissionType === 'Inborn' ? 'Inborn' : 'Outborn')
    : undefined;

  // Build patient address from available fields
  const addressParts = [
    patient.address,
    patient.village,
    patient.postOffice ? `P.O. ${patient.postOffice}` : undefined,
    patient.district,
    patient.state,
    patient.pinCode ? `PIN: ${patient.pinCode}` : undefined
  ].filter(Boolean);
  const patientAddress = addressParts.length > 0 ? addressParts.join(', ') : undefined;

  const summary: DischargeSummary = {
    // Patient Identification
    patientId: patient.id,
    patientName: patient.name,
    ntid: patient.ntid,
    hospitalName: patient.institutionName,
    hospitalAddress: undefined,

    // Patient Address
    patientAddress,
    patientVillage: patient.village,
    patientDistrict: patient.district,
    patientState: patient.state,
    patientPinCode: patient.pinCode,

    // Admission Type (Inborn/Outborn)
    admissionType,

    // Admission & Discharge Dates
    admissionDate: patient.admissionDate,
    admissionTime: patient.admissionDateTime,
    dischargeDate: patient.releaseDate || new Date().toISOString(),
    dischargeTime: patient.dischargeDateTime,
    totalStayDays,

    // Demographics
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    birthWeight: patient.birthWeight,
    gestationalAge,
    gestationalAgeCategory: patient.gestationalAgeCategory,

    // Maternal History
    motherName: patient.motherName,
    fatherName: patient.fatherName,
    maternalAge: patient.maternalHistory?.maternalAge,
    bloodGroup: patient.maternalHistory?.bloodGroup,
    modeOfDelivery: patient.modeOfDelivery,
    placeOfDelivery: patient.placeOfDelivery,

    // Diagnoses
    primaryDiagnosis: patient.diagnosis,
    finalDiagnosis: additionalData.finalDiagnosis || undefined,
    secondaryDiagnoses: [],
    icd10Codes: [],

    // Condition at Admission
    conditionAtAdmission: undefined,
    indicationsForAdmission: patient.indicationsForAdmission,

    // Clinical Course Summary - Will be filled by AI or manually
    clinicalCourseSummary: additionalData.clinicalCourseSummary || 'Clinical course summary to be added.',
    significantEvents: [],
    proceduresPerformed: [],
    investigationsResults: undefined,

    // Discharge Vitals
    dischargeVitals: additionalData.dischargeVitals || {
      weight: patient.weightOnDischarge || patient.birthWeight || 0,
      length: undefined,
      headCircumference: undefined,
      temperature: undefined,
      heartRate: undefined,
      respiratoryRate: undefined,
      spo2: undefined,
      bloodPressure: undefined,
    },
    weightGain,

    // Condition at Discharge
    conditionAtDischarge: additionalData.conditionAtDischarge || 'Stable',
    generalCondition: additionalData.generalCondition || 'Good',
    activity: additionalData.activity || 'Active, Alert',
    suckingReflex: additionalData.suckingReflex || 'Good',

    // Feeding
    dischargeFeeding: additionalData.dischargeFeeding || {
      feedingType: FeedingType.ExclusiveBreastfeeding,
      feedingVolume: undefined,
      feedingFrequency: undefined,
      calories: undefined,
      specialInstructions: undefined,
    },

    // Treatment Received During Hospital Stay (from patient medications)
    treatmentReceived: additionalData.treatmentReceived || (patient.medications || [])
      .map(med => {
        const parts = [med.name];
        if (med.dose) parts.push(med.dose);
        if (med.route) parts.push(`(${med.route})`);
        if (med.frequency) parts.push(`- ${med.frequency}`);
        return parts.join(' ');
      }),

    // Follow-up Medications (to take home)
    dischargeMedications: additionalData.dischargeMedications || defaultFollowUpMedications,

    // Vaccinations
    vaccinationsGiven: additionalData.vaccinationsGiven || [],
    vaccinationDates: additionalData.vaccinationDates || ({} as Record<VaccinationType, string>),
    pendingVaccinations: additionalData.pendingVaccinations || [],

    // Screenings
    screenings: additionalData.screenings || {
      hearingScreenDone: undefined,
      metabolicScreenDone: undefined,
      ropScreeningDone: undefined,
      carSeatTestDone: undefined,
    },

    // Follow-up (NHM Schedule)
    nhmFollowUpSchedule: additionalData.nhmFollowUpSchedule || (isNICU ? defaultNHMSchedule : undefined),
    followUpAppointments: additionalData.followUpAppointments, // For specialist referrals only
    nextImmunizationDue: additionalData.nextImmunizationDue,
    nextImmunizationDate: additionalData.nextImmunizationDate,

    // Parent Education
    parentEducationTopics: additionalData.parentEducationTopics || [
      'Breastfeeding technique',
      'Kangaroo Mother Care (KMC)',
      'Warning signs to watch',
      'Medication administration',
    ],
    warningSignsCounseled: true,
    feedingDemonstrated: true,
    medicationDemonstrated: defaultFollowUpMedications.length > 0,
    emergencyContactProvided: true,

    // Equipment
    homeEquipment: additionalData.homeEquipment || [],
    equipmentInstructions: additionalData.equipmentInstructions,

    // Discharge Advice
    dischargeAdvice: additionalData.dischargeAdvice || [
      'Continue breastfeeding on demand',
      'Keep baby warm using Kangaroo Mother Care (skin-to-skin contact)',
      'Wash hands before handling baby',
      'Ensure all vaccinations are completed on schedule',
      'Follow up as advised',
    ],
    dietaryRestrictions: additionalData.dietaryRestrictions,
    activityRestrictions: additionalData.activityRestrictions,

    // Warning Signs
    warningSignsToWatch: additionalData.warningSignsToWatch || [
      'Difficulty breathing or fast breathing',
      'Not feeding well or refusing to feed',
      'Fever (>100.4°F / 38°C) or very cold',
      'Yellow discoloration of skin/eyes (jaundice)',
      'Excessive sleepiness or lethargy',
      'Convulsions or seizures',
      'Umbilical redness, swelling, or discharge',
      'Skin rash or pustules',
    ],

    // Contact Information
    emergencyContact: additionalData.emergencyContact,
    hospitalHelpline: additionalData.hospitalHelpline,
    primaryCarePhysician: patient.doctorInCharge,

    // Metadata
    preparedBy: additionalData.preparedBy || 'Doctor',
    preparedByRole: additionalData.preparedByRole || 'Attending Physician',
    verifiedBy: additionalData.verifiedBy,
    verifiedByRole: additionalData.verifiedByRole,
    generatedAt: new Date().toISOString(),

    isPICU: patient.unit === Unit.PICU,

    // Merge any additional data
    ...additionalData,
  };

  return summary;
}

// ==================== DOWNLOAD PDF ====================

export async function downloadDischargeSummaryPDF(summary: DischargeSummary, patient: Patient): Promise<void> {
  const doc = await generateDischargeSummaryPDF(summary, patient);
  const fileName = `Discharge_Summary_${patient.name.replace(/\s+/g, '_')}_${patient.ntid || patient.id.slice(0, 8)}.pdf`;
  doc.save(fileName);
}

// ==================== PREVIEW PDF (Returns blob URL) ====================

export async function previewDischargeSummaryPDF(summary: DischargeSummary, patient: Patient): Promise<string> {
  const doc = await generateDischargeSummaryPDF(summary, patient);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
