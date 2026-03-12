import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';

const outputPath = '/Users/luhitdhungel/Downloads/neolink_-picu_nicu-medical-records/output/pdf/neolink-app-summary.pdf';

const doc = new jsPDF({ unit: 'pt', format: 'letter' });
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 36; // 0.5 in
const contentWidth = pageWidth - margin * 2;

let y = margin;

const setFont = (style = 'normal', size = 9) => {
  doc.setFont('Helvetica', style);
  doc.setFontSize(size);
};

const addLine = (text, options = {}) => {
  const { size = 9, style = 'normal', leading = 12, indent = 0, bullet = false } = options;
  setFont(style, size);
  const prefix = bullet ? '\u2022 ' : '';
  const lines = doc.splitTextToSize(prefix + text, contentWidth - indent);
  lines.forEach((line, idx) => {
    doc.text(line, margin + indent, y);
    y += leading;
  });
};

const addHeading = (text) => {
  setFont('bold', 11);
  doc.text(text, margin, y);
  y += 14;
};

const addSpacer = (space = 6) => { y += space; };

// Title
setFont('bold', 16);
doc.text('NeoLink - PICU/NICU Medical Records App', margin, y);
y += 18;

// What it is
addHeading('What it is');
addLine('A web-based medical records and analytics system for Pediatric and Neonatal ICUs, with role-based access and clinical dashboards.', { size: 9 });
addSpacer();

// Who it’s for
addHeading('Who it\'s for');
addLine('Primary users are PICU/NICU clinical staff (nurses and doctors) and administrators managing outcomes and reporting.', { size: 9 });
addSpacer();

// What it does
addHeading('What it does');
const features = [
  'Role-based access for nurses, doctors, and admins with draft-to-complete workflow.',
  'Patient intake and management for PICU/NICU, including outcome status tracking.',
  'Analytics dashboard with discharge/referral/mortality rates and charts.',
  'NICU inborn/outborn segmentation and referral hospital tracking.',
  'Date filtering (today, week, month, custom range, all-time) across metrics.',
  'AI/voice-related features and report pages (services and UI components included).'
];
features.forEach(item => addLine(item, { bullet: true, indent: 10 }));
addSpacer();

// How it works
addHeading('How it works (repo evidence)');
const arch = [
  'React + Vite frontend with routed/lazy-loaded pages (Dashboard, PatientForm, Analytics, AI Reports).',
  'State/providers via React Contexts and TanStack Query (ChatContext, BackgroundSaveContext, QueryProvider).',
  'Firebase Auth + Firestore for identity and data access (firebaseConfig.ts, services/authService.ts, services/firestoreService.ts).',
  'Firebase Cloud Functions backend for auth tooling and MedASR transcription via RunPod (functions/src).',
  'Services layer contains AI, speech-to-text, PDF, and reporting modules (services/*).',
  'Production hosting/deployment details: Not found in repo.'
];
arch.forEach(item => addLine(item, { bullet: true, indent: 10 }));
addSpacer();

// How to run
addHeading('How to run (minimal)');
const runSteps = [
  'Install dependencies: npm install',
  'Set GEMINI_API_KEY in .env.local',
  'Start dev server: npm run dev'
];
runSteps.forEach(item => addLine(item, { bullet: true, indent: 10 }));

// Footer
setFont('normal', 8);
const footer = 'Source: README.md, FEATURES.md, App.tsx, functions/src/index.ts, services/*, package.json';
const footerLines = doc.splitTextToSize(footer, contentWidth);
let footerY = pageHeight - margin + 6; // slightly above bottom
footerLines.forEach((line, idx) => {
  doc.text(line, margin, footerY + idx * 10);
});

// Ensure single page
if (doc.getNumberOfPages() > 1) {
  // If overflow, shrink? For now, trim extra pages to keep single-page requirement.
  while (doc.getNumberOfPages() > 1) doc.deletePage(doc.getNumberOfPages());
}

const pdfData = doc.output('arraybuffer');
fs.writeFileSync(outputPath, Buffer.from(pdfData));

console.log(outputPath);
