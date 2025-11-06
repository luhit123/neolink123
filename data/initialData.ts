import { Patient, Unit, AgeUnit, AdmissionType } from '../types';
import { generateSeptemberPatients } from './septemberPatients';

export const initialPatients: Patient[] = [
  // Generate all anonymous September 2025 patients (194 patients)
  ...generateSeptemberPatients(),

  // DETAILED MORTALITY CASES (3 patients)
  // MORTALITY CASE 1 - Inborn NICU
  {
    id: 'death-001',
    name: 'B/O Anjuwara Begum',
    age: 2, // Days (04/09 birth to 06/09 death)
    ageUnit: AgeUnit.Days,
    gender: 'Male',
    admissionDate: new Date('2025-09-04T20:52:00+05:30').toISOString(),
    releaseDate: new Date('2025-09-06T05:40:00+05:30').toISOString(),
    diagnosis: 'S/T/M/LSCS/AFD, Early Onset Neonatal Sepsis (EONS)',
    progressNotes: [
      {
        date: new Date('2025-09-04T19:24:00+05:30').toISOString(),
        note: 'Birth Details: DOB: 04/09/2025 at 7:24 PM, Birth Weight: 3.5 kg, Mode: LSCS (Indication: Respiratory Distress), Place: NMCH, Address: Rangia Pitambar, Assam'
      },
      {
        date: new Date('2025-09-04T20:52:00+05:30').toISOString(),
        note: 'Admission: Chief Complaint - Respiratory distress since birth. Baby cried at birth but developed respiratory distress. Examination: Cry-Feeble, Color-Peripheral cyanosis, CRT <3 sec, Sucking-Poor, Temp-36.8°C, HR-128/min, RR-62/min, SpO₂-83% (room air), RBS-56 mg/dL, Chest: B/L Air Entry+, SCR+, Downes Score-3/10, CNS-Lethargic. No congenital anomaly.'
      },
      {
        date: new Date('2025-09-04T20:52:00+05:30').toISOString(),
        note: 'Initial Management: Oxygen under nasal prongs, IVF D10, Inj. Cefotaxime, Inj. Amikacin, Vitals and RBS monitoring'
      },
      {
        date: new Date('2025-09-04T23:15:00+05:30').toISOString(),
        note: 'Clinical Deterioration: Poor CRT >3 sec, Seizure +, Cyanosis +. Management: Intubated, MV started (FiO₂ 60%, PEEP 5cmH₂O), NS bolus given, Inj. Phenobarbitone LD, Cefotaxime continued, IVF D10, Dopamine @10 mcg/kg/min started'
      },
      {
        date: new Date('2025-09-05T08:00:00+05:30').toISOString(),
        note: 'Morning Review: HR 121/min, SpO₂ 92% under MV. Continued antibiotics, Dopamine infusion'
      },
      {
        date: new Date('2025-09-06T01:45:00+05:30').toISOString(),
        note: 'Night Assessment: HR 104/min, SpO₂ 79% under MV. Increased Dopamine to 20 mcg/kg/min'
      },
      {
        date: new Date('2025-09-06T03:30:00+05:30').toISOString(),
        note: 'Critical Condition: HR 78/min, SpO₂ 64% under MV. Added Dobutamine and Adrenaline infusions'
      },
      {
        date: new Date('2025-09-06T05:40:00+05:30').toISOString(),
        note: 'Outcome: Baby went into cardiopulmonary arrest at 5:40 AM. Despite resuscitation efforts, HR and SpO₂ were not recordable. Declared dead at 5:40 AM on 06/09/2025.'
      }
    ],
    outcome: 'Deceased',
    unit: Unit.NICU,
    admissionType: AdmissionType.Inborn,
  },

  // DETAILED MORTALITY CASE 2 - Outborn
  {
    id: 'death-002',
    name: 'B/O Ashma Begum',
    age: 2, // Days (05/09 birth to 08/09 death, but admitted on 06/09)
    ageUnit: AgeUnit.Days,
    gender: 'Female',
    admissionDate: new Date('2025-09-06T21:51:00+05:30').toISOString(),
    releaseDate: new Date('2025-09-08T00:15:00+05:30').toISOString(),
    diagnosis: 'S/T/F/NVD/AFD, Birth Asphyxia / HIE Stage III, Early Onset Neonatal Sepsis',
    progressNotes: [
      {
        date: new Date('2025-09-05T09:08:00+05:30').toISOString(),
        note: 'Birth Details: DOB: 05/09/2025 at 9:08 AM, Birth Weight: 3.1 kg, Mode: NVD, Indication: Birth Asphyxia, Place: Sushrusha Hospital, Address: Kendukuchi, Nalbari, Assam'
      },
      {
        date: new Date('2025-09-06T21:51:00+05:30').toISOString(),
        note: 'Admission to NMCH: Chief Complaint - Did not cry at birth. Received gasping on oxygen support. Examination: Cry-Absent, Color-Peripheral cyanosis, CRT >3 sec, HR-116/min, SpO₂-35% (room air), Downes Score-7/10, CNS-Lethargic'
      },
      {
        date: new Date('2025-09-06T21:51:00+05:30').toISOString(),
        note: 'Initial Management: MV support started (FiO₂ 60%, PEEP 5cmH₂O), Inj. Cefotaxime, Inj. Amikacin, IVF D10, Adrenaline infusion'
      },
      {
        date: new Date('2025-09-06T23:00:00+05:30').toISOString(),
        note: 'First Assessment: HR 150/min, SpO₂ 77%. NS bolus given, Cefotaxime, D10, Adrenaline @0.5 mcg/kg/min'
      },
      {
        date: new Date('2025-09-07T08:00:00+05:30').toISOString(),
        note: 'Morning Review: HR 106/min, SpO₂ 89%. Cefotaxime, Amikacin continued, Adrenaline increased to @1 mcg/kg/min'
      },
      {
        date: new Date('2025-09-07T18:00:00+05:30').toISOString(),
        note: 'Evening Assessment: HR 107/min, SpO₂ 87%. Added Dopamine @10 mcg/kg/min'
      },
      {
        date: new Date('2025-09-07T22:00:00+05:30').toISOString(),
        note: 'Critical Status: HR 79/min, SpO₂ 71%, RBS 78 mg/dL. Continued inotropes, added Dobutamine'
      },
      {
        date: new Date('2025-09-07T23:45:00+05:30').toISOString(),
        note: 'Cardiac Arrest: Baby developed cardiac arrest at 11:45 PM. Resuscitation initiated.'
      },
      {
        date: new Date('2025-09-08T00:15:00+05:30').toISOString(),
        note: 'Outcome: Resuscitation unsuccessful. Declared dead at 12:15 AM on 08/09/2025.'
      }
    ],
    outcome: 'Deceased',
    unit: Unit.NICU,
    admissionType: AdmissionType.Outborn,
    referringHospital: 'Sushrusha Hospital',
    referringDistrict: 'Nalbari'
  },

  // DETAILED MORTALITY CASE 3 - PICU
  {
    id: 'death-003',
    name: 'Rijuwa Jannat',
    age: 7,
    ageUnit: AgeUnit.Months,
    gender: 'Female',
    admissionDate: new Date('2025-09-17T14:10:00+05:30').toISOString(),
    releaseDate: new Date('2025-09-17T20:27:00+05:30').toISOString(),
    diagnosis: 'Cardiorespiratory Arrest due to Congenital Heart Disease with Severe Pneumonia and Shock',
    progressNotes: [
      {
        date: new Date('2025-09-17T14:10:00+05:30').toISOString(),
        note: 'Patient Details: Age: 7 months, Father: Rijul Ali, Hospital No.: 94033, MRD No.: 15626, IRN: 620/24'
      },
      {
        date: new Date('2025-09-17T14:10:00+05:30').toISOString(),
        note: 'Chief Complaints: Excessive crying since 1 day, Breathing difficulty since 1 day. History: Sudden progressive breathing difficulty. No fever, vomiting, or abnormal movements. Birth History: Normal vaginal delivery, cried at birth, no prior NICU admission. Feeding: Exclusive breastfeeding. Immunization: BCG scar present.'
      },
      {
        date: new Date('2025-09-17T14:10:00+05:30').toISOString(),
        note: 'Examination: Temp-36.8°C, PR-152/min, RR-56/min, SpO₂-84% (room air), Cyanosis present, Hepatomegaly (3 cm), Splenomegaly (5 cm), Pupils: Bilaterally reactive. Investigations Advised: CBC, Serum Electrolytes, RFT, CRP, Chest X-ray, 2D Echo'
      },
      {
        date: new Date('2025-09-17T14:10:00+05:30').toISOString(),
        note: 'Initial Management: HR 89/min, SpO₂ 76%. HFNC started (FiO₂ 60%, PEEP 5), Inj. Amoxyclav, IVF, 3% NaCl neb, Salbutamol neb'
      },
      {
        date: new Date('2025-09-17T14:30:00+05:30').toISOString(),
        note: 'Rapid Deterioration: Poor respiratory effort, gasping. Intubated, MV started, Inj. Pipzo, Lasix, Dobutamine @20 mcg/kg/min'
      },
      {
        date: new Date('2025-09-17T19:40:00+05:30').toISOString(),
        note: 'Critical Status: HR 77/min, SpO₂ 46%. Added Dopamine and Adrenaline infusions'
      },
      {
        date: new Date('2025-09-17T20:15:00+05:30').toISOString(),
        note: 'Cardiopulmonary Arrest: Baby went into sudden cardiopulmonary arrest at 8:15 PM. Full resuscitation initiated.'
      },
      {
        date: new Date('2025-09-17T20:27:00+05:30').toISOString(),
        note: 'Outcome: No response to resuscitation efforts. Declared dead at 8:27 PM on 17/09/2025.'
      }
    ],
    outcome: 'Deceased',
    unit: Unit.PICU,
  }
];
