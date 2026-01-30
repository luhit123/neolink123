/**
 * Admission Indications Seeder Script
 *
 * Comprehensive admission indications for NICU, SNCU, PICU, and HDU based on:
 * - Indian Government SNCU Operational Guidelines (NHM/MoHFW)
 * - AAP/SCCM 2019/2020 Guidelines
 * - Indian Academy of Pediatrics (IAP) Intensive Care Chapter Guidelines
 * - WACEM 2019 Consensus Recommendations for PICU Admissions in India
 * - Common morbidity patterns from Indian NICU/SNCU studies
 *
 * Sources:
 * - NHM HP SNCU Admission Policy
 * - Facility Based Newborn Care (FBNC) Operational Guidelines - Ministry of Health & Family Welfare, GoI
 * - Indian Pediatrics Consensus Guidelines 2020
 * - Studies from Gujarat, Odisha, Andhra Pradesh, Chhattisgarh, Haryana
 *
 * Run from the app: Go to Super Admin Dashboard > Clinical > Admission Indications
 * and click "Initialize Comprehensive Indications Now"
 */

import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Unit, AdmissionIndication } from '../types';

// Comprehensive admission indications based on Indian guidelines and studies
const ADMISSION_INDICATIONS: Omit<AdmissionIndication, 'id'>[] = [
  // ============================================
  // NICU/SNCU - PREMATURITY & LOW BIRTH WEIGHT
  // (Most common causes: 23-40% of all admissions in India)
  // ============================================
  { name: 'Prematurity (< 37 weeks gestation)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 0 },
  { name: 'Extreme Prematurity (< 28 weeks gestation)', applicableUnits: [Unit.NICU], isActive: true, order: 1 },
  { name: 'Very Preterm (28-32 weeks gestation)', applicableUnits: [Unit.NICU], isActive: true, order: 2 },
  { name: 'Moderate Preterm (32-34 weeks gestation)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 3 },
  { name: 'Late Preterm (34-37 weeks gestation)', applicableUnits: [Unit.SNCU], isActive: true, order: 4 },
  { name: 'Low Birth Weight (< 2500 gm)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 5 },
  { name: 'Low Birth Weight (< 1800 gm) - SNCU Criteria', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 6 },
  { name: 'Very Low Birth Weight (< 1500 gm)', applicableUnits: [Unit.NICU], isActive: true, order: 7 },
  { name: 'Extremely Low Birth Weight (< 1000 gm)', applicableUnits: [Unit.NICU], isActive: true, order: 8 },
  { name: 'Small for Gestational Age (SGA)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 9 },
  { name: 'Intrauterine Growth Restriction (IUGR)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 10 },
  { name: 'Large for Gestational Age (> 4 kg at term)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 11 },

  // ============================================
  // NICU/SNCU - BIRTH ASPHYXIA / PERINATAL ASPHYXIA
  // (Major cause: 19-28% of admissions, 21% of NICU mortality in India)
  // ============================================
  { name: 'Birth Asphyxia / Perinatal Asphyxia', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 12 },
  { name: 'APGAR Score < 7 at 1 minute', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 13 },
  { name: 'APGAR Score < 6 at 5 minutes', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 14 },
  { name: 'Delayed Cry > 5 minutes after birth', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 15 },
  { name: 'Required Prolonged Resuscitation (Bag & Mask/Tube)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 16 },
  { name: 'Hypoxic Ischemic Encephalopathy (HIE) - Stage I', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 17 },
  { name: 'Hypoxic Ischemic Encephalopathy (HIE) - Stage II', applicableUnits: [Unit.NICU], isActive: true, order: 18 },
  { name: 'Hypoxic Ischemic Encephalopathy (HIE) - Stage III', applicableUnits: [Unit.NICU], isActive: true, order: 19 },
  { name: 'Therapeutic Hypothermia Candidate', applicableUnits: [Unit.NICU], isActive: true, order: 20 },
  { name: 'Post-resuscitation Encephalopathy', applicableUnits: [Unit.NICU], isActive: true, order: 21 },

  // ============================================
  // NICU/SNCU - RESPIRATORY DISTRESS
  // (Most common: 40% of admissions as per Odisha study)
  // ============================================
  { name: 'Respiratory Distress Syndrome (RDS)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 22 },
  { name: 'Respiratory Distress (RR > 60/min)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 23 },
  { name: 'Respiratory Distress (Grunting)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 24 },
  { name: 'Respiratory Distress (Chest Retractions)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 25 },
  { name: 'Respiratory Distress (Nasal Flaring)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 26 },
  { name: 'Transient Tachypnea of Newborn (TTN)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 27 },
  { name: 'Meconium Aspiration Syndrome (MAS)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 28 },
  { name: 'Meconium Stained Liquor with Respiratory Distress', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 29 },
  { name: 'Surfactant Deficiency', applicableUnits: [Unit.NICU], isActive: true, order: 30 },
  { name: 'Pneumothorax', applicableUnits: [Unit.NICU], isActive: true, order: 31 },
  { name: 'Pulmonary Hemorrhage', applicableUnits: [Unit.NICU], isActive: true, order: 32 },
  { name: 'Congenital Pneumonia', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 33 },
  { name: 'Aspiration Pneumonia', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 34 },
  { name: 'Bronchopulmonary Dysplasia (BPD)', applicableUnits: [Unit.NICU], isActive: true, order: 35 },
  { name: 'Persistent Pulmonary Hypertension (PPHN)', applicableUnits: [Unit.NICU], isActive: true, order: 36 },
  { name: 'Apnea of Prematurity', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 37 },
  { name: 'Apnea / Gasping', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 38 },
  { name: 'Central Cyanosis', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 39 },
  { name: 'Oxygen Saturation < 90% on Room Air', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 40 },

  // ============================================
  // NICU/SNCU - NEONATAL SEPSIS
  // (18-28% of admissions, 40% of NICU mortality in India)
  // ============================================
  { name: 'Early Onset Neonatal Sepsis (EONS) - < 72 hours', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 41 },
  { name: 'Late Onset Neonatal Sepsis (LONS) - > 72 hours', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 42 },
  { name: 'Suspected Sepsis / Sepsis Screen Positive', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 43 },
  { name: 'Culture Proven Sepsis', applicableUnits: [Unit.NICU], isActive: true, order: 44 },
  { name: 'Neonatal Meningitis', applicableUnits: [Unit.NICU], isActive: true, order: 45 },
  { name: 'Umbilical Sepsis / Omphalitis', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 46 },
  { name: 'Skin Infections / Pustulosis', applicableUnits: [Unit.SNCU], isActive: true, order: 47 },
  { name: 'Conjunctivitis (Severe/Gonococcal)', applicableUnits: [Unit.SNCU], isActive: true, order: 48 },
  { name: 'Urinary Tract Infection', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 49 },
  { name: 'Septic Shock', applicableUnits: [Unit.NICU], isActive: true, order: 50 },
  { name: 'Disseminated Intravascular Coagulation (DIC)', applicableUnits: [Unit.NICU], isActive: true, order: 51 },

  // ============================================
  // NICU/SNCU - NEONATAL JAUNDICE / HYPERBILIRUBINEMIA
  // (15-33% of admissions in Indian studies)
  // ============================================
  { name: 'Neonatal Jaundice requiring Phototherapy', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 52 },
  { name: 'Severe Hyperbilirubinemia (TSB > 20 mg/dL)', applicableUnits: [Unit.NICU], isActive: true, order: 53 },
  { name: 'Hyperbilirubinemia approaching Exchange level', applicableUnits: [Unit.NICU], isActive: true, order: 54 },
  { name: 'Exchange Transfusion Required', applicableUnits: [Unit.NICU], isActive: true, order: 55 },
  { name: 'Jaundice within 24 hours of birth', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 56 },
  { name: 'ABO Incompatibility with Jaundice', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 57 },
  { name: 'Rh Incompatibility / Rh Hemolytic Disease', applicableUnits: [Unit.NICU], isActive: true, order: 58 },
  { name: 'G6PD Deficiency with Hyperbilirubinemia', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 59 },
  { name: 'Acute Bilirubin Encephalopathy (ABE)', applicableUnits: [Unit.NICU], isActive: true, order: 60 },
  { name: 'Kernicterus / Chronic Bilirubin Encephalopathy', applicableUnits: [Unit.NICU], isActive: true, order: 61 },
  { name: 'Prolonged Jaundice (> 14 days in term, > 21 days in preterm)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 62 },
  { name: 'Cholestatic Jaundice / Conjugated Hyperbilirubinemia', applicableUnits: [Unit.NICU], isActive: true, order: 63 },

  // ============================================
  // NICU/SNCU - NEUROLOGICAL CONDITIONS
  // ============================================
  { name: 'Neonatal Seizures / Convulsions', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 64 },
  { name: 'Subtle Seizures', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 65 },
  { name: 'Tonic-Clonic Seizures', applicableUnits: [Unit.NICU], isActive: true, order: 66 },
  { name: 'Status Epilepticus (Neonatal)', applicableUnits: [Unit.NICU], isActive: true, order: 67 },
  { name: 'Intraventricular Hemorrhage (IVH)', applicableUnits: [Unit.NICU], isActive: true, order: 68 },
  { name: 'Periventricular Leukomalacia (PVL)', applicableUnits: [Unit.NICU], isActive: true, order: 69 },
  { name: 'Intracranial Hemorrhage', applicableUnits: [Unit.NICU], isActive: true, order: 70 },
  { name: 'Subdural Hemorrhage', applicableUnits: [Unit.NICU], isActive: true, order: 71 },
  { name: 'Subarachnoid Hemorrhage', applicableUnits: [Unit.NICU], isActive: true, order: 72 },
  { name: 'Hydrocephalus', applicableUnits: [Unit.NICU], isActive: true, order: 73 },
  { name: 'Meningomyelocele / Neural Tube Defect', applicableUnits: [Unit.NICU], isActive: true, order: 74 },
  { name: 'Encephalocele', applicableUnits: [Unit.NICU], isActive: true, order: 75 },
  { name: 'Hypotonia / Floppy Baby', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 76 },
  { name: 'Jitteriness / Tremors', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 77 },
  { name: 'Altered Sensorium / Lethargy', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 78 },

  // ============================================
  // NICU/SNCU - METABOLIC & ENDOCRINE
  // ============================================
  { name: 'Hypoglycemia (< 45 mg/dL)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 79 },
  { name: 'Recurrent / Refractory Hypoglycemia', applicableUnits: [Unit.NICU], isActive: true, order: 80 },
  { name: 'Symptomatic Hypoglycemia', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 81 },
  { name: 'Hyperglycemia', applicableUnits: [Unit.NICU], isActive: true, order: 82 },
  { name: 'Hypocalcemia', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 83 },
  { name: 'Hyponatremia', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 84 },
  { name: 'Hypernatremia', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 85 },
  { name: 'Hypokalemia', applicableUnits: [Unit.NICU], isActive: true, order: 86 },
  { name: 'Hyperkalemia', applicableUnits: [Unit.NICU], isActive: true, order: 87 },
  { name: 'Metabolic Acidosis', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 88 },
  { name: 'Inborn Errors of Metabolism (IEM)', applicableUnits: [Unit.NICU], isActive: true, order: 89 },
  { name: 'Congenital Hypothyroidism', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 90 },
  { name: 'Congenital Adrenal Hyperplasia (CAH)', applicableUnits: [Unit.NICU], isActive: true, order: 91 },
  { name: 'Baby of Diabetic Mother (IDM)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 92 },

  // ============================================
  // NICU/SNCU - CARDIOVASCULAR
  // ============================================
  { name: 'Congenital Heart Disease (CHD) - Cyanotic', applicableUnits: [Unit.NICU], isActive: true, order: 93 },
  { name: 'Congenital Heart Disease (CHD) - Acyanotic', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 94 },
  { name: 'Patent Ductus Arteriosus (PDA) - Hemodynamically Significant', applicableUnits: [Unit.NICU], isActive: true, order: 95 },
  { name: 'Congestive Heart Failure', applicableUnits: [Unit.NICU], isActive: true, order: 96 },
  { name: 'Cardiomyopathy', applicableUnits: [Unit.NICU], isActive: true, order: 97 },
  { name: 'Cardiac Arrhythmia / Bradycardia', applicableUnits: [Unit.NICU], isActive: true, order: 98 },
  { name: 'Supraventricular Tachycardia (SVT)', applicableUnits: [Unit.NICU], isActive: true, order: 99 },
  { name: 'Shock (Cold Periphery, CRT > 3 sec)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 100 },
  { name: 'Poor Perfusion / Mottling', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 101 },

  // ============================================
  // NICU/SNCU - GASTROINTESTINAL
  // ============================================
  { name: 'Necrotizing Enterocolitis (NEC)', applicableUnits: [Unit.NICU], isActive: true, order: 102 },
  { name: 'Suspected NEC / Abdominal Distension', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 103 },
  { name: 'Feed Intolerance', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 104 },
  { name: 'Poor Feeding / Refusal to Feed', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 105 },
  { name: 'Bilious Vomiting', applicableUnits: [Unit.NICU], isActive: true, order: 106 },
  { name: 'Non-Bilious Vomiting (Persistent)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 107 },
  { name: 'Blood in Stool', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 108 },
  { name: 'Gastrointestinal Hemorrhage', applicableUnits: [Unit.NICU], isActive: true, order: 109 },
  { name: 'Intestinal Obstruction', applicableUnits: [Unit.NICU], isActive: true, order: 110 },
  { name: 'Tracheoesophageal Fistula (TEF)', applicableUnits: [Unit.NICU], isActive: true, order: 111 },
  { name: 'Esophageal Atresia', applicableUnits: [Unit.NICU], isActive: true, order: 112 },
  { name: 'Duodenal Atresia', applicableUnits: [Unit.NICU], isActive: true, order: 113 },
  { name: 'Imperforate Anus', applicableUnits: [Unit.NICU], isActive: true, order: 114 },
  { name: 'Gastroschisis', applicableUnits: [Unit.NICU], isActive: true, order: 115 },
  { name: 'Omphalocele', applicableUnits: [Unit.NICU], isActive: true, order: 116 },
  { name: 'Diaphragmatic Hernia', applicableUnits: [Unit.NICU], isActive: true, order: 117 },
  { name: 'Pyloric Stenosis', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 118 },
  { name: 'Hirschsprung Disease', applicableUnits: [Unit.NICU], isActive: true, order: 119 },
  { name: 'Meconium Ileus', applicableUnits: [Unit.NICU], isActive: true, order: 120 },
  { name: 'Delayed Passage of Meconium (> 48 hours)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 121 },
  { name: 'Diarrhea (Severe)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 122 },

  // ============================================
  // NICU/SNCU - HEMATOLOGICAL
  // ============================================
  { name: 'Anemia of Prematurity', applicableUnits: [Unit.NICU], isActive: true, order: 123 },
  { name: 'Severe Anemia requiring Transfusion', applicableUnits: [Unit.NICU], isActive: true, order: 124 },
  { name: 'Polycythemia', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 125 },
  { name: 'Thrombocytopenia', applicableUnits: [Unit.NICU], isActive: true, order: 126 },
  { name: 'Bleeding / Hemorrhagic Disease of Newborn (HDN)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 127 },
  { name: 'Vitamin K Deficiency Bleeding (VKDB)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 128 },
  { name: 'Coagulopathy', applicableUnits: [Unit.NICU], isActive: true, order: 129 },

  // ============================================
  // NICU/SNCU - RENAL
  // ============================================
  { name: 'Acute Kidney Injury (AKI)', applicableUnits: [Unit.NICU], isActive: true, order: 130 },
  { name: 'Oliguria (< 1 mL/kg/hr)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 131 },
  { name: 'Anuria', applicableUnits: [Unit.NICU], isActive: true, order: 132 },
  { name: 'Posterior Urethral Valves (PUV)', applicableUnits: [Unit.NICU], isActive: true, order: 133 },
  { name: 'Hydronephrosis', applicableUnits: [Unit.NICU], isActive: true, order: 134 },
  { name: 'Renal Failure', applicableUnits: [Unit.NICU], isActive: true, order: 135 },

  // ============================================
  // NICU/SNCU - THERMOREGULATION
  // ============================================
  { name: 'Hypothermia (< 36.5°C)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 136 },
  { name: 'Moderate Hypothermia (32-36°C)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 137 },
  { name: 'Severe Hypothermia (< 32°C)', applicableUnits: [Unit.NICU], isActive: true, order: 138 },
  { name: 'Hyperthermia (> 37.5°C)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 139 },
  { name: 'Cold Stress', applicableUnits: [Unit.SNCU], isActive: true, order: 140 },

  // ============================================
  // NICU/SNCU - CONGENITAL ANOMALIES
  // ============================================
  { name: 'Multiple Congenital Anomalies (MCA)', applicableUnits: [Unit.NICU], isActive: true, order: 141 },
  { name: 'Cleft Lip and/or Palate', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 142 },
  { name: 'Pierre Robin Sequence', applicableUnits: [Unit.NICU], isActive: true, order: 143 },
  { name: 'Choanal Atresia', applicableUnits: [Unit.NICU], isActive: true, order: 144 },
  { name: 'Laryngomalacia (Severe)', applicableUnits: [Unit.NICU], isActive: true, order: 145 },
  { name: 'Subglottic Stenosis', applicableUnits: [Unit.NICU], isActive: true, order: 146 },
  { name: 'Down Syndrome with Complications', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 147 },
  { name: 'Chromosomal Abnormalities', applicableUnits: [Unit.NICU], isActive: true, order: 148 },
  { name: 'Ambiguous Genitalia', applicableUnits: [Unit.NICU], isActive: true, order: 149 },

  // ============================================
  // NICU/SNCU - INFECTIONS (SPECIFIC)
  // ============================================
  { name: 'Congenital Syphilis', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 150 },
  { name: 'Congenital Tuberculosis', applicableUnits: [Unit.NICU], isActive: true, order: 151 },
  { name: 'TORCH Infection', applicableUnits: [Unit.NICU], isActive: true, order: 152 },
  { name: 'Congenital CMV Infection', applicableUnits: [Unit.NICU], isActive: true, order: 153 },
  { name: 'Congenital Rubella Syndrome', applicableUnits: [Unit.NICU], isActive: true, order: 154 },
  { name: 'Congenital Toxoplasmosis', applicableUnits: [Unit.NICU], isActive: true, order: 155 },
  { name: 'Herpes Simplex Virus (HSV) Infection', applicableUnits: [Unit.NICU], isActive: true, order: 156 },
  { name: 'HIV Exposed Neonate', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 157 },
  { name: 'Hepatitis B Exposed Neonate', applicableUnits: [Unit.SNCU], isActive: true, order: 158 },
  { name: 'Neonatal Tetanus', applicableUnits: [Unit.NICU], isActive: true, order: 159 },
  { name: 'Fungal Sepsis', applicableUnits: [Unit.NICU], isActive: true, order: 160 },

  // ============================================
  // NICU/SNCU - MATERNAL RISK FACTORS
  // ============================================
  { name: 'Baby of Mother with PIH/Preeclampsia/Eclampsia', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 161 },
  { name: 'Baby of Mother with PROM > 18 hours', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 162 },
  { name: 'Baby of Mother with Chorioamnionitis', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 163 },
  { name: 'Baby of Mother with Maternal Fever', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 164 },
  { name: 'Baby of Mother with Foul Smelling Liquor', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 165 },
  { name: 'Twins / Multiple Gestation', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 166 },
  { name: 'Twin-to-Twin Transfusion Syndrome (TTTS)', applicableUnits: [Unit.NICU], isActive: true, order: 167 },

  // ============================================
  // NICU/SNCU - RESPIRATORY SUPPORT REQUIREMENTS
  // ============================================
  { name: 'Requiring Mechanical Ventilation', applicableUnits: [Unit.NICU], isActive: true, order: 168 },
  { name: 'Requiring High Frequency Oscillatory Ventilation (HFOV)', applicableUnits: [Unit.NICU], isActive: true, order: 169 },
  { name: 'Requiring CPAP Support', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 170 },
  { name: 'Requiring Bubble CPAP', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 171 },
  { name: 'Requiring High Flow Nasal Cannula (HFNC)', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 172 },
  { name: 'Requiring Supplemental Oxygen', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 173 },
  { name: 'Requiring Surfactant Therapy', applicableUnits: [Unit.NICU], isActive: true, order: 174 },
  { name: 'Post-extubation Monitoring', applicableUnits: [Unit.NICU, Unit.SNCU], isActive: true, order: 175 },

  // ============================================
  // NICU/SNCU - SURGICAL CONDITIONS
  // ============================================
  { name: 'Pre-operative Stabilization', applicableUnits: [Unit.NICU], isActive: true, order: 176 },
  { name: 'Post-operative Care (Neonatal Surgery)', applicableUnits: [Unit.NICU], isActive: true, order: 177 },
  { name: 'Post-operative Care (Cardiac Surgery)', applicableUnits: [Unit.NICU], isActive: true, order: 178 },

  // ============================================
  // PICU Indications (Pediatric Intensive Care)
  // Based on IAP 2020 Guidelines & WACEM 2019
  // ============================================
  { name: 'Severe Respiratory Distress / Respiratory Failure', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 200 },
  { name: 'Status Asthmaticus', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 201 },
  { name: 'Severe Pneumonia requiring ventilation', applicableUnits: [Unit.PICU], isActive: true, order: 202 },
  { name: 'Acute Respiratory Distress Syndrome (ARDS)', applicableUnits: [Unit.PICU], isActive: true, order: 203 },
  { name: 'Upper Airway Obstruction (Severe Croup/Epiglottitis)', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 204 },
  { name: 'Bronchiolitis requiring respiratory support', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 205 },
  { name: 'Foreign Body Aspiration with Respiratory Compromise', applicableUnits: [Unit.PICU], isActive: true, order: 206 },
  { name: 'Pulmonary Hemorrhage', applicableUnits: [Unit.PICU], isActive: true, order: 207 },
  { name: 'Severe Sepsis / Septic Shock', applicableUnits: [Unit.PICU], isActive: true, order: 208 },
  { name: 'Hypovolemic Shock', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 209 },
  { name: 'Cardiogenic Shock', applicableUnits: [Unit.PICU], isActive: true, order: 210 },
  { name: 'Distributive Shock', applicableUnits: [Unit.PICU], isActive: true, order: 211 },
  { name: 'Acute Cardiac Failure / Decompensated Heart Failure', applicableUnits: [Unit.PICU], isActive: true, order: 212 },
  { name: 'Post Cardiac Surgery Monitoring', applicableUnits: [Unit.PICU], isActive: true, order: 213 },
  { name: 'Cardiac Arrhythmias (Life-threatening)', applicableUnits: [Unit.PICU], isActive: true, order: 214 },
  { name: 'Severe Head Trauma / Traumatic Brain Injury', applicableUnits: [Unit.PICU], isActive: true, order: 215 },
  { name: 'Status Epilepticus / Refractory Seizures', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 216 },
  { name: 'Altered Consciousness / Coma (GCS < 8)', applicableUnits: [Unit.PICU], isActive: true, order: 217 },
  { name: 'Meningitis / Encephalitis (Severe)', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 218 },
  { name: 'Guillain-Barré Syndrome requiring ventilation', applicableUnits: [Unit.PICU], isActive: true, order: 219 },
  { name: 'Raised Intracranial Pressure (ICP)', applicableUnits: [Unit.PICU], isActive: true, order: 220 },
  { name: 'Multi-system Trauma / Polytrauma', applicableUnits: [Unit.PICU], isActive: true, order: 221 },
  { name: 'Major Burns (> 20% TBSA)', applicableUnits: [Unit.PICU], isActive: true, order: 222 },
  { name: 'Moderate Burns (10-20% TBSA)', applicableUnits: [Unit.HDU], isActive: true, order: 223 },
  { name: 'Near Drowning / Submersion Injury', applicableUnits: [Unit.PICU], isActive: true, order: 224 },
  { name: 'Severe Electrocution', applicableUnits: [Unit.PICU], isActive: true, order: 225 },
  { name: 'Diabetic Ketoacidosis (DKA) - Severe', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 226 },
  { name: 'Severe Dehydration with Shock', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 227 },
  { name: 'Acute Kidney Injury requiring Dialysis', applicableUnits: [Unit.PICU], isActive: true, order: 228 },
  { name: 'Hepatic Encephalopathy / Acute Liver Failure', applicableUnits: [Unit.PICU], isActive: true, order: 229 },
  { name: 'Severe Electrolyte Imbalance', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 230 },
  { name: 'Inborn Errors of Metabolism (Acute decompensation)', applicableUnits: [Unit.PICU], isActive: true, order: 231 },
  { name: 'Post-operative Care (Major Surgery)', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 232 },
  { name: 'Post Neurosurgery Monitoring', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 233 },
  { name: 'Post Thoracic Surgery', applicableUnits: [Unit.PICU], isActive: true, order: 234 },
  { name: 'Post Abdominal Surgery (Major)', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 235 },
  { name: 'Toxic Ingestion / Poisoning (Severe)', applicableUnits: [Unit.PICU], isActive: true, order: 236 },
  { name: 'Snake Bite with Envenomation', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 237 },
  { name: 'Scorpion Sting with Myocarditis', applicableUnits: [Unit.PICU], isActive: true, order: 238 },
  { name: 'Drug Overdose', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 239 },
  { name: 'Organophosphorus Poisoning', applicableUnits: [Unit.PICU], isActive: true, order: 240 },
  { name: 'Kerosene/Hydrocarbon Poisoning', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 241 },
  { name: 'Anaphylaxis (Severe)', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 242 },
  { name: 'Hemolytic Uremic Syndrome (HUS)', applicableUnits: [Unit.PICU], isActive: true, order: 243 },
  { name: 'Dengue Shock Syndrome', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 244 },
  { name: 'Severe Dengue with Warning Signs', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 245 },
  { name: 'Malaria (Severe / Cerebral)', applicableUnits: [Unit.PICU], isActive: true, order: 246 },
  { name: 'Scrub Typhus with Complications', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 247 },
  { name: 'Multi-organ Dysfunction Syndrome (MODS)', applicableUnits: [Unit.PICU], isActive: true, order: 248 },
  { name: 'Requiring Inotropic / Vasopressor Support', applicableUnits: [Unit.PICU], isActive: true, order: 249 },
  { name: 'Requiring Mechanical Ventilation', applicableUnits: [Unit.PICU], isActive: true, order: 250 },
  { name: 'Requiring Non-invasive Ventilation (NIV)', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 251 },
  { name: 'Requiring High Flow Oxygen Therapy', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 252 },
  { name: 'Acute Pancreatitis (Severe)', applicableUnits: [Unit.PICU], isActive: true, order: 253 },
  { name: 'Acute Glomerulonephritis with Complications', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 254 },
  { name: 'Nephrotic Syndrome with Complications', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 255 },
  { name: 'Severe Anemia requiring Exchange Transfusion', applicableUnits: [Unit.PICU], isActive: true, order: 256 },
  { name: 'Sickle Cell Crisis (Severe)', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 257 },
  { name: 'Tumor Lysis Syndrome', applicableUnits: [Unit.PICU], isActive: true, order: 258 },
  { name: 'Leukostasis', applicableUnits: [Unit.PICU], isActive: true, order: 259 },
  { name: 'Severe Malnutrition with Complications', applicableUnits: [Unit.PICU, Unit.HDU], isActive: true, order: 260 },

  // ============================================
  // HDU Specific Indications
  // ============================================
  { name: 'Moderate Respiratory Distress', applicableUnits: [Unit.HDU], isActive: true, order: 300 },
  { name: 'Post-extubation Monitoring', applicableUnits: [Unit.HDU], isActive: true, order: 301 },
  { name: 'Frequent Vital Signs Monitoring Required', applicableUnits: [Unit.HDU], isActive: true, order: 302 },
  { name: 'Altered Sensorium (GCS 9-12)', applicableUnits: [Unit.HDU], isActive: true, order: 303 },
  { name: 'Prolonged / Clustering Seizures', applicableUnits: [Unit.HDU], isActive: true, order: 304 },
  { name: 'Unstable Metabolic Condition', applicableUnits: [Unit.HDU], isActive: true, order: 305 },
  { name: 'Step-down from PICU', applicableUnits: [Unit.HDU], isActive: true, order: 306 },
  { name: 'Close Observation post-procedure', applicableUnits: [Unit.HDU], isActive: true, order: 307 },
  { name: 'Severe Asthma (improving)', applicableUnits: [Unit.HDU], isActive: true, order: 308 },
  { name: 'Moderate Dehydration requiring IV therapy', applicableUnits: [Unit.HDU], isActive: true, order: 309 },
  { name: 'Pneumonia requiring close monitoring', applicableUnits: [Unit.HDU], isActive: true, order: 310 },
  { name: 'Post-lumbar puncture observation', applicableUnits: [Unit.HDU], isActive: true, order: 311 },

  // ============================================
  // General Ward Indications
  // ============================================
  { name: 'Mild Respiratory Infection', applicableUnits: [Unit.GENERAL_WARD], isActive: true, order: 400 },
  { name: 'Stable for ward care', applicableUnits: [Unit.GENERAL_WARD], isActive: true, order: 401 },
  { name: 'Observation and monitoring', applicableUnits: [Unit.GENERAL_WARD], isActive: true, order: 402 },
  { name: 'Step-down from HDU', applicableUnits: [Unit.GENERAL_WARD], isActive: true, order: 403 },
  { name: 'Step-down from SNCU', applicableUnits: [Unit.GENERAL_WARD], isActive: true, order: 404 },
  { name: 'Completion of IV antibiotic course', applicableUnits: [Unit.GENERAL_WARD], isActive: true, order: 405 },
  { name: 'Weight gain monitoring (LBW)', applicableUnits: [Unit.GENERAL_WARD], isActive: true, order: 406 },
  { name: 'Phototherapy for jaundice (stable)', applicableUnits: [Unit.GENERAL_WARD], isActive: true, order: 407 },

  // ============================================
  // Common to All Units
  // ============================================
  { name: 'Any Other (Specify in remarks)', applicableUnits: [Unit.NICU, Unit.SNCU, Unit.PICU, Unit.HDU, Unit.GENERAL_WARD], isActive: true, order: 999 },
];

/**
 * Seed admission indications to Firestore
 * @param userEmail - Email of the user seeding the data (for audit trail)
 * @returns Object with success and failed counts
 */
export async function seedAdmissionIndications(userEmail: string): Promise<{ success: number; failed: number; skipped: number }> {
  console.log('🌱 Starting admission indications seeding...');
  console.log(`📊 Total indications to seed: ${ADMISSION_INDICATIONS.length}`);

  // Check if indications already exist
  const indicationsRef = collection(db, 'admissionIndications');
  const existingSnapshot = await getDocs(query(indicationsRef, orderBy('order', 'asc')));

  if (existingSnapshot.size > 0) {
    console.log(`⚠️ ${existingSnapshot.size} indications already exist. Skipping seeding to avoid duplicates.`);
    console.log('💡 To re-seed, first delete existing indications from the Super Admin Dashboard.');
    return { success: 0, failed: 0, skipped: existingSnapshot.size };
  }

  let successCount = 0;
  let failedCount = 0;

  for (const indication of ADMISSION_INDICATIONS) {
    try {
      await addDoc(indicationsRef, {
        ...indication,
        createdAt: new Date().toISOString(),
        createdBy: userEmail,
      });
      successCount++;
      if (successCount % 20 === 0) {
        console.log(`✅ Added ${successCount} indications...`);
      }
    } catch (error) {
      console.error(`❌ Failed to add ${indication.name}:`, error);
      failedCount++;
    }
  }

  console.log(`\n🌱 Seeding complete!`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log(`   📊 Total indications: ${ADMISSION_INDICATIONS.length}`);

  return { success: successCount, failed: failedCount, skipped: 0 };
}

/**
 * Get the total count of admission indications that would be seeded
 */
export function getAdmissionIndicationCount(): number {
  return ADMISSION_INDICATIONS.length;
}

/**
 * Get indications for a specific unit
 */
export function getIndicationsForUnit(unit: Unit): Omit<AdmissionIndication, 'id'>[] {
  return ADMISSION_INDICATIONS.filter(ind => ind.applicableUnits.includes(unit));
}

/**
 * Get indication breakdown by unit
 */
export function getIndicationBreakdown(): Record<string, number> {
  const breakdown: Record<string, number> = {};

  Object.values(Unit).forEach(unit => {
    breakdown[unit] = ADMISSION_INDICATIONS.filter(ind => ind.applicableUnits.includes(unit)).length;
  });

  return breakdown;
}

// Export the raw indications for reference
export { ADMISSION_INDICATIONS };
