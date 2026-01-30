import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Patient,
  Unit,
  DeathCertificate,
  DeletedDeathCertificate,
  CauseOfDeathPartI,
  CauseOfDeathPartII,
  MannerOfDeath,
  PlaceOfDeath,
  DeathClassification,
  PerinatalDeathType,
  NHMDeathCategory,
  AutopsyStatus
} from '../types';
import {
  createDeathCertificateFromPatient,
  downloadDeathCertificatePDF,
  previewDeathCertificatePDF
} from '../services/deathCertificateService';
import {
  generateCauseOfDeathAnalysis,
  suggestICD10Codes,
  generateDeathClinicalSummary,
  generateDeathTreatmentSummary,
  determineNHMDeathCategory,
  generateEnhancedCauseOfDeathAnalysis
} from '../services/openaiService';
import { generateComprehensiveClinicalSummary, ClinicalWarning } from '../services/clinicalIntelligenceService';
import { haptics } from '../utils/haptics';
import { AgeUnit } from '../types';

// Helper to calculate age in days from patient's age and ageUnit
const getPatientAgeInDays = (patient: Patient): number | undefined => {
  if (patient.age === undefined) return undefined;
  switch (patient.ageUnit) {
    case AgeUnit.Days:
      return patient.age;
    case AgeUnit.Weeks:
      return patient.age * 7;
    case AgeUnit.Months:
      return patient.age * 30;
    case AgeUnit.Years:
      return patient.age * 365;
    default:
      return undefined;
  }
};
import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { showToast } from '../utils/toast';

interface DeathCertificateModalProps {
  patient: Patient;
  onClose: () => void;
  onPatientUpdate?: (patient: Patient) => void;
  userName?: string;
  userDesignation?: string;
  userRegistrationNo?: string;
  institutionName?: string;
  institutionAddress?: string;
  institutionPhone?: string;
  viewMode?: boolean;
  doctors?: string[]; // List of doctors for dropdown
}

const DeathCertificateModal: React.FC<DeathCertificateModalProps> = ({
  patient,
  onClose,
  onPatientUpdate,
  userName = 'Doctor',
  userDesignation = 'Medical Officer',
  userRegistrationNo = '',
  institutionName = '',
  institutionAddress = '',
  institutionPhone = '',
  viewMode = false,
  doctors = []
}) => {
  const isNeonatal = patient.unit === Unit.NICU || patient.unit === Unit.SNCU;
  const hasSavedCertificate = !!patient.savedDeathCertificate;

  // Death Certificate Deletion Tracking
  const deletionCount = patient.deathCertificateDeletionCount || 0;
  const deletedCertificates = patient.deletedDeathCertificates || [];
  const maxDeletionsReached = deletionCount >= 2;
  const canGenerateNewCertificate = !hasSavedCertificate && !maxDeletionsReached;

  // Deletion Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeletedCertificates, setShowDeletedCertificates] = useState(false);

  // Form State
  const [activeSection, setActiveSection] = useState(0);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiGenerationComplete, setAiGenerationComplete] = useState(hasSavedCertificate); // AI is already done if loaded from saved
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(hasSavedCertificate);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showSectionMenu, setShowSectionMenu] = useState(false);
  const [clinicalWarnings, setClinicalWarnings] = useState<ClinicalWarning[]>([]);

  // Death Details
  const [dateOfDeath, setDateOfDeath] = useState(patient.dateOfDeath || patient.releaseDate || new Date().toISOString().split('T')[0]);
  const [timeOfDeath, setTimeOfDeath] = useState('');
  const [placeOfDeath, setPlaceOfDeath] = useState<PlaceOfDeath>(
    isNeonatal ? PlaceOfDeath.NICU : PlaceOfDeath.PICU
  );

  // Classification
  const [mannerOfDeath, setMannerOfDeath] = useState<MannerOfDeath>(MannerOfDeath.Natural);
  const [deathClassification, setDeathClassification] = useState<DeathClassification>(DeathClassification.ExpectedDeath);
  const [perinatalDeathType, setPerinatalDeathType] = useState<PerinatalDeathType | undefined>();
  const [nhmDeathCategory, setNhmDeathCategory] = useState<NHMDeathCategory>(NHMDeathCategory.Other);

  // Cause of Death - Part I
  const [immediateCause, setImmediateCause] = useState('');
  const [immediateCauseICD10, setImmediateCauseICD10] = useState('');
  const [immediateCauseDuration, setImmediateCauseDuration] = useState('');
  const [antecedentCause, setAntecedentCause] = useState('');
  const [antecedentCauseICD10, setAntecedentCauseICD10] = useState('');
  const [antecedentCauseDuration, setAntecedentCauseDuration] = useState('');
  const [underlyingCause, setUnderlyingCause] = useState('');
  const [underlyingCauseICD10, setUnderlyingCauseICD10] = useState('');
  const [underlyingCauseDuration, setUnderlyingCauseDuration] = useState('');

  // Cause of Death - Part II (Contributing Conditions)
  const [contributingConditions, setContributingConditions] = useState<Array<{
    condition: string;
    icd10Code: string;
    duration: string;
  }>>([]);

  // Clinical Summary
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [treatmentProvided, setTreatmentProvided] = useState<string[]>([]);
  const [terminalEvents, setTerminalEvents] = useState('');

  // Resuscitation
  const [resuscitationAttempted, setResuscitationAttempted] = useState(true);
  const [resuscitationDuration, setResuscitationDuration] = useState('');

  // Autopsy
  const [autopsyStatus, setAutopsyStatus] = useState<AutopsyStatus>(AutopsyStatus.NotPerformed);
  const [autopsyFindings, setAutopsyFindings] = useState('');

  // Death Summary Given To
  const [deathSummaryGivenTo, setDeathSummaryGivenTo] = useState('');
  const [relationToDeceased, setRelationToDeceased] = useState('');

  // NHM Notifications
  const [nhmCDRFormCompleted, setNhmCDRFormCompleted] = useState(false);
  const [deathNotifiedToASHA, setDeathNotifiedToASHA] = useState(false);

  // Certifying Physician (manually entered each time)
  const [certifyingPhysicianName, setCertifyingPhysicianName] = useState('');
  const [certifyingPhysicianDesignation, setCertifyingPhysicianDesignation] = useState('');
  const [certifyingPhysicianRegNo, setCertifyingPhysicianRegNo] = useState('');
  const [deathNotifiedToCMO, setDeathNotifiedToCMO] = useState(false);

  // ICD-10 Suggestions
  const [icd10Suggestions, setIcd10Suggestions] = useState<Array<{
    code: string;
    description: string;
    confidence: number;
  }>>([]);
  const [showICD10Suggestions, setShowICD10Suggestions] = useState(false);
  const [icd10TargetField, setIcd10TargetField] = useState<'immediate' | 'antecedent' | 'underlying' | null>(null);

  // Determine perinatal death type based on age
  useEffect(() => {
    const ageInDays = getPatientAgeInDays(patient);
    if (isNeonatal && ageInDays !== undefined) {
      if (ageInDays === 0) {
        setPerinatalDeathType(PerinatalDeathType.EarlyNeonatal);
      } else if (ageInDays < 7) {
        setPerinatalDeathType(PerinatalDeathType.EarlyNeonatal);
      } else if (ageInDays < 28) {
        setPerinatalDeathType(PerinatalDeathType.LateNeonatal);
      } else if (ageInDays < 365) {
        setPerinatalDeathType(PerinatalDeathType.PostNeonatal);
      }
    }
  }, [isNeonatal, patient.age, patient.ageUnit]);

  // Determine NHM category
  useEffect(() => {
    const category = determineNHMDeathCategory(patient);
    setNhmDeathCategory(category as NHMDeathCategory);
  }, [patient]);

  // Load saved certificate or generate AI content
  useEffect(() => {
    if (hasSavedCertificate && patient.savedDeathCertificate) {
      // Load existing saved certificate
      loadSavedCertificate(patient.savedDeathCertificate);
      console.log('Loaded saved death certificate');
    } else if (viewMode) {
      // View mode but no certificate - just show empty form
      setAiGenerationComplete(true);
      console.log('View mode - showing empty form');
    } else if (!maxDeletionsReached && patient.outcome !== 'Deceased') {
      // Only auto-generate for NEW deceased patients (outcome being set to Deceased now)
      // NOT for patients who are already marked Deceased (they should have saved cert)
      handleGenerateAI();
      console.log('Auto-generating for new deceased patient');
    } else if (!maxDeletionsReached && !hasSavedCertificate) {
      // Patient is Deceased but no saved certificate - allow manual generation
      // This handles the case where certificate was deleted or data is missing
      setAiGenerationComplete(false);
      console.log('Deceased patient without saved certificate - manual generation required');
    }
  }, []);

  const loadSavedCertificate = (cert: DeathCertificate) => {
    // Load all fields from saved certificate
    if (cert.dateOfDeath) setDateOfDeath(cert.dateOfDeath);
    if (cert.timeOfDeath) setTimeOfDeath(cert.timeOfDeath);
    if (cert.placeOfDeath) setPlaceOfDeath(cert.placeOfDeath);
    if (cert.mannerOfDeath) setMannerOfDeath(cert.mannerOfDeath);
    if (cert.deathClassification) setDeathClassification(cert.deathClassification);
    if (cert.perinatalDeathType) setPerinatalDeathType(cert.perinatalDeathType);
    if (cert.nhmDeathCategory) setNhmDeathCategory(cert.nhmDeathCategory);

    // Cause of Death Part I
    if (cert.causeOfDeathPartI) {
      setImmediateCause(cert.causeOfDeathPartI.immediateCause || '');
      setImmediateCauseICD10(cert.causeOfDeathPartI.immediateCauseICD10 || '');
      setImmediateCauseDuration(cert.causeOfDeathPartI.immediateCauseDuration || '');
      setAntecedentCause(cert.causeOfDeathPartI.antecedentCause || '');
      setAntecedentCauseICD10(cert.causeOfDeathPartI.antecedentCauseICD10 || '');
      setAntecedentCauseDuration(cert.causeOfDeathPartI.antecedentCauseDuration || '');
      setUnderlyingCause(cert.causeOfDeathPartI.underlyingCause || '');
      setUnderlyingCauseICD10(cert.causeOfDeathPartI.underlyingCauseICD10 || '');
      setUnderlyingCauseDuration(cert.causeOfDeathPartI.underlyingCauseDuration || '');
    }

    // Part II
    if (cert.causeOfDeathPartII?.contributingConditions) {
      setContributingConditions(cert.causeOfDeathPartII.contributingConditions.map(c => ({
        condition: c.condition,
        icd10Code: c.icd10Code || '',
        duration: c.duration || ''
      })));
    }

    // Clinical
    if (cert.clinicalCourseSummary) setClinicalSummary(cert.clinicalCourseSummary);
    if (cert.treatmentProvided) setTreatmentProvided(cert.treatmentProvided);
    if (cert.terminalEvents) setTerminalEvents(cert.terminalEvents);
    if (cert.resuscitationAttempted !== undefined) setResuscitationAttempted(cert.resuscitationAttempted);
    if (cert.resuscitationDuration) setResuscitationDuration(cert.resuscitationDuration);
    if (cert.autopsyStatus) setAutopsyStatus(cert.autopsyStatus);
    if (cert.autopsyFindings) setAutopsyFindings(cert.autopsyFindings);
    if (cert.deathSummaryGivenTo) setDeathSummaryGivenTo(cert.deathSummaryGivenTo);
    if (cert.relationToDeceased) setRelationToDeceased(cert.relationToDeceased);
    if (cert.nhmCDRFormCompleted) setNhmCDRFormCompleted(cert.nhmCDRFormCompleted);
    if (cert.deathNotifiedToASHA) setDeathNotifiedToASHA(cert.deathNotifiedToASHA);
    if (cert.deathNotifiedToCMO) setDeathNotifiedToCMO(cert.deathNotifiedToCMO);

    // Certifying Physician
    if (cert.certifiedBy) setCertifyingPhysicianName(cert.certifiedBy);
    if (cert.certifierDesignation) setCertifyingPhysicianDesignation(cert.certifierDesignation);
    if (cert.certifierRegistrationNo) setCertifyingPhysicianRegNo(cert.certifierRegistrationNo);

    setIsSaved(true);
    setAiGenerationComplete(true); // Already saved means AI was completed
    // No automatic preview - user should click preview manually
  };

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    haptics.tap();

    try {
      // Use enhanced clinical intelligence for accurate cause of death analysis
      const [enhancedCODAnalysis, summary, treatments] = await Promise.all([
        generateEnhancedCauseOfDeathAnalysis(patient),
        generateDeathClinicalSummary(patient),
        generateDeathTreatmentSummary(patient)
      ]);

      // Set cause of death from enhanced AI analysis
      if (enhancedCODAnalysis.partI) {
        setImmediateCause(enhancedCODAnalysis.partI.immediateCause || '');
        setImmediateCauseICD10(enhancedCODAnalysis.partI.immediateCauseICD10 || '');
        setImmediateCauseDuration(enhancedCODAnalysis.partI.immediateCauseDuration || '');
        setAntecedentCause(enhancedCODAnalysis.partI.antecedentCause || '');
        setAntecedentCauseICD10(enhancedCODAnalysis.partI.antecedentCauseICD10 || '');
        setAntecedentCauseDuration(enhancedCODAnalysis.partI.antecedentCauseDuration || '');
        setUnderlyingCause(enhancedCODAnalysis.partI.underlyingCause || '');
        setUnderlyingCauseICD10(enhancedCODAnalysis.partI.underlyingCauseICD10 || '');
        setUnderlyingCauseDuration(enhancedCODAnalysis.partI.underlyingCauseDuration || '');
      }

      if (enhancedCODAnalysis.partII && enhancedCODAnalysis.partII.length > 0) {
        setContributingConditions(enhancedCODAnalysis.partII);
      }

      if (enhancedCODAnalysis.nhmCategory) {
        setNhmDeathCategory(enhancedCODAnalysis.nhmCategory as NHMDeathCategory);
      }

      // Set clinical warnings from analysis - convert string array to ClinicalWarning array
      if (enhancedCODAnalysis.warnings && enhancedCODAnalysis.warnings.length > 0) {
        setClinicalWarnings(enhancedCODAnalysis.warnings.map(warning => ({
          type: 'warning' as const,
          message: warning,
          severity: 'medium' as const
        })));
      }

      setClinicalSummary(summary);
      setTreatmentProvided(treatments);

      setAiGenerationComplete(true);
      haptics.success();

      // Show warnings if validation issues found
      if (enhancedCODAnalysis.warnings && enhancedCODAnalysis.warnings.length > 0) {
        showToast('warning', `${enhancedCODAnalysis.warnings.length} validation issue(s) found - please review`);
      } else {
        showToast('success', 'AI analysis completed');
      }
    } catch (error) {
      console.error('Error generating enhanced AI content, falling back to basic generation:', error);

      // Fallback to basic generation
      try {
        const [codAnalysis, summary, treatments] = await Promise.all([
          generateCauseOfDeathAnalysis(patient),
          generateDeathClinicalSummary(patient),
          generateDeathTreatmentSummary(patient)
        ]);

        if (codAnalysis.partI) {
          setImmediateCause(codAnalysis.partI.immediateCause || '');
          setImmediateCauseICD10(codAnalysis.partI.immediateCauseICD10 || '');
          setImmediateCauseDuration(codAnalysis.partI.immediateCauseDuration || '');
          setAntecedentCause(codAnalysis.partI.antecedentCause || '');
          setAntecedentCauseICD10(codAnalysis.partI.antecedentCauseICD10 || '');
          setAntecedentCauseDuration(codAnalysis.partI.antecedentCauseDuration || '');
          setUnderlyingCause(codAnalysis.partI.underlyingCause || '');
          setUnderlyingCauseICD10(codAnalysis.partI.underlyingCauseICD10 || '');
          setUnderlyingCauseDuration(codAnalysis.partI.underlyingCauseDuration || '');
        }

        if (codAnalysis.partII && codAnalysis.partII.length > 0) {
          setContributingConditions(codAnalysis.partII);
        }

        if (codAnalysis.nhmCategory) {
          setNhmDeathCategory(codAnalysis.nhmCategory as NHMDeathCategory);
        }

        setClinicalSummary(summary);
        setTreatmentProvided(treatments);
        setAiGenerationComplete(true);
        showToast('success', 'AI analysis completed');
      } catch (fallbackError) {
        console.error('Fallback generation also failed:', fallbackError);
        haptics.error();
        showToast('error', 'AI analysis failed');
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleGetICD10Suggestions = async (diagnosis: string, targetField: 'immediate' | 'antecedent' | 'underlying') => {
    if (!diagnosis.trim()) return;

    setIcd10TargetField(targetField);
    try {
      const suggestions = await suggestICD10Codes(diagnosis, isNeonatal);
      setIcd10Suggestions(suggestions);
      setShowICD10Suggestions(true);
    } catch (error) {
      console.error('Error getting ICD-10 suggestions:', error);
    }
  };

  const handleSelectICD10 = (code: string) => {
    if (icd10TargetField === 'immediate') {
      setImmediateCauseICD10(code);
    } else if (icd10TargetField === 'antecedent') {
      setAntecedentCauseICD10(code);
    } else if (icd10TargetField === 'underlying') {
      setUnderlyingCauseICD10(code);
    }
    setShowICD10Suggestions(false);
    setIcd10TargetField(null);
  };

  const buildCertificate = (): DeathCertificate => {
    const causeOfDeathPartI: CauseOfDeathPartI = {
      immediateCause,
      immediateCauseICD10,
      immediateCauseDuration,
      antecedentCause: antecedentCause || undefined,
      antecedentCauseICD10: antecedentCauseICD10 || undefined,
      antecedentCauseDuration: antecedentCauseDuration || undefined,
      underlyingCause: underlyingCause || undefined,
      underlyingCauseICD10: underlyingCauseICD10 || undefined,
      underlyingCauseDuration: underlyingCauseDuration || undefined
    };

    const causeOfDeathPartII: CauseOfDeathPartII | undefined = contributingConditions.length > 0
      ? { contributingConditions }
      : undefined;

    return createDeathCertificateFromPatient(patient, {
      hospitalName: institutionName || patient.institutionName || 'Hospital',
      hospitalAddress: institutionAddress,
      hospitalPhone: institutionPhone,
      certifiedBy: certifyingPhysicianName,
      certifierDesignation: certifyingPhysicianDesignation,
      certifierRegistrationNo: certifyingPhysicianRegNo,
      causeOfDeathPartI,
      causeOfDeathPartII,
      clinicalCourseSummary: clinicalSummary,
      treatmentProvided,
      mannerOfDeath,
      placeOfDeath,
      deathClassification,
      perinatalDeathType,
      nhmDeathCategory,
      terminalEvents,
      resuscitationAttempted,
      resuscitationDuration,
      autopsyStatus,
      autopsyFindings,
      deathSummaryGivenTo,
      relationToDeceased,
      nhmCDRFormCompleted,
      deathNotifiedToASHA,
      deathNotifiedToCMO
    });
  };

  const handleSaveCertificate = async () => {
    if (!immediateCause.trim()) {
      showToast('warning', 'Please enter the immediate cause of death');
      return;
    }

    if (!certifyingPhysicianName.trim()) {
      showToast('warning', 'Please enter the certifying physician name');
      setActiveSection(5); // Go to certification section
      return;
    }

    if (!certifyingPhysicianDesignation.trim()) {
      showToast('warning', 'Please enter the physician designation');
      setActiveSection(5);
      return;
    }

    if (!certifyingPhysicianRegNo.trim()) {
      showToast('warning', 'Medical registration number is required');
      setActiveSection(5);
      return;
    }

    setIsSaving(true);
    haptics.tap();

    try {
      const certificate = buildCertificate();
      const now = new Date().toISOString();

      const patientRef = doc(db, 'patients', patient.id);
      await updateDoc(patientRef, {
        savedDeathCertificate: certificate,
        deathCertificateSavedAt: now,
        deathCertificateSavedBy: userName,
        outcome: 'Deceased',
        dateOfDeath: dateOfDeath,
        timeOfDeath: timeOfDeath
      });

      if (onPatientUpdate) {
        onPatientUpdate({
          ...patient,
          savedDeathCertificate: certificate,
          outcome: 'Deceased',
          dateOfDeath,
          timeOfDeath
        } as any);
      }

      setIsSaved(true);
      haptics.success();
      showToast('success', 'Death certificate saved');
    } catch (error) {
      console.error('Error saving certificate:', error);
      haptics.error();
      showToast('error', 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete certificate with audit trail (max 2 deletions allowed)
  const handleDeleteCertificate = async () => {
    if (!deletionReason.trim()) {
      showToast('warning', 'Please provide a reason for deletion');
      return;
    }

    if (deletionCount >= 2) {
      showToast('error', 'Maximum 2 deletions allowed. Cannot delete again.');
      return;
    }

    if (!patient.savedDeathCertificate) {
      showToast('error', 'No certificate to delete');
      return;
    }

    setIsDeleting(true);
    haptics.tap();

    try {
      const now = new Date().toISOString();
      const newDeletionCount = deletionCount + 1;

      // Create deleted certificate record for audit trail
      const deletedCertRecord: DeletedDeathCertificate = {
        certificate: patient.savedDeathCertificate,
        deletedAt: now,
        deletedBy: userName,
        deletedByEmail: undefined, // Could be added from props if available
        deletionReason: deletionReason.trim(),
        deletionNumber: newDeletionCount
      };

      // Archive the deleted certificate and clear the saved one
      const patientRef = doc(db, 'patients', patient.id);
      await updateDoc(patientRef, {
        savedDeathCertificate: null,
        deathCertificateSavedAt: null,
        deathCertificateSavedBy: null,
        deletedDeathCertificates: [...deletedCertificates, deletedCertRecord],
        deathCertificateDeletionCount: newDeletionCount
      });

      if (onPatientUpdate) {
        onPatientUpdate({
          ...patient,
          savedDeathCertificate: undefined,
          deathCertificateSavedAt: undefined,
          deathCertificateSavedBy: undefined,
          deletedDeathCertificates: [...deletedCertificates, deletedCertRecord],
          deathCertificateDeletionCount: newDeletionCount
        } as any);
      }

      setShowDeleteModal(false);
      setDeletionReason('');
      setIsSaved(false);
      haptics.success();

      const remainingDeletions = 2 - newDeletionCount;
      if (remainingDeletions > 0) {
        showToast('success', `Certificate deleted. ${remainingDeletions} deletion(s) remaining.`);
        // Close modal - user needs to reopen to create new certificate
        onClose();
      } else {
        showToast('warning', 'Certificate deleted. Maximum deletions reached - no new certificates can be created.');
        onClose();
      }
    } catch (error) {
      console.error('Error deleting certificate:', error);
      haptics.error();
      showToast('error', 'Failed to delete certificate');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGeneratePDF = () => {
    if (!isSaved) {
      showToast('warning', 'Please save first');
      return;
    }

    if (!certifyingPhysicianName.trim() || !certifyingPhysicianRegNo.trim()) {
      showToast('warning', 'Physician name and registration number are required');
      setActiveSection(5);
      return;
    }

    setIsGeneratingPDF(true);
    haptics.tap();

    try {
      const certificate = buildCertificate();
      downloadDeathCertificatePDF(certificate, patient);
      haptics.success();
    } catch (error) {
      console.error('Error generating PDF:', error);
      haptics.error();
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePreviewPDF = () => {
    if (!certifyingPhysicianName.trim() || !certifyingPhysicianRegNo.trim()) {
      showToast('warning', 'Please fill in certifying physician details (Section 6)');
      setActiveSection(5);
      return;
    }

    haptics.tap();
    try {
      const certificate = buildCertificate();
      const url = previewDeathCertificatePDF(certificate, patient);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Error previewing PDF:', error);
      haptics.error();
    }
  };

  const addContributingCondition = () => {
    setContributingConditions([...contributingConditions, { condition: '', icd10Code: '', duration: '' }]);
  };

  const removeContributingCondition = (index: number) => {
    setContributingConditions(contributingConditions.filter((_, i) => i !== index));
  };

  const updateContributingCondition = (index: number, field: string, value: string) => {
    const updated = [...contributingConditions];
    updated[index] = { ...updated[index], [field]: value };
    setContributingConditions(updated);
  };

  const addTreatment = () => {
    setTreatmentProvided([...treatmentProvided, '']);
  };

  const removeTreatment = (index: number) => {
    setTreatmentProvided(treatmentProvided.filter((_, i) => i !== index));
  };

  const updateTreatment = (index: number, value: string) => {
    const updated = [...treatmentProvided];
    updated[index] = value;
    setTreatmentProvided(updated);
  };

  const sections = [
    { id: 'death', title: 'Death Details', shortTitle: 'Death' },
    { id: 'cause', title: 'Cause of Death', shortTitle: 'Cause' },
    { id: 'contributing', title: 'Contributing', shortTitle: 'Part II' },
    { id: 'clinical', title: 'Clinical Summary', shortTitle: 'Clinical' },
    { id: 'nhm', title: 'NHM Classification', shortTitle: 'NHM' },
    { id: 'certification', title: 'Certification', shortTitle: 'Certify' }
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center overflow-hidden"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-white w-full sm:w-[95%] sm:max-w-3xl h-[100dvh] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden rounded-t-3xl"
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-slate-800 to-slate-900 text-white safe-area-top">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold truncate">Medical Certificate of Cause of Death</h2>
              <p className="text-xs text-white/80 truncate">MCCD Form 4 - {patient.name}</p>
            </div>
            <div className="flex items-center gap-2">
              {isGeneratingAI && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-white/20 rounded-lg">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">AI...</span>
                </div>
              )}
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Certificate Status Banners */}
          {maxDeletionsReached && (
            <div className="flex-shrink-0 px-4 py-3 bg-red-100 border-b border-red-200">
              <div className="flex items-center gap-2 text-red-800">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-bold text-sm">Maximum Deletions Reached</p>
                  <p className="text-xs">This patient has had 2 death certificates deleted. No new certificates can be generated.</p>
                </div>
              </div>
              {deletedCertificates.length > 0 && (
                <button
                  onClick={() => setShowDeletedCertificates(!showDeletedCertificates)}
                  className="mt-2 text-xs text-red-700 underline"
                >
                  {showDeletedCertificates ? 'Hide' : 'View'} deleted certificates audit trail
                </button>
              )}
            </div>
          )}

          {hasSavedCertificate && !maxDeletionsReached && (
            <div className="flex-shrink-0 px-4 py-3 bg-amber-50 border-b border-amber-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-800">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-bold text-sm">Certificate Already Exists</p>
                    <p className="text-xs">Saved on {patient.deathCertificateSavedAt ? new Date(patient.deathCertificateSavedAt).toLocaleDateString() : 'N/A'} by {patient.deathCertificateSavedBy || 'Unknown'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors"
                >
                  Delete Certificate ({2 - deletionCount} left)
                </button>
              </div>
              {deletionCount > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  Warning: {deletionCount} deletion(s) already made. Only {2 - deletionCount} deletion(s) remaining.
                </p>
              )}
            </div>
          )}

          {/* Deleted Certificates Audit Trail */}
          {showDeletedCertificates && deletedCertificates.length > 0 && (
            <div className="flex-shrink-0 px-4 py-3 bg-slate-100 border-b border-slate-200 max-h-48 overflow-y-auto">
              <h4 className="font-bold text-sm text-slate-700 mb-2">Deleted Certificates Audit Trail</h4>
              <div className="space-y-2">
                {deletedCertificates.map((deleted, idx) => (
                  <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-red-700">Deletion #{deleted.deletionNumber}</span>
                      <span className="text-slate-500">{new Date(deleted.deletedAt).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-600 mt-1"><strong>Deleted by:</strong> {deleted.deletedBy}</p>
                    <p className="text-slate-600"><strong>Reason:</strong> {deleted.deletionReason}</p>
                    <p className="text-slate-500 mt-1">Original cause: {deleted.certificate.causeOfDeathPartI?.immediateCause || 'N/A'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section Navigation */}
          <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50">
            {/* Mobile: Dropdown */}
            <div className="sm:hidden p-2">
              <button
                onClick={() => setShowSectionMenu(!showSectionMenu)}
                className="w-full px-4 py-2.5 rounded-xl flex items-center justify-between bg-white border-2 border-slate-200"
              >
                <span className="font-semibold text-slate-700">
                  {activeSection + 1}. {sections[activeSection].title}
                </span>
                <svg className={`w-5 h-5 transition-transform ${showSectionMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <AnimatePresence>
                {showSectionMenu && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 bg-white rounded-xl border border-slate-200 overflow-hidden"
                  >
                    {sections.map((section, index) => (
                      <button
                        key={section.id}
                        onClick={() => { setActiveSection(index); setShowSectionMenu(false); }}
                        className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b border-slate-100 last:border-0 ${
                          activeSection === index ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          activeSection === index ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>{index + 1}</span>
                        <span className="font-medium">{section.title}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop: Horizontal tabs */}
            <div className="hidden sm:flex p-2 gap-1 overflow-x-auto">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(index)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeSection === index
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    activeSection === index ? 'bg-white text-slate-800' : 'bg-slate-300 text-slate-600'
                  }`}>{index + 1}</span>
                  {section.title}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Section 1: Death Details */}
            {activeSection === 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Death Details</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Death *</label>
                    <input
                      type="date"
                      value={dateOfDeath.split('T')[0]}
                      onChange={(e) => setDateOfDeath(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Time of Death *</label>
                    <input
                      type="time"
                      value={timeOfDeath}
                      onChange={(e) => setTimeOfDeath(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Place of Death</label>
                  <select
                    value={placeOfDeath}
                    onChange={(e) => setPlaceOfDeath(e.target.value as PlaceOfDeath)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    {Object.values(PlaceOfDeath).map(place => (
                      <option key={place} value={place}>{place}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Manner of Death</label>
                  <select
                    value={mannerOfDeath}
                    onChange={(e) => setMannerOfDeath(e.target.value as MannerOfDeath)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    {Object.values(MannerOfDeath).map(manner => (
                      <option key={manner} value={manner}>{manner}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Death Classification</label>
                  <select
                    value={deathClassification}
                    onChange={(e) => setDeathClassification(e.target.value as DeathClassification)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    {Object.values(DeathClassification).map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                {/* Resuscitation */}
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-red-800">Resuscitation Attempted</span>
                    <button
                      onClick={() => setResuscitationAttempted(!resuscitationAttempted)}
                      className={`w-12 h-6 rounded-full transition-colors ${resuscitationAttempted ? 'bg-red-500' : 'bg-slate-300'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${resuscitationAttempted ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {resuscitationAttempted && (
                    <input
                      type="text"
                      value={resuscitationDuration}
                      onChange={(e) => setResuscitationDuration(e.target.value)}
                      placeholder="Duration (e.g., 30 minutes)"
                      className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm mt-2"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Section 2: Cause of Death (Part I) */}
            {activeSection === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Cause of Death - Part I</h3>
                  <button
                    onClick={handleGenerateAI}
                    disabled={isGeneratingAI}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 disabled:opacity-50"
                  >
                    {isGeneratingAI ? 'Analyzing...' : 'AI Analyze'}
                  </button>
                </div>

                <p className="text-xs text-slate-500 italic">
                  Following WHO ICD-10 Guidelines. Enter conditions in causal sequence.
                </p>

                {/* Line (a) - Immediate Cause */}
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-xs font-bold text-red-800 mb-2">(a) Immediate/Direct Cause of Death *</p>
                  <input
                    type="text"
                    value={immediateCause}
                    onChange={(e) => setImmediateCause(e.target.value)}
                    placeholder="Disease or condition directly leading to death"
                    className="w-full px-3 py-2.5 border border-red-200 rounded-lg text-sm mb-2"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={immediateCauseICD10}
                        onChange={(e) => setImmediateCauseICD10(e.target.value)}
                        placeholder="ICD-10 Code"
                        className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleGetICD10Suggestions(immediateCause, 'immediate')}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-semibold"
                    >
                      Suggest
                    </button>
                    <input
                      type="text"
                      value={immediateCauseDuration}
                      onChange={(e) => setImmediateCauseDuration(e.target.value)}
                      placeholder="Duration"
                      className="w-24 px-3 py-2 border border-red-200 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Line (b) - Antecedent Cause */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs font-bold text-amber-800 mb-2">(b) Due to (or as a consequence of)</p>
                  <input
                    type="text"
                    value={antecedentCause}
                    onChange={(e) => setAntecedentCause(e.target.value)}
                    placeholder="Antecedent cause (if any)"
                    className="w-full px-3 py-2.5 border border-amber-200 rounded-lg text-sm mb-2"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={antecedentCauseICD10}
                        onChange={(e) => setAntecedentCauseICD10(e.target.value)}
                        placeholder="ICD-10 Code"
                        className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleGetICD10Suggestions(antecedentCause, 'antecedent')}
                      className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold"
                    >
                      Suggest
                    </button>
                    <input
                      type="text"
                      value={antecedentCauseDuration}
                      onChange={(e) => setAntecedentCauseDuration(e.target.value)}
                      placeholder="Duration"
                      className="w-24 px-3 py-2 border border-amber-200 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Line (c) - Underlying Cause */}
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs font-bold text-blue-800 mb-2">(c) Due to (Underlying Cause)</p>
                  <input
                    type="text"
                    value={underlyingCause}
                    onChange={(e) => setUnderlyingCause(e.target.value)}
                    placeholder="Underlying cause - the disease that initiated the sequence"
                    className="w-full px-3 py-2.5 border border-blue-200 rounded-lg text-sm mb-2"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={underlyingCauseICD10}
                        onChange={(e) => setUnderlyingCauseICD10(e.target.value)}
                        placeholder="ICD-10 Code"
                        className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleGetICD10Suggestions(underlyingCause, 'underlying')}
                      className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold"
                    >
                      Suggest
                    </button>
                    <input
                      type="text"
                      value={underlyingCauseDuration}
                      onChange={(e) => setUnderlyingCauseDuration(e.target.value)}
                      placeholder="Duration"
                      className="w-24 px-3 py-2 border border-blue-200 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* ICD-10 Suggestions Modal */}
                <AnimatePresence>
                  {showICD10Suggestions && icd10Suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-3 bg-white rounded-xl border-2 border-slate-300 shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-800">ICD-10 Suggestions</span>
                        <button onClick={() => setShowICD10Suggestions(false)} className="text-slate-400 hover:text-slate-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="space-y-2">
                        {icd10Suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleSelectICD10(suggestion.code)}
                            className="w-full p-2 text-left bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-blue-600">{suggestion.code}</span>
                              <span className="text-xs text-slate-500">{Math.round(suggestion.confidence * 100)}% match</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1">{suggestion.description}</p>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Section 3: Contributing Conditions (Part II) */}
            {activeSection === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Part II - Contributing Conditions</h3>
                  <button
                    onClick={addContributingCondition}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    + Add
                  </button>
                </div>

                <p className="text-xs text-slate-500 italic">
                  Other significant conditions contributing to death but not related to the main sequence.
                </p>

                <div className="space-y-3">
                  {contributingConditions.map((condition, index) => (
                    <div key={index} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-slate-500">Condition #{index + 1}</span>
                        <button onClick={() => removeContributingCondition(index)} className="text-red-500 p-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={condition.condition}
                        onChange={(e) => updateContributingCondition(index, 'condition', e.target.value)}
                        placeholder="Contributing condition"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-2"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={condition.icd10Code}
                          onChange={(e) => updateContributingCondition(index, 'icd10Code', e.target.value)}
                          placeholder="ICD-10 Code"
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                        <input
                          type="text"
                          value={condition.duration}
                          onChange={(e) => updateContributingCondition(index, 'duration', e.target.value)}
                          placeholder="Duration"
                          className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  ))}
                  {contributingConditions.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">No contributing conditions added</p>
                  )}
                </div>
              </div>
            )}

            {/* Section 4: Clinical Summary */}
            {activeSection === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Clinical Course Summary</h3>
                  <button
                    onClick={handleGenerateAI}
                    disabled={isGeneratingAI}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 disabled:opacity-50"
                  >
                    {isGeneratingAI ? 'Generating...' : 'Regenerate AI'}
                  </button>
                </div>

                <textarea
                  value={clinicalSummary}
                  onChange={(e) => setClinicalSummary(e.target.value)}
                  placeholder="Clinical course summary..."
                  className="w-full h-32 p-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-500"
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Terminal Events</label>
                  <textarea
                    value={terminalEvents}
                    onChange={(e) => setTerminalEvents(e.target.value)}
                    placeholder="Describe the terminal events..."
                    className="w-full h-20 p-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-800">Treatment Provided</h3>
                    <button onClick={addTreatment} className="text-xs text-blue-600 font-semibold">+ Add</button>
                  </div>
                  <div className="space-y-2">
                    {treatmentProvided.map((treatment, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={treatment}
                          onChange={(e) => updateTreatment(index, e.target.value)}
                          placeholder="Treatment..."
                          className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
                        />
                        <button onClick={() => removeTreatment(index)} className="p-2 text-red-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Autopsy */}
                <div className="pt-4 border-t">
                  <h3 className="font-bold text-slate-800 mb-2">Autopsy</h3>
                  <select
                    value={autopsyStatus}
                    onChange={(e) => setAutopsyStatus(e.target.value as AutopsyStatus)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm mb-2"
                  >
                    {Object.values(AutopsyStatus).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  {autopsyStatus === AutopsyStatus.Performed && (
                    <textarea
                      value={autopsyFindings}
                      onChange={(e) => setAutopsyFindings(e.target.value)}
                      placeholder="Autopsy findings..."
                      className="w-full h-16 p-3 border border-slate-200 rounded-xl text-sm resize-none"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Section 5: NHM Classification */}
            {activeSection === 4 && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800">NHM Child Death Review Classification</h3>

                {isNeonatal && perinatalDeathType && (
                  <div className="p-3 bg-sky-50 rounded-xl border border-sky-200">
                    <label className="block text-xs font-semibold text-sky-800 mb-2">Perinatal Death Type</label>
                    <select
                      value={perinatalDeathType}
                      onChange={(e) => setPerinatalDeathType(e.target.value as PerinatalDeathType)}
                      className="w-full px-3 py-2.5 border border-sky-200 rounded-xl text-sm"
                    >
                      {Object.values(PerinatalDeathType).map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <label className="block text-xs font-semibold text-emerald-800 mb-2">NHM Death Category</label>
                  <select
                    value={nhmDeathCategory}
                    onChange={(e) => setNhmDeathCategory(e.target.value as NHMDeathCategory)}
                    className="w-full px-3 py-2.5 border border-emerald-200 rounded-xl text-sm"
                  >
                    {Object.values(NHMDeathCategory).map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                {/* NHM Notifications */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <h4 className="text-sm font-bold text-amber-800 mb-3">NHM Notifications</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nhmCDRFormCompleted}
                        onChange={(e) => setNhmCDRFormCompleted(e.target.checked)}
                        className="w-5 h-5 rounded border-amber-300"
                      />
                      <span className="text-sm text-amber-800">Child Death Review Form Completed</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deathNotifiedToASHA}
                        onChange={(e) => setDeathNotifiedToASHA(e.target.checked)}
                        className="w-5 h-5 rounded border-amber-300"
                      />
                      <span className="text-sm text-amber-800">Death Notified to ASHA</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deathNotifiedToCMO}
                        onChange={(e) => setDeathNotifiedToCMO(e.target.checked)}
                        className="w-5 h-5 rounded border-amber-300"
                      />
                      <span className="text-sm text-amber-800">Death Notified to CMO</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Section 6: Certification */}
            {activeSection === 5 && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800">Certification Details</h3>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-sm text-slate-600 italic mb-4">
                    I hereby certify that I attended the deceased during the last illness and that to the best of my knowledge and belief the cause of death and the particulars stated above are correct.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Certifying Physician Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          list="certifying-doctors-list"
                          value={certifyingPhysicianName}
                          onChange={(e) => setCertifyingPhysicianName(e.target.value)}
                          placeholder={doctors.length > 0 ? "Select or type physician name" : "Enter physician's full name"}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoComplete="off"
                        />
                        {doctors.length > 0 && (
                          <datalist id="certifying-doctors-list">
                            {doctors.map((doc, idx) => (
                              <option key={idx} value={doc} />
                            ))}
                          </datalist>
                        )}
                      </div>
                      {doctors.length > 0 && (
                        <p className="text-xs text-slate-400 mt-1">Type to search or select from suggestions</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Designation <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={certifyingPhysicianDesignation}
                        onChange={(e) => setCertifyingPhysicianDesignation(e.target.value)}
                        placeholder="e.g., Medical Officer, Pediatrician, Neonatologist"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Medical Registration No. <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={certifyingPhysicianRegNo}
                        onChange={(e) => setCertifyingPhysicianRegNo(e.target.value)}
                        placeholder="Enter medical council registration number"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">Required for legal validity of the certificate</p>
                    </div>
                  </div>
                </div>

                {/* Death Summary Given To */}
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <h4 className="text-sm font-bold text-blue-800 mb-3">Death Summary Given To</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-blue-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={deathSummaryGivenTo}
                        onChange={(e) => setDeathSummaryGivenTo(e.target.value)}
                        placeholder="Name of recipient"
                        className="w-full px-3 py-2.5 border border-blue-200 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-blue-700 mb-1">Relation to Deceased</label>
                      <input
                        type="text"
                        value={relationToDeceased}
                        onChange={(e) => setRelationToDeceased(e.target.value)}
                        placeholder="e.g., Father, Mother, Guardian"
                        className="w-full px-3 py-2.5 border border-blue-200 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-slate-200 p-3 pb-6 sm:pb-3 bg-white" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            {/* Show AI generating state - no actions available */}
            {isGeneratingAI && (
              <div className="flex items-center justify-center gap-3 py-4">
                <div className="w-6 h-6 border-3 border-slate-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-slate-600 font-medium">Generating death certificate with AI...</span>
              </div>
            )}

            {/* Show actions only after AI generation is complete */}
            {!isGeneratingAI && aiGenerationComplete && (
              <>
                {isSaved && (
                  <div className="mb-2 flex items-center justify-center gap-1.5 text-green-600 text-xs">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Saved - Death Certificate Ready</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handlePreviewPDF}
                    className="flex-1 py-3 px-4 border-2 border-slate-200 text-slate-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Preview
                  </button>

                  {!isSaved ? (
                    <button
                      onClick={handleSaveCertificate}
                      disabled={isSaving}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save Certificate'}
                    </button>
                  ) : (
                    <button
                      onClick={handleGeneratePDF}
                      disabled={isGeneratingPDF}
                      className="flex-1 py-3 px-4 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-slate-700 to-slate-800 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download MCCD
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Show error if max deletions reached and no certificate */}
            {!isGeneratingAI && !aiGenerationComplete && maxDeletionsReached && !hasSavedCertificate && (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-red-700 font-semibold">Certificate Generation Blocked</p>
                <p className="text-sm text-slate-500 mt-1">Maximum 2 deletions reached. No new certificates can be created.</p>
              </div>
            )}

            {/* Show manual generation option for deceased patients without saved certificate */}
            {!isGeneratingAI && !aiGenerationComplete && !maxDeletionsReached && !hasSavedCertificate && patient.outcome === 'Deceased' && (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-amber-700 font-semibold">No Saved Certificate Found</p>
                <p className="text-sm text-slate-500 mt-1 mb-3">
                  {deletionCount > 0
                    ? `Previous certificate was deleted. ${2 - deletionCount} deletion(s) remaining.`
                    : 'Click below to generate a new death certificate.'}
                </p>
                <button
                  onClick={handleGenerateAI}
                  className="px-6 py-2 bg-slate-700 text-white rounded-lg font-semibold text-sm hover:bg-slate-800 transition-colors"
                >
                  Generate Death Certificate
                </button>
              </div>
            )}

            {/* Show waiting state if AI hasn't started yet (for new deceased marking) */}
            {!isGeneratingAI && !aiGenerationComplete && !maxDeletionsReached && patient.outcome !== 'Deceased' && (
              <div className="text-center py-4 text-slate-500 text-sm">
                Preparing death certificate...
              </div>
            )}
          </div>
        </motion.div>

        {/* PDF Preview */}
        <AnimatePresence>
          {previewUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60] flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-slate-900">
                <h3 className="font-semibold text-white">MCCD Preview</h3>
                <button
                  onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <iframe src={previewUrl} className="flex-1 w-full bg-white" title="MCCD Preview" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4"
              onClick={(e) => e.target === e.currentTarget && setShowDeleteModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">Delete Death Certificate</h3>
                    <p className="text-sm text-red-600 font-medium">This action cannot be undone</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-800">
                    <strong>Warning:</strong> You have <strong>{2 - deletionCount}</strong> deletion(s) remaining.
                    {deletionCount === 1 && ' This will be your FINAL deletion - no new certificates can be created after this.'}
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Reason for Deletion <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={deletionReason}
                    onChange={(e) => setDeletionReason(e.target.value)}
                    placeholder="Enter the reason for deleting this certificate (mandatory for audit trail)..."
                    className="w-full h-24 p-3 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">This reason will be recorded for audit purposes.</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowDeleteModal(false); setDeletionReason(''); }}
                    className="flex-1 py-3 px-4 border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteCertificate}
                    disabled={isDeleting || !deletionReason.trim()}
                    className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Certificate'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default DeathCertificateModal;
