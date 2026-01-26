import React, { useState, useEffect } from 'react';
import { Patient, Unit, AgeUnit, UserRole, ProgressNote, AdmissionType, Category, PlaceOfDelivery, ModeOfTransport, ModeOfDelivery, AdmissionIndication, BloodGroup, MaternalRiskFactor, MaternalHistory } from '../types';
import { XIcon, PlusIcon, TrashIcon } from './common/Icons';
import ReferralForm from './ReferralForm';
import AddressInput, { AddressData } from './forms/AddressInput';
import LoadingOverlay from './LoadingOverlay';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { calculateAgeFromBirthDate, calculateAgeAtDate, calculateEDDFromLMP, calculateGestationalAge, getGestationalAgeCategoryColor, formatDateForDisplay } from '../utils/ageCalculator';
import { interpretDeathDiagnosis } from '../services/openaiService';
import { generateNTID, isValidNTID } from '../utils/ntidGenerator';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface PatientFormProps {
  patientToEdit?: Patient | null;
  onSave: (patient: Patient) => void;
  onClose: () => void;
  userRole: UserRole;
  defaultUnit?: Unit;
  institutionId: string;
  institutionName: string;
  userEmail: string;
  userName?: string;
  availableUnits?: Unit[];
  allPatients?: Patient[]; // For NTID lookup
}

const PatientForm: React.FC<PatientFormProps> = ({
  patientToEdit,
  onSave,
  onClose,
  userRole,
  defaultUnit,
  institutionId,
  institutionName,
  userEmail,
  userName,
  availableUnits,
  allPatients = []
}) => {
  const isNurse = userRole === UserRole.Nurse;
  const isDoctor = userRole === UserRole.Doctor || userRole === UserRole.Admin;

  const [showReferralForm, setShowReferralForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // NTID Search for readmission
  const [ntidSearch, setNtidSearch] = useState('');
  const [ntidSearchResult, setNtidSearchResult] = useState<Patient | null>(null);
  const [ntidSearching, setNtidSearching] = useState(false);
  const [ntidError, setNtidError] = useState('');

  // Create default patient object
  const defaultPatient: Patient = {
    id: '',
    ntid: generateNTID(institutionName), // Auto-generate NTID for new patients
    name: '',
    age: 0,
    ageUnit: AgeUnit.Days,
    gender: '' as any, // User must select - no default
    admissionDate: new Date().toISOString(),
    admissionDateTime: new Date().toISOString(), // Default to current time
    diagnosis: '',
    progressNotes: [], // Start with empty array - doctor will add comprehensive notes
    outcome: 'In Progress',
    unit: defaultUnit || Unit.NICU,
    admissionType: undefined as any, // User must select - no default
    category: undefined as any, // User must select - no default
    institutionId,
    institutionName,
    isDraft: isNurse,
    createdBy: userRole,
    createdByEmail: userEmail,
    createdByName: userName || userEmail,
    createdAt: new Date().toISOString()
  };

  // Merge patientToEdit with defaultPatient to ensure all fields exist
  const [patient, setPatient] = useState<Patient>(
    patientToEdit ? {
      ...defaultPatient,
      ...patientToEdit,
      progressNotes: patientToEdit.progressNotes || [] // Ensure progressNotes is always an array
    } : defaultPatient
  );

  const [newNote, setNewNote] = useState('');
  const [showProgressNoteForm, setShowProgressNoteForm] = useState(false);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);

  // Admission Indications
  const [admissionIndications, setAdmissionIndications] = useState<AdmissionIndication[]>([]);
  const [loadingIndications, setLoadingIndications] = useState(false);

  // Section expansion states
  const [expandedSections, setExpandedSections] = useState({
    demographics: true,
    admissionDetails: true, // Now includes Birth Details
    maternalHistory: false, // Maternal History section
    dischargeDetails: false,
    readmission: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    if (patientToEdit) {
      setPatient({
        ...defaultPatient,
        ...patientToEdit,
        progressNotes: patientToEdit.progressNotes || [] // Ensure progressNotes is always an array
      });
    }
  }, [patientToEdit]);

  // Update unit if defaultUnit changes (for new patients)
  useEffect(() => {
    if (!patientToEdit && defaultUnit && patient.unit !== defaultUnit) {
      console.log('🔄 Switching form unit to:', defaultUnit);
      setPatient(prev => ({ ...prev, unit: defaultUnit }));
    }
  }, [defaultUnit, patientToEdit]);


  // Fetch admission indications based on unit type
  useEffect(() => {
    const fetchAdmissionIndications = async () => {
      setLoadingIndications(true);
      try {
        const indicationsRef = collection(db, 'admissionIndications');

        // Try query with array-contains first
        try {
          const q = query(
            indicationsRef,
            where('isActive', '==', true),
            where('applicableUnits', 'array-contains', patient.unit),
            orderBy('order', 'asc')
          );
          const snapshot = await getDocs(q);
          const indications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdmissionIndication));
          console.log('✅ Fetched', indications.length, 'indications for', patient.unit);
          setAdmissionIndications(indications);
        } catch (indexError: any) {
          console.warn('⚠️ Array-contains query failed, using fallback. Error:', indexError.message);

          // Fallback: Fetch all indications and filter client-side to avoid index issues
          const fallbackQuery = query(
            indicationsRef,
            orderBy('order', 'asc')
          );
          const snapshot = await getDocs(fallbackQuery);
          const allIndications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdmissionIndication));

          // Filter client-side for the current unit and active status
          const filtered = allIndications.filter(ind => ind.isActive && ind.applicableUnits?.includes(patient.unit));
          console.log('✅ Fallback: Fetched', filtered.length, 'indications for', patient.unit, 'from', allIndications.length, 'total');
          setAdmissionIndications(filtered);
        }
      } catch (error: any) {
        console.error('❌ Error fetching admission indications:', error);
        console.error('Error details:', error.message);

        // If collection doesn't exist or other error, show empty
        setAdmissionIndications([]);
      } finally {
        setLoadingIndications(false);
      }
    };

    fetchAdmissionIndications();
  }, [patient.unit]);

  // Auto-update diagnosis when customIndication changes
  useEffect(() => {
    if ((patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && !isNurse) {
      const diagnosisParts = [...(patient.indicationsForAdmission || [])];
      if (patient.customIndication && patient.customIndication.trim()) {
        diagnosisParts.push(patient.customIndication.trim());
      }
      const newDiagnosis = diagnosisParts.join(', ');

      // Only update if diagnosis has changed to avoid infinite loop
      if (newDiagnosis !== patient.diagnosis) {
        setPatient(prev => ({ ...prev, diagnosis: newDiagnosis }));
      }
    }
  }, [patient.customIndication, patient.indicationsForAdmission, patient.unit, isNurse]);

  // Auto-calculate EDD from LMP and Gestational Age from LMP + DOB
  useEffect(() => {
    const lmp = patient.maternalHistory?.lmp;
    const cycleLength = patient.maternalHistory?.menstrualCycleLength || 28;
    const dob = patient.dateOfBirth;

    if (lmp) {
      // Calculate EDD from LMP
      const calculatedEDD = calculateEDDFromLMP(lmp, cycleLength);
      const currentEDD = patient.maternalHistory?.edd;

      // Only update EDD if it changed and wasn't manually set differently
      if (calculatedEDD !== currentEDD) {
        setPatient(prev => ({
          ...prev,
          maternalHistory: {
            ...prev.maternalHistory,
            edd: calculatedEDD
          }
        }));
      }

      // Calculate Gestational Age at Birth if DOB is available
      if (dob) {
        const ga = calculateGestationalAge(lmp, dob);
        // Only update if changed
        if (ga.weeks !== patient.gestationalAgeWeeks || ga.days !== patient.gestationalAgeDays) {
          setPatient(prev => ({
            ...prev,
            gestationalAgeWeeks: ga.weeks,
            gestationalAgeDays: ga.days,
            gestationalAgeCategory: ga.category
          }));
          console.log('✅ Auto-calculated gestational age:', ga.displayString, '-', ga.category);
        }
      }
    }
  }, [patient.maternalHistory?.lmp, patient.maternalHistory?.menstrualCycleLength, patient.dateOfBirth]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPatient(prev => {
      let processedValue: any = value;

      // Handle number fields
      if (['age', 'birthWeight', 'weightOnAdmission', 'weightOnDischarge', 'ageOnAdmission', 'ageOnDischarge'].includes(name)) {
        processedValue = value === '' ? undefined : parseFloat(value);
      }

      // Handle datetime fields - convert to ISO string
      if (['dateOfBirth', 'admissionDateTime', 'dischargeDateTime'].includes(name)) {
        processedValue = value ? new Date(value).toISOString() : '';
      }

      const updated = { ...prev, [name]: processedValue };

      // Auto-calculate age from date of birth
      if (name === 'dateOfBirth' && processedValue) {
        const calculatedAge = calculateAgeFromBirthDate(processedValue);
        updated.age = calculatedAge.age;
        updated.ageUnit = calculatedAge.ageUnit;
        console.log('✅ Auto-calculated age:', calculatedAge.age, calculatedAge.ageUnit);
      }

      // Auto-fill Baby's Name from Mother's Name
      if (name === 'motherName' && typeof processedValue === 'string') {
        if (processedValue.trim()) {
          updated.name = `Baby of ${processedValue}`;
        } else {
          updated.name = '';
        }
      }

      // Also sync: If baby's name is edited manually with "Baby of ...", extract mother's name
      if (name === 'name' && typeof processedValue === 'string') {
        const babyOfPrefix = 'Baby of ';
        if (processedValue.toLowerCase().startsWith(babyOfPrefix.toLowerCase())) {
          const extractedMotherName = processedValue.slice(babyOfPrefix.length);
          updated.motherName = extractedMotherName;
        }
      }

      // Auto-calculate age on admission from birth date and admission datetime
      if (name === 'admissionDateTime' && processedValue && prev.dateOfBirth) {
        const ageAtAdmission = calculateAgeAtDate(prev.dateOfBirth, processedValue);
        updated.ageOnAdmission = ageAtAdmission.age;
        updated.ageOnAdmissionUnit = ageAtAdmission.ageUnit;
        console.log('✅ Auto-calculated age on admission:', ageAtAdmission.age, ageAtAdmission.ageUnit);
      }

      // Auto-calculate age on discharge from birth date and discharge datetime
      if (name === 'dischargeDateTime' && processedValue && prev.dateOfBirth) {
        const ageAtDischarge = calculateAgeAtDate(prev.dateOfBirth, processedValue);
        updated.ageOnDischarge = ageAtDischarge.age;
        updated.ageOnDischargeUnit = ageAtDischarge.ageUnit;
        console.log('✅ Auto-calculated age on discharge:', ageAtDischarge.age, ageAtDischarge.ageUnit);
      }

      // Handle Step Down logic for both NICU and PICU
      if (name === 'outcome' && value === 'Step Down') {
        updated.stepDownDate = new Date().toISOString();
        updated.stepDownFrom = prev.unit; // Can be NICU or PICU
        updated.isStepDown = true;
        updated.outcome = 'Step Down';
      }

      // Sync admissionDateTime with admissionDate for backward compatibility
      if (name === 'admissionDateTime') {
        updated.admissionDate = processedValue;
      }

      // Sync dischargeDateTime with releaseDate for backward compatibility
      if (name === 'dischargeDateTime') {
        updated.releaseDate = processedValue;
      }

      // Auto-fill place of delivery for Inborn admissions
      if (name === 'admissionType' && value === AdmissionType.Inborn) {
        updated.placeOfDelivery = PlaceOfDelivery.GovernmentHospital;
        updated.placeOfDeliveryName = institutionName;
        // Clear referring hospital/district for inborn
        updated.referringHospital = '';
        updated.referringDistrict = '';
      }

      return updated;
    });
  };

  const handleDateChange = (date: Date | null, fieldName: string) => {
    if (!date) return;
    const isoString = date.toISOString();

    setPatient(prev => {
      let updated = { ...prev, [fieldName]: isoString };

      // Auto-calculate age from date of birth
      if (fieldName === 'dateOfBirth') {
        const calculatedAge = calculateAgeFromBirthDate(isoString);
        updated.age = calculatedAge.age;
        updated.ageUnit = calculatedAge.ageUnit;

        // Recalculate other derived ages if they depend on DOB
        if (updated.admissionDateTime) {
          const ageAtAdmission = calculateAgeAtDate(isoString, updated.admissionDateTime);
          updated.ageOnAdmission = ageAtAdmission.age;
          updated.ageOnAdmissionUnit = ageAtAdmission.ageUnit;
        }
        if (updated.dischargeDateTime) {
          const ageAtDischarge = calculateAgeAtDate(isoString, updated.dischargeDateTime);
          updated.ageOnDischarge = ageAtDischarge.age;
          updated.ageOnDischargeUnit = ageAtDischarge.ageUnit;
        }
      }

      // Auto-calculate age on admission
      if (fieldName === 'admissionDateTime' && prev.dateOfBirth) {
        const ageAtAdmission = calculateAgeAtDate(prev.dateOfBirth, isoString);
        updated.ageOnAdmission = ageAtAdmission.age;
        updated.ageOnAdmissionUnit = ageAtAdmission.ageUnit;

        // Sync backward compatibility
        updated.admissionDate = isoString;
      }

      // Auto-calculate age on discharge
      if (fieldName === 'dischargeDateTime' && prev.dateOfBirth) {
        const ageAtDischarge = calculateAgeAtDate(prev.dateOfBirth, isoString);
        updated.ageOnDischarge = ageAtDischarge.age;
        updated.ageOnDischargeUnit = ageAtDischarge.ageUnit;

        // Sync backward compatibility
        updated.releaseDate = isoString;
      }

      return updated;
    });
  };

  const handleNoteChange = (index: number, value: string) => {
    const updatedNotes = [...patient.progressNotes];
    updatedNotes[index].note = value;
    setPatient(prev => ({ ...prev, progressNotes: updatedNotes }));
  };

  const handleIndicationToggle = (indicationName: string) => {
    setPatient(prev => {
      const currentIndications = prev.indicationsForAdmission || [];
      const isSelected = currentIndications.includes(indicationName);

      let updatedIndications: string[];
      if (isSelected) {
        // Remove indication
        updatedIndications = currentIndications.filter(i => i !== indicationName);
      } else {
        // Add indication
        updatedIndications = [...currentIndications, indicationName];
      }

      // Auto-populate diagnosis from selected indications + custom indication
      const diagnosisParts = [...updatedIndications];
      if (prev.customIndication && prev.customIndication.trim()) {
        diagnosisParts.push(prev.customIndication.trim());
      }
      const diagnosis = diagnosisParts.join(', ');

      return {
        ...prev,
        indicationsForAdmission: updatedIndications,
        diagnosis: diagnosis // Auto-populate diagnosis from indications + custom
      };
    });
  };

  // Maternal History handlers
  const handleMaternalHistoryChange = (field: keyof MaternalHistory, value: any) => {
    setPatient(prev => ({
      ...prev,
      maternalHistory: {
        ...prev.maternalHistory,
        [field]: value
      }
    }));
  };

  const handleRiskFactorToggle = (riskFactor: MaternalRiskFactor) => {
    setPatient(prev => {
      const currentFactors = prev.maternalHistory?.riskFactors || [];
      const isSelected = currentFactors.includes(riskFactor);

      const updatedFactors = isSelected
        ? currentFactors.filter(f => f !== riskFactor)
        : [...currentFactors, riskFactor];

      return {
        ...prev,
        maternalHistory: {
          ...prev.maternalHistory,
          riskFactors: updatedFactors
        }
      };
    });
  };

  const handleSaveProgressNote = (note: ProgressNote) => {
    console.log('🚀 ========================================');
    console.log('🚀 handleSaveProgressNote CALLED');
    console.log('🚀 Received note:', JSON.stringify(note, null, 2));
    console.log('🚀 editingNoteIndex:', editingNoteIndex);
    console.log('🚀 Current patient.progressNotes length:', patient.progressNotes.length);
    console.log('🚀 Current patient.progressNotes:', JSON.stringify(patient.progressNotes, null, 2));

    if (editingNoteIndex !== null) {
      // Update existing note
      console.log('🚀 MODE: Updating existing note at index', editingNoteIndex);
      const updatedNotes = [...patient.progressNotes];
      updatedNotes[editingNoteIndex] = note;
      console.log('🚀 Updated notes array:', JSON.stringify(updatedNotes, null, 2));
      setPatient(prev => ({ ...prev, progressNotes: updatedNotes }));
    } else {
      // Add new note
      console.log('🚀 MODE: Adding new note');
      console.log('🚀 Adding new note to existing:', JSON.stringify(patient.progressNotes, null, 2));
      setPatient(prev => {
        const newNotes = [...prev.progressNotes, note];
        console.log('🚀 New notes array after add (length:', newNotes.length, '):', JSON.stringify(newNotes, null, 2));
        return {
          ...prev,
          progressNotes: newNotes
        };
      });
    }

    console.log('🚀 Setting showProgressNoteForm to FALSE');
    setShowProgressNoteForm(false);
    console.log('🚀 Setting editingNoteIndex to NULL');
    setEditingNoteIndex(null);
    console.log('🚀 handleSaveProgressNote COMPLETED');
    console.log('🚀 ========================================');
  };

  const handleAddNewProgressNote = () => {
    setEditingNoteIndex(null);
    setShowProgressNoteForm(true);
  };

  const handleEditNote = (index: number) => {
    setEditingNoteIndex(index);
    setShowProgressNoteForm(true);
  };

  const addNote = () => {
    setPatient(prev => ({
      ...prev,
      progressNotes: [...prev.progressNotes, { date: new Date().toISOString(), note: '' }]
    }));
  };

  const removeNote = (index: number) => {
    if (patient.progressNotes.length > 1) {
      const updatedNotes = patient.progressNotes.filter((_, i) => i !== index);
      setPatient(prev => ({ ...prev, progressNotes: updatedNotes }));
    }
  }

  const handleAddressChange = (address: AddressData) => {
    setPatient(prev => ({
      ...prev,
      address: address.address,
      village: address.village,
      postOffice: address.postOffice,
      pinCode: address.pinCode,
      district: address.district,
      state: address.state
    }));
  };

  const handleSubmit = async (e: React.FormEvent, saveAsDraft: boolean = false) => {
    console.log('💾 ========================================');
    console.log('💾 PatientForm handleSubmit CALLED');
    console.log('💾 Event type:', e.type);
    console.log('💾 saveAsDraft:', saveAsDraft);
    e.preventDefault();
    console.log('💾 preventDefault called on form submission');

    // Show loading overlay
    setIsSaving(true);
    setSaveSuccess(false);

    // Give user visual feedback
    await new Promise(resolve => setTimeout(resolve, 500));

    const updatedPatient = {
      ...patient,
      id: patient.id || Date.now().toString(),
      // Generate NTID for new patients only
      ntid: patient.ntid || generateNTID(institutionName),
      isDraft: saveAsDraft,
      lastUpdatedBy: userRole,
      lastUpdatedByEmail: userEmail,
      lastUpdatedByName: userName || userEmail,
      lastEditedAt: new Date().toISOString(),
      institutionId,
      institutionName
    };

    // AI Interpretation for Death Diagnosis
    if (updatedPatient.outcome === 'Deceased' && updatedPatient.diagnosisAtDeath && !updatedPatient.aiInterpretedDeathDiagnosis) {
      console.log('🤖 Generating AI-interpreted death diagnosis...');
      try {
        const aiInterpretation = await interpretDeathDiagnosis(
          updatedPatient.diagnosisAtDeath,
          updatedPatient.age,
          updatedPatient.ageUnit,
          updatedPatient.unit
        );
        updatedPatient.aiInterpretedDeathDiagnosis = aiInterpretation;
        console.log('✅ AI interpretation generated:', aiInterpretation);
      } catch (error) {
        console.error('❌ Error generating AI interpretation:', error);
        // Continue with save even if AI interpretation fails
      }
    }

    console.log('💾 updatedPatient.progressNotes (length:', updatedPatient.progressNotes.length, '):', JSON.stringify(updatedPatient.progressNotes, null, 2));
    console.log('💾 Full patient object keys:', Object.keys(updatedPatient));
    console.log('💾 About to call onSave with updatedPatient');

    try {
      await onSave(updatedPatient);
      console.log('💾 onSave completed');

      // Show success message
      setSaveSuccess(true);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Close after success
      setIsSaving(false);
      setSaveSuccess(false);
    } catch (error) {
      console.error('❌ Error saving patient:', error);
      setIsSaving(false);
      setSaveSuccess(false);
    }

    console.log('💾 ========================================');
  };

  const handleSaveAsDraft = (e: React.FormEvent) => {
    handleSubmit(e, true);
  };

  // NTID Search for readmission - fill form with previous patient data
  const handleNtidSearch = async () => {
    if (!ntidSearch.trim()) {
      setNtidError('Please enter an NTID');
      return;
    }

    setNtidSearching(true);
    setNtidError('');
    setNtidSearchResult(null);

    try {
      // Search in local patients first
      const foundPatient = allPatients.find(p => p.ntid?.toUpperCase() === ntidSearch.toUpperCase().trim());

      if (foundPatient) {
        setNtidSearchResult(foundPatient);
        // Calculate current age from date of birth
        const calculatedAge = foundPatient.dateOfBirth
          ? calculateAgeFromBirthDate(foundPatient.dateOfBirth)
          : { age: foundPatient.age || 0, ageUnit: foundPatient.ageUnit || AgeUnit.Days };
        // Auto-fill form with previous patient data (birth history, demographics)
        setPatient(prev => ({
          ...prev,
          // Keep new admission details
          id: '',
          ntid: foundPatient.ntid, // Keep same NTID for the child
          admissionDate: new Date().toISOString(),
          admissionDateTime: new Date().toISOString(),
          outcome: 'In Progress',
          progressNotes: [],
          diagnosis: '',
          indicationsForAdmission: [],
          customIndication: '',
          // Copy birth history and demographics
          name: foundPatient.name,
          motherName: foundPatient.motherName,
          fatherName: foundPatient.fatherName,
          gender: foundPatient.gender,
          dateOfBirth: foundPatient.dateOfBirth,
          birthWeight: foundPatient.birthWeight,
          // Set calculated current age
          age: calculatedAge.age,
          ageUnit: calculatedAge.ageUnit,
          modeOfDelivery: foundPatient.modeOfDelivery,
          placeOfDelivery: foundPatient.placeOfDelivery,
          placeOfDeliveryName: foundPatient.placeOfDeliveryName,
          // Copy address
          address: foundPatient.address,
          village: foundPatient.village,
          postOffice: foundPatient.postOffice,
          pinCode: foundPatient.pinCode,
          district: foundPatient.district,
          state: foundPatient.state,
          // Copy contacts
          contactNo1: foundPatient.contactNo1,
          contactRelation1: foundPatient.contactRelation1,
          contactNo2: foundPatient.contactNo2,
          contactRelation2: foundPatient.contactRelation2,
          // Copy identifiers
          mctsNo: foundPatient.mctsNo,
          category: foundPatient.category,
        }));
        setNtidError('');
      } else {
        // Try Firebase search
        const patientsRef = collection(db, 'patients');
        const q = query(patientsRef, where('ntid', '==', ntidSearch.toUpperCase().trim()));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const foundDoc = snapshot.docs[0];
          const foundData = { id: foundDoc.id, ...foundDoc.data() } as Patient;
          setNtidSearchResult(foundData);
          // Calculate current age from date of birth
          const calculatedAge = foundData.dateOfBirth
            ? calculateAgeFromBirthDate(foundData.dateOfBirth)
            : { age: foundData.age || 0, ageUnit: foundData.ageUnit || AgeUnit.Days };
          // Auto-fill form (same as above)
          setPatient(prev => ({
            ...prev,
            id: '',
            ntid: foundData.ntid,
            admissionDate: new Date().toISOString(),
            admissionDateTime: new Date().toISOString(),
            outcome: 'In Progress',
            progressNotes: [],
            diagnosis: '',
            indicationsForAdmission: [],
            customIndication: '',
            name: foundData.name,
            motherName: foundData.motherName,
            fatherName: foundData.fatherName,
            gender: foundData.gender,
            dateOfBirth: foundData.dateOfBirth,
            birthWeight: foundData.birthWeight,
            // Set calculated current age
            age: calculatedAge.age,
            ageUnit: calculatedAge.ageUnit,
            modeOfDelivery: foundData.modeOfDelivery,
            placeOfDelivery: foundData.placeOfDelivery,
            placeOfDeliveryName: foundData.placeOfDeliveryName,
            address: foundData.address,
            village: foundData.village,
            postOffice: foundData.postOffice,
            pinCode: foundData.pinCode,
            district: foundData.district,
            state: foundData.state,
            contactNo1: foundData.contactNo1,
            contactRelation1: foundData.contactRelation1,
            contactNo2: foundData.contactNo2,
            contactRelation2: foundData.contactRelation2,
            mctsNo: foundData.mctsNo,
            category: foundData.category,
          }));
        } else {
          setNtidError('No patient found with this NTID');
        }
      }
    } catch (error) {
      console.error('Error searching NTID:', error);
      setNtidError('Error searching for patient');
    } finally {
      setNtidSearching(false);
    }
  };

  const handleSaveComplete = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate indications for NICU/SNCU (indications auto-populate diagnosis)
    if ((patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && !isNurse) {
      if (!patient.indicationsForAdmission || patient.indicationsForAdmission.length === 0) {
        alert('Please select at least one indication for admission');
        return;
      }
      // Diagnosis will be auto-populated from indications
    } else {
      // For other units, diagnosis is required and manual
      if (!isNurse && !patient.diagnosis) {
        alert('Please enter a primary diagnosis');
        return;
      }
    }

    handleSubmit(e, false);
  };

  const canEditSensitiveFields = userRole === UserRole.Admin || userRole === UserRole.Doctor;

  return (
    <div className="w-full min-h-screen bg-slate-100">
      <div className="w-full mx-auto px-2 py-3 sm:px-4 sm:py-4 lg:px-8 lg:py-6 lg:max-w-7xl">
        {/* Header */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border-2 border-blue-300 p-3 sm:p-6 mb-3 sm:mb-6 sticky top-0 z-10">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-2">{patientToEdit ? 'Edit Patient Record' : 'Add New Patient'}</h1>
              {isNurse && <p className="text-sm text-blue-600">Enter basic patient information. Doctor will complete the diagnosis.</p>}
              {patient.isDraft && isDoctor && <p className="text-sm text-amber-600">⚠️ Draft record - Please complete diagnosis and notes</p>}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2 shadow-md"
            >
              <XIcon className="w-5 h-5" />
              Close
            </button>
          </div>
        </div>

        {/* NTID Search for Readmission - Only show for new patients */}
        {!patientToEdit && (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg border-2 border-blue-300 mb-3 sm:mb-6 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('readmission')}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-bold text-blue-900">Readmission Lookup (NTID)</h3>
              </div>
              <svg className={`w-5 h-5 text-blue-600 transition-transform ${expandedSections.readmission ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedSections.readmission && (
              <div className="p-3 sm:p-4 border-t-2 border-blue-100">
                <p className="text-sm text-gray-600 mb-3">
                  For readmissions, enter the child's NTID to auto-fill previous details (birth history, address, contacts).
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={ntidSearch}
                      onChange={(e) => {
                        setNtidSearch(e.target.value.toUpperCase());
                        setNtidError('');
                      }}
                      placeholder="Enter NTID (e.g., GMC2025010001)"
                      className="w-full px-4 py-2 bg-white border-2 border-blue-600 rounded-lg text-black font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    {ntidSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleNtidSearch}
                    disabled={ntidSearching || !ntidSearch.trim()}
                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Search
                  </button>
                </div>
                {ntidError && (
                  <p className="text-sm text-red-600 mt-2 font-medium">{ntidError}</p>
                )}
                {ntidSearchResult && (
                  <div className="mt-3 p-3 bg-green-50 border-2 border-green-400 rounded-lg">
                    <p className="text-green-800 font-bold flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Patient Found! Form auto-filled.
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      <strong>{ntidSearchResult.name}</strong> - Last admission: {new Date(ntidSearchResult.admissionDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Birth history, address, and contact details have been copied. Please update admission details for this visit.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSaveComplete} className="space-y-3 sm:space-y-6">
          <div className="space-y-3 sm:space-y-6 flex-grow">

            {/* Admission & Birth Details Section */}
            <div className="bg-white rounded-lg sm:rounded-xl border-2 border-blue-300 overflow-hidden shadow-md">
              <button
                type="button"
                onClick={() => toggleSection('admissionDetails')}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="text-lg font-bold text-white">Admission & Birth Details</h3>
                </div>
                <svg className={`w-5 h-5 text-white transition-transform ${expandedSections.admissionDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedSections.admissionDetails && (
                <div className="p-4 space-y-6">
                  {/* 1. Admission Context */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && (
                      <div>
                        <label htmlFor="admissionType" className="block text-sm font-medium text-slate-700 mb-1">
                          Type of Admission <span className="text-red-400">*</span>
                        </label>
                        <select
                          name="admissionType"
                          id="admissionType"
                          value={patient.admissionType || ''}
                          onChange={handleChange}
                          required
                          className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select Admission Type</option>
                          {Object.values(AdmissionType).map(at => <option key={at} value={at}>{at}</option>)}
                        </select>
                        {patient.admissionType === AdmissionType.Inborn && (
                          <p className="text-xs text-green-400 mt-1">
                            ✓ Place of delivery will be set to: {institutionName}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <label htmlFor="admissionDateTime" className="block text-sm font-medium text-slate-700 mb-1">
                        Date and Time of Admission <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        id="admissionDateTime"
                        name="admissionDateTime"
                        value={patient.admissionDateTime ? new Date(patient.admissionDateTime).toISOString().slice(0, 16) : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : null;
                          handleDateChange(date, 'admissionDateTime');
                        }}
                        required
                        className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <hr className="border-slate-700/50" />

                  {/* 2. Birth & Weight Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && (
                      <div>
                        <label htmlFor="dateOfBirth" className="block text-sm font-medium text-slate-700 mb-1">
                          Date and Time of Birth
                        </label>
                        <input
                          type="datetime-local"
                          id="dateOfBirth"
                          name="dateOfBirth"
                          value={patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().slice(0, 16) : ''}
                          onChange={(e) => {
                            const date = e.target.value ? new Date(e.target.value) : null;
                            handleDateChange(date, 'dateOfBirth');
                          }}
                          max={new Date().toISOString().slice(0, 16)}
                          className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                    <div>
                      <label htmlFor="age" className="block text-sm font-medium text-slate-700 mb-1">Current Age <span className="text-red-400">*</span></label>
                      <div className="flex gap-2">
                        <input type="number" name="age" id="age" value={patient.age} onChange={handleChange} required min="0" className="w-2/3 px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                        <select name="ageUnit" id="ageUnit" value={patient.ageUnit} onChange={handleChange} required className="w-1/3 px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm">
                          {Object.values(AgeUnit).map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) ? (
                      <div>
                        <label htmlFor="birthWeight" className="block text-sm font-medium text-slate-700 mb-1">Birth Weight (Kg)</label>
                        <input type="number" name="birthWeight" id="birthWeight" value={patient.birthWeight || ''} onChange={handleChange} step="0.001" min="0" className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 2.500" />
                      </div>
                    ) : <div></div>}
                    <div>
                      <label htmlFor="weightOnAdmission" className="block text-sm font-medium text-slate-700 mb-1">Weight on Admission (Kg)</label>
                      <input type="number" name="weightOnAdmission" id="weightOnAdmission" value={patient.weightOnAdmission || ''} onChange={handleChange} step="0.001" min="0" className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 2.500" />
                    </div>
                  </div>

                  <hr className="border-slate-700/50" />

                  {/* 3. Delivery Details (NICU Only) */}
                  {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="modeOfDelivery" className="block text-sm font-medium text-slate-700 mb-1">Mode of Delivery</label>
                        <select name="modeOfDelivery" id="modeOfDelivery" value={patient.modeOfDelivery || ''} onChange={handleChange} className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <option value="">Select Mode</option>
                          {Object.values(ModeOfDelivery).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="placeOfDelivery" className="block text-sm font-medium text-slate-700 mb-1">
                          Place of Delivery {patient.admissionType === AdmissionType.Inborn && <span className="text-xs text-green-400">(Auto-filled)</span>}
                        </label>
                        <select
                          name="placeOfDelivery"
                          id="placeOfDelivery"
                          value={patient.placeOfDelivery || ''}
                          onChange={handleChange}
                          disabled={patient.admissionType === AdmissionType.Inborn}
                          className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <option value="">Select Place</option>
                          {Object.values(PlaceOfDelivery).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {(patient.placeOfDelivery === PlaceOfDelivery.PrivateHospital || patient.placeOfDelivery === PlaceOfDelivery.GovernmentHospital) && (
                    <div>
                      <label htmlFor="placeOfDeliveryName" className="block text-sm font-medium text-slate-700 mb-1">
                        Hospital Name {patient.admissionType === AdmissionType.Inborn && <span className="text-xs text-green-400">(Auto-filled)</span>}
                      </label>
                      <input
                        type="text"
                        name="placeOfDeliveryName"
                        id="placeOfDeliveryName"
                        value={patient.placeOfDeliveryName || ''}
                        onChange={handleChange}
                        disabled={patient.admissionType === AdmissionType.Inborn}
                        className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="Enter hospital name"
                      />
                    </div>
                  )}


                  {/* 4. Transport & Referral */}
                  {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="modeOfTransport" className="block text-sm font-medium text-slate-700 mb-1">Mode of Transport</label>
                        <select name="modeOfTransport" id="modeOfTransport" value={patient.modeOfTransport || ''} onChange={handleChange} className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <option value="">Select Mode</option>
                          {Object.values(ModeOfTransport).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>

                      {(patient.admissionType === AdmissionType.OutbornHealthFacility || patient.admissionType === AdmissionType.OutbornCommunity) && (
                        <div className="space-y-4 md:col-span-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
                          <div>
                            <label htmlFor="referringHospital" className="block text-sm font-medium text-slate-700 mb-1">Referred From (Hospital/Facility)</label>
                            <input type="text" name="referringHospital" id="referringHospital" value={patient.referringHospital || ''} onChange={handleChange} className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Name of referring hospital or facility" />
                          </div>
                          <div>
                            <label htmlFor="referringDistrict" className="block text-sm font-medium text-slate-700 mb-1">Referring District</label>
                            <input type="text" name="referringDistrict" id="referringDistrict" value={patient.referringDistrict || ''} onChange={handleChange} className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="District name" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Maternal History Section - Only for NICU/SNCU */}
            {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && (
              <div className="bg-white rounded-lg sm:rounded-xl border-2 border-pink-300 overflow-hidden shadow-md">
                <button
                  type="button"
                  onClick={() => toggleSection('maternalHistory')}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <h3 className="text-lg font-bold text-white">Maternal History</h3>
                  </div>
                  <svg className={`w-5 h-5 text-white transition-transform ${expandedSections.maternalHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedSections.maternalHistory && (
                  <div className="p-4 space-y-6">
                    {/* 1. LMP, EDD & Gestational Age - CRITICAL SECTION */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border-2 border-purple-200">
                      <label className="block text-sm font-bold text-purple-700 mb-2">
                        LMP, EDD & Gestational Age
                      </label>
                      <p className="text-xs text-gray-600 mb-4">Last Menstrual Period is used to calculate Expected Date of Delivery and Gestational Age at Birth</p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-bold text-purple-600 mb-1">LMP (Last Menstrual Period)</label>
                          <input
                            type="date"
                            value={patient.maternalHistory?.lmp ? new Date(patient.maternalHistory.lmp).toISOString().split('T')[0] : ''}
                            onChange={(e) => handleMaternalHistoryChange('lmp', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                            max={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 bg-white border-2 border-purple-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-purple-600 mb-1">EDD (Expected Delivery Date)</label>
                          <input
                            type="date"
                            value={patient.maternalHistory?.edd ? new Date(patient.maternalHistory.edd).toISOString().split('T')[0] : ''}
                            onChange={(e) => handleMaternalHistoryChange('edd', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                            className="w-full px-3 py-2 bg-purple-50 border-2 border-purple-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            readOnly={!!patient.maternalHistory?.lmp}
                            title={patient.maternalHistory?.lmp ? 'Auto-calculated from LMP (Naegele\'s Rule: LMP + 280 days)' : 'Enter LMP to auto-calculate'}
                          />
                          {patient.maternalHistory?.lmp && (
                            <p className="text-xs text-purple-500 mt-1">Auto-calculated (LMP + 280 days)</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-purple-600 mb-1">Cycle Length (days)</label>
                          <input
                            type="number"
                            min="21"
                            max="35"
                            value={patient.maternalHistory?.menstrualCycleLength ?? 28}
                            onChange={(e) => handleMaternalHistoryChange('menstrualCycleLength', e.target.value === '' ? 28 : parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-white border-2 border-purple-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="28"
                          />
                          <p className="text-xs text-gray-500 mt-1">Default: 28 days</p>
                        </div>
                      </div>

                      {/* Gestational Age Display */}
                      {patient.maternalHistory?.lmp && patient.dateOfBirth && (
                        <div className={`p-3 rounded-lg border-2 ${getGestationalAgeCategoryColor(patient.gestationalAgeCategory || 'Full Term').bg} ${getGestationalAgeCategoryColor(patient.gestationalAgeCategory || 'Full Term').border}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-gray-600">Gestational Age at Birth</p>
                              <p className={`text-xl font-bold ${getGestationalAgeCategoryColor(patient.gestationalAgeCategory || 'Full Term').text}`}>
                                {patient.gestationalAgeWeeks} weeks {patient.gestationalAgeDays} days
                              </p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold ${getGestationalAgeCategoryColor(patient.gestationalAgeCategory || 'Full Term').bg} ${getGestationalAgeCategoryColor(patient.gestationalAgeCategory || 'Full Term').text} ${getGestationalAgeCategoryColor(patient.gestationalAgeCategory || 'Full Term').border} border`}>
                              {patient.gestationalAgeCategory}
                            </div>
                          </div>
                          {(patient.gestationalAgeWeeks || 0) < 37 && (
                            <p className="text-xs text-red-600 mt-2 font-medium">
                              ⚠️ Preterm Birth - Requires close monitoring and specialized care
                            </p>
                          )}
                        </div>
                      )}
                      {patient.maternalHistory?.lmp && !patient.dateOfBirth && (
                        <p className="text-xs text-amber-600 mt-2">Enter Date of Birth in Birth Details to calculate Gestational Age</p>
                      )}
                    </div>

                    <hr className="border-pink-200" />

                    {/* 2. Obstetric Formula (G_P_A_L) & Maternal Age */}
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-bold text-pink-700 mb-2">
                            Obstetric History (G/P/A/L)
                          </label>
                          <p className="text-xs text-gray-500 mb-3">G: Gravida | P: Para | A: Abortion | L: Living</p>
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">G</label>
                              <input
                                type="number"
                                min="0"
                                value={patient.maternalHistory?.gravida ?? ''}
                                onChange={(e) => handleMaternalHistoryChange('gravida', e.target.value === '' ? undefined : parseInt(e.target.value))}
                                className="w-full px-2 py-2 bg-white border-2 border-pink-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 text-center font-semibold"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">P</label>
                              <input
                                type="number"
                                min="0"
                                value={patient.maternalHistory?.para ?? ''}
                                onChange={(e) => handleMaternalHistoryChange('para', e.target.value === '' ? undefined : parseInt(e.target.value))}
                                className="w-full px-2 py-2 bg-white border-2 border-pink-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 text-center font-semibold"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">A</label>
                              <input
                                type="number"
                                min="0"
                                value={patient.maternalHistory?.abortion ?? ''}
                                onChange={(e) => handleMaternalHistoryChange('abortion', e.target.value === '' ? undefined : parseInt(e.target.value))}
                                className="w-full px-2 py-2 bg-white border-2 border-pink-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 text-center font-semibold"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">L</label>
                              <input
                                type="number"
                                min="0"
                                value={patient.maternalHistory?.living ?? ''}
                                onChange={(e) => handleMaternalHistoryChange('living', e.target.value === '' ? undefined : parseInt(e.target.value))}
                                className="w-full px-2 py-2 bg-white border-2 border-pink-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 text-center font-semibold"
                                placeholder="0"
                              />
                            </div>
                          </div>
                          {patient.maternalHistory?.gravida !== undefined && (
                            <p className="text-sm text-pink-600 mt-2 font-medium">
                              G{patient.maternalHistory.gravida}P{patient.maternalHistory.para || 0}A{patient.maternalHistory.abortion || 0}L{patient.maternalHistory.living || 0}
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-pink-700 mb-1">Maternal Age</label>
                            <p className="text-xs text-gray-500 mb-2">Mother's age (years)</p>
                            <input
                              type="number"
                              min="10"
                              max="60"
                              value={patient.maternalHistory?.maternalAge ?? ''}
                              onChange={(e) => handleMaternalHistoryChange('maternalAge', e.target.value === '' ? undefined : parseInt(e.target.value))}
                              className="w-full px-3 py-2 bg-white border-2 border-pink-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500"
                              placeholder="Age"
                            />
                            {patient.maternalHistory?.maternalAge && (patient.maternalHistory.maternalAge < 18 || patient.maternalHistory.maternalAge >= 35) && (
                              <p className="text-xs text-amber-600 mt-1">⚠️ {patient.maternalHistory.maternalAge < 18 ? 'Teenage pregnancy' : 'Advanced maternal age'}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-pink-700 mb-1">Blood Group</label>
                            <p className="text-xs text-gray-500 mb-2">Rh status</p>
                            <select
                              value={patient.maternalHistory?.bloodGroup || ''}
                              onChange={(e) => handleMaternalHistoryChange('bloodGroup', e.target.value || undefined)}
                              className="w-full px-3 py-2 bg-white border-2 border-pink-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500"
                            >
                              <option value="">Select</option>
                              {Object.values(BloodGroup).map(bg => (
                                <option key={bg} value={bg}>{bg}</option>
                              ))}
                            </select>
                            {patient.maternalHistory?.bloodGroup?.includes('-') && (
                              <p className="text-xs text-red-600 mt-1">⚠️ Rh Negative</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <hr className="border-pink-200" />

                    {/* 3. Antenatal Care & Steroid Coverage */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-pink-700 mb-1">
                          Antenatal Care (ANC)
                        </label>
                        <div className="flex items-center gap-4 mb-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={patient.maternalHistory?.ancReceived || false}
                              onChange={(e) => handleMaternalHistoryChange('ancReceived', e.target.checked)}
                              className="w-5 h-5 text-pink-600 border-2 border-pink-300 rounded focus:ring-pink-500"
                            />
                            <span className="text-sm font-medium text-gray-700">ANC Received</span>
                          </label>
                        </div>
                        {patient.maternalHistory?.ancReceived && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">No. of Visits</label>
                              <input
                                type="number"
                                min="0"
                                max="20"
                                value={patient.maternalHistory?.ancVisits ?? ''}
                                onChange={(e) => handleMaternalHistoryChange('ancVisits', e.target.value === '' ? undefined : parseInt(e.target.value))}
                                className="w-full px-3 py-2 bg-white border-2 border-pink-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500"
                                placeholder="0"
                              />
                              {patient.maternalHistory?.ancVisits !== undefined && patient.maternalHistory.ancVisits < 4 && (
                                <p className="text-xs text-amber-600 mt-1">⚠️ &lt;4 visits</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">ANC Place</label>
                              <input
                                type="text"
                                value={patient.maternalHistory?.ancPlace || ''}
                                onChange={(e) => handleMaternalHistoryChange('ancPlace', e.target.value)}
                                className="w-full px-3 py-2 bg-white border-2 border-pink-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500"
                                placeholder="Hospital/PHC"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Antenatal Steroid Coverage - Critical for preterm */}
                      <div className="bg-blue-50 p-3 rounded-lg border-2 border-blue-200">
                        <label className="block text-sm font-bold text-blue-700 mb-1">
                          Antenatal Steroid Coverage
                        </label>
                        <p className="text-xs text-gray-500 mb-2">Critical for preterm lung maturity</p>
                        <div className="flex items-center gap-4 mb-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={patient.maternalHistory?.antenatalSteroidsGiven || false}
                              onChange={(e) => handleMaternalHistoryChange('antenatalSteroidsGiven', e.target.checked)}
                              className="w-5 h-5 text-blue-600 border-2 border-blue-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Steroids Given</span>
                          </label>
                        </div>
                        {patient.maternalHistory?.antenatalSteroidsGiven && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">No. of Doses</label>
                              <select
                                value={patient.maternalHistory?.steroidDoses ?? ''}
                                onChange={(e) => handleMaternalHistoryChange('steroidDoses', e.target.value === '' ? undefined : parseInt(e.target.value))}
                                className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Select</option>
                                <option value="1">1 dose</option>
                                <option value="2">2 doses (Complete)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Last Dose to Delivery (hrs)</label>
                              <input
                                type="number"
                                min="0"
                                value={patient.maternalHistory?.lastSteroidToDeliveryHours ?? ''}
                                onChange={(e) => handleMaternalHistoryChange('lastSteroidToDeliveryHours', e.target.value === '' ? undefined : parseInt(e.target.value))}
                                className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Hours"
                              />
                            </div>
                          </div>
                        )}
                        {(patient.gestationalAgeWeeks || 0) < 34 && !patient.maternalHistory?.antenatalSteroidsGiven && (
                          <p className="text-xs text-amber-600 mt-2">⚠️ Preterm &lt;34 weeks without steroid coverage</p>
                        )}
                      </div>
                    </div>

                    <hr className="border-pink-200" />

                    {/* 4. Intrapartum Risk Factors */}
                    <div className="bg-orange-50 p-3 rounded-lg border-2 border-orange-200">
                      <label className="block text-sm font-bold text-orange-700 mb-2">
                        Intrapartum Risk Factors
                      </label>
                      <p className="text-xs text-gray-500 mb-3">Risk factors during labor and delivery</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <label className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${patient.maternalHistory?.prolongedRupture ? 'bg-orange-100 border-orange-500' : 'bg-white border-gray-200 hover:border-orange-300'}`}>
                          <input
                            type="checkbox"
                            checked={patient.maternalHistory?.prolongedRupture || false}
                            onChange={(e) => handleMaternalHistoryChange('prolongedRupture', e.target.checked)}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded"
                          />
                          <span className="text-xs font-medium">PROM &gt;18hrs</span>
                        </label>
                        <label className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${patient.maternalHistory?.meconiumStainedLiquor ? 'bg-orange-100 border-orange-500' : 'bg-white border-gray-200 hover:border-orange-300'}`}>
                          <input
                            type="checkbox"
                            checked={patient.maternalHistory?.meconiumStainedLiquor || false}
                            onChange={(e) => handleMaternalHistoryChange('meconiumStainedLiquor', e.target.checked)}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded"
                          />
                          <span className="text-xs font-medium">Meconium Stained</span>
                        </label>
                        <label className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${patient.maternalHistory?.fetalDistress ? 'bg-orange-100 border-orange-500' : 'bg-white border-gray-200 hover:border-orange-300'}`}>
                          <input
                            type="checkbox"
                            checked={patient.maternalHistory?.fetalDistress || false}
                            onChange={(e) => handleMaternalHistoryChange('fetalDistress', e.target.checked)}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded"
                          />
                          <span className="text-xs font-medium">Fetal Distress</span>
                        </label>
                        <label className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${patient.maternalHistory?.maternalFever ? 'bg-orange-100 border-orange-500' : 'bg-white border-gray-200 hover:border-orange-300'}`}>
                          <input
                            type="checkbox"
                            checked={patient.maternalHistory?.maternalFever || false}
                            onChange={(e) => handleMaternalHistoryChange('maternalFever', e.target.checked)}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded"
                          />
                          <span className="text-xs font-medium">Maternal Fever</span>
                        </label>
                      </div>
                      {patient.maternalHistory?.prolongedRupture && (
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Rupture to Delivery (hours)</label>
                          <input
                            type="number"
                            min="0"
                            value={patient.maternalHistory?.ruptureToDeliveryHours ?? ''}
                            onChange={(e) => handleMaternalHistoryChange('ruptureToDeliveryHours', e.target.value === '' ? undefined : parseInt(e.target.value))}
                            className="w-32 px-3 py-1 bg-white border-2 border-orange-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="Hours"
                          />
                        </div>
                      )}
                    </div>

                    <hr className="border-pink-200" />

                    {/* 5. Maternal Risk Factors (Antenatal) */}
                    <div>
                      <label className="block text-sm font-bold text-pink-700 mb-1">
                        Antenatal Risk Factors
                      </label>
                      <p className="text-xs text-gray-500 mb-3">Conditions during pregnancy</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.values(MaternalRiskFactor).map(factor => (
                          <label
                            key={factor}
                            className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${
                              patient.maternalHistory?.riskFactors?.includes(factor)
                                ? 'bg-pink-100 border-pink-500 text-pink-800'
                                : 'bg-white border-gray-200 hover:border-pink-300 text-gray-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={patient.maternalHistory?.riskFactors?.includes(factor) || false}
                              onChange={() => handleRiskFactorToggle(factor)}
                              className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                            />
                            <span className="text-xs font-medium">{factor}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Other Conditions</label>
                        <input
                          type="text"
                          value={patient.maternalHistory?.otherRiskFactors || ''}
                          onChange={(e) => handleMaternalHistoryChange('otherRiskFactors', e.target.value)}
                          className="w-full px-3 py-2 bg-white border-2 border-pink-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                          placeholder="Specify other conditions..."
                        />
                      </div>
                    </div>

                    <hr className="border-pink-200" />

                    {/* 6. Previous Pregnancy Outcomes */}
                    <div>
                      <label className="block text-sm font-bold text-pink-700 mb-1">
                        Previous Pregnancy Outcomes
                      </label>
                      <p className="text-xs text-gray-500 mb-3">History of adverse outcomes</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Prev. NICU</label>
                          <input
                            type="number"
                            min="0"
                            value={patient.maternalHistory?.previousNICUAdmissions ?? ''}
                            onChange={(e) => handleMaternalHistoryChange('previousNICUAdmissions', e.target.value === '' ? undefined : parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-white border-2 border-pink-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 text-center"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Neonatal Deaths</label>
                          <input
                            type="number"
                            min="0"
                            value={patient.maternalHistory?.previousNeonatalDeaths ?? ''}
                            onChange={(e) => handleMaternalHistoryChange('previousNeonatalDeaths', e.target.value === '' ? undefined : parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-white border-2 border-pink-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 text-center"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Stillbirths</label>
                          <input
                            type="number"
                            min="0"
                            value={patient.maternalHistory?.previousStillbirths ?? ''}
                            onChange={(e) => handleMaternalHistoryChange('previousStillbirths', e.target.value === '' ? undefined : parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-white border-2 border-pink-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500 text-center"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      {((patient.maternalHistory?.previousNICUAdmissions || 0) > 0 ||
                        (patient.maternalHistory?.previousNeonatalDeaths || 0) > 0 ||
                        (patient.maternalHistory?.previousStillbirths || 0) > 0) && (
                        <p className="text-xs text-amber-600 mt-2 font-medium">
                          ⚠️ Bad Obstetric History (BOH) - High-risk pregnancy
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Administrative & Demographic Information Section */}
            <div className="bg-white rounded-lg sm:rounded-xl border-2 border-blue-300 shadow-md overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('demographics')}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h3 className="text-lg font-bold text-white">Administrative & Demographic Information</h3>
                </div>
                <svg className={`w-5 h-5 text-white transition-transform ${expandedSections.demographics ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedSections.demographics && (
                <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="sncuRegNo" className="block text-sm font-medium text-slate-700 mb-1">SNCU Reg. No.</label>
                      <input type="text" name="sncuRegNo" id="sncuRegNo" value={patient.sncuRegNo || ''} onChange={handleChange} className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., SNCU/2024/001" />
                    </div>
                    <div>
                      <label htmlFor="ntid" className="block text-sm font-medium text-slate-700 mb-1">NTID (Neolink Tracking ID)</label>
                      <div className="w-full px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-400 rounded-lg text-blue-800 font-mono font-bold text-lg tracking-wider">
                        {patient.ntid || 'Auto-generated'}
                      </div>
                      <p className="text-xs text-blue-600 mt-1">Unique ID auto-generated for each patient</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="motherName" className="block text-sm font-bold text-black mb-1">Mother's Name</label>
                      <input type="text" name="motherName" id="motherName" value={patient.motherName || ''} onChange={handleChange} className="w-full px-3 py-2 bg-white border-2 border-blue-600 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600" placeholder="Enter mother's name" />
                    </div>
                    <div>
                      <label htmlFor="fatherName" className="block text-sm font-bold text-black mb-1">Father's Name</label>
                      <input type="text" name="fatherName" id="fatherName" value={patient.fatherName || ''} onChange={handleChange} className="w-full px-3 py-2 bg-white border-2 border-blue-600 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600" placeholder="Father's full name" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-bold text-black mb-1">Baby's Name <span className="text-red-500">*</span></label>
                      <input type="text" name="name" id="name" value={patient.name} onChange={handleChange} required className="w-full px-3 py-2 bg-white border-2 border-blue-600 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600" placeholder="Auto-filled from mother's name" />
                      <p className="text-xs text-blue-600 mt-1">Auto-fills as "Baby of [Mother's Name]"</p>
                    </div>
                    <div>
                      <label htmlFor="unit" className="block text-sm font-bold text-black mb-1">Unit <span className="text-red-500">*</span></label>
                      <select name="unit" id="unit" value={patient.unit} onChange={handleChange} className="w-full px-3 py-2 bg-white border-2 border-blue-600 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!canEditSensitiveFields}>
                        {(availableUnits || Object.values(Unit)).map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="gender" className="block text-sm font-medium text-slate-700 mb-1">Sex <span className="text-red-400">*</span></label>
                      <select name="gender" id="gender" value={patient.gender || ''} onChange={handleChange} required className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">Select Sex</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Ambiguous">Ambiguous</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="category" className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                      <select name="category" id="category" value={patient.category || ''} onChange={handleChange} className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">Select Category</option>
                        {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="doctorInCharge" className="block text-sm font-medium text-slate-700 mb-1">Doctor In Charge</label>
                      <input type="text" name="doctorInCharge" id="doctorInCharge" value={patient.doctorInCharge || ''} onChange={handleChange} className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Responsible doctor" />
                    </div>
                  </div>

                  {/* Enhanced Address Input with PIN Code Lookup */}
                  <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <h4 className="font-semibold text-blue-800">Address Details</h4>
                      <span className="text-xs text-blue-600 ml-auto">📍 Auto-fill from PIN code</span>
                    </div>
                    <AddressInput
                      address={{
                        address: patient.address,
                        village: patient.village,
                        postOffice: patient.postOffice,
                        pinCode: patient.pinCode,
                        district: patient.district,
                        state: patient.state
                      }}
                      onChange={handleAddressChange}
                      showVillage={true}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">Contact 1</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="tel" name="contactNo1" id="contactNo1" value={patient.contactNo1 || ''} onChange={handleChange} className="px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Phone number" />
                        <input type="text" name="contactRelation1" id="contactRelation1" value={patient.contactRelation1 || ''} onChange={handleChange} className="px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Relation" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">Contact 2</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="tel" name="contactNo2" id="contactNo2" value={patient.contactNo2 || ''} onChange={handleChange} className="px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Phone number" />
                        <input type="text" name="contactRelation2" id="contactRelation2" value={patient.contactRelation2 || ''} onChange={handleChange} className="px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Relation" />
                      </div>
                    </div>
                  </div>

                  {/* Admission Type - For NICU/SNCU */}
                  {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && (
                    <div className="pt-4 border-t border-blue-500/30">
                      <label htmlFor="admissionType" className="block text-sm font-medium text-slate-700 mb-1">
                        Type of Admission <span className="text-red-400">*</span>
                      </label>
                      <select
                        name="admissionType"
                        id="admissionType"
                        value={patient.admissionType || ''}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select Admission Type</option>
                        {Object.values(AdmissionType).map(at => <option key={at} value={at}>{at}</option>)}
                      </select>
                      {patient.admissionType === AdmissionType.Inborn && (
                        <p className="text-xs text-green-400 mt-1">
                          ✓ Place of delivery will be set to: {institutionName}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>





            {/* Clinical Information Section */}
            <div className="bg-white rounded-lg sm:rounded-xl border-2 border-blue-300 shadow-md overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <h3 className="text-lg font-bold text-white">Clinical Information</h3>
                </div>
              </div>

              <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">
                {/* Indications for Admission - Show if NICU/SNCU OR if indications are configured for the unit */}
                {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU || admissionIndications.length > 0) && (
                  <div>
                    <label className="block text-sm font-bold text-black mb-3">
                      Indications for Admission <span className="text-red-500">*</span>
                    </label>

                    {loadingIndications ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-sm mt-2 text-black">Loading indications...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto bg-white p-4 rounded-lg border-2 border-blue-600">
                        {admissionIndications.length > 0 ? (
                          admissionIndications.map((indication) => (
                            <label
                              key={indication.id}
                              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${(patient.indicationsForAdmission || []).includes(indication.name)
                                ? 'bg-blue-600 border-2 border-blue-700'
                                : 'bg-white border-2 border-gray-300 hover:border-blue-600'
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={(patient.indicationsForAdmission || []).includes(indication.name)}
                                onChange={() => handleIndicationToggle(indication.name)}
                                className="mt-1 w-5 h-5 text-blue-600 bg-white border-gray-400 rounded focus:ring-blue-600 focus:ring-2"
                              />
                              <span className={`text-sm font-medium flex-1 ${(patient.indicationsForAdmission || []).includes(indication.name) ? 'text-white' : 'text-black'}`}>
                                {indication.name}
                              </span>
                            </label>
                          ))
                        ) : (
                          <div className="col-span-2 text-center py-8">
                            <p className="text-sm text-black">No indications configured yet.</p>
                            <p className="text-xs mt-1 text-gray-600">SuperAdmin needs to add indications in Settings.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Custom Indication Field */}
                    <div className="mt-4">
                      <label htmlFor="customIndication" className="block text-sm font-bold text-black mb-1">
                        Custom Indication / Additional Notes
                      </label>
                      <textarea
                        name="customIndication"
                        id="customIndication"
                        value={patient.customIndication || ''}
                        onChange={handleChange}
                        rows={3}
                        className="w-full px-3 py-2 bg-white border-2 border-blue-600 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        placeholder="Enter any other indications or additional clinical notes..."
                      ></textarea>
                    </div>

                    {/* Primary Diagnosis Summary */}
                    {((patient.indicationsForAdmission || []).length > 0 || patient.customIndication) && (
                      <div className="mt-4 p-4 bg-blue-600 rounded-lg">
                        <p className="text-sm font-bold text-white mb-3">Primary Diagnosis:</p>
                        <div className="flex flex-wrap gap-2">
                          {patient.indicationsForAdmission?.map((indication, idx) => (
                            <span key={idx} className="px-3 py-1.5 bg-white text-black text-sm font-medium rounded-full">
                              {indication}
                            </span>
                          ))}
                          {patient.customIndication && (
                            <span className="px-3 py-1.5 bg-white text-black text-sm font-medium rounded-full">
                              {patient.customIndication}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}


                {/* For nurses - show read-only if diagnosis exists */}
                {isNurse && patient.diagnosis && patient.unit !== Unit.NICU && patient.unit !== Unit.SNCU && (
                  <div className="bg-blue-50 p-3 rounded-lg border-2 border-blue-300">
                    <label className="block text-xs font-medium text-blue-600 mb-1">Primary Diagnosis (Doctor entered)</label>
                    <p className="text-sm text-slate-700 font-medium">{patient.diagnosis}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Patient Status Section */}
            <div className="bg-white rounded-lg sm:rounded-xl border-2 border-blue-300 shadow-md overflow-hidden">
              <div className="px-4 py-3 bg-blue-100">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-bold text-blue-900">Patient Status</h3>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="outcome" className="block text-sm font-medium text-slate-700 mb-1">Current Status <span className="text-red-400">*</span></label>
                    <select name="outcome" id="outcome" value={patient.outcome} onChange={handleChange} required className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="In Progress">In Progress</option>
                      {!patient.isStepDown && (
                        <option value="Step Down">Step Down</option>
                      )}
                      <option value="Discharged">Discharged</option>
                      <option value="Referred">Referred</option>
                      <option value="Deceased">Deceased</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="admissionDate" className="block text-sm font-medium text-slate-700 mb-1">Admission Date <span className="text-red-400">*</span></label>
                    <input type="date" name="admissionDate" id="admissionDate" value={patient.admissionDate.split('T')[0]} onChange={handleChange} required className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!canEditSensitiveFields} />
                  </div>
                </div>
              </div>
            </div>

            {/* Readmit to ICU Section - Only show for Step Down patients */}
            {patient.outcome === 'Step Down' && patient.isStepDown && (
              <div className="bg-white rounded-lg sm:rounded-xl border-2 border-blue-300 overflow-hidden shadow-md">
                <div className="px-4 py-3 bg-red-900/50">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="text-lg font-bold text-red-200">Readmission Required?</h3>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="bg-red-50/10 border border-red-400/30 rounded-lg p-4">
                    <p className="text-sm text-slate-700 mb-4">
                      This patient is currently in <strong className="text-blue-600">Step Down</strong> status from <strong className="text-blue-600">{patient.stepDownFrom}</strong>.
                      If the patient requires readmission to intensive care, click the button below.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[Unit.NICU, Unit.PICU, Unit.SNCU].map(unit => (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => {
                            setPatient(prev => ({
                              ...prev,
                              outcome: 'In Progress',
                              unit: unit,
                              isStepDown: false,
                              readmissionFromStepDown: true,
                            }));
                            alert(`Patient readmitted to ${unit} successfully! Status changed to "In Progress".`);
                          }}
                          className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Readmit to {unit}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Discharge Details Section - Only show when outcome is not In Progress */}
            {patient.outcome !== 'In Progress' && (
              <div className="bg-white rounded-lg sm:rounded-xl border-2 border-blue-300 shadow-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('dischargeDetails')}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <h3 className="text-lg font-bold text-blue-900">
                      {patient.outcome === 'Step Down' ? 'Step Down Details' : 'Discharge Details'}
                    </h3>
                  </div>
                  <svg className={`w-5 h-5 text-blue-600 transition-transform ${expandedSections.dischargeDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedSections.dischargeDetails && (
                  <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="dischargeDateTime" className="block text-sm font-medium text-slate-700 mb-1">
                          Date and Time of {patient.outcome === 'Step Down' ? 'Step Down' : 'Discharge'}
                        </label>
                        <input type="datetime-local" name="dischargeDateTime" id="dischargeDateTime" value={patient.dischargeDateTime ? patient.dischargeDateTime.slice(0, 16) : (patient.releaseDate ? patient.releaseDate.slice(0, 16) : '')} onChange={handleChange} className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label htmlFor="weightOnDischarge" className="block text-sm font-medium text-slate-700 mb-1">Weight on Discharge (Kg)</label>
                        <input type="number" name="weightOnDischarge" id="weightOnDischarge" value={patient.weightOnDischarge || ''} onChange={handleChange} step="0.001" min="0" className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 3.200" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="ageOnDischarge" className="block text-sm font-medium text-slate-700 mb-1">Age on Discharge</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="number" name="ageOnDischarge" id="ageOnDischarge" value={patient.ageOnDischarge || ''} onChange={handleChange} min="0" className="px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Age" />
                          <select name="ageOnDischargeUnit" id="ageOnDischargeUnit" value={patient.ageOnDischargeUnit || AgeUnit.Days} onChange={handleChange} className="px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            {Object.values(AgeUnit).map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="releaseDate" className="block text-sm font-medium text-slate-700 mb-1">Legacy Release Date</label>
                        <input
                          type="date"
                          name="releaseDate"
                          id="releaseDate"
                          value={patient.releaseDate ? patient.releaseDate.split('T')[0] : ''}
                          onChange={handleChange}
                          className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required={patient.outcome === 'Step Down'}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}





            {/* Patient Dates & Status Section */}
            <div className="bg-white rounded-lg sm:rounded-xl border-2 border-amber-300 shadow-md overflow-hidden">
              <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-orange-500">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Admission & Outcome Details
                </h3>
              </div>
              <div className="p-3 sm:p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="admissionDate" className="block text-sm font-medium text-slate-700 mb-1">Admission Date</label>
                    <input type="date" name="admissionDate" id="admissionDate" value={patient.admissionDate.split('T')[0]} onChange={handleChange} required className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!canEditSensitiveFields} />
                  </div>
                  <div>
                    <label htmlFor="releaseDate" className="block text-sm font-medium text-slate-700 mb-1">
                      {patient.outcome === 'Step Down' ? 'Step Down Date' : 'Date of Release'}
                    </label>
                    <input
                      type="date"
                      name="releaseDate"
                      id="releaseDate"
                      value={patient.releaseDate ? patient.releaseDate.split('T')[0] : ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      required={patient.outcome === 'Step Down'}
                    />
                  </div>
                  <div>
                    <label htmlFor="outcome" className="block text-sm font-medium text-slate-700 mb-1">Current Status</label>
                    <select name="outcome" id="outcome" value={patient.outcome} onChange={handleChange} className="w-full px-3 py-2 bg-white border-2 border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                      <option value="In Progress">In Progress</option>
                      {!patient.isStepDown && (
                        <option value="Step Down">Step Down</option>
                      )}
                      <option value="Discharged">Discharged</option>
                      <option value="Referred">Referred</option>
                      <option value="Deceased">Deceased</option>
                    </select>
                  </div>
                </div>

                {/* Death Diagnosis - Mandatory when outcome is Deceased */}
                {patient.outcome === 'Deceased' && (
                  <div className="bg-red-50 border-2 border-red-300 p-6 rounded-xl space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <h3 className="text-xl font-bold text-red-700">Diagnosis at Time of Death</h3>
                        <p className="text-sm text-red-600">Required: Complete clinical diagnosis for mortality documentation</p>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border-2 border-red-200">
                      <p className="text-sm text-red-700 mb-3">
                        <span className="font-semibold">📋 Include comprehensive details:</span>
                      </p>
                      <ul className="text-sm text-slate-700 space-y-1 ml-4">
                        <li>✓ Primary cause of death</li>
                        <li>✓ Contributing factors and comorbidities</li>
                        <li>✓ Timeline of clinical deterioration</li>
                        <li>✓ Resuscitation attempts and outcomes</li>
                        <li>✓ Final clinical assessment</li>
                      </ul>
                    </div>

                    <div>
                      <label htmlFor="dateOfDeath" className="block text-sm font-medium text-red-700 mb-2">
                        Date and Time of Death <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        name="dateOfDeath"
                        id="dateOfDeath"
                        value={patient.dateOfDeath ? patient.dateOfDeath.slice(0, 16) : ''}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-white border-2 border-red-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400"
                      />
                    </div>

                    <div>
                      <label htmlFor="diagnosisAtDeath" className="block text-sm font-medium text-red-700 mb-2">
                        Full Clinical Diagnosis at Time of Death <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="diagnosisAtDeath"
                        id="diagnosisAtDeath"
                        value={patient.diagnosisAtDeath || ''}
                        onChange={handleChange}
                        required
                        rows={8}
                        placeholder="Enter comprehensive diagnosis including primary cause, contributing factors, timeline, and clinical assessment..."
                        className="w-full px-4 py-3 bg-white border-2 border-red-200 rounded-lg text-slate-800 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 resize-y"
                      />
                      <p className="text-xs text-red-600 mt-2">
                        This field is mandatory for mortality records. AI will analyze and generate a concise summary for analytics.
                      </p>
                    </div>

                    {patient.aiInterpretedDeathDiagnosis && (
                      <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-400">
                        <div className="flex items-start gap-3">
                          <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-blue-800 mb-2">AI-Interpreted Diagnosis</h4>
                            <p className="text-sm text-slate-700 leading-relaxed">{patient.aiInterpretedDeathDiagnosis}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Referral Information - Only show when outcome is Referred */}
                {patient.outcome === 'Referred' && isDoctor && patientToEdit && (
                  <div className="bg-orange-50 border-2 border-orange-300 p-6 rounded-xl space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      <div>
                        <h3 className="text-xl font-bold text-orange-300">Create Formal Referral</h3>
                        <p className="text-sm text-slate-700">Generate AI-powered referral letter and notify receiving institution</p>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-300">
                      <p className="text-sm text-slate-700 mb-3">
                        <span className="font-semibold text-orange-800">📋 Complete Referral Includes:</span>
                      </p>
                      <ul className="text-sm text-slate-700 space-y-1 ml-4">
                        <li>✓ Searchable institution dropdown</li>
                        <li>✓ Comprehensive referral details form</li>
                        <li>✓ AI-generated professional referral letter</li>
                        <li>✓ Real-time notification to receiving institution</li>
                        <li>✓ Status tracking and updates</li>
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowReferralForm(true)}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 rounded-lg transition-all font-bold text-lg shadow-lg flex items-center justify-center gap-3"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Create Formal Referral
                    </button>

                    <p className="text-xs text-blue-600 text-center">
                      Click to open comprehensive referral form with AI-powered letter generation
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-xl shadow-lg border-2 border-blue-300 p-6 mt-6 sticky bottom-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-3 rounded-lg text-blue-800 bg-slate-700 hover:bg-slate-600 transition-colors font-semibold text-base flex items-center justify-center gap-2"
                >
                  <XIcon className="w-5 h-5" />
                  Cancel
                </button>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  {isNurse && (
                    <button
                      type="button"
                      onClick={handleSaveAsDraft}
                      className="w-full sm:w-auto px-8 py-3 rounded-lg text-white bg-yellow-600 hover:bg-yellow-700 transition-colors font-bold text-base flex items-center justify-center gap-2 shadow-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Save as Draft
                    </button>
                  )}
                  {isDoctor && (
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-8 py-3 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-all font-bold text-base flex items-center justify-center gap-2 shadow-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Complete & Save Patient
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Referral Form Modal */}
        {
          showReferralForm && patientToEdit && (
            <ReferralForm
              patient={patientToEdit}
              currentInstitutionId={institutionId}
              currentInstitutionName={institutionName}
              userEmail={userEmail}
              userRole={userRole}
              userName={userName || userEmail}
              onClose={() => setShowReferralForm(false)}
              onSuccess={() => {
                setShowReferralForm(false);
                onClose(); // Close the patient form after successful referral
              }}
            />
          )
        }

        {/* Loading Overlay */}
        <LoadingOverlay
          show={isSaving && !saveSuccess}
          message="Saving patient..."
        />

        {/* Success Overlay */}
        <LoadingOverlay
          show={saveSuccess}
          message="✓ Saved successfully!"
        />
      </div >
    </div >
  );
};

export default PatientForm;
