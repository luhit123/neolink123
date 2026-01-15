/**
 * ICD-10 Type Definitions
 * Types for ICD-10 coding system integration
 */

// ICD-10 Code structure
export interface ICD10Code {
  code: string;
  description: string;
  shortDescription?: string;
  category: string;
  chapter: string;
  isNeonatal: boolean;
  isPediatric: boolean;
  commonAliases?: string[];
  relatedCodes?: string[];
}

// ICD-10 Suggestion from AI
export interface ICD10Suggestion {
  code: string;
  description: string;
  confidence: number;
  source: 'template' | 'ai' | 'manual' | 'history';
  isPrimary: boolean;
  extractedFrom?: string;
  category?: string;
}

// Patient's assigned ICD-10 codes
export interface PatientICD10 {
  id: string;
  patientId: string;
  code: string;
  description: string;
  isPrimary: boolean;
  assignedAt: string;
  assignedBy: string;
  assignedByName?: string;
  source: 'template' | 'ai' | 'manual';
  aiConfidence?: number;
  notes?: string;
}

// ICD-10 Search Result
export interface ICD10SearchResult {
  code: ICD10Code;
  relevanceScore: number;
  matchType: 'exact' | 'prefix' | 'description' | 'alias';
}

// ICD-10 Chapter categories
export interface ICD10Chapter {
  code: string;
  title: string;
  range: [string, string];
}

// Common ICD-10 chapters for neonatal/pediatric
export const NEONATAL_ICD10_CHAPTERS: ICD10Chapter[] = [
  {
    code: 'P',
    title: 'Certain conditions originating in the perinatal period',
    range: ['P00', 'P96']
  },
  {
    code: 'Q',
    title: 'Congenital malformations, deformations and chromosomal abnormalities',
    range: ['Q00', 'Q99']
  },
  {
    code: 'J',
    title: 'Diseases of the respiratory system',
    range: ['J00', 'J99']
  },
  {
    code: 'A-B',
    title: 'Certain infectious and parasitic diseases',
    range: ['A00', 'B99']
  },
  {
    code: 'E',
    title: 'Endocrine, nutritional and metabolic diseases',
    range: ['E00', 'E89']
  },
  {
    code: 'G',
    title: 'Diseases of the nervous system',
    range: ['G00', 'G99']
  },
  {
    code: 'R',
    title: 'Symptoms, signs and abnormal clinical and laboratory findings',
    range: ['R00', 'R99']
  }
];

// Diagnosis to ICD-10 mapping hints for common neonatal conditions
export interface DiagnosisMapping {
  keywords: string[];
  primaryCode: string;
  secondaryCodes?: string[];
  category: string;
}

export const COMMON_DIAGNOSIS_MAPPINGS: DiagnosisMapping[] = [
  {
    keywords: ['sepsis', 'septicemia', 'bacteremia'],
    primaryCode: 'P36.9',
    secondaryCodes: ['P36.0', 'P36.1', 'P36.2'],
    category: 'Neonatal Infections'
  },
  {
    keywords: ['rds', 'respiratory distress', 'hyaline membrane'],
    primaryCode: 'P22.0',
    secondaryCodes: ['P22.1', 'P22.8'],
    category: 'Respiratory Conditions'
  },
  {
    keywords: ['jaundice', 'hyperbilirubinemia', 'icterus'],
    primaryCode: 'P59.9',
    secondaryCodes: ['P59.0', 'P59.3', 'P58.0'],
    category: 'Neonatal Jaundice'
  },
  {
    keywords: ['hie', 'asphyxia', 'encephalopathy', 'birth asphyxia'],
    primaryCode: 'P91.60',
    secondaryCodes: ['P91.61', 'P91.62', 'P91.63'],
    category: 'Neurological Conditions'
  },
  {
    keywords: ['nec', 'necrotizing enterocolitis'],
    primaryCode: 'P77.9',
    secondaryCodes: ['P77.1', 'P77.2', 'P77.3'],
    category: 'Gastrointestinal Conditions'
  },
  {
    keywords: ['preterm', 'premature', 'prematurity'],
    primaryCode: 'P07.30',
    secondaryCodes: ['P07.31', 'P07.32', 'P07.33'],
    category: 'Prematurity'
  },
  {
    keywords: ['lbw', 'low birth weight', 'small for gestational'],
    primaryCode: 'P07.10',
    secondaryCodes: ['P07.14', 'P07.15', 'P07.16'],
    category: 'Birth Weight Issues'
  },
  {
    keywords: ['meconium aspiration', 'mas'],
    primaryCode: 'P24.01',
    secondaryCodes: ['P24.00'],
    category: 'Respiratory Conditions'
  },
  {
    keywords: ['pneumonia', 'congenital pneumonia'],
    primaryCode: 'P23.9',
    secondaryCodes: ['P23.0', 'P23.1', 'P23.6'],
    category: 'Respiratory Infections'
  },
  {
    keywords: ['apnea', 'apnoea'],
    primaryCode: 'P28.4',
    secondaryCodes: ['P28.3'],
    category: 'Respiratory Conditions'
  },
  {
    keywords: ['hypoglycemia', 'low sugar'],
    primaryCode: 'P70.4',
    secondaryCodes: ['P70.0', 'P70.1'],
    category: 'Metabolic Conditions'
  },
  {
    keywords: ['seizure', 'convulsion', 'fits'],
    primaryCode: 'P90',
    category: 'Neurological Conditions'
  },
  {
    keywords: ['pda', 'patent ductus', 'ductus arteriosus'],
    primaryCode: 'Q25.0',
    category: 'Congenital Cardiac'
  },
  {
    keywords: ['ivh', 'intraventricular hemorrhage', 'intraventricular haemorrhage'],
    primaryCode: 'P52.3',
    secondaryCodes: ['P52.0', 'P52.1', 'P52.2'],
    category: 'Intracranial Hemorrhage'
  },
  {
    keywords: ['rop', 'retinopathy of prematurity'],
    primaryCode: 'H35.10',
    secondaryCodes: ['H35.11', 'H35.12', 'H35.13'],
    category: 'Eye Conditions'
  }
];
