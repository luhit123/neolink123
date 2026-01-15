/**
 * Neonatal & Pediatric ICD-10 Codes Database
 * Comprehensive collection of ICD-10 codes commonly used in NICU/PICU
 */

import { ICD10Code } from '../types/icd10';

export const NEONATAL_ICD10_CODES: ICD10Code[] = [
  // P00-P04: Newborn affected by maternal factors
  {
    code: 'P00.0',
    description: 'Newborn affected by maternal hypertensive disorders',
    shortDescription: 'Maternal hypertension',
    category: 'Maternal factors',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['PIH baby', 'preeclampsia baby']
  },
  {
    code: 'P00.1',
    description: 'Newborn affected by maternal renal and urinary tract diseases',
    shortDescription: 'Maternal renal disease',
    category: 'Maternal factors',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P00.2',
    description: 'Newborn affected by maternal infectious and parasitic diseases',
    shortDescription: 'Maternal infection',
    category: 'Maternal factors',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P01.0',
    description: 'Newborn affected by incompetent cervix',
    shortDescription: 'Incompetent cervix',
    category: 'Maternal factors',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P01.1',
    description: 'Newborn affected by premature rupture of membranes',
    shortDescription: 'PROM',
    category: 'Maternal factors',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['PROM baby', 'prolonged ROM']
  },
  {
    code: 'P02.0',
    description: 'Newborn affected by placenta previa',
    shortDescription: 'Placenta previa',
    category: 'Placental conditions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P02.1',
    description: 'Newborn affected by other forms of placental separation and hemorrhage',
    shortDescription: 'Placental abruption',
    category: 'Placental conditions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['abruption', 'APH']
  },

  // P05-P08: Disorders related to length of gestation and fetal growth
  {
    code: 'P05.0',
    description: 'Newborn light for gestational age',
    shortDescription: 'Light for GA',
    category: 'Growth disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['LGA', 'small baby']
  },
  {
    code: 'P05.1',
    description: 'Newborn small for gestational age',
    shortDescription: 'Small for GA',
    category: 'Growth disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['SGA', 'IUGR', 'FGR']
  },
  {
    code: 'P07.00',
    description: 'Extremely low birth weight newborn, unspecified weight',
    shortDescription: 'ELBW',
    category: 'Birth weight',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['ELBW', 'extremely low birth weight']
  },
  {
    code: 'P07.01',
    description: 'Extremely low birth weight newborn, less than 500 grams',
    shortDescription: 'ELBW <500g',
    category: 'Birth weight',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.02',
    description: 'Extremely low birth weight newborn, 500-749 grams',
    shortDescription: 'ELBW 500-749g',
    category: 'Birth weight',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.03',
    description: 'Extremely low birth weight newborn, 750-999 grams',
    shortDescription: 'ELBW 750-999g',
    category: 'Birth weight',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.10',
    description: 'Other low birth weight newborn, unspecified weight',
    shortDescription: 'LBW',
    category: 'Birth weight',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['LBW', 'low birth weight']
  },
  {
    code: 'P07.14',
    description: 'Other low birth weight newborn, 1000-1249 grams',
    shortDescription: 'LBW 1000-1249g',
    category: 'Birth weight',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['VLBW']
  },
  {
    code: 'P07.15',
    description: 'Other low birth weight newborn, 1250-1499 grams',
    shortDescription: 'LBW 1250-1499g',
    category: 'Birth weight',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['VLBW']
  },
  {
    code: 'P07.16',
    description: 'Other low birth weight newborn, 1500-1749 grams',
    shortDescription: 'LBW 1500-1749g',
    category: 'Birth weight',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.17',
    description: 'Other low birth weight newborn, 1750-1999 grams',
    shortDescription: 'LBW 1750-1999g',
    category: 'Birth weight',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.18',
    description: 'Other low birth weight newborn, 2000-2499 grams',
    shortDescription: 'LBW 2000-2499g',
    category: 'Birth weight',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.20',
    description: 'Extreme immaturity of newborn, unspecified weeks of gestation',
    shortDescription: 'Extreme preterm',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['extreme preterm', 'micro preemie']
  },
  {
    code: 'P07.21',
    description: 'Extreme immaturity of newborn, gestational age less than 23 completed weeks',
    shortDescription: 'Preterm <23 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.22',
    description: 'Extreme immaturity of newborn, gestational age 23 completed weeks',
    shortDescription: 'Preterm 23 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.23',
    description: 'Extreme immaturity of newborn, gestational age 24 completed weeks',
    shortDescription: 'Preterm 24 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.24',
    description: 'Extreme immaturity of newborn, gestational age 25 completed weeks',
    shortDescription: 'Preterm 25 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.25',
    description: 'Extreme immaturity of newborn, gestational age 26 completed weeks',
    shortDescription: 'Preterm 26 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.26',
    description: 'Extreme immaturity of newborn, gestational age 27 completed weeks',
    shortDescription: 'Preterm 27 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.30',
    description: 'Preterm newborn, unspecified weeks of gestation',
    shortDescription: 'Preterm',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['premature', 'preterm birth']
  },
  {
    code: 'P07.31',
    description: 'Preterm newborn, gestational age 28 completed weeks',
    shortDescription: 'Preterm 28 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.32',
    description: 'Preterm newborn, gestational age 29 completed weeks',
    shortDescription: 'Preterm 29 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.33',
    description: 'Preterm newborn, gestational age 30 completed weeks',
    shortDescription: 'Preterm 30 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.34',
    description: 'Preterm newborn, gestational age 31 completed weeks',
    shortDescription: 'Preterm 31 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.35',
    description: 'Preterm newborn, gestational age 32 completed weeks',
    shortDescription: 'Preterm 32 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.36',
    description: 'Preterm newborn, gestational age 33 completed weeks',
    shortDescription: 'Preterm 33 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.37',
    description: 'Preterm newborn, gestational age 34 completed weeks',
    shortDescription: 'Preterm 34 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.38',
    description: 'Preterm newborn, gestational age 35 completed weeks',
    shortDescription: 'Preterm 35 weeks',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P07.39',
    description: 'Preterm newborn, gestational age 36 completed weeks',
    shortDescription: 'Late preterm',
    category: 'Prematurity',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['late preterm', '36 weeker']
  },
  {
    code: 'P08.0',
    description: 'Exceptionally large newborn baby',
    shortDescription: 'Large baby',
    category: 'Growth disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['LGA', 'macrosomia']
  },
  {
    code: 'P08.1',
    description: 'Other heavy for gestational age newborn',
    shortDescription: 'Heavy for GA',
    category: 'Growth disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P08.21',
    description: 'Post-term newborn',
    shortDescription: 'Post-term',
    category: 'Gestational age',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['post dates', 'overdue']
  },

  // P10-P15: Birth trauma
  {
    code: 'P10.0',
    description: 'Subdural hemorrhage due to birth injury',
    shortDescription: 'Birth subdural hemorrhage',
    category: 'Birth trauma',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P10.1',
    description: 'Cerebral hemorrhage due to birth injury',
    shortDescription: 'Birth cerebral hemorrhage',
    category: 'Birth trauma',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P11.0',
    description: 'Cerebral edema due to birth injury',
    shortDescription: 'Birth cerebral edema',
    category: 'Birth trauma',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P11.2',
    description: 'Unspecified brain damage due to birth injury',
    shortDescription: 'Birth brain injury',
    category: 'Birth trauma',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P12.0',
    description: 'Cephalhematoma due to birth injury',
    shortDescription: 'Cephalhematoma',
    category: 'Birth trauma',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['cephalohematoma']
  },
  {
    code: 'P12.1',
    description: 'Chignon (from vacuum extraction) due to birth injury',
    shortDescription: 'Chignon',
    category: 'Birth trauma',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P12.3',
    description: 'Bruising of scalp due to birth injury',
    shortDescription: 'Scalp bruising',
    category: 'Birth trauma',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P12.81',
    description: 'Caput succedaneum',
    shortDescription: 'Caput',
    category: 'Birth trauma',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P13.4',
    description: 'Fracture of clavicle due to birth injury',
    shortDescription: 'Birth clavicle fracture',
    category: 'Birth trauma',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['clavicle fracture', 'fractured clavicle']
  },
  {
    code: 'P14.0',
    description: "Erb's paralysis due to birth injury",
    shortDescription: "Erb's palsy",
    category: 'Birth trauma',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['erb palsy', 'brachial plexus injury']
  },
  {
    code: 'P14.1',
    description: "Klumpke's paralysis due to birth injury",
    shortDescription: "Klumpke's palsy",
    category: 'Birth trauma',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P15.0',
    description: 'Birth injury to liver',
    shortDescription: 'Liver injury',
    category: 'Birth trauma',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },

  // P20-P29: Respiratory and cardiovascular disorders specific to perinatal period
  {
    code: 'P20.0',
    description: 'Intrauterine hypoxia first noted before onset of labor',
    shortDescription: 'Fetal distress antepartum',
    category: 'Perinatal hypoxia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['fetal distress']
  },
  {
    code: 'P20.1',
    description: 'Intrauterine hypoxia first noted during labor and delivery',
    shortDescription: 'Fetal distress intrapartum',
    category: 'Perinatal hypoxia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P21.0',
    description: 'Severe birth asphyxia',
    shortDescription: 'Severe birth asphyxia',
    category: 'Birth asphyxia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['birth asphyxia', 'perinatal asphyxia']
  },
  {
    code: 'P21.1',
    description: 'Mild and moderate birth asphyxia',
    shortDescription: 'Mild birth asphyxia',
    category: 'Birth asphyxia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P22.0',
    description: 'Respiratory distress syndrome of newborn',
    shortDescription: 'RDS/HMD',
    category: 'Respiratory conditions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['RDS', 'HMD', 'hyaline membrane disease', 'respiratory distress']
  },
  {
    code: 'P22.1',
    description: 'Transient tachypnea of newborn',
    shortDescription: 'TTN',
    category: 'Respiratory conditions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['TTN', 'wet lung', 'transient tachypnea']
  },
  {
    code: 'P22.8',
    description: 'Other respiratory distress of newborn',
    shortDescription: 'Other resp distress',
    category: 'Respiratory conditions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P23.0',
    description: 'Congenital pneumonia due to viral agent',
    shortDescription: 'Viral pneumonia',
    category: 'Pneumonia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P23.1',
    description: 'Congenital pneumonia due to Chlamydia',
    shortDescription: 'Chlamydia pneumonia',
    category: 'Pneumonia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P23.4',
    description: 'Congenital pneumonia due to Escherichia coli',
    shortDescription: 'E.coli pneumonia',
    category: 'Pneumonia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P23.6',
    description: 'Congenital pneumonia due to other bacterial agents',
    shortDescription: 'Bacterial pneumonia',
    category: 'Pneumonia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P23.9',
    description: 'Congenital pneumonia, unspecified',
    shortDescription: 'Congenital pneumonia',
    category: 'Pneumonia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['pneumonia', 'congenital pneumonia']
  },
  {
    code: 'P24.00',
    description: 'Meconium aspiration without respiratory symptoms',
    shortDescription: 'MAS mild',
    category: 'Aspiration syndromes',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P24.01',
    description: 'Meconium aspiration with respiratory symptoms',
    shortDescription: 'MAS',
    category: 'Aspiration syndromes',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['MAS', 'meconium aspiration', 'meconium aspiration syndrome']
  },
  {
    code: 'P24.10',
    description: 'Neonatal aspiration of blood without respiratory symptoms',
    shortDescription: 'Blood aspiration',
    category: 'Aspiration syndromes',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P24.21',
    description: 'Neonatal aspiration of milk and regurgitated food with respiratory symptoms',
    shortDescription: 'Milk aspiration',
    category: 'Aspiration syndromes',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P25.0',
    description: 'Interstitial emphysema originating in the perinatal period',
    shortDescription: 'PIE',
    category: 'Air leak syndromes',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['PIE', 'pulmonary interstitial emphysema']
  },
  {
    code: 'P25.1',
    description: 'Pneumothorax originating in the perinatal period',
    shortDescription: 'Pneumothorax',
    category: 'Air leak syndromes',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['pneumothorax', 'air leak']
  },
  {
    code: 'P25.2',
    description: 'Pneumomediastinum originating in the perinatal period',
    shortDescription: 'Pneumomediastinum',
    category: 'Air leak syndromes',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P26.1',
    description: 'Massive pulmonary hemorrhage originating in the perinatal period',
    shortDescription: 'Pulmonary hemorrhage',
    category: 'Pulmonary hemorrhage',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['pulmonary hemorrhage', 'lung bleed']
  },
  {
    code: 'P27.1',
    description: 'Bronchopulmonary dysplasia originating in the perinatal period',
    shortDescription: 'BPD',
    category: 'Chronic lung disease',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['BPD', 'bronchopulmonary dysplasia', 'CLD']
  },
  {
    code: 'P28.0',
    description: 'Primary atelectasis of newborn',
    shortDescription: 'Primary atelectasis',
    category: 'Atelectasis',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P28.10',
    description: 'Unspecified atelectasis of newborn',
    shortDescription: 'Atelectasis',
    category: 'Atelectasis',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['atelectasis', 'lung collapse']
  },
  {
    code: 'P28.3',
    description: 'Primary sleep apnea of newborn',
    shortDescription: 'Central apnea',
    category: 'Apnea',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['central apnea']
  },
  {
    code: 'P28.4',
    description: 'Other apnea of newborn',
    shortDescription: 'Apnea of prematurity',
    category: 'Apnea',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['AOP', 'apnea of prematurity', 'apnea']
  },
  {
    code: 'P29.0',
    description: 'Neonatal cardiac failure',
    shortDescription: 'Neonatal heart failure',
    category: 'Cardiac conditions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['heart failure', 'cardiac failure']
  },
  {
    code: 'P29.11',
    description: 'Neonatal tachycardia',
    shortDescription: 'Neonatal tachycardia',
    category: 'Cardiac conditions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P29.12',
    description: 'Neonatal bradycardia',
    shortDescription: 'Neonatal bradycardia',
    category: 'Cardiac conditions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P29.2',
    description: 'Neonatal hypertension',
    shortDescription: 'Neonatal hypertension',
    category: 'Cardiac conditions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P29.30',
    description: 'Pulmonary hypertension of newborn',
    shortDescription: 'PPHN',
    category: 'Cardiac conditions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['PPHN', 'persistent pulmonary hypertension', 'persistent fetal circulation']
  },
  {
    code: 'P29.38',
    description: 'Other persistent fetal circulation',
    shortDescription: 'PFC',
    category: 'Cardiac conditions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },

  // P35-P39: Infections specific to the perinatal period
  {
    code: 'P35.0',
    description: 'Congenital rubella syndrome',
    shortDescription: 'Congenital rubella',
    category: 'Congenital infections',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['CRS']
  },
  {
    code: 'P35.1',
    description: 'Congenital cytomegalovirus infection',
    shortDescription: 'Congenital CMV',
    category: 'Congenital infections',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['CMV', 'cytomegalovirus']
  },
  {
    code: 'P35.2',
    description: 'Congenital herpesviral [herpes simplex] infection',
    shortDescription: 'Neonatal HSV',
    category: 'Congenital infections',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['HSV', 'herpes', 'neonatal herpes']
  },
  {
    code: 'P35.3',
    description: 'Congenital viral hepatitis',
    shortDescription: 'Congenital hepatitis',
    category: 'Congenital infections',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P36.0',
    description: 'Sepsis of newborn due to streptococcus, group B',
    shortDescription: 'GBS sepsis',
    category: 'Neonatal sepsis',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['GBS', 'group B strep sepsis']
  },
  {
    code: 'P36.10',
    description: 'Sepsis of newborn due to unspecified streptococci',
    shortDescription: 'Strep sepsis',
    category: 'Neonatal sepsis',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P36.2',
    description: 'Sepsis of newborn due to Staphylococcus aureus',
    shortDescription: 'Staph aureus sepsis',
    category: 'Neonatal sepsis',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['staph sepsis']
  },
  {
    code: 'P36.30',
    description: 'Sepsis of newborn due to unspecified staphylococci',
    shortDescription: 'Staph sepsis',
    category: 'Neonatal sepsis',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P36.4',
    description: 'Sepsis of newborn due to Escherichia coli',
    shortDescription: 'E.coli sepsis',
    category: 'Neonatal sepsis',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['e coli sepsis']
  },
  {
    code: 'P36.5',
    description: 'Sepsis of newborn due to anaerobes',
    shortDescription: 'Anaerobic sepsis',
    category: 'Neonatal sepsis',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P36.8',
    description: 'Other bacterial sepsis of newborn',
    shortDescription: 'Other bacterial sepsis',
    category: 'Neonatal sepsis',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P36.9',
    description: 'Bacterial sepsis of newborn, unspecified',
    shortDescription: 'Neonatal sepsis',
    category: 'Neonatal sepsis',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['sepsis', 'neonatal sepsis', 'suspected sepsis']
  },
  {
    code: 'P37.0',
    description: 'Congenital tuberculosis',
    shortDescription: 'Congenital TB',
    category: 'Congenital infections',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P37.1',
    description: 'Congenital toxoplasmosis',
    shortDescription: 'Congenital toxoplasma',
    category: 'Congenital infections',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['toxoplasmosis', 'TORCH']
  },
  {
    code: 'P37.2',
    description: 'Neonatal (disseminated) listeriosis',
    shortDescription: 'Neonatal listeria',
    category: 'Congenital infections',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P37.5',
    description: 'Neonatal candidiasis',
    shortDescription: 'Neonatal candida',
    category: 'Fungal infections',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['candida', 'thrush', 'fungal infection']
  },
  {
    code: 'P38.1',
    description: 'Omphalitis with mild hemorrhage',
    shortDescription: 'Omphalitis mild',
    category: 'Umbilical infections',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P38.9',
    description: 'Omphalitis without hemorrhage',
    shortDescription: 'Omphalitis',
    category: 'Umbilical infections',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['umbilical infection', 'umbilical sepsis']
  },
  {
    code: 'P39.1',
    description: 'Neonatal conjunctivitis and dacryocystitis',
    shortDescription: 'Neonatal conjunctivitis',
    category: 'Neonatal infections',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['ophthalmia neonatorum', 'sticky eyes']
  },
  {
    code: 'P39.4',
    description: 'Neonatal skin infection',
    shortDescription: 'Neonatal skin infection',
    category: 'Neonatal infections',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['skin infection', 'pustules']
  },
  {
    code: 'P39.9',
    description: 'Infection specific to the perinatal period, unspecified',
    shortDescription: 'Perinatal infection',
    category: 'Neonatal infections',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },

  // P50-P61: Hemorrhagic and hematological disorders of newborn
  {
    code: 'P50.0',
    description: 'Newborn affected by intrauterine blood loss from vasa previa',
    shortDescription: 'Vasa previa bleed',
    category: 'Fetal blood loss',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P50.3',
    description: 'Newborn affected by hemorrhage into co-twin',
    shortDescription: 'Twin-twin transfusion',
    category: 'Fetal blood loss',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['TTTS', 'twin twin transfusion']
  },
  {
    code: 'P51.0',
    description: 'Massive umbilical hemorrhage of newborn',
    shortDescription: 'Umbilical hemorrhage',
    category: 'Neonatal hemorrhage',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P52.0',
    description: 'Intraventricular (nontraumatic) hemorrhage, grade 1, of newborn',
    shortDescription: 'IVH Grade 1',
    category: 'Intracranial hemorrhage',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['IVH I', 'grade 1 bleed']
  },
  {
    code: 'P52.1',
    description: 'Intraventricular (nontraumatic) hemorrhage, grade 2, of newborn',
    shortDescription: 'IVH Grade 2',
    category: 'Intracranial hemorrhage',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['IVH II', 'grade 2 bleed']
  },
  {
    code: 'P52.21',
    description: 'Intraventricular (nontraumatic) hemorrhage, grade 3, of newborn',
    shortDescription: 'IVH Grade 3',
    category: 'Intracranial hemorrhage',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['IVH III', 'grade 3 bleed']
  },
  {
    code: 'P52.22',
    description: 'Intraventricular (nontraumatic) hemorrhage, grade 4, of newborn',
    shortDescription: 'IVH Grade 4',
    category: 'Intracranial hemorrhage',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['IVH IV', 'grade 4 bleed', 'periventricular hemorrhagic infarction']
  },
  {
    code: 'P52.3',
    description: 'Unspecified intraventricular (nontraumatic) hemorrhage of newborn',
    shortDescription: 'IVH unspecified',
    category: 'Intracranial hemorrhage',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['IVH', 'intraventricular hemorrhage']
  },
  {
    code: 'P52.4',
    description: 'Intracerebral (nontraumatic) hemorrhage of newborn',
    shortDescription: 'Intracerebral hemorrhage',
    category: 'Intracranial hemorrhage',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P52.5',
    description: 'Subarachnoid (nontraumatic) hemorrhage of newborn',
    shortDescription: 'Subarachnoid hemorrhage',
    category: 'Intracranial hemorrhage',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['SAH']
  },
  {
    code: 'P53',
    description: 'Hemorrhagic disease of newborn',
    shortDescription: 'VKDB/HDN',
    category: 'Coagulation disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['HDN', 'VKDB', 'vitamin K deficiency bleeding']
  },
  {
    code: 'P54.1',
    description: 'Neonatal melena',
    shortDescription: 'Neonatal melena',
    category: 'GI bleeding',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['melena', 'GI bleed']
  },
  {
    code: 'P54.2',
    description: 'Neonatal rectal hemorrhage',
    shortDescription: 'Rectal bleeding',
    category: 'GI bleeding',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P55.0',
    description: 'Rh isoimmunization of newborn',
    shortDescription: 'Rh hemolytic disease',
    category: 'Hemolytic disease',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['Rh incompatibility', 'Rh HDN']
  },
  {
    code: 'P55.1',
    description: 'ABO isoimmunization of newborn',
    shortDescription: 'ABO incompatibility',
    category: 'Hemolytic disease',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['ABO HDN', 'ABO hemolytic disease']
  },
  {
    code: 'P55.8',
    description: 'Other hemolytic diseases of newborn',
    shortDescription: 'Other hemolytic disease',
    category: 'Hemolytic disease',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P56.0',
    description: 'Hydrops fetalis due to isoimmunization',
    shortDescription: 'Immune hydrops',
    category: 'Hydrops',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hydrops', 'fetal hydrops']
  },
  {
    code: 'P56.90',
    description: 'Hydrops fetalis due to unspecified hemolytic disease',
    shortDescription: 'Hydrops fetalis',
    category: 'Hydrops',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P57.0',
    description: 'Kernicterus due to isoimmunization',
    shortDescription: 'Kernicterus - iso',
    category: 'Bilirubin encephalopathy',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['kernicterus', 'bilirubin encephalopathy']
  },
  {
    code: 'P58.0',
    description: 'Neonatal jaundice due to bruising',
    shortDescription: 'Jaundice - bruising',
    category: 'Neonatal jaundice',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P58.3',
    description: 'Neonatal jaundice due to polycythemia',
    shortDescription: 'Jaundice - polycythemia',
    category: 'Neonatal jaundice',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P58.41',
    description: 'Neonatal jaundice due to drugs or toxins transmitted from mother',
    shortDescription: 'Drug-induced jaundice',
    category: 'Neonatal jaundice',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P59.0',
    description: 'Neonatal jaundice associated with preterm delivery',
    shortDescription: 'Preterm jaundice',
    category: 'Neonatal jaundice',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['jaundice of prematurity']
  },
  {
    code: 'P59.1',
    description: 'Inspissated bile syndrome',
    shortDescription: 'Inspissated bile',
    category: 'Neonatal jaundice',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P59.20',
    description: 'Neonatal jaundice from unspecified hepatocellular damage',
    shortDescription: 'Hepatocellular jaundice',
    category: 'Neonatal jaundice',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P59.3',
    description: 'Neonatal jaundice from breast milk inhibitor',
    shortDescription: 'Breast milk jaundice',
    category: 'Neonatal jaundice',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['breast milk jaundice', 'breastfeeding jaundice']
  },
  {
    code: 'P59.9',
    description: 'Neonatal jaundice, unspecified',
    shortDescription: 'Neonatal jaundice',
    category: 'Neonatal jaundice',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['jaundice', 'hyperbilirubinemia', 'icterus']
  },
  {
    code: 'P60',
    description: 'Disseminated intravascular coagulation of newborn',
    shortDescription: 'DIC',
    category: 'Coagulation disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['DIC', 'coagulopathy']
  },
  {
    code: 'P61.0',
    description: 'Transient neonatal thrombocytopenia',
    shortDescription: 'Neonatal thrombocytopenia',
    category: 'Hematological disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['low platelets', 'thrombocytopenia']
  },
  {
    code: 'P61.1',
    description: 'Polycythemia neonatorum',
    shortDescription: 'Neonatal polycythemia',
    category: 'Hematological disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['polycythemia', 'high hematocrit']
  },
  {
    code: 'P61.2',
    description: 'Anemia of prematurity',
    shortDescription: 'Anemia of prematurity',
    category: 'Anemia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['AOP', 'preterm anemia']
  },
  {
    code: 'P61.3',
    description: 'Congenital anemia from fetal blood loss',
    shortDescription: 'Fetal blood loss anemia',
    category: 'Anemia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P61.4',
    description: 'Other congenital anemias, not elsewhere classified',
    shortDescription: 'Congenital anemia',
    category: 'Anemia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },

  // P70-P74: Transitory endocrine and metabolic disorders
  {
    code: 'P70.0',
    description: 'Syndrome of infant of mother with gestational diabetes',
    shortDescription: 'IDM - gestational',
    category: 'Metabolic disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['IDM', 'infant of diabetic mother']
  },
  {
    code: 'P70.1',
    description: 'Syndrome of infant of a diabetic mother',
    shortDescription: 'IDM',
    category: 'Metabolic disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['IDM', 'baby of diabetic mother']
  },
  {
    code: 'P70.2',
    description: 'Neonatal diabetes mellitus',
    shortDescription: 'Neonatal DM',
    category: 'Metabolic disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P70.3',
    description: 'Iatrogenic neonatal hypoglycemia',
    shortDescription: 'Iatrogenic hypoglycemia',
    category: 'Hypoglycemia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P70.4',
    description: 'Other neonatal hypoglycemia',
    shortDescription: 'Neonatal hypoglycemia',
    category: 'Hypoglycemia',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hypoglycemia', 'low sugar', 'low blood glucose']
  },
  {
    code: 'P71.0',
    description: "Cow's milk hypocalcemia in newborn",
    shortDescription: 'Cow milk hypocalcemia',
    category: 'Calcium disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P71.1',
    description: 'Other neonatal hypocalcemia',
    shortDescription: 'Neonatal hypocalcemia',
    category: 'Calcium disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hypocalcemia', 'low calcium']
  },
  {
    code: 'P71.2',
    description: 'Neonatal hypomagnesemia',
    shortDescription: 'Neonatal hypomagnesemia',
    category: 'Electrolyte disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['low magnesium']
  },
  {
    code: 'P71.3',
    description: 'Neonatal tetany without calcium or magnesium deficiency',
    shortDescription: 'Neonatal tetany',
    category: 'Metabolic disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P71.4',
    description: 'Transitory neonatal hypoparathyroidism',
    shortDescription: 'Neonatal hypoparathyroid',
    category: 'Endocrine disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P72.0',
    description: 'Neonatal goiter, not elsewhere classified',
    shortDescription: 'Neonatal goiter',
    category: 'Thyroid disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P72.1',
    description: 'Transitory neonatal hyperthyroidism',
    shortDescription: 'Neonatal hyperthyroid',
    category: 'Thyroid disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P72.2',
    description: 'Other transitory neonatal disorders of thyroid function, not elsewhere classified',
    shortDescription: 'Transient thyroid disorder',
    category: 'Thyroid disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['transient hypothyroidism']
  },
  {
    code: 'P74.1',
    description: 'Dehydration of newborn',
    shortDescription: 'Neonatal dehydration',
    category: 'Fluid disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['dehydration', 'dehydrated']
  },
  {
    code: 'P74.21',
    description: 'Hypernatremia of newborn',
    shortDescription: 'Neonatal hypernatremia',
    category: 'Electrolyte disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hypernatremia', 'high sodium']
  },
  {
    code: 'P74.22',
    description: 'Hyponatremia of newborn',
    shortDescription: 'Neonatal hyponatremia',
    category: 'Electrolyte disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hyponatremia', 'low sodium']
  },
  {
    code: 'P74.31',
    description: 'Hyperkalemia of newborn',
    shortDescription: 'Neonatal hyperkalemia',
    category: 'Electrolyte disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hyperkalemia', 'high potassium']
  },
  {
    code: 'P74.32',
    description: 'Hypokalemia of newborn',
    shortDescription: 'Neonatal hypokalemia',
    category: 'Electrolyte disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hypokalemia', 'low potassium']
  },
  {
    code: 'P74.4',
    description: 'Other transitory electrolyte disturbances of newborn',
    shortDescription: 'Electrolyte imbalance',
    category: 'Electrolyte disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P74.5',
    description: 'Transitory tyrosinemia of newborn',
    shortDescription: 'Transient tyrosinemia',
    category: 'Metabolic disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },

  // P76-P78: Digestive system disorders
  {
    code: 'P76.0',
    description: 'Meconium plug syndrome',
    shortDescription: 'Meconium plug',
    category: 'GI disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P76.1',
    description: 'Transitory ileus of newborn',
    shortDescription: 'Neonatal ileus',
    category: 'GI disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['ileus', 'functional ileus']
  },
  {
    code: 'P76.2',
    description: 'Intestinal obstruction due to inspissated milk',
    shortDescription: 'Milk obstruction',
    category: 'GI disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P76.8',
    description: 'Other specified intestinal obstruction of newborn',
    shortDescription: 'Other intestinal obstruction',
    category: 'GI disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P77.1',
    description: 'Stage 1 necrotizing enterocolitis in newborn',
    shortDescription: 'NEC Stage 1',
    category: 'NEC',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['NEC 1', 'suspected NEC']
  },
  {
    code: 'P77.2',
    description: 'Stage 2 necrotizing enterocolitis in newborn',
    shortDescription: 'NEC Stage 2',
    category: 'NEC',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['NEC 2', 'definite NEC']
  },
  {
    code: 'P77.3',
    description: 'Stage 3 necrotizing enterocolitis in newborn',
    shortDescription: 'NEC Stage 3',
    category: 'NEC',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['NEC 3', 'advanced NEC', 'surgical NEC']
  },
  {
    code: 'P77.9',
    description: 'Necrotizing enterocolitis in newborn, unspecified',
    shortDescription: 'NEC',
    category: 'NEC',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['NEC', 'necrotizing enterocolitis']
  },
  {
    code: 'P78.0',
    description: 'Perinatal intestinal perforation',
    shortDescription: 'Intestinal perforation',
    category: 'GI disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['SIP', 'spontaneous intestinal perforation']
  },
  {
    code: 'P78.1',
    description: 'Other neonatal peritonitis',
    shortDescription: 'Neonatal peritonitis',
    category: 'GI disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P78.2',
    description: 'Neonatal hematemesis and melena due to swallowed maternal blood',
    shortDescription: 'Swallowed blood',
    category: 'GI disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['apt test positive']
  },
  {
    code: 'P78.83',
    description: 'Newborn esophageal reflux',
    shortDescription: 'Neonatal reflux',
    category: 'GI disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['GERD', 'reflux', 'GER']
  },
  {
    code: 'P78.84',
    description: 'Gestational alloimmune liver disease',
    shortDescription: 'GALD',
    category: 'Liver disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['neonatal hemochromatosis']
  },

  // P80-P83: Conditions involving the integument and temperature regulation
  {
    code: 'P80.0',
    description: 'Cold injury syndrome',
    shortDescription: 'Cold injury',
    category: 'Temperature regulation',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P80.8',
    description: 'Other hypothermia of newborn',
    shortDescription: 'Hypothermia',
    category: 'Temperature regulation',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hypothermia', 'cold stress']
  },
  {
    code: 'P81.0',
    description: 'Environmental hyperthermia of newborn',
    shortDescription: 'Hyperthermia',
    category: 'Temperature regulation',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hyperthermia', 'overheating']
  },
  {
    code: 'P83.0',
    description: 'Sclerema neonatorum',
    shortDescription: 'Sclerema',
    category: 'Skin conditions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P83.1',
    description: 'Neonatal erythema toxicum',
    shortDescription: 'Erythema toxicum',
    category: 'Skin conditions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['ETN', 'toxic erythema']
  },
  {
    code: 'P83.2',
    description: 'Hydrops fetalis not due to hemolytic disease',
    shortDescription: 'Non-immune hydrops',
    category: 'Hydrops',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['NIHF', 'non-immune hydrops']
  },
  {
    code: 'P83.30',
    description: 'Unspecified edema specific to newborn',
    shortDescription: 'Neonatal edema',
    category: 'Edema',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['edema', 'swelling']
  },
  {
    code: 'P83.5',
    description: 'Congenital hydrocele',
    shortDescription: 'Congenital hydrocele',
    category: 'Congenital',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hydrocele']
  },

  // P90-P96: Other disorders originating in perinatal period
  {
    code: 'P90',
    description: 'Convulsions of newborn',
    shortDescription: 'Neonatal seizures',
    category: 'Neurological',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['seizures', 'convulsions', 'fits']
  },
  {
    code: 'P91.0',
    description: 'Neonatal cerebral ischemia',
    shortDescription: 'Neonatal stroke',
    category: 'Neurological',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['stroke', 'cerebral infarction']
  },
  {
    code: 'P91.1',
    description: 'Acquired periventricular cysts of newborn',
    shortDescription: 'PVL',
    category: 'Neurological',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['PVL', 'periventricular leukomalacia', 'white matter injury']
  },
  {
    code: 'P91.2',
    description: 'Neonatal cerebral leukomalacia',
    shortDescription: 'Cerebral leukomalacia',
    category: 'Neurological',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P91.3',
    description: 'Neonatal cerebral irritability',
    shortDescription: 'Cerebral irritability',
    category: 'Neurological',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P91.4',
    description: 'Neonatal cerebral depression',
    shortDescription: 'Cerebral depression',
    category: 'Neurological',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P91.5',
    description: 'Neonatal coma',
    shortDescription: 'Neonatal coma',
    category: 'Neurological',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P91.60',
    description: 'Hypoxic ischemic encephalopathy [HIE], unspecified',
    shortDescription: 'HIE unspecified',
    category: 'HIE',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['HIE', 'hypoxic ischemic encephalopathy']
  },
  {
    code: 'P91.61',
    description: 'Mild hypoxic ischemic encephalopathy [HIE]',
    shortDescription: 'HIE mild (Stage 1)',
    category: 'HIE',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['HIE stage 1', 'mild HIE']
  },
  {
    code: 'P91.62',
    description: 'Moderate hypoxic ischemic encephalopathy [HIE]',
    shortDescription: 'HIE moderate (Stage 2)',
    category: 'HIE',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['HIE stage 2', 'moderate HIE']
  },
  {
    code: 'P91.63',
    description: 'Severe hypoxic ischemic encephalopathy [HIE]',
    shortDescription: 'HIE severe (Stage 3)',
    category: 'HIE',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['HIE stage 3', 'severe HIE']
  },
  {
    code: 'P91.811',
    description: 'Neonatal encephalopathy in diseases classified elsewhere',
    shortDescription: 'Neonatal encephalopathy',
    category: 'Neurological',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P91.88',
    description: 'Other specified disturbances of cerebral status of newborn',
    shortDescription: 'Other cerebral disturbance',
    category: 'Neurological',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P92.01',
    description: 'Bilious vomiting of newborn',
    shortDescription: 'Bilious vomiting',
    category: 'Feeding problems',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['bilious vomiting', 'green vomit']
  },
  {
    code: 'P92.09',
    description: 'Other vomiting of newborn',
    shortDescription: 'Neonatal vomiting',
    category: 'Feeding problems',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['vomiting']
  },
  {
    code: 'P92.1',
    description: 'Regurgitation and rumination of newborn',
    shortDescription: 'Regurgitation',
    category: 'Feeding problems',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['posseting', 'spitting up']
  },
  {
    code: 'P92.2',
    description: 'Slow feeding of newborn',
    shortDescription: 'Slow feeding',
    category: 'Feeding problems',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['poor suck', 'weak suck']
  },
  {
    code: 'P92.3',
    description: 'Underfeeding of newborn',
    shortDescription: 'Underfeeding',
    category: 'Feeding problems',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P92.4',
    description: 'Overfeeding of newborn',
    shortDescription: 'Overfeeding',
    category: 'Feeding problems',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P92.5',
    description: 'Neonatal difficulty in feeding at breast',
    shortDescription: 'Breastfeeding difficulty',
    category: 'Feeding problems',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['latch problems', 'breastfeeding issues']
  },
  {
    code: 'P92.6',
    description: 'Failure to thrive in newborn',
    shortDescription: 'Failure to thrive',
    category: 'Growth problems',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['FTT', 'poor weight gain']
  },
  {
    code: 'P92.9',
    description: 'Feeding problem of newborn, unspecified',
    shortDescription: 'Feeding problems',
    category: 'Feeding problems',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['feeding intolerance', 'feed intolerance']
  },
  {
    code: 'P93.0',
    description: 'Grey baby syndrome',
    shortDescription: 'Grey baby syndrome',
    category: 'Drug reactions',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['chloramphenicol toxicity']
  },
  {
    code: 'P94.0',
    description: 'Transient neonatal myasthenia gravis',
    shortDescription: 'Neonatal myasthenia',
    category: 'Muscle disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'P94.1',
    description: 'Congenital hypertonia',
    shortDescription: 'Neonatal hypertonia',
    category: 'Muscle tone',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hypertonia', 'increased tone']
  },
  {
    code: 'P94.2',
    description: 'Congenital hypotonia',
    shortDescription: 'Neonatal hypotonia',
    category: 'Muscle tone',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hypotonia', 'floppy baby', 'decreased tone']
  },
  {
    code: 'P95',
    description: 'Stillbirth',
    shortDescription: 'Stillbirth',
    category: 'Mortality',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['stillborn', 'fetal death']
  },
  {
    code: 'P96.0',
    description: 'Congenital renal failure',
    shortDescription: 'Congenital renal failure',
    category: 'Renal disorders',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['renal failure', 'kidney failure']
  },
  {
    code: 'P96.1',
    description: 'Neonatal withdrawal symptoms from maternal use of drugs of addiction',
    shortDescription: 'NAS',
    category: 'Drug effects',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['NAS', 'neonatal abstinence syndrome', 'withdrawal']
  },
  {
    code: 'P96.2',
    description: 'Withdrawal symptoms from therapeutic use of drugs in newborn',
    shortDescription: 'Drug withdrawal',
    category: 'Drug effects',
    chapter: 'P',
    isNeonatal: true,
    isPediatric: true
  },

  // Q - Congenital malformations (selected common ones)
  {
    code: 'Q00.0',
    description: 'Anencephaly',
    shortDescription: 'Anencephaly',
    category: 'CNS malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'Q01.9',
    description: 'Encephalocele, unspecified',
    shortDescription: 'Encephalocele',
    category: 'CNS malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'Q03.9',
    description: 'Congenital hydrocephalus, unspecified',
    shortDescription: 'Congenital hydrocephalus',
    category: 'CNS malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hydrocephalus']
  },
  {
    code: 'Q05.9',
    description: 'Spina bifida, unspecified',
    shortDescription: 'Spina bifida',
    category: 'CNS malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['neural tube defect', 'myelomeningocele']
  },
  {
    code: 'Q20.0',
    description: 'Common arterial trunk',
    shortDescription: 'Truncus arteriosus',
    category: 'Cardiac malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'Q21.0',
    description: 'Ventricular septal defect',
    shortDescription: 'VSD',
    category: 'Cardiac malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['VSD']
  },
  {
    code: 'Q21.1',
    description: 'Atrial septal defect',
    shortDescription: 'ASD',
    category: 'Cardiac malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['ASD']
  },
  {
    code: 'Q21.2',
    description: 'Atrioventricular septal defect',
    shortDescription: 'AVSD',
    category: 'Cardiac malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['AVSD', 'AV canal']
  },
  {
    code: 'Q21.3',
    description: 'Tetralogy of Fallot',
    shortDescription: 'TOF',
    category: 'Cardiac malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['TOF', 'tet spells']
  },
  {
    code: 'Q23.0',
    description: 'Congenital stenosis of aortic valve',
    shortDescription: 'Aortic stenosis',
    category: 'Cardiac malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['AS']
  },
  {
    code: 'Q23.4',
    description: 'Hypoplastic left heart syndrome',
    shortDescription: 'HLHS',
    category: 'Cardiac malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['HLHS']
  },
  {
    code: 'Q25.0',
    description: 'Patent ductus arteriosus',
    shortDescription: 'PDA',
    category: 'Cardiac malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['PDA']
  },
  {
    code: 'Q25.1',
    description: 'Coarctation of aorta',
    shortDescription: 'Coarctation',
    category: 'Cardiac malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['CoA']
  },
  {
    code: 'Q25.5',
    description: 'Atresia of pulmonary artery',
    shortDescription: 'Pulmonary atresia',
    category: 'Cardiac malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'Q35.9',
    description: 'Cleft palate, unspecified',
    shortDescription: 'Cleft palate',
    category: 'Facial malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['cleft palate']
  },
  {
    code: 'Q36.9',
    description: 'Cleft lip, unilateral',
    shortDescription: 'Cleft lip',
    category: 'Facial malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['cleft lip']
  },
  {
    code: 'Q37.9',
    description: 'Cleft palate with cleft lip, unilateral',
    shortDescription: 'Cleft lip and palate',
    category: 'Facial malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['CLP']
  },
  {
    code: 'Q39.0',
    description: 'Atresia of esophagus without fistula',
    shortDescription: 'EA without TEF',
    category: 'GI malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['esophageal atresia', 'EA']
  },
  {
    code: 'Q39.1',
    description: 'Atresia of esophagus with tracheo-esophageal fistula',
    shortDescription: 'EA with TEF',
    category: 'GI malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['EA/TEF', 'tracheoesophageal fistula']
  },
  {
    code: 'Q40.0',
    description: 'Congenital hypertrophic pyloric stenosis',
    shortDescription: 'Pyloric stenosis',
    category: 'GI malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['IHPS', 'pyloric stenosis']
  },
  {
    code: 'Q41.0',
    description: 'Congenital absence, atresia and stenosis of duodenum',
    shortDescription: 'Duodenal atresia',
    category: 'GI malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['duodenal atresia']
  },
  {
    code: 'Q42.0',
    description: 'Congenital absence, atresia and stenosis of rectum with fistula',
    shortDescription: 'Anorectal malformation',
    category: 'GI malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['ARM', 'imperforate anus']
  },
  {
    code: 'Q43.1',
    description: "Hirschsprung's disease",
    shortDescription: "Hirschsprung's",
    category: 'GI malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hirschsprung', 'congenital megacolon']
  },
  {
    code: 'Q43.3',
    description: 'Congenital malformations of intestinal fixation',
    shortDescription: 'Malrotation',
    category: 'GI malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['malrotation', 'volvulus']
  },
  {
    code: 'Q44.2',
    description: 'Atresia of bile ducts',
    shortDescription: 'Biliary atresia',
    category: 'Hepatobiliary',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['biliary atresia']
  },
  {
    code: 'Q60.0',
    description: 'Renal agenesis, unilateral',
    shortDescription: 'Unilateral renal agenesis',
    category: 'Renal malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'Q60.1',
    description: 'Renal agenesis, bilateral',
    shortDescription: 'Bilateral renal agenesis',
    category: 'Renal malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['potter syndrome']
  },
  {
    code: 'Q61.4',
    description: 'Renal dysplasia',
    shortDescription: 'Renal dysplasia',
    category: 'Renal malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'Q62.0',
    description: 'Congenital hydronephrosis',
    shortDescription: 'Congenital hydronephrosis',
    category: 'Renal malformations',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['hydronephrosis', 'PUJO']
  },
  {
    code: 'Q64.1',
    description: 'Exstrophy of urinary bladder',
    shortDescription: 'Bladder exstrophy',
    category: 'Urological',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'Q79.0',
    description: 'Congenital diaphragmatic hernia',
    shortDescription: 'CDH',
    category: 'Diaphragm',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['CDH', 'diaphragmatic hernia']
  },
  {
    code: 'Q79.2',
    description: 'Exomphalos',
    shortDescription: 'Omphalocele',
    category: 'Abdominal wall',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['omphalocele']
  },
  {
    code: 'Q79.3',
    description: 'Gastroschisis',
    shortDescription: 'Gastroschisis',
    category: 'Abdominal wall',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'Q90.9',
    description: "Down syndrome, unspecified",
    shortDescription: 'Down syndrome',
    category: 'Chromosomal',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['down syndrome', 'trisomy 21']
  },
  {
    code: 'Q91.3',
    description: 'Edwards syndrome, unspecified',
    shortDescription: 'Trisomy 18',
    category: 'Chromosomal',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['edwards syndrome', 'trisomy 18']
  },
  {
    code: 'Q91.7',
    description: 'Patau syndrome, unspecified',
    shortDescription: 'Trisomy 13',
    category: 'Chromosomal',
    chapter: 'Q',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['patau syndrome', 'trisomy 13']
  },

  // Eye conditions (H35 - ROP)
  {
    code: 'H35.10',
    description: 'Retinopathy of prematurity, unspecified',
    shortDescription: 'ROP unspecified',
    category: 'Eye disorders',
    chapter: 'H',
    isNeonatal: true,
    isPediatric: true,
    commonAliases: ['ROP', 'retinopathy of prematurity']
  },
  {
    code: 'H35.111',
    description: 'Retinopathy of prematurity, stage 1, right eye',
    shortDescription: 'ROP Stage 1 RE',
    category: 'Eye disorders',
    chapter: 'H',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'H35.121',
    description: 'Retinopathy of prematurity, stage 2, right eye',
    shortDescription: 'ROP Stage 2 RE',
    category: 'Eye disorders',
    chapter: 'H',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'H35.131',
    description: 'Retinopathy of prematurity, stage 3, right eye',
    shortDescription: 'ROP Stage 3 RE',
    category: 'Eye disorders',
    chapter: 'H',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'H35.141',
    description: 'Retinopathy of prematurity, stage 4, right eye',
    shortDescription: 'ROP Stage 4 RE',
    category: 'Eye disorders',
    chapter: 'H',
    isNeonatal: true,
    isPediatric: true
  },
  {
    code: 'H35.151',
    description: 'Retinopathy of prematurity, stage 5, right eye',
    shortDescription: 'ROP Stage 5 RE',
    category: 'Eye disorders',
    chapter: 'H',
    isNeonatal: true,
    isPediatric: true
  }
];

// Export utility function to search codes
export const searchICD10Codes = (query: string): ICD10Code[] => {
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) return [];

  return NEONATAL_ICD10_CODES.filter(code => {
    // Check code itself
    if (code.code.toLowerCase().startsWith(lowerQuery)) return true;

    // Check description
    if (code.description.toLowerCase().includes(lowerQuery)) return true;

    // Check short description
    if (code.shortDescription?.toLowerCase().includes(lowerQuery)) return true;

    // Check aliases
    if (code.commonAliases?.some(alias => alias.toLowerCase().includes(lowerQuery))) return true;

    // Check category
    if (code.category.toLowerCase().includes(lowerQuery)) return true;

    return false;
  });
};

// Export function to get code by exact match
export const getICD10Code = (code: string): ICD10Code | undefined => {
  return NEONATAL_ICD10_CODES.find(c => c.code === code);
};

// Export categories for filtering
export const ICD10_CATEGORIES = Array.from(
  new Set(NEONATAL_ICD10_CODES.map(c => c.category))
).sort();
