import React from 'react';
import { VitalSigns, ReferralDetails } from '../types';
import jsPDF from 'jspdf';

interface ReferralTicketProps {
    data: {
        priority: string;
        referralDate: string;
        patient: {
            name: string;
            age: number | string;
            ageUnit: string;
            gender: string;
            admissionDate: string;
            ipNumber?: string;
            unit?: string;
        };
        from: {
            institutionName: string;
            unit?: string;
            referredBy: string;
            referredByRole: string;
        };
        to: {
            institutionName: string;
            district?: string;
            unit?: string;
        };
        clinical: ReferralDetails;
        vitals?: VitalSigns;
        referralLetter?: string;
    };
    isPreview?: boolean;
    onEditSummary?: () => void;
}

const ReferralTicket: React.FC<ReferralTicketProps> = ({ data }) => {
    const { priority, referralDate, patient, from, to, clinical, vitals, referralLetter } = data;

    const handleDownloadPDF = () => {
        try {
            // Show loading state
            const button = document.querySelector('.download-pdf-btn') as HTMLButtonElement;
            if (button) {
                button.disabled = true;
                button.textContent = 'Generating PDF...';
            }

            // Initialize PDF (A4: 210mm x 297mm)
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 12;
            const contentWidth = pageWidth - (margin * 2);
            let y = margin;
            let pageNumber = 1;

            // Helper: Clean markdown from AI text
            const cleanMarkdown = (text: string): string => {
                if (!text) return '';
                return text
                    .replace(/\*\*(.*?)\*\*/g, '$1')
                    .replace(/\*(.*?)\*/g, '$1')
                    .replace(/#{1,6}\s/g, '')
                    .replace(/`(.*?)`/g, '$1')
                    .replace(/\n{3,}/g, '\n\n');
            };

            // Helper: Add footer to every page
            const addFooter = () => {
                pdf.setFontSize(7);
                pdf.setTextColor(120, 120, 120);
                pdf.text('Generated via NeoLink Healthcare Network | This is a computer-generated document', margin, pageHeight - 8);
                pdf.text(`Page ${pageNumber}`, pageWidth - margin - 10, pageHeight - 8);
                pdf.setDrawColor(200, 200, 200);
                pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
            };

            // Helper: Check if we need a new page
            const checkNewPage = (neededHeight: number) => {
                if (y + neededHeight > pageHeight - 20) {
                    addFooter();
                    pdf.addPage();
                    pageNumber++;
                    y = margin;
                    return true;
                }
                return false;
            };

            // Helper: Draw a colored section header
            const drawSectionHeader = (title: string, bgColor: [number, number, number] = [15, 23, 42]) => {
                checkNewPage(14);
                pdf.setFillColor(...bgColor);
                pdf.rect(margin, y, contentWidth, 10, 'F');
                pdf.setFontSize(12);
                pdf.setTextColor(255, 255, 255);
                pdf.setFont('helvetica', 'bold');
                pdf.text(title.toUpperCase(), margin + 4, y + 7);
                y += 13;
                pdf.setTextColor(0, 0, 0);
            };

            // Helper: Draw a label-value pair
            const drawLabelValue = (label: string, value: string, labelWidth: number = 50) => {
                checkNewPage(10);
                pdf.setFontSize(11);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(80, 80, 80);
                pdf.text(label + ':', margin + 3, y);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(20, 20, 20);
                const wrappedValue = pdf.splitTextToSize(value || 'N/A', contentWidth - labelWidth - 8);
                pdf.text(wrappedValue, margin + labelWidth, y);
                y += Math.max(7, wrappedValue.length * 6);
            };

            // Helper: Draw wrapped text block
            const drawTextBlock = (text: string, fontSize: number = 11) => {
                const cleanText = cleanMarkdown(text);
                pdf.setFontSize(fontSize);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(30, 30, 30);
                const lines = pdf.splitTextToSize(cleanText, contentWidth - 6);
                for (let i = 0; i < lines.length; i++) {
                    checkNewPage(7);
                    pdf.text(lines[i], margin + 3, y);
                    y += 6;
                }
                y += 3;
            };

            // ==================== PDF CONTENT ====================

            // --- HEADER SECTION ---
            pdf.setFillColor(15, 23, 42); // Slate-900
            pdf.rect(0, 0, pageWidth, 38, 'F');

            pdf.setFontSize(24);
            pdf.setTextColor(255, 255, 255);
            pdf.setFont('helvetica', 'bold');
            pdf.text('MEDICAL REFERRAL TICKET', margin, 18);

            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Inter-Facility Patient Transfer Document', margin, 28);

            // Priority badge
            const priorityColor: [number, number, number] = priority === 'Critical' ? [220, 38, 38] : priority === 'High' ? [234, 88, 12] : [34, 197, 94];
            pdf.setFillColor(...priorityColor);
            pdf.roundedRect(pageWidth - margin - 40, 10, 38, 14, 3, 3, 'F');
            pdf.setFontSize(11);
            pdf.setTextColor(255, 255, 255);
            pdf.setFont('helvetica', 'bold');
            pdf.text(priority.toUpperCase(), pageWidth - margin - 37, 19);

            // Date
            pdf.setFontSize(10);
            pdf.setTextColor(180, 180, 180);
            pdf.text(`Date: ${new Date(referralDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin - 60, 32);

            y = 46;

            // --- TRANSFER DETAILS ---
            pdf.setFillColor(248, 250, 252); // Slate-50
            pdf.rect(margin, y, contentWidth, 34, 'F');
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(margin, y, contentWidth, 34, 'S');

            // From
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            pdf.setFont('helvetica', 'bold');
            pdf.text('FROM INSTITUTION', margin + 5, y + 8);
            pdf.setFontSize(14);
            pdf.setTextColor(20, 20, 20);
            pdf.text(from.institutionName, margin + 5, y + 17);
            pdf.setFontSize(10);
            pdf.setTextColor(60, 60, 60);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`${from.unit || 'Unit Not Specified'} | Dr. ${from.referredBy}`, margin + 5, y + 25);

            // Arrow
            pdf.setFontSize(22);
            pdf.setTextColor(80, 80, 80);
            pdf.text('→', contentWidth / 2 + margin - 5, y + 18);

            // To
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            pdf.setFont('helvetica', 'bold');
            pdf.text('TO INSTITUTION', contentWidth / 2 + margin + 12, y + 8);
            pdf.setFontSize(14);
            pdf.setTextColor(20, 20, 20);
            pdf.text(to.institutionName, contentWidth / 2 + margin + 12, y + 17);
            pdf.setFontSize(10);
            pdf.setTextColor(60, 60, 60);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`${to.district || ''} ${to.unit ? '| ' + to.unit : ''}`, contentWidth / 2 + margin + 12, y + 25);

            y += 40;

            // --- PATIENT DEMOGRAPHICS ---
            drawSectionHeader('Patient Information', [51, 65, 85]);

            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(220, 220, 220);
            pdf.rect(margin, y, contentWidth, 26, 'FD');

            const colWidth = contentWidth / 4;
            const demographics = [
                { label: 'Patient Name', value: patient.name },
                { label: 'Age / Gender', value: `${patient.age} ${patient.ageUnit} / ${patient.gender}` },
                { label: 'Admission Date', value: new Date(patient.admissionDate).toLocaleDateString() },
                { label: 'UHID / IP No', value: patient.ipNumber || 'N/A' }
            ];

            demographics.forEach((item, i) => {
                const x = margin + (colWidth * i) + 4;
                pdf.setFontSize(9);
                pdf.setTextColor(100, 100, 100);
                pdf.setFont('helvetica', 'bold');
                pdf.text(item.label.toUpperCase(), x, y + 8);
                pdf.setFontSize(12);
                pdf.setTextColor(20, 20, 20);
                pdf.setFont('helvetica', 'normal');
                pdf.text(item.value, x, y + 17);
            });

            y += 32;

            // --- CLINICAL DETAILS ---
            drawSectionHeader('Clinical Details', [51, 65, 85]);

            drawLabelValue('Diagnosis', clinical.diagnosisAtReferral || 'Not specified');
            drawLabelValue('Reason for Referral', clinical.reasonForReferral || 'Not specified');
            drawLabelValue('Condition at Referral', clinical.conditionAtReferral || 'Not specified');

            // Vitals
            if (vitals && Object.values(vitals).some(v => v)) {
                y += 3;
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(100, 100, 100);
                pdf.text('VITALS AT REFERRAL:', margin + 2, y);
                y += 5;

                const vitalLabels: Record<string, string> = { temperature: 'Temp', hr: 'HR', rr: 'RR', bp: 'BP', spo2: 'SpO2', crt: 'CRT', weight: 'Wt' };
                const vitalUnits: Record<string, string> = { temperature: '°C', hr: 'bpm', rr: '/min', bp: 'mmHg', spo2: '%', crt: 'sec', weight: 'kg' };
                const vitalStr = Object.entries(vitals)
                    .filter(([_, val]) => val)
                    .map(([key, val]) => `${vitalLabels[key] || key}: ${val}${vitalUnits[key] || ''}`)
                    .join('  |  ');

                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(40, 40, 40);
                pdf.text(vitalStr, margin + 2, y);
                y += 7;
            }

            // Treatments
            if (clinical.treatmentsProvided && clinical.treatmentsProvided.length > 0) {
                y += 2;
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(100, 100, 100);
                pdf.text('TREATMENTS PROVIDED:', margin + 2, y);
                y += 5;
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(40, 40, 40);
                clinical.treatmentsProvided.slice(0, 8).forEach((treatment, i) => {
                    checkNewPage(5);
                    pdf.text(`${i + 1}. ${treatment}`, margin + 4, y);
                    y += 4.5;
                });
                y += 2;
            }

            // Investigations
            if (clinical.investigationsPerformed) {
                drawLabelValue('Investigations', clinical.investigationsPerformed);
            }

            // Recommended Treatment
            if (clinical.recommendedTreatment) {
                drawLabelValue('Recommended Treatment', clinical.recommendedTreatment);
            }

            // --- CLINICAL SUMMARY (AI Generated) ---
            if (referralLetter) {
                y += 4;
                drawSectionHeader('Clinical Summary', [30, 64, 175]); // Blue

                pdf.setFillColor(240, 249, 255); // Light blue
                checkNewPage(15);

                const summaryLines = pdf.splitTextToSize(cleanMarkdown(referralLetter), contentWidth - 8);
                const summaryHeight = Math.min(summaryLines.length * 4.5 + 6, 80); // Cap height

                pdf.rect(margin, y, contentWidth, summaryHeight, 'F');
                pdf.setDrawColor(191, 219, 254);
                pdf.rect(margin, y, contentWidth, summaryHeight, 'S');

                pdf.setFontSize(9);
                pdf.setTextColor(30, 41, 59);
                pdf.setFont('helvetica', 'normal');

                let summaryY = y + 5;
                summaryLines.slice(0, 15).forEach((line: string) => {
                    if (summaryY < y + summaryHeight - 3) {
                        pdf.text(line, margin + 4, summaryY);
                        summaryY += 4.5;
                    }
                });

                y += summaryHeight + 6;
            }

            // --- SIGNATURE SECTION ---
            checkNewPage(45);
            y += 5;

            pdf.setFillColor(248, 250, 252);
            pdf.rect(margin, y, contentWidth, 40, 'F');
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(margin, y, contentWidth, 40, 'S');

            // Left side: System info
            pdf.setFontSize(7);
            pdf.setTextColor(120, 120, 120);
            pdf.text('Generated via NeoLink Healthcare Network', margin + 4, y + 8);
            pdf.text(`Ref ID: ${Math.random().toString(36).substring(2, 11).toUpperCase()}`, margin + 4, y + 13);
            pdf.text(`Generated: ${new Date().toLocaleString()}`, margin + 4, y + 18);

            // Right side: Signature block
            const sigX = pageWidth - margin - 70;
            pdf.setDrawColor(100, 100, 100);
            pdf.line(sigX, y + 22, sigX + 60, y + 22);

            pdf.setFontSize(10);
            pdf.setTextColor(30, 30, 30);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`Dr. ${from.referredBy}`, sigX, y + 28);

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80, 80, 80);
            pdf.text(from.referredByRole, sigX, y + 33);
            pdf.text(`${from.unit || 'Unit'} - ${from.institutionName}`, sigX, y + 38);

            pdf.setFontSize(7);
            pdf.setTextColor(120, 120, 120);
            pdf.text('Authorized Signature', sigX + 15, y + 18);

            // Add footer to last page
            addFooter();

            // Save PDF
            pdf.save(`Referral_${patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

            // Reset button
            if (button) {
                button.disabled = false;
                button.textContent = 'Download Referral Sheet';
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
            const button = document.querySelector('.download-pdf-btn') as HTMLButtonElement;
            if (button) {
                button.disabled = false;
                button.textContent = 'Download Referral Sheet';
            }
        }
    };

    return (
        <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-lg font-sans">

            {/* Download Button (Screen Only) */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-end">
                <button
                    onClick={handleDownloadPDF}
                    className="download-pdf-btn flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all font-semibold text-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download Referral Sheet
                </button>
            </div>

            {/* Ticket Content - This will be captured for PDF */}
            <div id="referral-ticket-content" className="bg-white">

                {/* 1. Header Section */}
                <div className="bg-slate-50 border-b-2 border-slate-900 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-widest">Medical Referral Ticket</h2>
                        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Priority: <span className={`${priority === 'Critical' ? 'text-red-600 font-extrabold' : 'text-slate-700'}`}>{priority}</span></p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase">Referral Date</p>
                        <p className="font-bold text-slate-900">{new Date(referralDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>

                {/* 2. Transfer Details (From -> To) */}
                <div className="flex flex-col md:flex-row border-b border-slate-200">
                    <div className="flex-1 p-5 border-r border-slate-200 bg-slate-50/50">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">From Institution</p>
                        <p className="font-bold text-lg text-slate-800">{from.institutionName}</p>
                        <p className="text-sm text-slate-600">{from.unit || 'Unit Not Specified'}</p>
                        <div className="mt-2 text-sm">
                            <p className="font-semibold text-slate-700">Ref. By: Dr. {from.referredBy}</p>
                            <p className="text-slate-500 text-xs">{from.referredByRole}</p>
                        </div>
                    </div>
                    <div className="flex-1 p-5 bg-sky-50/30">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">To Institution</p>
                        <p className="font-bold text-lg text-slate-800">{to.institutionName}</p>
                        <p className="text-sm text-slate-600">{to.district}</p>
                        {to.unit && (
                            <div className="mt-2 inline-block px-2 py-1 bg-sky-100 text-sky-700 text-xs font-bold rounded">
                                Requested Unit: {to.unit}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Patient Demographics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 border-b border-slate-200 divide-x divide-slate-200">
                    <div className="p-4">
                        <p className="text-xs font-bold text-slate-400 uppercase">Patient Name</p>
                        <p className="font-semibold text-slate-900">{patient.name}</p>
                    </div>
                    <div className="p-4">
                        <p className="text-xs font-bold text-slate-400 uppercase">Age / Gender</p>
                        <p className="font-semibold text-slate-900">{patient.age} {patient.ageUnit} / {patient.gender}</p>
                    </div>
                    <div className="p-4">
                        <p className="text-xs font-bold text-slate-400 uppercase">Admission Date</p>
                        <p className="font-semibold text-slate-900">{new Date(patient.admissionDate).toLocaleDateString()}</p>
                    </div>
                    <div className="p-4">
                        <p className="text-xs font-bold text-slate-400 uppercase">UHID / IP No</p>
                        <p className="font-semibold text-slate-900">{patient.ipNumber || 'N/A'}</p>
                    </div>
                </div>

                {/* 4. Clinical Details Section */}
                <div className="p-6 space-y-6">

                    {/* Diagnosis & Reason Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm print:shadow-none print:border-slate-300">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Diagnosis</h4>
                            <p className="text-slate-900 font-medium">{clinical.diagnosisAtReferral}</p>
                        </div>
                        <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm print:shadow-none print:border-slate-300">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Reason for Referral</h4>
                            <p className="text-slate-900 font-medium">{clinical.reasonForReferral}</p>
                        </div>
                    </div>

                    {/* Vitals Grid */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 text-center border-b border-slate-100 pb-2">Vitals at Referral</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                            {vitals ? Object.entries(vitals).map(([key, value]) => {
                                const labels: Record<string, string> = { temperature: 'Temp', hr: 'HR', rr: 'RR', bp: 'BP', spo2: 'SpO2', crt: 'CRT', weight: 'Wt' };
                                const units: Record<string, string> = { temperature: '°C', hr: 'bpm', rr: '/min', bp: 'mmHg', spo2: '%', crt: 'sec', weight: 'kg' };
                                if (!value) return null;
                                return (
                                    <div key={key} className="bg-slate-50 border border-slate-100 rounded p-2 text-center print:border-slate-300">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{labels[key] || key}</p>
                                        <p className="font-bold text-slate-700">{value} <span className="text-[10px] font-normal text-slate-400">{units[key] || ''}</span></p>
                                    </div>
                                )
                            }) : <p className="col-span-full text-center text-slate-400 text-sm italic">No vitals recorded</p>}
                        </div>
                    </div>

                    {/* Treatments & Condition */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Treatments Given</h4>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 h-full print:border-slate-300">
                                {clinical.treatmentsProvided && clinical.treatmentsProvided.length > 0 ? (
                                    <ul className="list-decimal list-inside text-sm text-slate-700 space-y-1">
                                        {clinical.treatmentsProvided.map((t, i) => <li key={i}>{t}</li>)}
                                    </ul>
                                ) : <p className="text-sm text-slate-400 italic">None specified</p>}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Current Condition</h4>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 h-full print:border-slate-300">
                                <p className="text-slate-900 text-sm">{clinical.conditionAtReferral}</p>
                            </div>
                        </div>
                    </div>

                    {/* Investigations & Recommended */}
                    {
                        (clinical.investigationsPerformed || clinical.recommendedTreatment) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {clinical.investigationsPerformed && (
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Investigations</h4>
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 print:border-slate-300">
                                            {clinical.investigationsPerformed}
                                        </div>
                                    </div>
                                )}
                                {clinical.recommendedTreatment && (
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Recommended Treatment</h4>
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 print:border-slate-300">
                                            {clinical.recommendedTreatment}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    }

                    {/* AI Summary Box */}
                    <div className="mt-4 print:break-inside-avoid">
                        <h4 className="text-sm font-bold text-slate-900 uppercase mb-2 flex items-center gap-2">
                            Clinical Summary
                            <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold print:hidden">Generated by NeoLink AI</span>
                        </h4>
                        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 text-slate-800 text-sm leading-relaxed text-justify whitespace-pre-wrap print:bg-white print:border-slate-300">
                            {referralLetter || "No summary generated."}
                        </div>
                    </div>

                </div>

                {/* Footer / Signature Area - Enhanced for Print */}
                <div className="bg-slate-50 border-t border-slate-200 p-8 mt-4 print:bg-white print:border-t-2 print:border-slate-800 print:mt-8 print:break-inside-avoid">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-8">

                        {/* Timestamp & System Info */}
                        <div className="text-xs text-slate-400 print:text-slate-500">
                            <p>Generated via NeoLink Network</p>
                            <p>Ref ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                            <p>{new Date().toLocaleString()}</p>
                        </div>

                        {/* Signature Block */}
                        <div className="text-center min-w-[250px]">
                            <div className="border-b border-slate-400 mb-2 h-12"></div> {/* Signature Line */}
                            <p className="font-bold text-slate-900 text-base">Dr. {from.referredBy}</p>
                            <p className="text-sm text-slate-600">{from.referredByRole}</p>
                            <p className="text-sm text-slate-600">{from.unit || 'Unit Not Specified'} - {from.institutionName}</p>
                            <p className="text-xs text-slate-400 mt-1">Authorized Signature</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ReferralTicket;
