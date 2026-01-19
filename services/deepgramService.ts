/**
 * Deepgram Speech-to-Text Service
 *
 * Uses Deepgram API for medical speech transcription
 * Optimized for clinical terminology and medical dictation
 *
 * Model: Nova-3 (Latest and most accurate Deepgram model)
 * Features: Punctuation, numerals, smart formatting, real-time streaming
 *
 * Supports:
 * - Live streaming transcription (real-time)
 * - Pre-recorded transcription (batch)
 */

/**
 * Check if Deepgram is configured
 */
export const isDeepgramConfigured = (): boolean => {
  return !!import.meta.env.VITE_DEEPGRAM_API_KEY;
};

/**
 * Live streaming transcription connection
 */
let liveConnection: WebSocket | null = null;
let mediaRecorder: MediaRecorder | null = null;
let audioChunkBuffer: Blob[] = []; // Buffer to hold audio chunks while WebSocket connects
let isWebSocketReady = false; // Track WebSocket ready state
let connectionRetryCount = 0;
const MAX_RETRY_COUNT = 3;

/**
 * Get Deepgram API key from environment
 */
const getDeepgramApiKey = (): string => {
  const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error('Deepgram API key not configured. Please set VITE_DEEPGRAM_API_KEY in .env file');
  }
  return apiKey;
};

/**
 * Medical keywords and phrases to enhance transcription accuracy
 * Comprehensive list of 1000+ NICU/PICU medical terminology
 */
const MEDICAL_KEYWORDS = [
  // ===== VITALS AND MEASUREMENTS =====
  'temperature', 'heart rate', 'respiratory rate', 'SpO2', 'blood pressure', 'oxygen saturation',
  'capillary refill time', 'CRT', 'weight', 'temp', 'HR', 'RR', 'BP', 'pulse', 'saturation',
  'febrile', 'afebrile', 'hypothermia', 'hyperthermia', 'normothermic', 'pyrexia', 'fever',
  'systolic', 'diastolic', 'mean arterial pressure', 'MAP', 'pulse oximetry', 'oximeter',
  'sphygmomanometer', 'thermometer', 'rectal temperature', 'axillary temperature',
  'core temperature', 'peripheral temperature', 'central temperature', 'temperature gradient',
  'head circumference', 'length', 'height', 'BMI', 'body mass index', 'percentile',
  'growth chart', 'z-score', 'weight gain', 'weight loss', 'birth weight',

  // ===== RESPIRATORY / CHEST / PULMONARY =====
  'CPAP', 'PEEP', 'FiO2', 'PIP', 'MAP', 'SIMV', 'IPPV', 'HFOV', 'HFNC', 'BiPAP',
  'ventilator', 'intubated', 'extubated', 'air entry', 'bilateral', 'breath sounds',
  'retractions', 'subcostal', 'intercostal', 'grunting', 'nasal flaring', 'chest',
  'tachypnea', 'apnea', 'desaturation', 'crepitations', 'wheeze', 'rhonchi', 'rales',
  'bronchial', 'vesicular', 'stridor', 'equal air entry', 'decreased air entry',
  'oxygen', 'room air', 'nasal prongs', 'face mask', 'endotracheal tube', 'ETT',
  'tracheostomy', 'ventilation', 'oxygenation', 'hypoxia', 'hypoxemia', 'hyperoxia',
  'hypercapnia', 'hypocapnia', 'respiratory distress', 'respiratory failure',
  'mechanical ventilation', 'pressure support', 'volume control', 'pressure control',
  'inspiratory time', 'expiratory time', 'I:E ratio', 'tidal volume', 'minute ventilation',
  'peak inspiratory pressure', 'positive end expiratory pressure', 'mean airway pressure',
  'high frequency oscillatory ventilation', 'high flow nasal cannula', 'low flow',
  'nasal cannula', 'simple mask', 'non-rebreather mask', 'Venturi mask', 'ambu bag',
  'bag mask ventilation', 'manual ventilation', 'self-inflating bag', 'flow-inflating bag',
  'laryngoscope', 'blade', 'Miller', 'Macintosh', 'video laryngoscope', 'stylet',
  'suction', 'suctioning', 'secretions', 'thick secretions', 'thin secretions',
  'mucus', 'sputum', 'hemoptysis', 'pneumothorax', 'pneumomediastinum', 'pleural effusion',
  'atelectasis', 'consolidation', 'infiltrate', 'hyperinflation', 'air trapping',
  'bronchospasm', 'bronchodilator', 'nebulizer', 'metered dose inhaler', 'MDI', 'spacer',
  'chest physiotherapy', 'CPT', 'percussion', 'vibration', 'postural drainage',
  'pulmonary toilet', 'airway clearance', 'lung recruitment', 'prone positioning',
  'surfactant deficiency', 'surfactant replacement', 'Curosurf', 'Survanta', 'Infasurf',
  'pulmonary hypertension', 'PPHN', 'persistent pulmonary hypertension', 'pulmonary vasodilator',
  'nitric oxide', 'iNO', 'inhaled nitric oxide', 'sildenafil', 'bosentan',

  // ===== CNS (CENTRAL NERVOUS SYSTEM) / NEUROLOGY =====
  'CNS', 'alert', 'active', 'lethargic', 'irritable', 'encephalopathic', 'conscious',
  'fontanelle', 'anterior fontanelle', 'posterior fontanelle', 'bulging', 'sunken', 'flat', 'tense',
  'seizures', 'convulsions', 'tone', 'hypotonia', 'hypertonia', 'normal tone', 'spasticity',
  'Moro reflex', 'suck reflex', 'grasp reflex', 'rooting reflex', 'reflexes intact',
  'pupils', 'PERRLA', 'reactive', 'sluggish', 'fixed', 'dilated', 'constricted', 'anisocoria',
  'GCS', 'Glasgow coma scale', 'oriented', 'drowsy', 'stuporous', 'comatose', 'obtunded',
  'neurological', 'neurology', 'cerebral', 'cerebellar', 'brainstem', 'spinal cord',
  'meninges', 'meningitis', 'encephalitis', 'meningoencephalitis', 'ventriculitis',
  'hydrocephalus', 'ventriculomegaly', 'macrocephaly', 'microcephaly', 'craniosynostosis',
  'sutures', 'sagittal', 'coronal', 'lambdoid', 'metopic', 'overriding sutures',
  'intracranial pressure', 'ICP', 'cerebral edema', 'herniation', 'cushing triad',
  'nystagmus', 'opisthotonos', 'decerebrate', 'decorticate', 'posturing',
  'tremor', 'jitteriness', 'clonus', 'ankle clonus', 'hyperreflexia', 'hyporeflexia', 'areflexia',
  'Babinski', 'plantar reflex', 'deep tendon reflexes', 'DTR', 'patellar', 'biceps', 'triceps',
  'cranial nerves', 'facial nerve', 'vagus', 'glossopharyngeal', 'hypoglossal',
  'EEG', 'electroencephalogram', 'aEEG', 'amplitude integrated EEG', 'burst suppression',
  'background activity', 'seizure activity', 'epileptiform', 'sharp waves', 'spikes',
  'therapeutic hypothermia', 'cooling', 'rewarming', 'neuroprotection',

  // ===== CVS (CARDIOVASCULAR SYSTEM) =====
  'CVS', 'cardiovascular', 'S1', 'S2', 'S3', 'S4', 'heart sounds', 'murmur', 'systolic murmur', 'diastolic murmur',
  'tachycardia', 'bradycardia', 'arrhythmia', 'regular rhythm', 'irregular', 'sinus rhythm',
  'cyanosis', 'central cyanosis', 'peripheral cyanosis', 'acrocyanosis', 'circumoral cyanosis',
  'perfusion', 'well perfused', 'poorly perfused', 'mottled', 'pallor', 'flushed',
  'pulses', 'femoral', 'brachial', 'radial', 'dorsalis pedis', 'palpable', 'feeble', 'bounding',
  'capillary refill', 'edema', 'JVP', 'jugular venous pressure', 'distension',
  'cardiac', 'cardiomegaly', 'cardiomyopathy', 'myocarditis', 'pericarditis', 'pericardial effusion',
  'cardiac tamponade', 'cardiac arrest', 'asystole', 'pulseless electrical activity', 'PEA',
  'ventricular fibrillation', 'VF', 'ventricular tachycardia', 'VT', 'SVT', 'supraventricular tachycardia',
  'atrial fibrillation', 'atrial flutter', 'heart block', 'first degree', 'second degree', 'third degree',
  'conduction', 'QRS', 'QT interval', 'PR interval', 'ST segment', 'T wave', 'P wave',
  'ECG', 'EKG', 'electrocardiogram', 'rhythm strip', 'telemetry', 'cardiac monitor',
  'echocardiogram', 'echo', 'transthoracic', 'transesophageal', 'ejection fraction', 'EF',
  'shortening fraction', 'SF', 'cardiac output', 'stroke volume', 'preload', 'afterload',
  'contractility', 'inotropic', 'chronotropic', 'dromotropic', 'lusitropic',
  'congenital heart disease', 'CHD', 'cyanotic', 'acyanotic', 'duct dependent',
  'PDA', 'patent ductus arteriosus', 'ASD', 'atrial septal defect', 'VSD', 'ventricular septal defect',
  'AVSD', 'atrioventricular septal defect', 'TOF', 'tetralogy of Fallot', 'TGA', 'transposition',
  'coarctation', 'aortic stenosis', 'pulmonary stenosis', 'tricuspid atresia', 'HLHS',
  'hypoplastic left heart syndrome', 'truncus arteriosus', 'TAPVR', 'Ebstein anomaly',
  'Fontan', 'Glenn', 'Norwood', 'Blalock-Taussig', 'shunt', 'palliative', 'corrective',

  // ===== PER ABDOMEN (PA) / GASTROINTESTINAL =====
  'abdomen', 'per abdomen', 'PA', 'soft', 'distended', 'tender', 'non-tender', 'scaphoid',
  'bowel sounds', 'present', 'absent', 'sluggish', 'hyperactive', 'normoactive',
  'hepatomegaly', 'splenomegaly', 'hepatosplenomegaly', 'organomegaly', 'liver', 'spleen',
  'umbilicus', 'healthy', 'oozing', 'granuloma', 'hernia', 'inguinal', 'umbilical hernia',
  'guarding', 'rigidity', 'rebound tenderness', 'ascites', 'shifting dullness', 'fluid wave',
  'gastric', 'intestinal', 'colonic', 'rectal', 'anal', 'perianal',
  'vomiting', 'regurgitation', 'reflux', 'GERD', 'gastroesophageal reflux',
  'diarrhea', 'constipation', 'obstipation', 'ileus', 'paralytic ileus',
  'meconium', 'meconium passage', 'delayed meconium', 'meconium plug', 'meconium ileus',
  'stool', 'loose stools', 'formed stools', 'bloody stools', 'melena', 'hematochezia',
  'abdominal distension', 'abdominal girth', 'gaseous distension', 'air fluid levels',
  'NEC', 'necrotizing enterocolitis', 'Bell staging', 'pneumatosis', 'portal venous gas',
  'perforation', 'free air', 'pneumoperitoneum', 'peritonitis', 'septic abdomen',
  'malrotation', 'volvulus', 'intussusception', 'obstruction', 'atresia', 'stenosis',
  'esophageal atresia', 'tracheoesophageal fistula', 'TEF', 'duodenal atresia', 'jejunal atresia',
  'Hirschsprung disease', 'anorectal malformation', 'imperforate anus', 'gastroschisis', 'omphalocele',

  // ===== GENITOURINARY / RENAL =====
  'GU', 'genitalia', 'normal', 'ambiguous', 'undescended testes', 'hypospadias', 'epispadias',
  'urine output', 'oliguria', 'anuria', 'polyuria', 'catheter', 'Foley', 'urinary catheter',
  'renal', 'kidney', 'kidneys', 'bilateral kidneys', 'hydronephrosis', 'hydroureter',
  'acute kidney injury', 'AKI', 'chronic kidney disease', 'CKD', 'renal failure',
  'creatinine', 'BUN', 'blood urea nitrogen', 'GFR', 'glomerular filtration rate',
  'proteinuria', 'hematuria', 'pyuria', 'bacteriuria', 'UTI', 'urinary tract infection',
  'pyelonephritis', 'cystitis', 'urethritis', 'vesicoureteral reflux', 'VUR',
  'circumcision', 'phimosis', 'paraphimosis', 'cryptorchidism', 'testicular torsion',
  'labial', 'scrotal', 'penile', 'clitoral', 'vaginal', 'urethral', 'meatal',
  'dialysis', 'peritoneal dialysis', 'hemodialysis', 'CRRT', 'continuous renal replacement therapy',

  // ===== SKIN / DERMATOLOGY =====
  'skin', 'jaundice', 'pallor', 'rash', 'petechiae', 'purpura', 'ecchymosis', 'bruising',
  'mottling', 'erythema', 'desquamation', 'vernix', 'lanugo', 'turgor', 'skin turgor',
  'cyanotic', 'pink', 'well perfused', 'warm', 'cold', 'clammy', 'diaphoretic',
  'birthmark', 'nevus', 'hemangioma', 'port wine stain', 'Mongolian spot', 'cafe au lait',
  'milia', 'miliaria', 'erythema toxicum', 'pustular melanosis', 'sebaceous hyperplasia',
  'eczema', 'dermatitis', 'contact dermatitis', 'diaper dermatitis', 'candidal rash',
  'vesicles', 'bullae', 'pustules', 'papules', 'macules', 'nodules', 'plaques',
  'scaling', 'crusting', 'weeping', 'oozing', 'ulceration', 'erosion', 'fissure',
  'cellulitis', 'abscess', 'impetigo', 'omphalitis', 'paronychia', 'necrotizing fasciitis',
  'wound', 'laceration', 'abrasion', 'contusion', 'hematoma', 'pressure ulcer', 'decubitus',
  'IV site', 'infiltration', 'extravasation', 'phlebitis', 'thrombophlebitis',

  // ===== HEMATOLOGY =====
  'anemia', 'polycythemia', 'thrombocytopenia', 'thrombocytosis', 'leukocytosis', 'leukopenia',
  'neutropenia', 'neutrophilia', 'lymphocytosis', 'lymphopenia', 'eosinophilia', 'basophilia',
  'hemoglobin', 'Hgb', 'hematocrit', 'Hct', 'RBC', 'red blood cells', 'WBC', 'white blood cells',
  'platelets', 'PLT', 'reticulocytes', 'reticulocyte count', 'MCV', 'MCH', 'MCHC', 'RDW',
  'coagulation', 'PT', 'prothrombin time', 'PTT', 'partial thromboplastin time', 'INR',
  'fibrinogen', 'D-dimer', 'FDP', 'fibrin degradation products', 'bleeding time',
  'DIC', 'disseminated intravascular coagulation', 'coagulopathy', 'hemorrhage', 'bleeding',
  'transfusion', 'blood transfusion', 'packed RBC', 'PRBC', 'FFP', 'fresh frozen plasma',
  'cryoprecipitate', 'platelet transfusion', 'exchange transfusion', 'double volume exchange',
  'blood type', 'Rh factor', 'cross match', 'direct Coombs', 'indirect Coombs', 'antibody screen',
  'hemolysis', 'hemolytic', 'jaundice', 'hyperbilirubinemia', 'kernicterus', 'bilirubin encephalopathy',
  'sickle cell', 'thalassemia', 'G6PD deficiency', 'spherocytosis', 'hemophilia', 'von Willebrand',

  // ===== ENDOCRINE / METABOLIC =====
  'glucose', 'blood glucose', 'blood sugar', 'hypoglycemia', 'hyperglycemia', 'normoglycemic',
  'insulin', 'glucagon', 'dextrose', 'D10', 'D5', 'GIR', 'glucose infusion rate',
  'electrolytes', 'sodium', 'potassium', 'chloride', 'bicarbonate', 'calcium', 'magnesium', 'phosphorus',
  'hyponatremia', 'hypernatremia', 'hypokalemia', 'hyperkalemia', 'hypocalcemia', 'hypercalcemia',
  'hypomagnesemia', 'hypermagnesemia', 'hypophosphatemia', 'hyperphosphatemia',
  'metabolic acidosis', 'metabolic alkalosis', 'respiratory acidosis', 'respiratory alkalosis',
  'anion gap', 'base deficit', 'base excess', 'pH', 'pCO2', 'pO2', 'HCO3', 'lactate',
  'ABG', 'arterial blood gas', 'VBG', 'venous blood gas', 'CBG', 'capillary blood gas',
  'thyroid', 'TSH', 'T3', 'T4', 'free T4', 'hypothyroid', 'hyperthyroid', 'congenital hypothyroidism',
  'cortisol', 'ACTH', 'adrenal', 'adrenal insufficiency', 'CAH', 'congenital adrenal hyperplasia',
  'inborn error of metabolism', 'IEM', 'metabolic screening', 'newborn screen', 'PKU', 'galactosemia',
  'ammonia', 'hyperammonemia', 'urea cycle defect', 'organic acidemia', 'fatty acid oxidation defect',

  // ===== INFECTIOUS DISEASE =====
  'infection', 'sepsis', 'septicemia', 'bacteremia', 'viremia', 'fungemia',
  'early onset sepsis', 'EOS', 'late onset sepsis', 'LOS', 'nosocomial', 'healthcare associated',
  'meningitis', 'pneumonia', 'urinary tract infection', 'UTI', 'skin infection', 'bone infection',
  'osteomyelitis', 'septic arthritis', 'endocarditis', 'peritonitis', 'cholangitis',
  'gram positive', 'gram negative', 'cocci', 'bacilli', 'anaerobic', 'aerobic',
  'Staphylococcus', 'Streptococcus', 'Enterococcus', 'E coli', 'Klebsiella', 'Pseudomonas',
  'MRSA', 'methicillin resistant', 'ESBL', 'extended spectrum beta lactamase', 'VRE', 'CRE',
  'Group B Strep', 'GBS', 'Listeria', 'Serratia', 'Acinetobacter', 'Enterobacter', 'Citrobacter',
  'Candida', 'fungal', 'yeast', 'Aspergillus', 'invasive candidiasis', 'candidemia',
  'viral', 'RSV', 'respiratory syncytial virus', 'CMV', 'cytomegalovirus', 'HSV', 'herpes simplex',
  'enterovirus', 'parechovirus', 'rotavirus', 'norovirus', 'adenovirus', 'rhinovirus', 'influenza',
  'COVID', 'coronavirus', 'HIV', 'hepatitis', 'EBV', 'Epstein Barr', 'parvovirus',
  'TORCH', 'toxoplasmosis', 'rubella', 'syphilis', 'congenital infection',
  'culture', 'blood culture', 'urine culture', 'CSF culture', 'wound culture', 'respiratory culture',
  'sensitivity', 'susceptibility', 'resistant', 'sensitive', 'intermediate', 'MIC',

  // ===== MEDICATIONS - VASOPRESSORS/INOTROPES =====
  'adrenaline', 'epinephrine', 'noradrenaline', 'norepinephrine', 'levophed',
  'dopamine', 'dobutamine', 'milrinone', 'vasopressin', 'terlipressin',
  'inotrope', 'vasopressor', 'chronotrope', 'pressor', 'inotropic support', 'vasopressor support',
  'phenylephrine', 'neosynephrine', 'isoproterenol', 'levosimendan',

  // ===== MEDICATIONS - ANTIBIOTICS =====
  'vancomycin', 'ampicillin', 'gentamicin', 'amikacin', 'tobramycin', 'streptomycin',
  'cefotaxime', 'ceftriaxone', 'ceftazidime', 'cefepime', 'cefazolin', 'cephalexin',
  'meropenem', 'imipenem', 'ertapenem', 'doripenem', 'carbapenem',
  'piperacillin', 'tazobactam', 'Zosyn', 'ampicillin sulbactam', 'Unasyn',
  'metronidazole', 'Flagyl', 'clindamycin', 'erythromycin', 'azithromycin', 'clarithromycin',
  'penicillin', 'cloxacillin', 'nafcillin', 'oxacillin', 'dicloxacillin',
  'linezolid', 'Zyvox', 'daptomycin', 'tigecycline', 'quinupristin', 'dalfopristin',
  'colistin', 'polymyxin', 'rifampin', 'rifampicin',
  'ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'fluoroquinolone',
  'trimethoprim', 'sulfamethoxazole', 'Bactrim', 'TMP-SMX', 'nitrofurantoin',

  // ===== MEDICATIONS - ANTIVIRALS =====
  'acyclovir', 'ganciclovir', 'valganciclovir', 'foscarnet', 'cidofovir',
  'oseltamivir', 'Tamiflu', 'zanamivir', 'ribavirin', 'remdesivir',
  'zidovudine', 'AZT', 'nevirapine', 'lopinavir', 'ritonavir', 'antiretroviral',

  // ===== MEDICATIONS - ANTIFUNGALS =====
  'fluconazole', 'Diflucan', 'amphotericin', 'amphotericin B', 'liposomal amphotericin',
  'micafungin', 'caspofungin', 'anidulafungin', 'echinocandin',
  'voriconazole', 'posaconazole', 'itraconazole', 'nystatin', 'clotrimazole',

  // ===== MEDICATIONS - SEDATIVES/ANALGESICS =====
  'fentanyl', 'morphine', 'hydromorphone', 'Dilaudid', 'methadone', 'oxycodone',
  'midazolam', 'Versed', 'lorazepam', 'Ativan', 'diazepam', 'Valium',
  'ketamine', 'propofol', 'Diprivan', 'dexmedetomidine', 'Precedex',
  'chloral hydrate', 'pentobarbital', 'thiopental',
  'opioid', 'benzodiazepine', 'sedation', 'analgesia', 'pain management',
  'naloxone', 'Narcan', 'flumazenil', 'Romazicon', 'reversal agent',
  'paracetamol', 'acetaminophen', 'Tylenol', 'ibuprofen', 'Motrin', 'Advil',
  'ketorolac', 'Toradol', 'naproxen', 'NSAID',

  // ===== MEDICATIONS - ANTICONVULSANTS =====
  'phenobarbital', 'phenobarbitone', 'phenytoin', 'Dilantin', 'fosphenytoin',
  'levetiracetam', 'Keppra', 'valproic acid', 'Depakote', 'carbamazepine', 'Tegretol',
  'topiramate', 'Topamax', 'lacosamide', 'Vimpat', 'oxcarbazepine', 'Trileptal',
  'clonazepam', 'Klonopin', 'clobazam', 'Onfi', 'vigabatrin', 'pyridoxine',
  'antiepileptic', 'anticonvulsant', 'seizure prophylaxis', 'therapeutic level',

  // ===== MEDICATIONS - CARDIAC =====
  'digoxin', 'Lanoxin', 'amiodarone', 'Cordarone', 'lidocaine', 'procainamide',
  'adenosine', 'Adenocard', 'atropine', 'esmolol', 'Brevibloc', 'propranolol', 'Inderal',
  'metoprolol', 'Lopressor', 'labetalol', 'Trandate', 'carvedilol', 'Coreg',
  'hydralazine', 'Apresoline', 'nicardipine', 'Cardene', 'nifedipine', 'Procardia',
  'enalapril', 'captopril', 'lisinopril', 'ACE inhibitor', 'losartan', 'ARB',
  'spironolactone', 'Aldactone', 'thiazide', 'hydrochlorothiazide',
  'aspirin', 'heparin', 'enoxaparin', 'Lovenox', 'warfarin', 'Coumadin', 'anticoagulant',
  'indomethacin', 'Indocin', 'ibuprofen', 'PDA closure',

  // ===== MEDICATIONS - DIURETICS =====
  'furosemide', 'Lasix', 'bumetanide', 'Bumex', 'torsemide', 'loop diuretic',
  'chlorothiazide', 'Diuril', 'metolazone', 'Zaroxolyn', 'thiazide diuretic',
  'spironolactone', 'Aldactone', 'amiloride', 'potassium sparing', 'diuresis',

  // ===== MEDICATIONS - GI =====
  'ranitidine', 'Zantac', 'famotidine', 'Pepcid', 'H2 blocker',
  'omeprazole', 'Prilosec', 'pantoprazole', 'Protonix', 'lansoprazole', 'Prevacid', 'PPI',
  'domperidone', 'metoclopramide', 'Reglan', 'erythromycin', 'prokinetic',
  'ondansetron', 'Zofran', 'granisetron', 'Kytril', 'antiemetic',
  'simethicone', 'Mylicon', 'lactulose', 'glycerin', 'polyethylene glycol', 'MiraLAX',
  'ursodiol', 'Actigall', 'cholestyramine', 'Questran',

  // ===== MEDICATIONS - ELECTROLYTES/SUPPLEMENTS =====
  'sodium chloride', 'normal saline', 'NS', 'half normal saline', 'hypertonic saline',
  'potassium chloride', 'KCl', 'potassium phosphate', 'potassium acetate',
  'calcium gluconate', 'calcium chloride', 'calcium carbonate',
  'magnesium sulfate', 'magnesium oxide', 'phosphorus', 'sodium phosphate',
  'sodium bicarbonate', 'bicarbonate', 'THAM', 'tromethamine', 'buffer',
  'dextrose', 'D5', 'D10', 'D12.5', 'D25', 'TPN', 'total parenteral nutrition',
  'lipids', 'Intralipid', 'SMOFlipid', 'amino acids', 'Trophamine', 'Aminosyn',
  'vitamin K', 'phytonadione', 'vitamin D', 'cholecalciferol', 'ergocalciferol',
  'iron', 'ferrous sulfate', 'iron dextran', 'EPO', 'erythropoietin', 'Epogen', 'Procrit',
  'zinc', 'selenium', 'chromium', 'copper', 'manganese', 'trace elements',

  // ===== MEDICATIONS - BLOOD PRODUCTS =====
  'packed red blood cells', 'PRBC', 'fresh frozen plasma', 'FFP',
  'platelets', 'platelet concentrate', 'single donor platelets', 'apheresis platelets',
  'cryoprecipitate', 'cryo', 'factor concentrate', 'Factor VII', 'Factor VIII', 'Factor IX',
  'albumin', 'albumin 5%', 'albumin 25%', 'colloid', 'crystalloid',
  'immunoglobulin', 'IVIG', 'intravenous immunoglobulin', 'Rh immune globulin', 'RhoGAM',
  'exchange transfusion', 'partial exchange', 'double volume exchange', 'phlebotomy',

  // ===== MEDICATIONS - OTHER =====
  'surfactant', 'Curosurf', 'Survanta', 'Infasurf', 'poractant', 'beractant', 'calfactant',
  'caffeine', 'caffeine citrate', 'aminophylline', 'theophylline', 'methylxanthine',
  'prostaglandin', 'PGE1', 'alprostadil', 'Prostin', 'ductal patency',
  'sildenafil', 'Viagra', 'Revatio', 'bosentan', 'Tracleer', 'epoprostenol', 'Flolan',
  'hydrocortisone', 'dexamethasone', 'Decadron', 'methylprednisolone', 'Solu-Medrol', 'prednisone',
  'corticosteroid', 'steroid', 'stress dose steroids', 'physiologic steroids',
  'vitamin A', 'retinol', 'vitamin E', 'tocopherol', 'vitamin C', 'ascorbic acid',
  'recombinant factor', 'antithrombin', 'protein C',

  // ===== MEDICATION ADMINISTRATION =====
  'inj', 'injection', 'IV', 'intravenous', 'IM', 'intramuscular', 'SC', 'subcutaneous',
  'oral', 'PO', 'per oral', 'NGT', 'nasogastric', 'OGT', 'orogastric', 'NJT', 'nasojejunal',
  'infusion', 'continuous infusion', 'intermittent', 'bolus', 'push', 'piggyback',
  'stat', 'loading dose', 'maintenance', 'taper', 'wean', 'titrate', 'escalate', 'de-escalate',
  'mg', 'milligram', 'mcg', 'microgram', 'gram', 'g', 'kg', 'kilogram',
  'ml', 'mL', 'milliliter', 'liter', 'L', 'cc',
  'units', 'international units', 'IU', 'mEq', 'milliequivalent', 'mmol', 'millimole',
  'mg/kg', 'mcg/kg', 'mg/kg/day', 'mg/kg/dose', 'mcg/kg/min', 'units/kg',
  'once daily', 'twice daily', 'three times daily', 'four times daily',
  'daily', 'BD', 'BID', 'TDS', 'TID', 'QID', 'QD', 'OD', 'every', 'q',
  'q4h', 'q6h', 'q8h', 'q12h', 'q24h', 'every 4 hours', 'every 6 hours', 'every 8 hours',
  'PRN', 'as needed', 'SOS', 'immediately', 'ASAP',
  'before meals', 'after meals', 'with meals', 'AC', 'PC', 'HS', 'at bedtime',
  'peripheral IV', 'PIV', 'central line', 'PICC', 'peripherally inserted central catheter',
  'UVC', 'umbilical venous catheter', 'UAC', 'umbilical arterial catheter',
  'arterial line', 'A-line', 'central venous pressure', 'CVP',

  // ===== DIAGNOSES - RESPIRATORY =====
  'RDS', 'respiratory distress syndrome', 'surfactant deficiency', 'hyaline membrane disease',
  'TTN', 'transient tachypnea of newborn', 'wet lung', 'retained lung fluid',
  'MAS', 'meconium aspiration syndrome', 'meconium aspiration', 'aspiration pneumonia',
  'BPD', 'bronchopulmonary dysplasia', 'chronic lung disease', 'CLD', 'oxygen dependency',
  'pneumonia', 'bacterial pneumonia', 'viral pneumonia', 'ventilator associated pneumonia', 'VAP',
  'atelectasis', 'lobar collapse', 'lung collapse', 'consolidation',
  'pneumothorax', 'tension pneumothorax', 'pneumomediastinum', 'pulmonary interstitial emphysema', 'PIE',
  'pleural effusion', 'chylothorax', 'hemothorax', 'empyema',
  'pulmonary hemorrhage', 'pulmonary edema', 'ARDS', 'acute respiratory distress syndrome',
  'PPHN', 'persistent pulmonary hypertension', 'pulmonary hypertension',
  'apnea of prematurity', 'central apnea', 'obstructive apnea', 'mixed apnea',
  'laryngomalacia', 'tracheomalacia', 'bronchomalacia', 'subglottic stenosis',
  'bronchiolitis', 'RSV bronchiolitis', 'croup', 'laryngotracheobronchitis', 'epiglottitis',
  'congenital diaphragmatic hernia', 'CDH', 'Bochdalek hernia', 'pulmonary hypoplasia',
  'congenital pulmonary airway malformation', 'CPAM', 'CCAM', 'pulmonary sequestration',

  // ===== DIAGNOSES - CARDIAC =====
  'CHD', 'congenital heart disease', 'congenital heart defect', 'structural heart disease',
  'PDA', 'patent ductus arteriosus', 'hemodynamically significant PDA', 'hsPDA',
  'ASD', 'atrial septal defect', 'secundum ASD', 'primum ASD', 'sinus venosus defect',
  'VSD', 'ventricular septal defect', 'muscular VSD', 'perimembranous VSD', 'inlet VSD', 'outlet VSD',
  'AVSD', 'atrioventricular septal defect', 'AV canal', 'endocardial cushion defect',
  'TOF', 'tetralogy of Fallot', 'Tet spell', 'cyanotic spell', 'hypercyanotic episode',
  'TGA', 'transposition of great arteries', 'd-TGA', 'l-TGA', 'corrected transposition',
  'coarctation of aorta', 'CoA', 'arch hypoplasia', 'interrupted aortic arch', 'IAA',
  'hypoplastic left heart', 'HLHS', 'hypoplastic left heart syndrome', 'single ventricle',
  'tricuspid atresia', 'pulmonary atresia', 'aortic atresia', 'mitral atresia',
  'Ebstein anomaly', 'truncus arteriosus', 'double outlet right ventricle', 'DORV',
  'TAPVR', 'total anomalous pulmonary venous return', 'PAPVR', 'partial anomalous',
  'aortic stenosis', 'AS', 'pulmonary stenosis', 'PS', 'mitral stenosis', 'MS',
  'aortic regurgitation', 'AR', 'pulmonary regurgitation', 'PR', 'mitral regurgitation', 'MR',
  'tricuspid regurgitation', 'TR', 'valvular disease', 'valve', 'stenotic', 'regurgitant',
  'cardiomyopathy', 'dilated cardiomyopathy', 'hypertrophic cardiomyopathy', 'restrictive cardiomyopathy',
  'myocarditis', 'pericarditis', 'pericardial effusion', 'cardiac tamponade',
  'arrhythmia', 'SVT', 'supraventricular tachycardia', 'atrial flutter', 'atrial fibrillation',
  'heart block', 'complete heart block', 'congenital heart block', 'long QT syndrome',
  'Wolff Parkinson White', 'WPW', 'accessory pathway', 'reentrant tachycardia',

  // ===== DIAGNOSES - NEUROLOGICAL =====
  'HIE', 'hypoxic ischemic encephalopathy', 'perinatal asphyxia', 'birth asphyxia',
  'seizures', 'neonatal seizures', 'epilepsy', 'status epilepticus', 'refractory seizures',
  'IVH', 'intraventricular hemorrhage', 'germinal matrix hemorrhage', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
  'PVL', 'periventricular leukomalacia', 'white matter injury', 'cystic PVL',
  'hydrocephalus', 'post hemorrhagic hydrocephalus', 'PHH', 'communicating', 'non-communicating',
  'meningitis', 'bacterial meningitis', 'viral meningitis', 'ventriculitis',
  'encephalitis', 'encephalopathy', 'septic encephalopathy', 'metabolic encephalopathy',
  'hypotonia', 'hypertonia', 'spasticity', 'dystonia', 'choreoathetosis',
  'cerebral palsy', 'CP', 'spastic diplegia', 'spastic quadriplegia', 'hemiplegia',
  'neural tube defect', 'spina bifida', 'meningocele', 'myelomeningocele', 'anencephaly',
  'Chiari malformation', 'Dandy Walker', 'agenesis of corpus callosum', 'holoprosencephaly',

  // ===== DIAGNOSES - HEMATOLOGICAL =====
  'anemia of prematurity', 'physiologic anemia', 'hemolytic anemia', 'aplastic anemia',
  'jaundice', 'neonatal jaundice', 'hyperbilirubinemia', 'unconjugated', 'conjugated', 'direct',
  'kernicterus', 'bilirubin encephalopathy', 'acute bilirubin encephalopathy',
  'Rh incompatibility', 'ABO incompatibility', 'hemolytic disease of newborn', 'HDN', 'erythroblastosis',
  'thrombocytopenia', 'neonatal alloimmune thrombocytopenia', 'NAIT', 'ITP',
  'polycythemia', 'hyperviscosity syndrome', 'partial exchange',
  'DIC', 'disseminated intravascular coagulation', 'consumptive coagulopathy',
  'hemorrhagic disease of newborn', 'VKDB', 'vitamin K deficiency bleeding',

  // ===== DIAGNOSES - INFECTIOUS =====
  'sepsis', 'neonatal sepsis', 'early onset sepsis', 'late onset sepsis', 'clinical sepsis',
  'culture positive sepsis', 'culture negative sepsis', 'presumed sepsis', 'suspected sepsis',
  'septic shock', 'severe sepsis', 'SIRS', 'systemic inflammatory response syndrome',
  'bacteremia', 'fungemia', 'candidemia', 'viremia',
  'meningitis', 'pneumonia', 'UTI', 'omphalitis', 'cellulitis', 'abscess',
  'osteomyelitis', 'septic arthritis', 'necrotizing fasciitis',
  'TORCH infections', 'congenital CMV', 'congenital toxoplasmosis', 'congenital rubella',
  'congenital syphilis', 'congenital HSV', 'disseminated HSV', 'HSV encephalitis',
  'GBS disease', 'Group B streptococcal disease', 'E coli sepsis', 'Listeria',

  // ===== DIAGNOSES - METABOLIC/ENDOCRINE =====
  'hypoglycemia', 'neonatal hypoglycemia', 'persistent hypoglycemia', 'hyperinsulinism',
  'hyperglycemia', 'neonatal diabetes', 'transient neonatal diabetes',
  'congenital hypothyroidism', 'transient hypothyroidism', 'thyrotoxicosis',
  'CAH', 'congenital adrenal hyperplasia', '21 hydroxylase deficiency', 'salt wasting',
  'adrenal insufficiency', 'adrenal crisis', 'hypoadrenalism',
  'inborn error of metabolism', 'IEM', 'metabolic disorder',
  'PKU', 'phenylketonuria', 'galactosemia', 'maple syrup urine disease', 'MSUD',
  'organic acidemia', 'methylmalonic acidemia', 'propionic acidemia', 'isovaleric acidemia',
  'urea cycle defect', 'ornithine transcarbamylase deficiency', 'OTC deficiency',
  'fatty acid oxidation defect', 'MCAD', 'VLCAD', 'LCHAD',
  'mitochondrial disorder', 'lactic acidosis', 'pyruvate metabolism disorder',

  // ===== DIAGNOSES - NEONATAL/PERINATAL =====
  'prematurity', 'preterm', 'late preterm', 'extremely preterm', 'moderately preterm',
  'term', 'post term', 'post dates', 'small for gestational age', 'SGA',
  'appropriate for gestational age', 'AGA', 'large for gestational age', 'LGA',
  'IUGR', 'intrauterine growth restriction', 'FGR', 'fetal growth restriction', 'symmetric', 'asymmetric',
  'low birth weight', 'LBW', 'very low birth weight', 'VLBW', 'extremely low birth weight', 'ELBW',
  'macrosomia', 'infant of diabetic mother', 'IDM', 'gestational diabetes',
  'ROP', 'retinopathy of prematurity', 'plus disease', 'laser treatment', 'anti-VEGF',
  'NEC', 'necrotizing enterocolitis', 'Bell stage', 'surgical NEC', 'medical NEC',
  'spontaneous intestinal perforation', 'SIP', 'focal intestinal perforation',
  'bronchopulmonary dysplasia', 'BPD', 'chronic lung disease',
  'periventricular hemorrhage', 'periventricular leukomalacia',
  'apnea of prematurity', 'bradycardia of prematurity', 'desaturation',
  'feeding intolerance', 'poor feeding', 'feeding difficulty',

  // ===== PROCEDURES =====
  'intubation', 'extubation', 'reintubation', 'elective intubation', 'emergent intubation',
  'lumbar puncture', 'LP', 'spinal tap', 'CSF collection', 'traumatic tap',
  'blood draw', 'venipuncture', 'arterial puncture', 'heel stick', 'capillary sample',
  'IV insertion', 'peripheral IV', 'PIV', 'IV access', 'difficult access',
  'central line placement', 'PICC insertion', 'central venous catheter', 'CVC',
  'UVC insertion', 'umbilical venous catheterization', 'UAC insertion', 'umbilical arterial catheterization',
  'arterial line', 'A-line', 'peripheral arterial line',
  'chest tube', 'thoracostomy', 'tube thoracostomy', 'needle decompression', 'thoracentesis',
  'paracentesis', 'abdominal tap', 'peritoneal drain',
  'exchange transfusion', 'double volume exchange', 'partial exchange',
  'surfactant administration', 'INSURE', 'LISA', 'less invasive surfactant administration',
  'therapeutic hypothermia', 'cooling', 'total body cooling', 'selective head cooling',
  'phototherapy', 'intensive phototherapy', 'double phototherapy', 'bili lights',
  'circumcision', 'frenotomy', 'frenulectomy', 'tongue tie release',
  'ROP screening', 'eye exam', 'hearing screen', 'ABR', 'OAE', 'AABR',
  'cardiac catheterization', 'cath', 'interventional catheterization', 'balloon atrial septostomy', 'Rashkind',
  'surgery', 'laparotomy', 'thoracotomy', 'sternotomy', 'craniotomy', 'VP shunt',
  'ostomy', 'ileostomy', 'colostomy', 'gastrostomy', 'G-tube', 'jejunostomy', 'J-tube',
  'tracheostomy', 'trach',

  // ===== LAB TESTS / VALUES =====
  'CBC', 'complete blood count', 'hemoglobin', 'hematocrit', 'WBC', 'differential',
  'neutrophils', 'bands', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils',
  'I/T ratio', 'immature to total ratio', 'absolute neutrophil count', 'ANC',
  'platelets', 'platelet count', 'MPV', 'mean platelet volume',
  'reticulocyte count', 'retic', 'corrected reticulocyte count',
  'blood type', 'type and screen', 'type and crossmatch', 'antibody screen',
  'direct Coombs', 'indirect Coombs', 'DAT', 'direct antiglobulin test',
  'bilirubin', 'total bilirubin', 'direct bilirubin', 'indirect bilirubin', 'conjugated', 'unconjugated',
  'CRP', 'C reactive protein', 'procalcitonin', 'PCT', 'ESR', 'sed rate',
  'BMP', 'basic metabolic panel', 'CMP', 'comprehensive metabolic panel',
  'sodium', 'potassium', 'chloride', 'bicarbonate', 'CO2', 'anion gap',
  'BUN', 'creatinine', 'GFR', 'glucose', 'calcium', 'ionized calcium', 'magnesium', 'phosphorus',
  'AST', 'ALT', 'GGT', 'alkaline phosphatase', 'ALP', 'LDH', 'total protein', 'albumin',
  'ammonia', 'lactate', 'lactic acid', 'pyruvate',
  'PT', 'INR', 'PTT', 'aPTT', 'fibrinogen', 'D-dimer', 'FDP',
  'blood gas', 'ABG', 'VBG', 'CBG', 'pH', 'pCO2', 'pO2', 'HCO3', 'base excess', 'base deficit',
  'blood culture', 'urine culture', 'CSF culture', 'wound culture', 'ET culture', 'respiratory culture',
  'CSF analysis', 'CSF glucose', 'CSF protein', 'CSF cell count', 'CSF gram stain',
  'urinalysis', 'UA', 'urine specific gravity', 'urine pH',
  'newborn screen', 'metabolic screen', 'tandem mass spectrometry',
  'thyroid function', 'TSH', 'T4', 'free T4', 'T3',
  'cortisol', 'ACTH', '17-OHP', '17 hydroxyprogesterone',
  'drug level', 'trough', 'peak', 'therapeutic level', 'toxic level',

  // ===== EQUIPMENT =====
  'ventilator', 'conventional ventilator', 'high frequency ventilator', 'oscillator',
  'CPAP machine', 'bubble CPAP', 'RAM cannula', 'nasal prongs', 'nasal mask',
  'oxygen blender', 'flow meter', 'humidifier', 'heated humidifier',
  'suction', 'wall suction', 'portable suction', 'meconium aspirator',
  'ambu bag', 'resuscitation bag', 'T-piece resuscitator', 'Neopuff',
  'laryngoscope', 'blade', 'Miller blade', 'Macintosh blade', 'video laryngoscope',
  'endotracheal tube', 'ETT', 'uncuffed', 'cuffed', 'stylet', 'bougie',
  'monitor', 'cardiorespiratory monitor', 'pulse oximeter', 'CO2 detector', 'capnograph',
  'infusion pump', 'syringe pump', 'IV pump', 'feeding pump',
  'incubator', 'isolette', 'warmer', 'radiant warmer', 'open warmer',
  'phototherapy unit', 'bili lights', 'bili blanket', 'fiberoptic pad',
  'feeding tube', 'NG tube', 'OG tube', 'NJ tube', 'G-tube', 'MIC-KEY', 'button',
  'Foley catheter', 'urinary catheter', 'urine bag',
  'chest tube', 'pigtail catheter', 'Heimlich valve',
  'central line', 'PICC line', 'Broviac', 'Hickman', 'Port-a-Cath',
  'UVC', 'umbilical catheter', 'UAC', 'single lumen', 'double lumen', 'triple lumen',
  'blood pressure cuff', 'NIBP', 'arterial line transducer',
  'EKG leads', 'ECG electrodes', 'telemetry', 'defibrillator', 'pacer', 'pacemaker',
  'glucometer', 'point of care', 'iStat', 'blood gas analyzer',
  'cooling blanket', 'cooling cap', 'hypothermia system',

  // ===== FEEDING / NUTRITION =====
  'feeds', 'feeding', 'enteral feeds', 'enteral nutrition', 'parenteral nutrition',
  'breast milk', 'mother milk', 'expressed breast milk', 'EBM', 'donor milk', 'DHM',
  'formula', 'preterm formula', 'term formula', 'hydrolysate', 'elemental formula',
  'Similac', 'Enfamil', 'Neosure', 'Enfacare', 'Alimentum', 'Nutramigen', 'Pregestimil',
  'human milk fortifier', 'HMF', 'Prolacta', 'fortified breast milk',
  'NPO', 'nil per oral', 'nothing by mouth', 'gut rest',
  'trophic feeds', 'minimal enteral feeds', 'priming feeds',
  'advancing feeds', 'full feeds', 'goal feeds', 'ad lib', 'on demand',
  'feed intolerance', 'emesis', 'vomiting', 'aspirate', 'residual', 'gastric residual',
  'bilious', 'non-bilious', 'bloody', 'coffee ground',
  'gavage feeds', 'tube feeds', 'bolus feeds', 'continuous feeds',
  'oral feeds', 'nipple feeds', 'bottle feeds', 'breastfeeding', 'direct breastfeeding', 'DBF',
  'spoon feeds', 'cup feeds', 'syringe feeds', 'finger feeds',
  'non-nutritive sucking', 'NNS', 'pacifier', 'oral stimulation',
  'swallow study', 'VFSS', 'videofluoroscopic swallow study', 'FEES',
  'TPN', 'total parenteral nutrition', 'PPN', 'partial parenteral nutrition',
  'lipids', 'Intralipid', 'SMOFlipid', 'fat emulsion',
  'amino acids', 'protein', 'Trophamine', 'Aminosyn', 'Premasol',
  'dextrose', 'glucose', 'GIR', 'glucose infusion rate',
  'calories', 'kcal', 'kcal/kg/day', 'caloric density', 'caloric intake',

  // ===== COMMON CLINICAL PHRASES =====
  'within normal limits', 'WNL', 'no abnormality detected', 'NAD', 'unremarkable',
  'grossly normal', 'essentially normal', 'appears normal', 'normal for age',
  'stable', 'clinically stable', 'hemodynamically stable', 'improving', 'worsening',
  'unchanged', 'no change', 'status quo', 'same as before',
  'mild', 'moderate', 'severe', 'profound', 'minimal', 'significant',
  'acute', 'chronic', 'subacute', 'intermittent', 'persistent', 'recurrent',
  'localized', 'generalized', 'diffuse', 'focal', 'multifocal',
  'unilateral', 'bilateral', 'symmetrical', 'asymmetrical',
  'proximal', 'distal', 'medial', 'lateral', 'anterior', 'posterior', 'superior', 'inferior',
  'central', 'peripheral', 'superficial', 'deep',
  'primary', 'secondary', 'tertiary', 'idiopathic', 'iatrogenic',
  'congenital', 'acquired', 'inherited', 'familial', 'sporadic',
  'provisional diagnosis', 'differential diagnosis', 'working diagnosis', 'final diagnosis',
  'impression', 'assessment', 'plan', 'recommendation',
  'continue current management', 'maintain current therapy', 'no changes',
  'start', 'initiate', 'begin', 'stop', 'discontinue', 'hold', 'resume',
  'increase', 'decrease', 'adjust', 'modify', 'optimize', 'titrate', 'wean',
  'monitor', 'observe', 'watch', 'follow', 'reassess', 'reevaluate',
  'consult', 'consultation', 'referral', 'transfer', 'discharge',
  'admit', 'admission', 'readmission', 'length of stay', 'LOS',
  'day of life', 'DOL', 'hour of life', 'HOL', 'week of life', 'WOL',
  'gestational age', 'GA', 'corrected gestational age', 'CGA', 'postmenstrual age', 'PMA',
  'chronological age', 'birth history', 'prenatal history', 'perinatal history',
  'maternal history', 'family history', 'social history',
  'Apgar score', 'Apgar', 'one minute Apgar', 'five minute Apgar', 'ten minute Apgar',
  'resuscitation', 'delivery room resuscitation', 'NRP', 'neonatal resuscitation',
  'code', 'code blue', 'rapid response', 'emergency', 'critical', 'urgent',
  'prognosis', 'outcome', 'survival', 'mortality', 'morbidity',
  'goals of care', 'comfort care', 'palliative care', 'end of life', 'withdrawal of care',

  // ===== ANATOMICAL TERMS =====
  'head', 'scalp', 'skull', 'cranium', 'brain', 'cerebrum', 'cerebellum', 'brainstem',
  'face', 'forehead', 'eyes', 'ears', 'nose', 'mouth', 'chin', 'cheeks',
  'neck', 'throat', 'trachea', 'esophagus', 'larynx', 'pharynx',
  'chest', 'thorax', 'sternum', 'ribs', 'clavicle', 'scapula',
  'lungs', 'right lung', 'left lung', 'upper lobe', 'middle lobe', 'lower lobe',
  'heart', 'atrium', 'ventricle', 'septum', 'valve', 'aorta', 'pulmonary artery',
  'abdomen', 'stomach', 'liver', 'spleen', 'pancreas', 'gallbladder',
  'intestines', 'small intestine', 'large intestine', 'colon', 'rectum', 'anus',
  'kidneys', 'ureters', 'bladder', 'urethra',
  'pelvis', 'hip', 'groin', 'inguinal',
  'extremities', 'upper extremities', 'lower extremities',
  'arms', 'shoulders', 'elbows', 'wrists', 'hands', 'fingers',
  'legs', 'thighs', 'knees', 'ankles', 'feet', 'toes',
  'spine', 'vertebrae', 'cervical', 'thoracic', 'lumbar', 'sacral', 'coccyx',
  'joints', 'muscles', 'tendons', 'ligaments', 'bones', 'cartilage',
  'vessels', 'arteries', 'veins', 'capillaries', 'lymphatics',
  'nerves', 'spinal cord', 'peripheral nerves', 'plexus',

  // ===== UNITS AND MEASUREMENTS =====
  'millimeter', 'mm', 'centimeter', 'cm', 'meter', 'm', 'inch', 'foot',
  'milligram', 'mg', 'microgram', 'mcg', 'gram', 'g', 'kilogram', 'kg', 'pound', 'lb', 'ounce', 'oz',
  'milliliter', 'mL', 'liter', 'L', 'cubic centimeter', 'cc',
  'millimole', 'mmol', 'micromole', 'umol', 'mole', 'mol',
  'milliequivalent', 'mEq', 'international unit', 'IU', 'unit', 'U',
  'millimeters of mercury', 'mmHg', 'centimeters of water', 'cmH2O',
  'beats per minute', 'bpm', 'breaths per minute', 'respirations per minute',
  'liters per minute', 'LPM', 'milliliters per kilogram', 'mL/kg',
  'percent', 'percentage', 'fraction', 'ratio',
  'degrees Celsius', 'degrees Fahrenheit', 'Celsius', 'Fahrenheit',
  'French', 'Fr', 'gauge', 'G',
  'per day', 'per hour', 'per minute', 'per second',
  'milligrams per kilogram', 'mg/kg', 'micrograms per kilogram', 'mcg/kg',
  'milligrams per kilogram per day', 'mg/kg/day',
  'micrograms per kilogram per minute', 'mcg/kg/min',
  'milliliters per kilogram per hour', 'mL/kg/hr',
  'kilocalories', 'kcal', 'calories per kilogram', 'kcal/kg'
];

/**
 * Transcribe audio using Deepgram API
 * @param audioBlob - Audio blob to transcribe
 * @param onProgress - Optional callback for progress updates
 * @returns Transcribed text
 */
export const transcribeWithDeepgram = async (
  audioBlob: Blob,
  onProgress?: (status: string) => void
): Promise<string> => {
  try {
    onProgress?.('Initializing Deepgram transcription...');
    console.log('🎤 Sending audio to Deepgram for medical transcription...');

    const apiKey = getDeepgramApiKey();

    onProgress?.('Processing audio...');

    // Deepgram API endpoint for pre-recorded audio
    const url = 'https://api.deepgram.com/v1/listen';

    // Build query parameters
    const params = new URLSearchParams({
      model: 'nova-3', // Latest Nova-3 model with superior accuracy
      punctuate: 'true', // Add punctuation
      numerals: 'true', // Convert numbers to digits
      profanity_filter: 'false', // Don't filter medical terms
      diarize: 'false', // Single speaker
      smart_format: 'true', // Smart formatting for better readability
      utterances: 'false', // Don't split by utterances
      language: 'en-US' // English (US)
    });

    // Add medical keyterms (Nova-3 uses 'keyterm' instead of 'keywords')
    // Limit to 100 terms to avoid URL length issues
    MEDICAL_KEYWORDS.slice(0, 100).forEach(term => {
      params.append('keyterm', term);
    });

    // Make request to Deepgram
    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': audioBlob.type || 'audio/webm'
      },
      body: audioBlob
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram API error:', errorText);
      throw new Error(`Deepgram API error: ${response.status} ${response.statusText}`);
    }

    onProgress?.('Parsing transcription...');

    const result = await response.json();

    // Extract transcript from Deepgram response
    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    if (!transcript) {
      throw new Error('No transcription returned from Deepgram');
    }

    console.log('✅ Deepgram transcription complete:', transcript);
    onProgress?.('Transcription complete');

    return transcript.trim();

  } catch (error: any) {
    console.error('❌ Deepgram transcription error:', error);

    // Provide helpful error messages
    if (error.message.includes('401')) {
      throw new Error('Deepgram authentication failed. Please check your API key.');
    } else if (error.message.includes('429')) {
      throw new Error('Deepgram rate limit exceeded. Please wait and try again.');
    } else if (error.message.includes('network')) {
      throw new Error('Network error. Please check your internet connection.');
    }

    throw new Error(`Deepgram transcription failed: ${error.message}`);
  }
};

/**
 * Transcribe audio from base64 data
 * @param audioBase64 - Base64 encoded audio data
 * @param onProgress - Optional callback for progress updates
 * @returns Transcribed text
 */
export const transcribeBase64 = async (
  audioBase64: string,
  onProgress?: (status: string) => void
): Promise<string> => {
  // Convert base64 to blob
  const byteCharacters = atob(audioBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const audioBlob = new Blob([byteArray], { type: 'audio/webm' });

  return transcribeWithDeepgram(audioBlob, onProgress);
};

/**
 * Test Deepgram connection
 */
export const testDeepgramConnection = async (): Promise<boolean> => {
  try {
    const apiKey = getDeepgramApiKey();

    // Test with Deepgram's balance endpoint
    const response = await fetch('https://api.deepgram.com/v1/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiKey}`
      }
    });

    return response.ok;
  } catch (error) {
    console.error('Deepgram connection test failed:', error);
    return false;
  }
};

/**
 * Send buffered audio chunks once WebSocket is ready
 */
const flushAudioBuffer = () => {
  if (liveConnection?.readyState === WebSocket.OPEN && audioChunkBuffer.length > 0) {
    console.log(`📤 Flushing ${audioChunkBuffer.length} buffered audio chunks...`);
    audioChunkBuffer.forEach((chunk, index) => {
      liveConnection!.send(chunk);
      if (index === 0 || (index + 1) % 5 === 0) {
        console.log(`📤 Sent buffered chunk ${index + 1}/${audioChunkBuffer.length}`);
      }
    });
    audioChunkBuffer = [];
  }
};

/**
 * Start live streaming transcription
 * OPTIMIZED: Starts recording immediately while WebSocket connects in parallel
 * Audio is buffered and sent once connection is ready
 *
 * @param onTranscript - Callback for real-time transcript updates
 * @param onError - Callback for errors
 * @param onReady - Callback when WebSocket is ready (optional)
 * @returns Promise with the MediaStream (for visualization)
 */
export const startLiveTranscription = async (
  onTranscript: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void,
  onReady?: () => void
): Promise<MediaStream> => {
  const apiKey = getDeepgramApiKey();

  // Reset state
  audioChunkBuffer = [];
  isWebSocketReady = false;
  connectionRetryCount = 0;

  // Get microphone FIRST - this is usually the slowest part
  console.log('🎤 Requesting microphone access...');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });
  console.log('✅ Microphone access granted');

  // START RECORDING IMMEDIATELY - don't wait for WebSocket
  // Audio will be buffered until WebSocket is ready
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus'
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      if (liveConnection?.readyState === WebSocket.OPEN) {
        // WebSocket ready - send directly
        liveConnection.send(event.data);
      } else {
        // WebSocket not ready - buffer the audio
        audioChunkBuffer.push(event.data);
        if (audioChunkBuffer.length === 1) {
          console.log('📦 Buffering audio while WebSocket connects...');
        }
      }
    }
  };

  // Start recording NOW - user can speak immediately
  mediaRecorder.start(250);
  console.log('🎙️ Recording started immediately (buffering until WebSocket ready)');

  // Build WebSocket URL for live streaming
  // Using minimal parameters for better compatibility
  const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&interim_results=true&language=en-US`;
  console.log('🔌 Connecting to Deepgram WebSocket...');

  // Function to create and connect WebSocket
  const connectWebSocket = () => {
    try {
      // Create WebSocket connection with API key in subprotocol (Deepgram's official method)
      // Format: ['token', 'YOUR_API_KEY']
      liveConnection = new WebSocket(wsUrl, ['token', apiKey]);

      // Set up message handler
      liveConnection.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          const transcript = data?.channel?.alternatives?.[0]?.transcript;
          const isFinal = data?.is_final || false;

          if (transcript && transcript.trim()) {
            console.log(`📝 Transcript (${isFinal ? 'final' : 'interim'}): ${transcript}`);
            onTranscript(transcript, isFinal);
          }
        } catch (err) {
          console.error('Error parsing Deepgram message:', err);
        }
      };

      // Set connection timeout - if not connected within 5 seconds, stop trying
      const connectionTimeout = setTimeout(() => {
        if (!isWebSocketReady && liveConnection) {
          console.warn('⚠️ WebSocket connection timeout - will use batch transcription');
          liveConnection.close();
          liveConnection = null;
        }
      }, 5000);

      liveConnection.onerror = (error) => {
        console.error('❌ Deepgram WebSocket error:', error);
        console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        isWebSocketReady = false;
        clearTimeout(connectionTimeout);

        // Retry connection if not too many attempts
        if (connectionRetryCount < MAX_RETRY_COUNT && mediaRecorder?.state === 'recording') {
          connectionRetryCount++;
          console.log(`🔄 Retrying WebSocket connection (attempt ${connectionRetryCount}/${MAX_RETRY_COUNT})...`);
          setTimeout(connectWebSocket, 1000);
        } else if (connectionRetryCount >= MAX_RETRY_COUNT) {
          console.warn('⚠️ WebSocket connection failed after retries - audio will be processed at end');
          // Don't call onError - we'll transcribe the buffered audio when recording stops
        }
      };

      liveConnection.onclose = (event) => {
        console.log(`🔌 WebSocket closed: code=${event.code}, reason=${event.reason}`);
        clearTimeout(connectionTimeout);

        // Only try to reconnect if recording is still active and it wasn't a normal close
        if (event.code !== 1000 && event.code !== 1005 && mediaRecorder?.state === 'recording') {
          isWebSocketReady = false;
          if (connectionRetryCount < MAX_RETRY_COUNT) {
            connectionRetryCount++;
            console.log(`🔄 Reconnecting WebSocket (attempt ${connectionRetryCount}/${MAX_RETRY_COUNT})...`);
            setTimeout(connectWebSocket, 1000);
          }
        } else {
          isWebSocketReady = false;
          liveConnection = null;
        }
      };

      // Handle WebSocket open - flush buffered audio
      liveConnection.onopen = () => {
        clearTimeout(connectionTimeout);
        isWebSocketReady = true;
        connectionRetryCount = 0; // Reset retry count on successful connection
        console.log('✅ Deepgram WebSocket connected!');

        // Flush any buffered audio chunks
        if (audioChunkBuffer.length > 0) {
          console.log(`📤 Flushing ${audioChunkBuffer.length} buffered audio chunks...`);
          audioChunkBuffer.forEach((chunk) => {
            if (liveConnection?.readyState === WebSocket.OPEN) {
              liveConnection.send(chunk);
            }
          });
          audioChunkBuffer = [];
          console.log('✅ Buffer flushed - now streaming live');
        }

        onReady?.();
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
    }
  };

  // Start WebSocket connection
  connectWebSocket();

  return stream;
};

/**
 * Stop live streaming transcription
 * If WebSocket never connected, returns the buffered audio for batch transcription
 * @returns Promise<Blob | null> - Returns audio blob if batch transcription is needed
 */
export const stopLiveTranscription = async (): Promise<Blob | null> => {
  return new Promise((resolve) => {
    try {
      // Check if we have buffered audio that was never sent (WebSocket failed)
      const hasBufferedAudio = audioChunkBuffer.length > 0;
      const wasConnected = isWebSocketReady;

      // Clear state flags
      isWebSocketReady = false;
      connectionRetryCount = 0;

      // Close WebSocket connection first
      if (liveConnection) {
        if (liveConnection.readyState === WebSocket.OPEN) {
          // Send close message
          try {
            liveConnection.send(JSON.stringify({ type: 'CloseStream' }));
          } catch (e) {
            // Ignore send errors on close
          }
        }
        liveConnection.close();
        liveConnection = null;
      }

      // Stop media recorder
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        // If we have buffered audio (WebSocket never connected), collect all audio
        if (hasBufferedAudio && !wasConnected) {
          console.log('⚠️ WebSocket never connected - collecting buffered audio for batch transcription');

          mediaRecorder.onstop = () => {
            // Combine all buffered chunks into a single blob
            const audioBlob = new Blob(audioChunkBuffer, { type: 'audio/webm' });
            console.log(`📦 Collected ${audioChunkBuffer.length} chunks, total size: ${audioBlob.size} bytes`);

            // Stop all tracks
            if (mediaRecorder?.stream) {
              mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
            mediaRecorder = null;
            audioChunkBuffer = [];

            resolve(audioBlob);
          };

          mediaRecorder.stop();
        } else {
          // Normal stop - audio was streamed via WebSocket
          mediaRecorder.stop();

          // Stop all tracks
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
          mediaRecorder = null;
          audioChunkBuffer = [];

          console.log('🎤 Live transcription stopped');
          resolve(null);
        }
      } else {
        // No active recorder
        audioChunkBuffer = [];
        resolve(null);
      }
    } catch (error) {
      console.error('Error stopping live transcription:', error);
      // Force cleanup
      liveConnection = null;
      mediaRecorder = null;
      isWebSocketReady = false;
      audioChunkBuffer = [];
      resolve(null);
    }
  });
};

/**
 * Check if live transcription WebSocket is ready
 */
export const isLiveTranscriptionReady = (): boolean => {
  return isWebSocketReady && liveConnection?.readyState === WebSocket.OPEN;
};

export default {
  transcribe: transcribeWithDeepgram,
  transcribeBase64,
  isConfigured: isDeepgramConfigured,
  testConnection: testDeepgramConnection,
  startLive: startLiveTranscription,
  stopLive: stopLiveTranscription,
  isLiveReady: isLiveTranscriptionReady
};
