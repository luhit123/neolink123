import React, { useMemo } from 'react';
import { ProgressNote, Patient } from '../types';
import { calculateAgeAtDate } from '../utils/ageCalculator';

interface ProgressNoteDisplayProps {
    note: ProgressNote;
    patient?: Patient;
}

interface ExtendedProgressNoteDisplayProps extends ProgressNoteDisplayProps {
    noteIndex?: number;
    totalNotes?: number;
}

const ProgressNoteDisplay: React.FC<ExtendedProgressNoteDisplayProps> = ({ note, patient, noteIndex, totalNotes }) => {
    const hasVitals = note.vitals && Object.values(note.vitals).some(v => v);
    const hasMedications = note.medications && note.medications.length > 0;

    // Calculate age at the time of the note
    const ageAtNote = useMemo(() => {
        if (patient?.dateOfBirth && note.date) {
            const { age, ageUnit } = calculateAgeAtDate(patient.dateOfBirth, note.date);
            return `${age} ${ageUnit}`;
        }
        // Fallback to stored age
        return `${patient?.age || 0} ${patient?.ageUnit || 'days'}`;
    }, [patient?.dateOfBirth, patient?.age, patient?.ageUnit, note.date]);

    // Calculate Day of Life at the time of the note
    const dolAtNote = useMemo(() => {
        if (patient?.dateOfBirth && note.date) {
            const birthDate = new Date(patient.dateOfBirth);
            const noteDate = new Date(note.date);
            const diffMs = noteDate.getTime() - birthDate.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
            if (diffDays > 0 && diffDays <= 28) {
                return `DOL ${diffDays}`;
            }
        }
        return '';
    }, [patient?.dateOfBirth, note.date]);

    // Download/Print handler - Creates beautifully formatted medical note
    const handleDownload = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Format date and time
        const noteDate = new Date(note.date);
        const formattedDate = noteDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = noteDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        // Build patient info section
        const patientInfo = patient ? `
            <div style="border: 2px solid #2563eb; padding: 15px; margin-bottom: 20px; background: linear-gradient(to right, #eff6ff, #ffffff);">
                <div style="text-align: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 12px;">
                    <h2 style="margin: 0 0 8px 0; color: #1e293b; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">Clinical Progress Note</h2>
                    <p style="margin: 4px 0; font-size: 13px; color: #475569;">${patient.institutionName || ''}</p>
                    <p style="margin: 4px 0; font-size: 13px; color: #2563eb; font-weight: 600;">
                        ${patient.unit || ''}${patient.admissionType ? ' - ' + patient.admissionType : ''}
                    </p>
                </div>
                <h4 style="margin: 0 0 10px 0; font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Patient Particulars</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tr>
                        <td style="padding: 4px 0; width: 33%;"><strong style="color: #475569;">Name:</strong> ${patient.name}</td>
                        <td style="padding: 4px 0; width: 33%;"><strong style="color: #475569;">Age:</strong> ${ageAtNote}${dolAtNote ? ' (' + dolAtNote + ')' : ''}</td>
                        <td style="padding: 4px 0; width: 34%;"><strong style="color: #475569;">Gender:</strong> ${patient.gender || 'Not specified'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0;"><strong style="color: #475569;">Date:</strong> ${formattedDate}</td>
                        <td style="padding: 4px 0;" colspan="2"><strong style="color: #475569;">Time:</strong> ${formattedTime}</td>
                    </tr>
                    <tr>
                        <td colspan="3" style="padding: 4px 0;"><strong style="color: #475569;">Primary Diagnosis:</strong> ${patient.diagnosis}</td>
                    </tr>
                </table>
            </div>
        ` : '';

        // Build SOAP sections
        let soapContent = '';

        if (sections['subjective_(s)'] || sections.subjective) {
            soapContent += `
                <div style="margin-bottom: 20px; page-break-inside: avoid;">
                    <div style="background: linear-gradient(to right, #1e40af, #2563eb); color: white; padding: 8px 12px; margin-bottom: 8px; border-radius: 4px;">
                        <h3 style="margin: 0; font-size: 14px; display: flex; align-items: center;">
                            <span style="background: white; color: #1e40af; padding: 2px 8px; margin-right: 10px; border-radius: 3px; font-weight: bold; font-size: 12px;">S</span>
                            SUBJECTIVE
                        </h3>
                    </div>
                    <div style="padding-left: 20px; line-height: 1.8; color: #1e293b;">
                        <pre style="font-family: 'Segoe UI', Arial, sans-serif; white-space: pre-wrap; margin: 0; font-size: 13px;">${sections['subjective_(s)'] || sections.subjective}</pre>
                    </div>
                </div>
            `;
        }

        if (sections['objective_(o)'] || sections.objective || sections.vital_signs || sections.vitals || sections.physical_examination || sections.examination || sections.labs_imaging) {
            soapContent += `
                <div style="margin-bottom: 20px; page-break-inside: avoid;">
                    <div style="background: linear-gradient(to right, #059669, #10b981); color: white; padding: 8px 12px; margin-bottom: 8px; border-radius: 4px;">
                        <h3 style="margin: 0; font-size: 14px; display: flex; align-items: center;">
                            <span style="background: white; color: #059669; padding: 2px 8px; margin-right: 10px; border-radius: 3px; font-weight: bold; font-size: 12px;">O</span>
                            OBJECTIVE
                        </h3>
                    </div>
                    <div style="padding-left: 20px; line-height: 1.8; color: #1e293b;">
            `;

            if (sections.vital_signs || sections.vitals) {
                soapContent += `
                    <div style="margin-bottom: 12px;">
                        <h4 style="font-size: 12px; color: #065f46; margin: 0 0 6px 0; font-weight: 700;">Vital Signs:</h4>
                        <pre style="font-family: 'Segoe UI', Arial, sans-serif; white-space: pre-wrap; margin: 0; font-size: 13px; padding-left: 10px;">${sections.vital_signs || sections.vitals}</pre>
                    </div>
                `;
            }

            if (sections.physical_examination || sections.examination) {
                soapContent += `
                    <div style="margin-bottom: 12px;">
                        <h4 style="font-size: 12px; color: #065f46; margin: 0 0 6px 0; font-weight: 700;">Physical Examination:</h4>
                        <pre style="font-family: 'Segoe UI', Arial, sans-serif; white-space: pre-wrap; margin: 0; font-size: 13px; padding-left: 10px;">${sections.physical_examination || sections.examination}</pre>
                    </div>
                `;
            }

            if (sections.labs_imaging) {
                soapContent += `
                    <div style="margin-bottom: 12px;">
                        <h4 style="font-size: 12px; color: #065f46; margin: 0 0 6px 0; font-weight: 700;">Labs/Imaging:</h4>
                        <pre style="font-family: 'Segoe UI', Arial, sans-serif; white-space: pre-wrap; margin: 0; font-size: 13px; padding-left: 10px;">${sections.labs_imaging}</pre>
                    </div>
                `;
            }

            if ((sections['objective_(o)'] || sections.objective) && !sections.vital_signs && !sections.vitals && !sections.physical_examination && !sections.examination) {
                soapContent += `
                    <pre style="font-family: 'Segoe UI', Arial, sans-serif; white-space: pre-wrap; margin: 0; font-size: 13px;">${sections['objective_(o)'] || sections.objective}</pre>
                `;
            }

            soapContent += `
                    </div>
                </div>
            `;
        }

        if (sections['assessment_(a)'] || sections.assessment || sections.impression) {
            soapContent += `
                <div style="margin-bottom: 20px; page-break-inside: avoid;">
                    <div style="background: linear-gradient(to right, #ea580c, #f97316); color: white; padding: 8px 12px; margin-bottom: 8px; border-radius: 4px;">
                        <h3 style="margin: 0; font-size: 14px; display: flex; align-items: center;">
                            <span style="background: white; color: #ea580c; padding: 2px 8px; margin-right: 10px; border-radius: 3px; font-weight: bold; font-size: 12px;">A</span>
                            ASSESSMENT
                        </h3>
                    </div>
                    <div style="padding-left: 20px; line-height: 1.8; color: #1e293b;">
                        <pre style="font-family: 'Segoe UI', Arial, sans-serif; white-space: pre-wrap; margin: 0; font-size: 13px;">${sections['assessment_(a)'] || sections.assessment || sections.impression}</pre>
                    </div>
                </div>
            `;
        }

        if (sections['plan_(p)'] || sections.plan || sections.plan_and_advice || sections.treatment) {
            soapContent += `
                <div style="margin-bottom: 20px; page-break-inside: avoid;">
                    <div style="background: linear-gradient(to right, #7c3aed, #9333ea); color: white; padding: 8px 12px; margin-bottom: 8px; border-radius: 4px;">
                        <h3 style="margin: 0; font-size: 14px; display: flex; align-items: center;">
                            <span style="background: white; color: #7c3aed; padding: 2px 8px; margin-right: 10px; border-radius: 3px; font-weight: bold; font-size: 12px;">P</span>
                            PLAN
                        </h3>
                    </div>
                    <div style="padding-left: 20px; line-height: 1.8; color: #1e293b;">
                        <pre style="font-family: 'Segoe UI', Arial, sans-serif; white-space: pre-wrap; margin: 0; font-size: 13px;">${sections['plan_(p)'] || sections.plan || sections.plan_and_advice || sections.treatment}</pre>
                    </div>
                </div>
            `;
        }

        // Fallback if no sections found
        if (!soapContent && note.note) {
            soapContent = `
                <div style="border-left: 4px solid #f59e0b; background: #fffbeb; padding: 15px; margin-bottom: 20px;">
                    <h4 style="font-size: 12px; color: #92400e; margin: 0 0 10px 0; font-weight: 700;">Clinical Note</h4>
                    <pre style="font-family: 'Segoe UI', Arial, sans-serif; white-space: pre-wrap; margin: 0; font-size: 13px; line-height: 1.8; color: #1e293b;">${note.note}</pre>
                </div>
            `;
        }

        // Doctor's signature
        const signature = note.addedBy ? `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #cbd5e1; text-align: right; page-break-inside: avoid;">
                <div style="display: inline-block; text-align: right;">
                    <div style="border-top: 2px solid #64748b; width: 200px; margin-bottom: 8px;"></div>
                    <p style="margin: 4px 0; font-size: 14px; font-weight: 600; color: #1e293b;">${note.addedBy}</p>
                    <p style="margin: 4px 0; font-size: 12px; color: #64748b;">Attending Physician</p>
                </div>
            </div>
        ` : '';

        // Build complete HTML document
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Clinical Note - ${patient?.name || 'Patient'} - ${formattedDate}</title>
                <style>
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Segoe UI', 'Arial', sans-serif;
                        margin: 0;
                        padding: 20px;
                        color: #1e293b;
                        line-height: 1.6;
                        background: white;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 15px;
                        }
                        @page {
                            margin: 1.5cm;
                        }
                    }
                    pre {
                        font-family: 'Segoe UI', Arial, sans-serif;
                        margin: 0;
                    }
                </style>
            </head>
            <body>
                ${patientInfo}
                ${soapContent}
                ${signature}
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 300);
    };

    // Parse clinical note into sections
    const parseNoteIntoSections = (noteText: string) => {
        const sections: Record<string, string> = {};

        console.log('📄 Parsing note, length:', noteText.length);
        console.log('📄 First 200 chars:', noteText.substring(0, 200));

        // Remove doctor signature patterns from note text (will be added separately)
        let cleanedText = noteText;
        if (note.addedBy) {
            // Remove various signature patterns
            const signaturePatterns = [
                new RegExp(`${note.addedBy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'),
                new RegExp(`Dr\\.?\\s*${note.addedBy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'),
                new RegExp(`Signed by:?\\s*${note.addedBy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'),
                new RegExp(`-+\\s*${note.addedBy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'),
                /Attending Physician\s*$/i,
                /Resident Physician\s*$/i,
                /-{3,}\s*$/,
                /_{3,}\s*$/
            ];

            signaturePatterns.forEach(pattern => {
                cleanedText = cleanedText.replace(pattern, '');
            });
            cleanedText = cleanedText.trim();
        }

        // Remove box drawing characters and markdown
        const cleanText = cleanedText
            .replace(/[┌┐└┘├┤┬┴┼─│]/g, '') // Remove box drawing characters
            .replace(/━{2,}/g, '') // Remove double line characters
            .replace(/#{1,6}\s/g, '')
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/^-\s/gm, '')
            .replace(/^\*\s/gm, '')
            .replace(/`/g, '')
            .replace(/_{3,}/g, '')
            .replace(/={3,}/g, '')
            .replace(/\-{3,}/g, '');

        console.log('🧹 After cleaning, length:', cleanText.length);

        // Split into sections based on headers (SOAP format)
        // Look for these patterns in the text - more flexible matching
        const sectionPatterns = [
            { key: 'soap_note', pattern: /SOAP NOTE.*CLINICAL PROGRESS NOTE/i },
            { key: 'clinical_progress_note', pattern: /CLINICAL PROGRESS NOTE/i },
            // SUBJECTIVE - multiple formats
            { key: 'subjective_(s)', pattern: /^[#\s]*SUBJECTIVE\s*\(S\)\s*:?\s*$/i },
            { key: 'subjective', pattern: /^[#\s]*SUBJECTIVE\s*:?\s*$/i },
            { key: 'subjective', pattern: /^[#\s]*S\s*[-:\.]\s*SUBJECTIVE/i },
            { key: 'subjective', pattern: /^[#\s]*S\s*[:\.]\s*$/i },
            { key: 'subjective', pattern: /^[#\s]*\[S\]\s*SUBJECTIVE/i },
            { key: 'subjective', pattern: /^[#\s]*1\.\s*SUBJECTIVE/i },
            // OBJECTIVE - multiple formats
            { key: 'objective_(o)', pattern: /^[#\s]*OBJECTIVE\s*\(O\)\s*:?\s*$/i },
            { key: 'objective', pattern: /^[#\s]*OBJECTIVE\s*:?\s*$/i },
            { key: 'objective', pattern: /^[#\s]*O\s*[-:\.]\s*OBJECTIVE/i },
            { key: 'objective', pattern: /^[#\s]*O\s*[:\.]\s*$/i },
            { key: 'objective', pattern: /^[#\s]*\[O\]\s*OBJECTIVE/i },
            { key: 'objective', pattern: /^[#\s]*2\.\s*OBJECTIVE/i },
            // Vitals and Examination
            { key: 'vital_signs', pattern: /^[#\s]*VITAL\s*SIGNS?\s*:?\s*$/i },
            { key: 'vitals', pattern: /^[#\s]*VITALS?\s*:?\s*$/i },
            { key: 'physical_examination', pattern: /^[#\s]*PHYSICAL\s*EXAMINATION\s*:?\s*$/i },
            { key: 'examination', pattern: /^[#\s]*EXAMINATION\s*:?\s*$/i },
            { key: 'labs_imaging', pattern: /^[#\s]*LABS?\s*(\/|AND)?\s*IMAGING\s*:?\s*$/i },
            { key: 'labs_imaging', pattern: /^[#\s]*INVESTIGATIONS?\s*:?\s*$/i },
            // ASSESSMENT - multiple formats
            { key: 'assessment_(a)', pattern: /^[#\s]*ASSESSMENT\s*\(A\)\s*:?\s*$/i },
            { key: 'assessment', pattern: /^[#\s]*ASSESSMENT\s*:?\s*$/i },
            { key: 'assessment', pattern: /^[#\s]*A\s*[-:\.]\s*ASSESSMENT/i },
            { key: 'assessment', pattern: /^[#\s]*A\s*[:\.]\s*$/i },
            { key: 'assessment', pattern: /^[#\s]*\[A\]\s*ASSESSMENT/i },
            { key: 'assessment', pattern: /^[#\s]*3\.\s*ASSESSMENT/i },
            { key: 'assessment', pattern: /^[#\s]*IMPRESSION\s*:?\s*$/i },
            { key: 'assessment', pattern: /^[#\s]*DIAGNOSIS\s*:?\s*$/i },
            // PLAN - multiple formats
            { key: 'plan_(p)', pattern: /^[#\s]*PLAN\s*\(P\)\s*:?\s*$/i },
            { key: 'plan', pattern: /^[#\s]*PLAN\s*:?\s*$/i },
            { key: 'plan', pattern: /^[#\s]*P\s*[-:\.]\s*PLAN/i },
            { key: 'plan', pattern: /^[#\s]*P\s*[:\.]\s*$/i },
            { key: 'plan', pattern: /^[#\s]*\[P\]\s*PLAN/i },
            { key: 'plan', pattern: /^[#\s]*4\.\s*PLAN/i },
            { key: 'plan', pattern: /^[#\s]*TREATMENT\s*(PLAN)?\s*:?\s*$/i },
            { key: 'plan', pattern: /^[#\s]*MANAGEMENT\s*(PLAN)?\s*:?\s*$/i },
            { key: 'plan', pattern: /^[#\s]*ADVICE\s*:?\s*$/i },
            { key: 'plan', pattern: /^[#\s]*PLAN\s*(AND|&)\s*ADVICE\s*:?\s*$/i }
        ];

        let currentSection = 'header';
        let currentContent = '';

        const lines = cleanText.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Check if this line is a section header
            let matchedPattern = null;
            for (const { key, pattern } of sectionPatterns) {
                if (pattern.test(trimmedLine)) {
                    matchedPattern = key;
                    break;
                }
            }

            if (matchedPattern) {
                // Save previous section
                if (currentContent.trim()) {
                    sections[currentSection] = currentContent.trim();
                    console.log(`✅ Saved section '${currentSection}', length:`, sections[currentSection].length);
                }
                // Start new section
                currentSection = matchedPattern;
                currentContent = '';
                console.log(`🔖 Found section header: ${matchedPattern}`);
            } else if (trimmedLine) {
                // Only add non-empty lines to content
                currentContent += line + '\n';
            }
        }

        // Save last section
        if (currentContent.trim()) {
            sections[currentSection] = currentContent.trim();
            console.log(`✅ Saved final section '${currentSection}', length:`, sections[currentSection].length);
        }

        console.log('📊 Total sections found:', Object.keys(sections).length);
        console.log('📊 Section keys:', Object.keys(sections));

        // Remove signature lines from all sections
        if (note.addedBy) {
            Object.keys(sections).forEach(key => {
                let sectionContent = sections[key];
                // Remove doctor's name and signature patterns
                const signaturePatterns = [
                    new RegExp(`${note.addedBy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'),
                    new RegExp(`Dr\\.?\\s*${note.addedBy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'),
                    new RegExp(`Signed by:?\\s*${note.addedBy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'),
                    new RegExp(`-+\\s*${note.addedBy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'),
                    /Attending Physician\s*$/i,
                    /Resident Physician\s*$/i,
                    /Consultant\s*$/i,
                    /Medical Officer\s*$/i,
                    /-{3,}\s*$/m,
                    /_{3,}\s*$/m
                ];
                signaturePatterns.forEach(pattern => {
                    sectionContent = sectionContent.replace(pattern, '');
                });
                sections[key] = sectionContent.trim();
            });
        }

        // Post-process OBJECTIVE section to extract VITALS and EXAMINATION subsections
        if (sections['objective_(o)'] || sections.objective) {
            const objectiveContent = sections['objective_(o)'] || sections.objective;
            const vitalsMatch = objectiveContent.match(/VITALS?\s*\n([\s\S]*?)(?=\n\s*(?:EXAMINATION|LABS?|$))/i);
            const examMatch = objectiveContent.match(/EXAMINATION\s*\n([\s\S]*?)(?=\n\s*(?:LABS?|$))/i);
            const labsMatch = objectiveContent.match(/LABS?(?:\/IMAGING)?\s*\n([\s\S]*?)$/i);

            if (vitalsMatch && vitalsMatch[1].trim()) {
                sections.vitals = vitalsMatch[1].trim();
                console.log('✅ Extracted VITALS subsection, length:', sections.vitals.length);
            }

            if (examMatch && examMatch[1].trim()) {
                sections.examination = examMatch[1].trim();
                console.log('✅ Extracted EXAMINATION subsection, length:', sections.examination.length);
            }

            if (labsMatch && labsMatch[1].trim()) {
                sections.labs_imaging = labsMatch[1].trim();
                console.log('✅ Extracted LABS/IMAGING subsection, length:', sections.labs_imaging.length);
            }
        }

        // FALLBACK: Try to extract each SOAP section that's missing
        console.log('📊 Checking for missing SOAP sections...');

        // Always try to fill in missing sections with regex fallback
        // SUBJECTIVE
        if (!sections['subjective_(s)'] && !sections.subjective) {
            console.log('⚠️ SUBJECTIVE not found, trying fallback patterns...');
            // Try multiple patterns
            const subjectivePatterns = [
                /SUBJECTIVE[^a-z]*(?:\(S\))?[^\n]*\n([\s\S]*?)(?=\n\s*(?:OBJECTIVE|O\s*[:\-\.]|ASSESSMENT|A\s*[:\-\.]|PLAN|P\s*[:\-\.]))/i,
                /\bS\s*[:\-\.]\s*([\s\S]*?)(?=\n\s*(?:O\s*[:\-\.]|OBJECTIVE|ASSESSMENT|PLAN))/i,
                /Chief\s*Concern[:\s]*([\s\S]*?)(?=\n\s*(?:OBJECTIVE|VITALS?|EXAMINATION|ASSESSMENT|PLAN))/i,
                /History[:\s]*([\s\S]*?)(?=\n\s*(?:OBJECTIVE|VITALS?|EXAMINATION|ASSESSMENT|PLAN))/i
            ];
            for (const pattern of subjectivePatterns) {
                const match = cleanText.match(pattern);
                if (match && match[1] && match[1].trim().length > 5) {
                    sections.subjective = match[1].trim().replace(/^[│┃|]\s*/gm, '').trim();
                    console.log('✅ Fallback: Extracted SUBJECTIVE, length:', sections.subjective.length);
                    break;
                }
            }
        }

        // OBJECTIVE
        if (!sections['objective_(o)'] && !sections.objective && !sections.vital_signs && !sections.vitals && !sections.examination) {
            console.log('⚠️ OBJECTIVE not found, trying fallback patterns...');
            const objectivePatterns = [
                /OBJECTIVE[^a-z]*(?:\(O\))?[^\n]*\n([\s\S]*?)(?=\n\s*(?:ASSESSMENT|A\s*[:\-\.]|PLAN|P\s*[:\-\.]))/i,
                /\bO\s*[:\-\.]\s*([\s\S]*?)(?=\n\s*(?:A\s*[:\-\.]|ASSESSMENT|PLAN))/i,
                /VITALS?\s*[:\n]([\s\S]*?)(?=\n\s*(?:ASSESSMENT|PLAN))/i
            ];
            for (const pattern of objectivePatterns) {
                const match = cleanText.match(pattern);
                if (match && match[1] && match[1].trim().length > 5) {
                    sections.objective = match[1].trim().replace(/^[│┃|]\s*/gm, '').trim();
                    console.log('✅ Fallback: Extracted OBJECTIVE, length:', sections.objective.length);
                    break;
                }
            }
        }

        // ASSESSMENT
        if (!sections['assessment_(a)'] && !sections.assessment && !sections.impression) {
            console.log('⚠️ ASSESSMENT not found, trying fallback patterns...');
            const assessmentPatterns = [
                /ASSESSMENT[^a-z]*(?:\(A\))?[^\n]*\n([\s\S]*?)(?=\n\s*(?:PLAN|P\s*[:\-\.]))/i,
                /\bA\s*[:\-\.]\s*([\s\S]*?)(?=\n\s*(?:P\s*[:\-\.]|PLAN))/i,
                /IMPRESSION[:\s]*([\s\S]*?)(?=\n\s*(?:PLAN|TREATMENT|MANAGEMENT))/i,
                /DIAGNOSIS[:\s]*([\s\S]*?)(?=\n\s*(?:PLAN|TREATMENT|MANAGEMENT))/i,
                /PRIMARY[:\s]*([\s\S]*?)(?=\n\s*(?:PLAN|TREATMENT|MANAGEMENT|SECONDARY))/i
            ];
            for (const pattern of assessmentPatterns) {
                const match = cleanText.match(pattern);
                if (match && match[1] && match[1].trim().length > 3) {
                    sections.assessment = match[1].trim().replace(/^[│┃|]\s*/gm, '').trim();
                    console.log('✅ Fallback: Extracted ASSESSMENT, length:', sections.assessment.length);
                    break;
                }
            }
        }

        // PLAN
        if (!sections['plan_(p)'] && !sections.plan && !sections.treatment) {
            console.log('⚠️ PLAN not found, trying fallback patterns...');
            const planPatterns = [
                /PLAN[^a-z]*(?:\(P\))?[^\n]*\n([\s\S]*?)(?=\n\s*(?:Dr\.|Attending|Physician|Signature|─{3,}|━{3,}|$))/i,
                /\bP\s*[:\-\.]\s*([\s\S]*?)(?=\n\s*(?:Dr\.|Attending|Physician|$))/i,
                /TREATMENT\s*(PLAN)?[:\s]*([\s\S]*?)(?=\n\s*(?:Dr\.|Attending|Physician|$))/i,
                /MANAGEMENT[:\s]*([\s\S]*?)(?=\n\s*(?:Dr\.|Attending|Physician|$))/i,
                /ADVICE[:\s]*([\s\S]*?)(?=\n\s*(?:Dr\.|Attending|Physician|$))/i
            ];
            for (const pattern of planPatterns) {
                const match = cleanText.match(pattern);
                if (match) {
                    const content = (match[2] || match[1] || '').trim().replace(/^[│┃|]\s*/gm, '').trim();
                    if (content.length > 3) {
                        sections.plan = content;
                        console.log('✅ Fallback: Extracted PLAN, length:', sections.plan.length);
                        break;
                    }
                }
            }
        }

        console.log('📊 Final sections found:', Object.keys(sections).filter(k => sections[k]));

        return sections;
    };

    const sections = note.note ? parseNoteIntoSections(note.note) : {};

    return (
        <div className="bg-white rounded-none md:rounded-xl overflow-hidden border-0 md:border-2 md:border-blue-300 shadow-lg">
            {/* Header Bar - Medical Blue Theme */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-3 md:px-4 py-3">
                <div className="flex items-center gap-2 md:gap-3">
                    {/* Note Number Badge */}
                    {noteIndex !== undefined && totalNotes !== undefined && (
                        <div className="bg-white/20 backdrop-blur-sm px-2 md:px-2.5 py-1 rounded-lg">
                            <span className="text-white font-bold text-sm">
                                #{totalNotes - noteIndex}
                            </span>
                        </div>
                    )}
                    <div>
                        <p className="text-white font-semibold text-sm">
                            {new Date(note.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            })}
                        </p>
                        <p className="text-blue-100 text-xs">
                            {new Date(note.date).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Content Area - Case Sheet Style */}
            <div className="p-0 md:p-5 space-y-4">

                {/* Clinical Note - Single Continuous Layout */}
                {note.note && (
                    <div id={`note-${noteIndex}`} className="bg-gradient-to-br from-amber-50 via-white to-blue-50 rounded-none md:rounded-lg border-0 md:border border-slate-300 shadow-sm overflow-hidden">
                        {/* Medical Case Sheet Style Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-3 md:px-4 py-2 border-b border-blue-700 flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-white uppercase tracking-wide flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Clinical Progress Note
                            </h4>
                            <button
                                onClick={handleDownload}
                                className="no-print flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 text-xs font-semibold backdrop-blur-sm active:scale-95"
                                title="Download/Print Note"
                            >
                                <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span className="hidden sm:inline">Download</span>
                            </button>
                        </div>

                        {/* Single Continuous Note Content */}
                        <div className="p-3 md:p-6 space-y-4 md:space-y-5">

                            {/* Patient Particulars - Integrated at top of note like real medical notes */}
                            {patient && (
                                <div className="border-b-2 border-slate-300 pb-3 md:pb-4 mb-3 md:mb-4">
                                    {/* Headline */}
                                    <div className="text-center mb-3 pb-2 border-b border-slate-200">
                                        <h4 className="text-base md:text-lg font-bold text-slate-900 uppercase tracking-wide">Clinical Progress Note</h4>
                                        <p className="text-xs text-slate-600 mt-1">{patient.institutionName}</p>
                                        <p className="text-xs font-semibold text-blue-700 mt-0.5">
                                            {patient.unit}
                                            {patient.admissionType && ` - ${patient.admissionType}`}
                                        </p>
                                    </div>

                                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Patient Particulars</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 md:gap-x-6 gap-y-1.5 md:gap-y-2">
                                        <div>
                                            <span className="text-xs font-semibold text-slate-600">Name: </span>
                                            <span className="text-sm text-slate-900 font-medium">{patient.name}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs font-semibold text-slate-600">Age: </span>
                                            <span className="text-sm text-slate-900 font-medium">{ageAtNote}{dolAtNote && <span className="text-blue-600 ml-1">({dolAtNote})</span>}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs font-semibold text-slate-600">Gender: </span>
                                            <span className="text-sm text-slate-900 font-medium">{patient.gender || 'Not specified'}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs font-semibold text-slate-600">Date: </span>
                                            <span className="text-sm text-slate-900 font-medium">
                                                {new Date(note.date).toLocaleDateString('en-US', {
                                                    weekday: 'short',
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-xs font-semibold text-slate-600">Time: </span>
                                            <span className="text-sm text-slate-900 font-medium">
                                                {new Date(note.date).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: true
                                                })}
                                            </span>
                                        </div>
                                        <div className="md:col-span-1">
                                            {/* Empty spacer for grid alignment */}
                                        </div>
                                        <div className="md:col-span-3">
                                            <span className="text-xs font-semibold text-slate-600">Primary Diagnosis: </span>
                                            <span className="text-sm text-slate-900 font-medium">{patient.diagnosis}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SUBJECTIVE */}
                            {(sections['subjective_(s)'] || sections.subjective) && (
                                <div className="space-y-1.5">
                                    <h5 className="text-sm font-bold text-blue-900 border-b-2 border-blue-400 pb-1 mb-2 flex items-center gap-2">
                                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded font-bold">S</span>
                                        SUBJECTIVE
                                    </h5>
                                    <div className="pl-2 md:pl-6">
                                        <pre className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">{sections['subjective_(s)'] || sections.subjective}</pre>
                                    </div>
                                </div>
                            )}

                            {/* OBJECTIVE */}
                            {(sections['objective_(o)'] || sections.objective || sections.vital_signs || sections.vitals || sections.physical_examination || sections.examination || sections.labs_imaging) && (
                                <div className="space-y-1.5">
                                    <h5 className="text-sm font-bold text-emerald-900 border-b-2 border-emerald-400 pb-1 mb-2 flex items-center gap-2">
                                        <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded font-bold">O</span>
                                        OBJECTIVE
                                    </h5>
                                    <div className="pl-2 md:pl-6 space-y-2 md:space-y-3">
                                        {/* Vital Signs */}
                                        {(sections.vital_signs || sections.vitals) && (
                                            <div>
                                                <h6 className="text-xs font-semibold text-emerald-800 mb-1">Vital Signs:</h6>
                                                <pre className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans pl-1 md:pl-2">{sections.vital_signs || sections.vitals}</pre>
                                            </div>
                                        )}
                                        {/* Physical Examination */}
                                        {(sections.physical_examination || sections.examination) && (
                                            <div>
                                                <h6 className="text-xs font-semibold text-emerald-800 mb-1">Examination:</h6>
                                                <pre className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans pl-1 md:pl-2">{sections.physical_examination || sections.examination}</pre>
                                            </div>
                                        )}
                                        {/* Labs/Imaging */}
                                        {sections.labs_imaging && (
                                            <div>
                                                <h6 className="text-xs font-semibold text-emerald-800 mb-1">Labs/Imaging:</h6>
                                                <pre className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans pl-1 md:pl-2">{sections.labs_imaging}</pre>
                                            </div>
                                        )}
                                        {/* Full Objective if no subsections */}
                                        {(sections['objective_(o)'] || sections.objective) && !sections.vital_signs && !sections.vitals && !sections.physical_examination && !sections.examination && (
                                            <pre className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">{sections['objective_(o)'] || sections.objective}</pre>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ASSESSMENT */}
                            {(sections['assessment_(a)'] || sections.assessment || sections.impression) && (
                                <div className="space-y-1.5">
                                    <h5 className="text-sm font-bold text-orange-900 border-b-2 border-orange-400 pb-1 mb-2 flex items-center gap-2">
                                        <span className="bg-orange-600 text-white text-xs px-2 py-0.5 rounded font-bold">A</span>
                                        ASSESSMENT
                                    </h5>
                                    <div className="pl-2 md:pl-6">
                                        <pre className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">{sections['assessment_(a)'] || sections.assessment || sections.impression}</pre>
                                    </div>
                                </div>
                            )}

                            {/* PLAN */}
                            {(sections['plan_(p)'] || sections.plan || sections.plan_and_advice || sections.treatment) && (
                                <div className="space-y-1.5">
                                    <h5 className="text-sm font-bold text-purple-900 border-b-2 border-purple-400 pb-1 mb-2 flex items-center gap-2">
                                        <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded font-bold">P</span>
                                        PLAN
                                    </h5>
                                    <div className="pl-2 md:pl-6">
                                        <pre className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">{sections['plan_(p)'] || sections.plan || sections.plan_and_advice || sections.treatment}</pre>
                                    </div>
                                </div>
                            )}

                            {/* Fallback: Show full note if no sections found */}
                            {!sections['subjective_(s)'] && !sections.subjective && !sections['objective_(o)'] && !sections.objective && !sections['assessment_(a)'] && !sections.assessment && !sections['plan_(p)'] && !sections.plan && note.note && (
                                <div className="border-l-4 border-amber-500 bg-amber-50 p-4 rounded">
                                    <div className="text-xs font-semibold text-amber-900 mb-2">Clinical Note</div>
                                    <pre className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">{note.note}</pre>
                                </div>
                            )}

                            {/* Doctor's Signature - Bottom Right like real medical notes */}
                            {note.addedBy && (
                                <div className="mt-6 md:mt-8 pt-3 md:pt-4 border-t border-slate-200 flex justify-end">
                                    <div className="text-right">
                                        <div className="mb-1">
                                            <div className="h-px w-32 md:w-48 bg-slate-400 mb-1"></div>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-900">{note.addedBy}</p>
                                        <p className="text-xs text-slate-600">Attending Physician</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgressNoteDisplay;
