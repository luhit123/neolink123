// ==================== DISCHARGE ADVICE GENERATOR ====================
// Generates context-aware discharge advice based on diagnoses

// ==================== ADVICE BY DIAGNOSIS CATEGORY ====================

interface DiagnosisAdvice {
  keywords: string[]; // Keywords to match in diagnosis
  icd10Prefixes: string[]; // ICD-10 code prefixes to match
  advice: string[];
  warnings: string[];
  followUp?: string;
}

const DIAGNOSIS_ADVICE_MAP: DiagnosisAdvice[] = [
  // Prematurity
  {
    keywords: ['preterm', 'premature', 'prematurity', 'low birth weight', 'lbw', 'vlbw', 'elbw'],
    icd10Prefixes: ['P07'],
    advice: [
      'Continue Kangaroo Mother Care (KMC) - skin-to-skin contact for at least 1 hour, multiple times daily',
      'Feed baby on demand or every 2-3 hours; do not let baby sleep more than 3 hours without feeding',
      'Keep baby warm - maintain room temperature 25-28°C, dress baby in layers',
      'Monitor weight weekly - expected gain is 15-20g/kg/day',
      'Protect from infections - limit visitors, hand hygiene before handling baby',
      'Give Iron drops as prescribed from 2 weeks of age for preterm babies',
    ],
    warnings: [
      'Baby not gaining weight or losing weight',
      'Feeding less than usual or refusing feeds',
      'Body feels cold despite adequate clothing',
      'Excessive sleepiness or difficult to wake for feeds',
    ],
    followUp: 'Weekly weight check and developmental assessment at corrected age milestones'
  },

  // Respiratory Distress / RDS
  {
    keywords: ['respiratory distress', 'rds', 'breathing', 'oxygen', 'ventilator', 'cpap', 'surfactant'],
    icd10Prefixes: ['P22', 'P28'],
    advice: [
      'Watch for breathing problems - fast breathing, chest retractions, grunting',
      'Keep baby\'s nose clear; use saline drops if needed',
      'Position baby on back for sleep with head slightly elevated',
      'Avoid exposure to smoke, dust, and strong perfumes',
      'Complete any pending respiratory medications as prescribed',
    ],
    warnings: [
      'Fast breathing (>60 breaths/min) or difficulty breathing',
      'Blue discoloration of lips, tongue, or fingers (cyanosis)',
      'Nostrils flaring or chest pulling in with each breath',
      'Grunting sounds while breathing',
      'Apnea (pause in breathing >20 seconds)',
    ],
    followUp: 'Respiratory follow-up if baby required prolonged oxygen support'
  },

  // BPD / Chronic Lung Disease
  {
    keywords: ['bpd', 'bronchopulmonary dysplasia', 'chronic lung'],
    icd10Prefixes: ['P27.1'],
    advice: [
      'Baby may need home oxygen therapy - follow instructions carefully',
      'Keep follow-up appointments with pulmonologist',
      'Avoid crowded places and sick contacts during RSV season',
      'Ensure RSV immunoprophylaxis (Palivizumab) if eligible',
      'Report any increase in breathing effort or oxygen requirement',
    ],
    warnings: [
      'Increasing oxygen requirement or breathing difficulty',
      'Blue spells or color changes',
      'Poor feeding due to breathing issues',
      'Signs of respiratory infection (cough, runny nose, fever)',
    ],
    followUp: 'Pulmonology follow-up and RSV prophylaxis as scheduled'
  },

  // Birth Asphyxia / HIE
  {
    keywords: ['asphyxia', 'hie', 'hypoxic', 'encephalopathy', 'seizure', 'convulsion'],
    icd10Prefixes: ['P21', 'P91.6', 'P90'],
    advice: [
      'Watch for seizure activity - rhythmic jerking, staring, lip smacking',
      'Continue anticonvulsant medications exactly as prescribed',
      'Do not stop seizure medications without doctor\'s advice',
      'Developmental stimulation - talk to baby, gentle play, tummy time when awake',
      'Early intervention therapy referral for developmental support',
      'Keep all neurology follow-up appointments',
    ],
    warnings: [
      'Seizure activity - jerky movements, stiffening, eye rolling',
      'Excessive irritability or high-pitched crying',
      'Poor feeding or frequent vomiting',
      'Abnormal movements or posturing',
      'Excessive sleepiness or difficulty waking',
    ],
    followUp: 'Neurology follow-up, developmental assessment at 3, 6, 9, 12 months'
  },

  // Sepsis / Infection
  {
    keywords: ['sepsis', 'infection', 'meningitis', 'pneumonia', 'antibiotics'],
    icd10Prefixes: ['P36', 'P23', 'P39', 'G00', 'A41'],
    advice: [
      'Complete any remaining course of antibiotics as prescribed',
      'Maintain strict hand hygiene - wash hands before handling baby',
      'Watch for signs of recurrent infection',
      'Keep umbilical cord stump clean and dry',
      'Limit visitors and avoid contact with sick individuals',
      'Exclusive breastfeeding provides infection protection',
    ],
    warnings: [
      'Fever (temperature >100.4°F / 38°C) or very cold baby',
      'Poor feeding, vomiting, or abdominal distension',
      'Lethargy, excessive sleepiness, or irritability',
      'Skin rash, redness, or pus from any site',
      'Umbilical area becoming red, swollen, or foul-smelling',
    ],
    followUp: 'Post-sepsis follow-up, hearing screen if meningitis'
  },

  // Jaundice
  {
    keywords: ['jaundice', 'hyperbilirubinemia', 'phototherapy', 'bilirubin', 'yellow'],
    icd10Prefixes: ['P55', 'P57', 'P58', 'P59'],
    advice: [
      'Watch for return of yellow color in skin and eyes',
      'Ensure adequate feeding (8-12 times/day) to help clear bilirubin',
      'Expose baby to indirect sunlight (not direct) for short periods',
      'Keep follow-up appointment for bilirubin recheck if advised',
    ],
    warnings: [
      'Increasing yellow color of skin or eyes',
      'Yellow color spreading to arms, legs, palms, or soles',
      'Baby becoming very sleepy and difficult to wake for feeds',
      'High-pitched cry or arching of back',
      'Poor feeding or signs of dehydration',
    ],
    followUp: 'Bilirubin recheck as advised, typically within 24-48 hours after discharge'
  },

  // PDA / Cardiac Issues
  {
    keywords: ['pda', 'patent ductus', 'heart', 'cardiac', 'murmur', 'vsd', 'asd'],
    icd10Prefixes: ['Q25.0', 'Q21', 'Q20', 'P29.3'],
    advice: [
      'Watch for signs of heart failure - fast breathing, sweating during feeds',
      'Feed in upright position; small frequent feeds if tiring easily',
      'Monitor weight closely - poor weight gain may indicate heart strain',
      'Keep all cardiology follow-up appointments',
      'Complete cardiac medications as prescribed',
    ],
    warnings: [
      'Fast or difficult breathing, especially during feeding',
      'Sweating during feeds or around the head',
      'Blue discoloration of lips or fingernails',
      'Poor weight gain despite adequate feeding',
      'Excessive tiredness, taking long to finish feeds',
    ],
    followUp: 'Pediatric cardiology follow-up with echocardiogram as scheduled'
  },

  // NEC
  {
    keywords: ['nec', 'necrotizing enterocolitis', 'abdominal'],
    icd10Prefixes: ['P77'],
    advice: [
      'Feed as per doctor\'s instructions - gradual advancement',
      'Watch for feeding intolerance signs',
      'Monitor stool pattern - color, consistency, frequency',
      'Report any abdominal distension immediately',
    ],
    warnings: [
      'Abdominal distension or bloating',
      'Blood in stool or dark/black colored stool',
      'Vomiting, especially bilious (green) vomit',
      'Refusing feeds or increasing residuals',
      'Temperature instability or lethargy',
    ],
    followUp: 'Surgical follow-up if operated, growth monitoring'
  },

  // ROP
  {
    keywords: ['rop', 'retinopathy', 'eye', 'vision'],
    icd10Prefixes: ['H35.1'],
    advice: [
      'Keep all ophthalmology (ROP screening) appointments - VERY IMPORTANT',
      'Protect baby\'s eyes from bright lights',
      'Watch for eye tracking and following objects by 2-3 months',
      'Complete ROP screening schedule until retina is fully mature',
    ],
    warnings: [
      'Missing ROP screening appointments can lead to permanent vision loss',
      'White reflex in pupil (leukocoria)',
      'Baby not tracking faces or objects by 3 months corrected age',
      'Eye turning inward or outward (squint)',
    ],
    followUp: 'ROP screening every 1-2 weeks until retina fully vascularized'
  },

  // IVH / Brain Hemorrhage
  {
    keywords: ['ivh', 'intraventricular', 'hemorrhage', 'brain bleed', 'hydrocephalus'],
    icd10Prefixes: ['P52'],
    advice: [
      'Watch for signs of increased intracranial pressure',
      'Monitor head circumference weekly - report rapid increase',
      'Developmental stimulation appropriate for corrected age',
      'Early intervention services referral',
    ],
    warnings: [
      'Rapid increase in head size',
      'Bulging fontanelle (soft spot)',
      'Sunset sign (eyes looking downward)',
      'Increasing irritability or high-pitched cry',
      'Vomiting, poor feeding, or excessive sleepiness',
    ],
    followUp: 'Head ultrasound follow-up, neurodevelopmental assessment'
  },

  // Anemia
  {
    keywords: ['anemia', 'transfusion', 'low hemoglobin', 'iron'],
    icd10Prefixes: ['P61.2', 'P61.4'],
    advice: [
      'Give Iron supplements as prescribed',
      'Include iron-rich foods when starting solids (after 6 months)',
      'Iron drops can cause dark stools - this is normal',
      'Complete full course of iron supplementation',
    ],
    warnings: [
      'Pale appearance or pale conjunctiva (inside of eyelids)',
      'Excessive tiredness or poor activity',
      'Fast breathing or fast heart rate',
      'Poor feeding or weight gain',
    ],
    followUp: 'Hemoglobin check as advised by doctor'
  },

  // Hypoglycemia
  {
    keywords: ['hypoglycemia', 'low sugar', 'blood sugar', 'glucose'],
    icd10Prefixes: ['P70.4'],
    advice: [
      'Feed frequently - do not let baby go more than 3 hours without feeding',
      'Wake baby for feeds if sleeping too long',
      'Watch for signs of low blood sugar',
    ],
    warnings: [
      'Jitteriness or tremors',
      'Excessive sleepiness or lethargy',
      'Poor feeding or weak suck',
      'Seizures or abnormal movements',
      'High-pitched or weak cry',
    ],
    followUp: 'Blood sugar monitoring may be needed initially at home'
  },

  // MAS
  {
    keywords: ['meconium aspiration', 'mas', 'meconium'],
    icd10Prefixes: ['P24'],
    advice: [
      'Watch for respiratory distress signs',
      'Keep follow-up for lung recovery assessment',
      'Avoid exposure to respiratory irritants',
    ],
    warnings: [
      'Persistent cough or breathing difficulty',
      'Fast breathing or chest retractions',
      'Blue discoloration around lips',
      'Poor feeding due to breathing issues',
    ],
    followUp: 'Respiratory follow-up if required'
  },

  // Congenital Anomalies
  {
    keywords: ['congenital', 'anomaly', 'malformation', 'cleft', 'hernia', 'atresia'],
    icd10Prefixes: ['Q'],
    advice: [
      'Keep all surgical and specialty follow-up appointments',
      'Follow specific care instructions for the condition',
      'Watch for any new symptoms or changes',
    ],
    warnings: [
      'Any new symptoms related to the condition',
      'Signs of infection at surgical sites',
      'Breathing or feeding difficulties',
    ],
    followUp: 'Specialty follow-up as per condition'
  },
];

// ==================== GENERAL ADVICE FOR ALL NEONATES ====================

const GENERAL_NEONATAL_ADVICE = [
  // Breastfeeding
  'Continue exclusive breastfeeding for first 6 months; feed on demand (8-12 times/day)',
  'Ensure good latch - baby\'s mouth should cover most of the areola',
  'Mother should maintain adequate nutrition and hydration for milk production',

  // Hygiene & Care
  'Wash hands thoroughly with soap before handling baby',
  'Keep umbilical stump clean and dry; do not apply anything on it',
  'Give bath only after umbilical cord falls off (usually 7-10 days)',

  // Warmth
  'Keep baby warm - maintain room temperature, dress in layers',
  'Practice Kangaroo Mother Care (skin-to-skin contact) daily',

  // Immunization
  'Complete all vaccinations as per schedule',
  'Do not miss scheduled immunization dates',

  // Safety
  'Always place baby on back to sleep (reduces SIDS risk)',
  'Never leave baby unattended on bed, table, or any elevated surface',
  'Avoid exposure to cigarette smoke and strong fumes',

  // Follow-up
  'Attend all scheduled follow-up appointments',
  'Maintain the baby\'s health card with all records',
];

const GENERAL_WARNING_SIGNS = [
  'Difficulty breathing or fast breathing (>60 breaths/min)',
  'Not feeding well or refusing to feed',
  'Fever (>100.4°F/38°C) or body feeling very cold',
  'Yellow discoloration of skin/eyes (jaundice)',
  'Excessive sleepiness or difficult to wake',
  'Convulsions or abnormal movements',
  'Umbilical redness, swelling, or foul-smelling discharge',
  'Skin rash, pustules, or boils',
  'Persistent vomiting or abdominal distension',
  'Blood in stool or no stool for >48 hours',
];

// ==================== MAIN GENERATOR FUNCTION ====================

export interface GeneratedAdvice {
  advice: string[];
  warnings: string[];
  followUpNotes: string[];
}

export function generateDischargeAdviceFromDiagnosis(
  diagnosisText: string,
  isNICU: boolean = true
): GeneratedAdvice {
  const advice: Set<string> = new Set();
  const warnings: Set<string> = new Set();
  const followUpNotes: Set<string> = new Set();

  const diagnosisLower = diagnosisText.toLowerCase();

  // Check each diagnosis category
  DIAGNOSIS_ADVICE_MAP.forEach(category => {
    // Check keywords
    const keywordMatch = category.keywords.some(keyword =>
      diagnosisLower.includes(keyword.toLowerCase())
    );

    // Check ICD-10 codes
    const icd10Match = category.icd10Prefixes.some(prefix => {
      const regex = new RegExp(`\\[${prefix}`, 'i');
      return regex.test(diagnosisText);
    });

    if (keywordMatch || icd10Match) {
      category.advice.forEach(a => advice.add(a));
      category.warnings.forEach(w => warnings.add(w));
      if (category.followUp) {
        followUpNotes.add(category.followUp);
      }
    }
  });

  // Add general advice
  GENERAL_NEONATAL_ADVICE.forEach(a => advice.add(a));

  // Add general warning signs (but avoid duplicates)
  GENERAL_WARNING_SIGNS.forEach(w => {
    // Check if a similar warning already exists
    const exists = Array.from(warnings).some(existing =>
      existing.toLowerCase().includes(w.substring(0, 20).toLowerCase()) ||
      w.toLowerCase().includes(existing.substring(0, 20).toLowerCase())
    );
    if (!exists) {
      warnings.add(w);
    }
  });

  // Sort advice - diagnosis-specific first, then general
  const adviceArray = Array.from(advice);
  const specificAdvice = adviceArray.filter(a => !GENERAL_NEONATAL_ADVICE.includes(a));
  const generalAdvice = adviceArray.filter(a => GENERAL_NEONATAL_ADVICE.includes(a));

  return {
    advice: [...specificAdvice, ...generalAdvice],
    warnings: Array.from(warnings),
    followUpNotes: Array.from(followUpNotes),
  };
}

// ==================== QUICK ACCESS ADVICE BY CONDITION ====================

export function getQuickAdviceForCondition(condition: string): string[] {
  const conditionLower = condition.toLowerCase();

  for (const category of DIAGNOSIS_ADVICE_MAP) {
    const match = category.keywords.some(k => conditionLower.includes(k));
    if (match) {
      return category.advice;
    }
  }

  return [];
}

export function getQuickWarningsForCondition(condition: string): string[] {
  const conditionLower = condition.toLowerCase();

  for (const category of DIAGNOSIS_ADVICE_MAP) {
    const match = category.keywords.some(k => conditionLower.includes(k));
    if (match) {
      return category.warnings;
    }
  }

  return [];
}
