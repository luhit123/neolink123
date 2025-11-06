import { Patient, Unit, AgeUnit, AdmissionType } from '../types';

// Helper to generate random date in September 2025
const randomSeptDate = (day?: number) => {
  const d = day || Math.floor(Math.random() * 30) + 1;
  const h = Math.floor(Math.random() * 24);
  const m = Math.floor(Math.random() * 60);
  return new Date(`2025-09-${d.toString().padStart(2, '0')}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00+05:30`).toISOString();
};

// Generate 194 anonymous patients (197 total - 3 detailed death cases)
export const generateSeptemberPatients = (): Patient[] => {
  const patients: Patient[] = [];
  let id = 1;

  // NICU Inborn Males: 83 (minus 1 death = 82 anonymous)
  for (let i = 0; i < 82; i++) {
    patients.push({
      id: `nicu-inborn-m-${id++}`,
      name: `B/O Mother ${id}`,
      age: Math.floor(Math.random() * 28) + 1,
      ageUnit: AgeUnit.Days,
      gender: 'Male',
      admissionDate: randomSeptDate(),
      diagnosis: ['Respiratory Distress Syndrome (RDS)', 'Neonatal Jaundice', 'Transient Tachypnea of Newborn', 'Low Birth Weight', 'Hypoglycemia'][Math.floor(Math.random() * 5)],
      progressNotes: [{
        date: randomSeptDate(),
        note: 'Admitted to NICU. Under observation. Vitals stable.'
      }],
      outcome: ['In Progress', 'Discharged'][Math.floor(Math.random() * 2)] as any,
      unit: Unit.NICU,
      admissionType: AdmissionType.Inborn,
    });
  }

  // NICU Inborn Females: 73 (all anonymous)
  for (let i = 0; i < 73; i++) {
    patients.push({
      id: `nicu-inborn-f-${id++}`,
      name: `B/O Mother ${id}`,
      age: Math.floor(Math.random() * 28) + 1,
      ageUnit: AgeUnit.Days,
      gender: 'Female',
      admissionDate: randomSeptDate(),
      diagnosis: ['Respiratory Distress Syndrome (RDS)', 'Neonatal Jaundice', 'Transient Tachypnea of Newborn', 'Low Birth Weight', 'Feeding Intolerance'][Math.floor(Math.random() * 5)],
      progressNotes: [{
        date: randomSeptDate(),
        note: 'Admitted to NICU. Monitoring vitals and feeding.'
      }],
      outcome: ['In Progress', 'Discharged'][Math.floor(Math.random() * 2)] as any,
      unit: Unit.NICU,
      admissionType: AdmissionType.Inborn,
    });
  }

  // NICU Outborn Males: 23 (all anonymous)
  const hospitals = ['Sushrusha Hospital', 'Rangia Civil Hospital', 'Tihu Model Hospital', 'Nalbari CHC'];
  for (let i = 0; i < 23; i++) {
    patients.push({
      id: `nicu-outborn-m-${id++}`,
      name: `B/O Mother ${id}`,
      age: Math.floor(Math.random() * 28) + 1,
      ageUnit: AgeUnit.Days,
      gender: 'Male',
      admissionDate: randomSeptDate(),
      diagnosis: ['Meconium Aspiration Syndrome (MAS)', 'Birth Asphyxia', 'Neonatal Sepsis', 'Prematurity', 'Hypothermia'][Math.floor(Math.random() * 5)],
      progressNotes: [{
        date: randomSeptDate(),
        note: 'Referred from outside hospital. Receiving intensive care.'
      }],
      outcome: ['In Progress', 'Discharged'][Math.floor(Math.random() * 2)] as any,
      unit: Unit.NICU,
      admissionType: AdmissionType.Outborn,
      referringHospital: hospitals[Math.floor(Math.random() * hospitals.length)],
      referringDistrict: 'Nalbari'
    });
  }

  // NICU Outborn Females: 18 (minus 1 death = 17 anonymous)
  for (let i = 0; i < 17; i++) {
    patients.push({
      id: `nicu-outborn-f-${id++}`,
      name: `B/O Mother ${id}`,
      age: Math.floor(Math.random() * 28) + 1,
      ageUnit: AgeUnit.Days,
      gender: 'Female',
      admissionDate: randomSeptDate(),
      diagnosis: ['Meconium Aspiration Syndrome (MAS)', 'Birth Asphyxia', 'Neonatal Sepsis', 'Prematurity', 'Congenital Pneumonia'][Math.floor(Math.random() * 5)],
      progressNotes: [{
        date: randomSeptDate(),
        note: 'Transferred from referring facility. Under treatment.'
      }],
      outcome: ['In Progress', 'Discharged'][Math.floor(Math.random() * 2)] as any,
      unit: Unit.NICU,
      admissionType: AdmissionType.Outborn,
      referringHospital: hospitals[Math.floor(Math.random() * hospitals.length)],
      referringDistrict: 'Nalbari'
    });
  }

  // PICU Patients: ~50 admissions (minus 1 death = 49 anonymous)
  const picuDiagnoses = ['Severe Pneumonia', 'Acute Gastroenteritis with Dehydration', 'Febrile Seizures', 'Bronchiolitis', 'Dengue Fever', 'Meningitis'];
  for (let i = 0; i < 49; i++) {
    const ageInMonths = Math.floor(Math.random() * 144) + 1; // 1-144 months (12 years)
    patients.push({
      id: `picu-${id++}`,
      name: `Child ${id}`,
      age: ageInMonths > 12 ? Math.floor(ageInMonths / 12) : ageInMonths,
      ageUnit: ageInMonths > 12 ? AgeUnit.Years : AgeUnit.Months,
      gender: ['Male', 'Female'][Math.floor(Math.random() * 2)] as any,
      admissionDate: randomSeptDate(),
      diagnosis: picuDiagnoses[Math.floor(Math.random() * picuDiagnoses.length)],
      progressNotes: [{
        date: randomSeptDate(),
        note: 'Admitted to PICU. Treatment initiated as per protocol.'
      }],
      outcome: ['In Progress', 'Discharged'][Math.floor(Math.random() * 2)] as any,
      unit: Unit.PICU,
    });
  }

  return patients;
};
