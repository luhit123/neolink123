import { ProgressNote, VitalSigns, ClinicalExamination, Medication } from '../types';

/**
 * Clinical Template Interface
 */
export interface ClinicalTemplate {
  id: string;
  name: string;
  category: 'NICU' | 'PICU' | 'SNCU' | 'General';
  description: string;
  vitals?: Partial<VitalSigns>;
  examination?: Partial<ClinicalExamination>;
  medications?: Medication[];
  note: string;
  keywords: string[];
}

/**
 * Smart Clinical Templates Library
 *
 * 20+ pre-built templates for common NICU/PICU/SNCU scenarios
 * to accelerate clinical documentation and ensure completeness.
 */
export const clinicalTemplates: Record<string, ClinicalTemplate> = {
  // ========== NICU TEMPLATES ==========

  neonatalRDS: {
    id: 'neonatal-rds',
    name: 'Neonatal Respiratory Distress Syndrome (RDS)',
    category: 'NICU',
    description: 'Template for preterm neonates with RDS',
    vitals: {
      rr: '60-80',
      spo2: '88-95',
      hr: '140-160',
      temperature: '36.5-37.5',
    },
    examination: {
      chest: 'Subcostal and intercostal retractions, grunting, nasal flaring. Bilateral air entry present but decreased.',
      cvs: 'S1S2 normal, no murmur. Good peripheral perfusion.',
      cns: 'Alert when stimulated, active movements, good tone.',
      perAbdomen: 'Soft, non-tender, no distension.',
    },
    medications: [
      { name: 'Caffeine citrate', dose: '20mg/kg loading, then 5mg/kg/day', route: 'PO', frequency: 'OD' },
      { name: 'Ampicillin', dose: '50mg/kg', route: 'IV', frequency: 'BD' },
      { name: 'Gentamicin', dose: '4mg/kg', route: 'IV', frequency: 'OD' },
    ],
    note: 'Preterm neonate with respiratory distress consistent with RDS. Currently on CPAP/ventilator support with FiO2 requirements. Chest X-ray shows ground glass appearance. Blood culture sent. Plan: Continue respiratory support, wean oxygen as tolerated, antibiotics pending culture results (48-72hrs), monitor for complications (air leak, sepsis, NEC).',
    keywords: ['RDS', 'respiratory distress', 'preterm', 'surfactant', 'CPAP', 'ventilator'],
  },

  neonatalSepsis: {
    id: 'neonatal-sepsis',
    name: 'Neonatal Sepsis (Early/Late Onset)',
    category: 'NICU',
    description: 'Template for suspected or confirmed neonatal sepsis',
    vitals: {
      temperature: '<36.5 or >38',
      hr: '>180 or <100',
      spo2: '<90',
      rr: '>60',
    },
    examination: {
      cns: 'Lethargy, poor feeding, hypotonia, decreased activity.',
      cvs: 'Tachycardia, poor perfusion, CRT >3 seconds, mottled skin.',
      chest: 'Tachypnea, grunting, increased work of breathing.',
      perAbdomen: 'Distension, feeding intolerance, possible hepatomegaly.',
    },
    medications: [
      { name: 'Ampicillin', dose: '50mg/kg', route: 'IV', frequency: 'BD' },
      { name: 'Gentamicin', dose: '4mg/kg', route: 'IV', frequency: 'OD' },
      { name: 'Normal Saline bolus', dose: '10ml/kg', route: 'IV', frequency: 'STAT' },
      { name: 'Inotropes (if needed)', dose: 'As per protocol', route: 'IV', frequency: 'Continuous' },
    ],
    note: 'Neonate with clinical features suggestive of sepsis. Blood culture, CRP, CBC sent. Lumbar puncture considered if stable. Plan: IV antibiotics (Ampicillin + Gentamicin) for minimum 7-10 days pending culture. Fluid resuscitation as needed. Monitor vitals closely. Consider inotropic support if hypotensive.',
    keywords: ['sepsis', 'infection', 'fever', 'hypothermia', 'lethargy', 'CRP'],
  },

  neonatalHIE: {
    id: 'neonatal-hie',
    name: 'Hypoxic Ischemic Encephalopathy (HIE)',
    category: 'NICU',
    description: 'Template for birth asphyxia and HIE',
    vitals: {
      temperature: '33-34 (if cooling)',
      hr: '100-120',
      spo2: '95-100',
    },
    examination: {
      cns: 'Decreased level of consciousness, hypotonia/hypertonia, abnormal primitive reflexes, seizure activity.',
      cvs: 'S1S2 normal, monitor for myocardial dysfunction.',
      chest: 'On ventilator support, bilateral air entry equal.',
      perAbdomen: 'Soft, bowel sounds present.',
    },
    medications: [
      { name: 'Phenobarbitone', dose: '20mg/kg loading', route: 'IV', frequency: 'STAT' },
      { name: 'Ampicillin', dose: '50mg/kg', route: 'IV', frequency: 'BD' },
      { name: 'Gentamicin', dose: '4mg/kg', route: 'IV', frequency: 'OD' },
    ],
    note: 'Term neonate with birth asphyxia, now with HIE (Sarnat Stage II/III). Therapeutic hypothermia initiated within 6 hours of birth, target temp 33-34°C for 72 hours. EEG monitoring for seizures. Plan: Maintain normoglycemia, monitor electrolytes, rewarming protocol after 72hrs, MRI brain at day 4-7, developmental follow-up.',
    keywords: ['HIE', 'asphyxia', 'cooling', 'hypothermia', 'seizures', 'birth depression'],
  },

  neonatalNEC: {
    id: 'neonatal-nec',
    name: 'Necrotizing Enterocolitis (NEC)',
    category: 'NICU',
    description: 'Template for suspected or confirmed NEC',
    vitals: {
      temperature: 'Unstable',
      hr: '>180',
      spo2: '<90',
    },
    examination: {
      perAbdomen: 'Distended, tender, absent bowel sounds, visible bowel loops.',
      cns: 'Lethargy, decreased activity.',
      cvs: 'Tachycardia, poor perfusion, shock.',
    },
    medications: [
      { name: 'Ampicillin', dose: '50mg/kg', route: 'IV', frequency: 'TID' },
      { name: 'Gentamicin', dose: '4mg/kg', route: 'IV', frequency: 'OD' },
      { name: 'Metronidazole', dose: '7.5mg/kg', route: 'IV', frequency: 'BD' },
      { name: 'TPN', dose: 'As per protocol', route: 'IV', frequency: 'Continuous' },
    ],
    note: 'Preterm neonate with suspected NEC (Modified Bell Stage II/III). Abdominal X-ray shows pneumatosis intestinalis/portal venous gas. Plan: NPO (bowel rest), NGT aspiration, IV antibiotics (Amp+Gent+Metro) for 10-14 days, TPN, serial abdominal exams, surgical consultation if perforation/clinical deterioration.',
    keywords: ['NEC', 'necrotizing enterocolitis', 'abdominal distension', 'feeding intolerance'],
  },

  neonatalTTN: {
    id: 'neonatal-ttn',
    name: 'Transient Tachypnea of Newborn (TTN)',
    category: 'NICU',
    description: 'Template for TTN in term/near-term neonates',
    vitals: {
      rr: '60-80',
      spo2: '92-95',
      hr: '140-160',
    },
    examination: {
      chest: 'Tachypnea, mild retractions, good air entry bilaterally.',
      cvs: 'S1S2 normal.',
      cns: 'Active, alert.',
    },
    medications: [
      { name: 'Ampicillin', dose: '50mg/kg', route: 'IV', frequency: 'BD' },
      { name: 'Gentamicin', dose: '4mg/kg', route: 'IV', frequency: 'OD' },
    ],
    note: 'Term neonate delivered by LSCS with respiratory distress. Clinical and radiological features consistent with TTN. Minimal oxygen requirement. Plan: Supportive care, oxygen supplementation as needed, antibiotics for 48 hrs pending culture, monitor for resolution (usually 24-72 hrs).',
    keywords: ['TTN', 'transient tachypnea', 'LSCS', 'wet lung'],
  },

  neonatalJaundice: {
    id: 'neonatal-jaundice',
    name: 'Neonatal Jaundice',
    category: 'NICU',
    description: 'Template for pathological jaundice requiring phototherapy',
    vitals: {
      temperature: '36.5-37.5',
      hr: '120-160',
    },
    examination: {
      cns: 'Active, alert, good feeding.',
      cvs: 'S1S2 normal.',
      otherFindings: 'Jaundice up to abdomen/feet. No hepatosplenomegaly.',
    },
    medications: [],
    note: 'Neonate with jaundice, TSB (Total Serum Bilirubin) elevated requiring phototherapy. G6PD status checked. On double/single phototherapy. Plan: Monitor TSB every 12-24 hrs, adequate hydration, consider exchange transfusion if TSB crosses exchange level, investigate for hemolytic causes if indicated.',
    keywords: ['jaundice', 'hyperbilirubinemia', 'phototherapy', 'bilirubin'],
  },

  // ========== PICU TEMPLATES ==========

  pediatricPneumonia: {
    id: 'pediatric-pneumonia',
    name: 'Pediatric Pneumonia',
    category: 'PICU',
    description: 'Template for severe pneumonia in children',
    vitals: {
      temperature: '>38.5',
      rr: '>40 (age dependent)',
      spo2: '<92',
      hr: '>140',
    },
    examination: {
      chest: 'Crepitations/bronchial breathing, decreased air entry on affected side, intercostal retractions.',
      cvs: 'Tachycardia, normal S1S2.',
      cns: 'Alert/irritable.',
    },
    medications: [
      { name: 'Ceftriaxone', dose: '75mg/kg', route: 'IV', frequency: 'OD' },
      { name: 'Azithromycin', dose: '10mg/kg', route: 'PO/IV', frequency: 'OD' },
      { name: 'Paracetamol', dose: '15mg/kg', route: 'PO/IV', frequency: 'Q6H' },
      { name: 'Salbutamol nebulization', dose: '2.5mg', route: 'Inhalation', frequency: 'Q6H' },
    ],
    note: 'Child with clinical and radiological features of pneumonia (lobar/bronchopneumonia). CXR shows consolidation. Plan: IV antibiotics (Ceftriaxone + Azithromycin) for 7-10 days, oxygen supplementation, chest physiotherapy, monitor for complications (pleural effusion, empyema), step down to oral antibiotics when afebrile for 48 hrs.',
    keywords: ['pneumonia', 'respiratory infection', 'cough', 'fever'],
  },

  pediatricBronchiolitis: {
    id: 'pediatric-bronchiolitis',
    name: 'Bronchiolitis (RSV/Viral)',
    category: 'PICU',
    description: 'Template for acute bronchiolitis in infants',
    vitals: {
      rr: '>50',
      spo2: '88-92',
      hr: '>150',
      temperature: '37.5-38.5',
    },
    examination: {
      chest: 'Bilateral crepitations, wheeze, intercostal retractions, nasal flaring.',
      cvs: 'Tachycardia.',
      cns: 'Irritable, poor feeding.',
    },
    medications: [
      { name: 'Salbutamol nebulization', dose: '2.5mg', route: 'Inhalation', frequency: 'Q4H' },
      { name: 'Paracetamol', dose: '15mg/kg', route: 'PO', frequency: 'Q6H PRN' },
    ],
    note: 'Infant with acute bronchiolitis, likely viral (RSV). Increased work of breathing with oxygen requirement. Plan: Supportive care, oxygen supplementation to maintain SpO2 >90%, adequate hydration (IV/NG if poor feeding), monitor for apneas, consider CPAP/HFNC if severe, no routine antibiotics unless secondary bacterial infection suspected.',
    keywords: ['bronchiolitis', 'RSV', 'wheeze', 'infant'],
  },

  pediatricDengue: {
    id: 'pediatric-dengue',
    name: 'Dengue Fever (With Warning Signs)',
    category: 'PICU',
    description: 'Template for dengue with warning signs',
    vitals: {
      temperature: '>38',
      hr: 'Variable',
      bp: 'Monitor for hypotension',
    },
    examination: {
      cns: 'Restless/lethargic.',
      cvs: 'Tachycardia, check for pleural effusion/ascites.',
      perAbdomen: 'Tender, hepatomegaly, ascites.',
      otherFindings: 'Petechiae, positive tourniquet test.',
    },
    medications: [
      { name: 'Paracetamol', dose: '15mg/kg', route: 'PO', frequency: 'Q6H' },
      { name: 'IV fluids (NS/RL)', dose: 'As per WHO protocol', route: 'IV', frequency: 'Continuous' },
    ],
    note: 'Child with dengue fever with warning signs (abdominal pain, vomiting, hepatomegaly, rising HCT with falling platelets). Critical phase approaching. Plan: Close monitoring of vitals, strict I/O charting, serial HCT and platelet monitoring (6-12 hourly), IV fluid management as per WHO dengue guidelines, watch for plasma leakage and shock, avoid IM injections/NSAIDs.',
    keywords: ['dengue', 'DHF', 'warning signs', 'thrombocytopenia'],
  },

  pediatricGastroenteritis: {
    id: 'pediatric-gastroenteritis',
    name: 'Acute Gastroenteritis with Dehydration',
    category: 'PICU',
    description: 'Template for severe dehydration from gastroenteritis',
    vitals: {
      hr: '>140',
      bp: 'Low/normal',
    },
    examination: {
      cns: 'Lethargic, sunken eyes, dry mucous membranes.',
      cvs: 'Tachycardia, weak pulse, poor perfusion.',
      perAbdomen: 'Soft, non-tender, increased bowel sounds.',
    },
    medications: [
      { name: 'IV fluid bolus (NS)', dose: '20ml/kg', route: 'IV', frequency: 'STAT' },
      { name: 'Zinc sulfate', dose: '20mg', route: 'PO', frequency: 'OD (for 14 days)' },
      { name: 'ORS', dose: 'Ad lib', route: 'PO', frequency: 'Frequent small sips' },
    ],
    note: 'Child with acute gastroenteritis and severe dehydration (>9% fluid deficit). Plan: IV fluid resuscitation (20ml/kg bolus, reassess), maintenance + deficit correction over 24 hrs, zinc supplementation, early refeeding once rehydrated, stool examination, monitor electrolytes.',
    keywords: ['gastroenteritis', 'dehydration', 'diarrhea', 'vomiting'],
  },

  pediatricMeningitis: {
    id: 'pediatric-meningitis',
    name: 'Bacterial Meningitis',
    category: 'PICU',
    description: 'Template for suspected bacterial meningitis',
    vitals: {
      temperature: '>38.5',
      hr: '>150',
    },
    examination: {
      cns: 'Altered sensorium, neck rigidity, Kernig/Brudzinski sign positive, bulging fontanelle (infants).',
      cvs: 'Tachycardia.',
    },
    medications: [
      { name: 'Ceftriaxone', dose: '100mg/kg', route: 'IV', frequency: 'BD' },
      { name: 'Vancomycin', dose: '15mg/kg', route: 'IV', frequency: 'Q6H' },
      { name: 'Dexamethasone', dose: '0.15mg/kg', route: 'IV', frequency: 'Q6H (before antibiotics)' },
      { name: 'Paracetamol', dose: '15mg/kg', route: 'IV', frequency: 'Q6H' },
    ],
    note: 'Child with features of meningitis. CSF analysis shows elevated WBC, low glucose, high protein - suggestive of bacterial meningitis. Plan: IV antibiotics (Ceftriaxone + Vancomycin) for 10-14 days, dexamethasone to reduce neurological sequelae, monitor for complications (seizures, SIADH, subdural effusion), supportive care, hearing assessment before discharge.',
    keywords: ['meningitis', 'CNS infection', 'CSF', 'altered sensorium'],
  },

  pediatricSeizure: {
    id: 'pediatric-seizure',
    name: 'Status Epilepticus / Prolonged Seizures',
    category: 'PICU',
    description: 'Template for status epilepticus management',
    vitals: {
      temperature: 'Check for fever',
      spo2: 'Monitor during seizure',
    },
    examination: {
      cns: 'Seizure activity, post-ictal state, assess level of consciousness.',
    },
    medications: [
      { name: 'Lorazepam', dose: '0.1mg/kg', route: 'IV', frequency: 'STAT (repeat x1 if needed)' },
      { name: 'Phenytoin', dose: '20mg/kg loading', route: 'IV', frequency: 'Slow infusion' },
      { name: 'Levetiracetam', dose: '20-60mg/kg', route: 'IV', frequency: 'Loading dose' },
    ],
    note: 'Child with prolonged seizure/status epilepticus. Seizure terminated with IV Lorazepam. Plan: Investigate cause (electrolytes, glucose, neuroimaging, EEG), maintenance anti-epileptic (Phenytoin/Levetiracetam), monitor for recurrence, manage underlying cause (fever, infection, metabolic).',
    keywords: ['seizure', 'convulsion', 'status epilepticus', 'fits'],
  },

  pediatricDKA: {
    id: 'pediatric-dka',
    name: 'Diabetic Ketoacidosis (DKA)',
    category: 'PICU',
    description: 'Template for DKA management',
    vitals: {
      hr: '>120',
      rr: 'Deep (Kussmaul breathing)',
      bp: 'Monitor for shock',
    },
    examination: {
      cns: 'Altered sensorium, dehydration.',
      cvs: 'Tachycardia, poor perfusion.',
      chest: 'Kussmaul breathing (deep, labored).',
      otherFindings: 'Fruity breath odor.',
    },
    medications: [
      { name: 'IV fluid (NS)', dose: '10-20ml/kg bolus', route: 'IV', frequency: 'STAT if shock' },
      { name: 'Regular Insulin', dose: '0.1 units/kg/hr', route: 'IV', frequency: 'Continuous infusion' },
      { name: 'Potassium chloride', dose: 'As per protocol', route: 'IV', frequency: 'In maintenance fluids' },
    ],
    note: 'Child with new/known diabetes presenting with DKA (hyperglycemia, ketosis, acidosis). Plan: Fluid resuscitation (careful not to drop glucose too fast), insulin infusion (0.1U/kg/hr), monitor blood glucose hourly, electrolytes 2-4 hrly, avoid cerebral edema (gradual correction), transition to SC insulin when acidosis resolves.',
    keywords: ['DKA', 'diabetes', 'ketoacidosis', 'hyperglycemia'],
  },

  // ========== SNCU TEMPLATES ==========

  sncuLBW: {
    id: 'sncu-lbw',
    name: 'Low Birth Weight (LBW) Baby',
    category: 'SNCU',
    description: 'Template for LBW babies requiring special care',
    vitals: {
      temperature: '36.5-37.5 (maintain thermal neutral)',
      hr: '120-160',
      rr: '40-60',
    },
    examination: {
      cns: 'Active, good tone for gestational age.',
      cvs: 'S1S2 normal.',
      chest: 'Bilateral air entry equal.',
    },
    medications: [
      { name: 'Vitamin K', dose: '1mg', route: 'IM', frequency: 'STAT (at birth)' },
      { name: 'Iron + Folic acid', dose: 'As per weight', route: 'PO', frequency: 'OD (after 2 weeks)' },
    ],
    note: 'Low birth weight baby (weight <2.5kg). Currently stable, tolerating feeds. Plan: Kangaroo Mother Care (KMC), frequent small feeds (breast milk/formula), monitor for hypoglycemia/hypothermia, iron supplementation after 2 weeks, weight monitoring, immunizations as per schedule.',
    keywords: ['LBW', 'low birth weight', 'KMC', 'preterm'],
  },

  // ========== GENERAL TEMPLATES ==========

  generalAdmission: {
    id: 'general-admission',
    name: 'General Admission Note',
    category: 'General',
    description: 'Basic template for general patient admission',
    vitals: {},
    examination: {
      cns: '',
      cvs: '',
      chest: '',
      perAbdomen: '',
    },
    medications: [],
    note: 'Patient admitted for evaluation and management. Detailed history and examination documented. Investigations sent. Plan: Supportive care, monitor vitals, await investigation results, modify treatment as needed.',
    keywords: ['admission', 'general'],
  },
};

/**
 * Get all templates
 */
export const getAllTemplates = (): ClinicalTemplate[] => {
  return Object.values(clinicalTemplates);
};

/**
 * Get templates by category
 */
export const getTemplatesByCategory = (category: 'NICU' | 'PICU' | 'SNCU' | 'General'): ClinicalTemplate[] => {
  return Object.values(clinicalTemplates).filter((t) => t.category === category);
};

/**
 * Search templates by keyword
 */
export const searchTemplates = (query: string): ClinicalTemplate[] => {
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    return getAllTemplates();
  }

  return Object.values(clinicalTemplates).filter((template) => {
    return (
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.keywords.some((keyword) => keyword.toLowerCase().includes(lowerQuery))
    );
  });
};

/**
 * Get template by ID
 */
export const getTemplateById = (id: string): ClinicalTemplate | undefined => {
  return clinicalTemplates[id];
};

/**
 * Get recently used templates from localStorage
 */
export const getRecentTemplates = (): ClinicalTemplate[] => {
  try {
    const recentIds = JSON.parse(localStorage.getItem('recentTemplates') || '[]') as string[];
    return recentIds
      .map((id) => clinicalTemplates[id])
      .filter((template): template is ClinicalTemplate => template !== undefined)
      .slice(0, 5); // Top 5 recent
  } catch {
    return [];
  }
};

/**
 * Mark template as used (add to recent)
 */
export const markTemplateAsUsed = (templateId: string): void => {
  try {
    const recentIds = JSON.parse(localStorage.getItem('recentTemplates') || '[]') as string[];

    // Remove if already exists
    const filtered = recentIds.filter((id) => id !== templateId);

    // Add to beginning
    const updated = [templateId, ...filtered].slice(0, 10); // Keep max 10

    localStorage.setItem('recentTemplates', JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save recent template:', error);
  }
};

/**
 * Get favorite templates from localStorage
 */
export const getFavoriteTemplates = (): ClinicalTemplate[] => {
  try {
    const favoriteIds = JSON.parse(localStorage.getItem('favoriteTemplates') || '[]') as string[];
    return favoriteIds
      .map((id) => clinicalTemplates[id])
      .filter((template): template is ClinicalTemplate => template !== undefined);
  } catch {
    return [];
  }
};

/**
 * Toggle template favorite status
 */
export const toggleTemplateFavorite = (templateId: string): boolean => {
  try {
    const favoriteIds = JSON.parse(localStorage.getItem('favoriteTemplates') || '[]') as string[];

    const index = favoriteIds.indexOf(templateId);
    if (index > -1) {
      // Remove from favorites
      favoriteIds.splice(index, 1);
      localStorage.setItem('favoriteTemplates', JSON.stringify(favoriteIds));
      return false;
    } else {
      // Add to favorites
      favoriteIds.push(templateId);
      localStorage.setItem('favoriteTemplates', JSON.stringify(favoriteIds));
      return true;
    }
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    return false;
  }
};

/**
 * Check if template is favorited
 */
export const isTemplateFavorite = (templateId: string): boolean => {
  try {
    const favoriteIds = JSON.parse(localStorage.getItem('favoriteTemplates') || '[]') as string[];
    return favoriteIds.includes(templateId);
  } catch {
    return false;
  }
};

export default clinicalTemplates;
