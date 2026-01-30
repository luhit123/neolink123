import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient, Unit } from '../types';

// ==================== ICD-10 DATABASE FOR NEONATAL CONDITIONS ====================

interface ICD10Code {
  code: string;
  description: string;
  category: string;
  shortName: string;
}

const NEONATAL_ICD10_CODES: ICD10Code[] = [
  // Prematurity & Birth Weight
  { code: 'P07.00', description: 'Extremely low birth weight newborn, unspecified weight', category: 'Prematurity/LBW', shortName: 'ELBW' },
  { code: 'P07.01', description: 'Extremely low birth weight newborn, less than 500 grams', category: 'Prematurity/LBW', shortName: 'ELBW <500g' },
  { code: 'P07.02', description: 'Extremely low birth weight newborn, 500-749 grams', category: 'Prematurity/LBW', shortName: 'ELBW 500-749g' },
  { code: 'P07.03', description: 'Extremely low birth weight newborn, 750-999 grams', category: 'Prematurity/LBW', shortName: 'ELBW 750-999g' },
  { code: 'P07.14', description: 'Other low birth weight newborn, 1000-1249 grams', category: 'Prematurity/LBW', shortName: 'VLBW 1000-1249g' },
  { code: 'P07.15', description: 'Other low birth weight newborn, 1250-1499 grams', category: 'Prematurity/LBW', shortName: 'VLBW 1250-1499g' },
  { code: 'P07.16', description: 'Other low birth weight newborn, 1500-1749 grams', category: 'Prematurity/LBW', shortName: 'LBW 1500-1749g' },
  { code: 'P07.17', description: 'Other low birth weight newborn, 1750-1999 grams', category: 'Prematurity/LBW', shortName: 'LBW 1750-1999g' },
  { code: 'P07.18', description: 'Other low birth weight newborn, 2000-2499 grams', category: 'Prematurity/LBW', shortName: 'LBW 2000-2499g' },
  { code: 'P07.20', description: 'Extreme immaturity of newborn, unspecified weeks of gestation', category: 'Prematurity/LBW', shortName: 'Extreme Preterm' },
  { code: 'P07.21', description: 'Extreme immaturity of newborn, gestational age less than 23 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm <23w' },
  { code: 'P07.22', description: 'Extreme immaturity of newborn, gestational age 23 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 23w' },
  { code: 'P07.23', description: 'Extreme immaturity of newborn, gestational age 24 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 24w' },
  { code: 'P07.24', description: 'Extreme immaturity of newborn, gestational age 25 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 25w' },
  { code: 'P07.25', description: 'Extreme immaturity of newborn, gestational age 26 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 26w' },
  { code: 'P07.26', description: 'Extreme immaturity of newborn, gestational age 27 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 27w' },
  { code: 'P07.31', description: 'Preterm newborn, gestational age 28 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 28w' },
  { code: 'P07.32', description: 'Preterm newborn, gestational age 29 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 29w' },
  { code: 'P07.33', description: 'Preterm newborn, gestational age 30 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 30w' },
  { code: 'P07.34', description: 'Preterm newborn, gestational age 31 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 31w' },
  { code: 'P07.35', description: 'Preterm newborn, gestational age 32 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 32w' },
  { code: 'P07.36', description: 'Preterm newborn, gestational age 33 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 33w' },
  { code: 'P07.37', description: 'Preterm newborn, gestational age 34 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 34w' },
  { code: 'P07.38', description: 'Preterm newborn, gestational age 35 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 35w' },
  { code: 'P07.39', description: 'Preterm newborn, gestational age 36 completed weeks', category: 'Prematurity/LBW', shortName: 'Preterm 36w' },

  // Respiratory Disorders
  { code: 'P22.0', description: 'Respiratory distress syndrome of newborn (RDS/HMD)', category: 'Respiratory', shortName: 'RDS' },
  { code: 'P22.1', description: 'Transient tachypnea of newborn (TTN)', category: 'Respiratory', shortName: 'TTN' },
  { code: 'P22.8', description: 'Other respiratory distress of newborn', category: 'Respiratory', shortName: 'Resp. Distress' },
  { code: 'P22.9', description: 'Respiratory distress of newborn, unspecified', category: 'Respiratory', shortName: 'Resp. Distress NOS' },
  { code: 'P24.01', description: 'Meconium aspiration with respiratory symptoms', category: 'Respiratory', shortName: 'MAS with symptoms' },
  { code: 'P24.00', description: 'Meconium aspiration without respiratory symptoms', category: 'Respiratory', shortName: 'MAS w/o symptoms' },
  { code: 'P25.1', description: 'Pneumothorax originating in the perinatal period', category: 'Respiratory', shortName: 'Pneumothorax' },
  { code: 'P27.1', description: 'Bronchopulmonary dysplasia (BPD)', category: 'Respiratory', shortName: 'BPD' },
  { code: 'P28.3', description: 'Primary sleep apnea of newborn', category: 'Respiratory', shortName: 'Apnea' },
  { code: 'P28.4', description: 'Other apnea of newborn', category: 'Respiratory', shortName: 'Apnea' },
  { code: 'P28.5', description: 'Respiratory failure of newborn', category: 'Respiratory', shortName: 'Resp. Failure' },

  // Birth Asphyxia & HIE
  { code: 'P21.0', description: 'Severe birth asphyxia', category: 'Birth Asphyxia', shortName: 'Severe Asphyxia' },
  { code: 'P21.1', description: 'Mild and moderate birth asphyxia', category: 'Birth Asphyxia', shortName: 'Mild-Mod Asphyxia' },
  { code: 'P21.9', description: 'Birth asphyxia, unspecified', category: 'Birth Asphyxia', shortName: 'Birth Asphyxia' },
  { code: 'P91.60', description: 'Hypoxic ischemic encephalopathy [HIE], unspecified', category: 'Birth Asphyxia', shortName: 'HIE' },
  { code: 'P91.61', description: 'Mild hypoxic ischemic encephalopathy [HIE]', category: 'Birth Asphyxia', shortName: 'HIE Stage 1' },
  { code: 'P91.62', description: 'Moderate hypoxic ischemic encephalopathy [HIE]', category: 'Birth Asphyxia', shortName: 'HIE Stage 2' },
  { code: 'P91.63', description: 'Severe hypoxic ischemic encephalopathy [HIE]', category: 'Birth Asphyxia', shortName: 'HIE Stage 3' },

  // Infections
  { code: 'P36.0', description: 'Sepsis of newborn due to streptococcus, group B', category: 'Infections', shortName: 'GBS Sepsis' },
  { code: 'P36.10', description: 'Sepsis of newborn due to other and unspecified streptococci', category: 'Infections', shortName: 'Strep Sepsis' },
  { code: 'P36.2', description: 'Sepsis of newborn due to Staphylococcus aureus', category: 'Infections', shortName: 'Staph Sepsis' },
  { code: 'P36.30', description: 'Sepsis of newborn due to other and unspecified staphylococci', category: 'Infections', shortName: 'CoNS Sepsis' },
  { code: 'P36.4', description: 'Sepsis of newborn due to Escherichia coli', category: 'Infections', shortName: 'E.coli Sepsis' },
  { code: 'P36.5', description: 'Sepsis of newborn due to anaerobes', category: 'Infections', shortName: 'Anaerobic Sepsis' },
  { code: 'P36.8', description: 'Other bacterial sepsis of newborn', category: 'Infections', shortName: 'Bacterial Sepsis' },
  { code: 'P36.9', description: 'Bacterial sepsis of newborn, unspecified', category: 'Infections', shortName: 'Neonatal Sepsis' },
  { code: 'P23.0', description: 'Congenital pneumonia due to viral agent', category: 'Infections', shortName: 'Viral Pneumonia' },
  { code: 'P23.4', description: 'Congenital pneumonia due to Escherichia coli', category: 'Infections', shortName: 'E.coli Pneumonia' },
  { code: 'P23.9', description: 'Congenital pneumonia, unspecified', category: 'Infections', shortName: 'Congenital Pneumonia' },
  { code: 'P39.9', description: 'Infection specific to the perinatal period, unspecified', category: 'Infections', shortName: 'Perinatal Infection' },
  { code: 'G00.9', description: 'Bacterial meningitis, unspecified', category: 'Infections', shortName: 'Meningitis' },
  { code: 'A41.9', description: 'Sepsis, unspecified organism', category: 'Infections', shortName: 'Sepsis' },

  // Jaundice
  { code: 'P59.0', description: 'Neonatal jaundice associated with preterm delivery', category: 'Jaundice', shortName: 'Jaundice of Prematurity' },
  { code: 'P59.9', description: 'Neonatal jaundice, unspecified', category: 'Jaundice', shortName: 'Neonatal Jaundice' },
  { code: 'P58.0', description: 'Neonatal jaundice due to bruising', category: 'Jaundice', shortName: 'Jaundice - Bruising' },
  { code: 'P58.3', description: 'Neonatal jaundice due to polycythemia', category: 'Jaundice', shortName: 'Jaundice - Polycythemia' },
  { code: 'P55.0', description: 'Rh isoimmunization of newborn', category: 'Jaundice', shortName: 'Rh Incompatibility' },
  { code: 'P55.1', description: 'ABO isoimmunization of newborn', category: 'Jaundice', shortName: 'ABO Incompatibility' },
  { code: 'P57.0', description: 'Kernicterus due to isoimmunization', category: 'Jaundice', shortName: 'Kernicterus' },

  // Hemorrhagic Disorders
  { code: 'P52.0', description: 'Intraventricular hemorrhage, grade 1', category: 'Hemorrhagic', shortName: 'IVH Grade I' },
  { code: 'P52.1', description: 'Intraventricular hemorrhage, grade 2', category: 'Hemorrhagic', shortName: 'IVH Grade II' },
  { code: 'P52.21', description: 'Intraventricular hemorrhage, grade 3', category: 'Hemorrhagic', shortName: 'IVH Grade III' },
  { code: 'P52.22', description: 'Intraventricular hemorrhage, grade 4', category: 'Hemorrhagic', shortName: 'IVH Grade IV' },
  { code: 'P52.4', description: 'Intracerebral hemorrhage of newborn', category: 'Hemorrhagic', shortName: 'ICH' },
  { code: 'P52.6', description: 'Cerebellar hemorrhage of newborn', category: 'Hemorrhagic', shortName: 'Cerebellar Hemorrhage' },
  { code: 'P54.5', description: 'Neonatal gastrointestinal hemorrhage', category: 'Hemorrhagic', shortName: 'GI Hemorrhage' },
  { code: 'P54.6', description: 'Neonatal vaginal hemorrhage', category: 'Hemorrhagic', shortName: 'Vaginal Hemorrhage' },
  { code: 'P53', description: 'Hemorrhagic disease of newborn (VKDB)', category: 'Hemorrhagic', shortName: 'VKDB' },

  // Metabolic Disorders
  { code: 'P70.4', description: 'Other neonatal hypoglycemia', category: 'Metabolic', shortName: 'Hypoglycemia' },
  { code: 'P70.0', description: 'Syndrome of infant of mother with gestational diabetes', category: 'Metabolic', shortName: 'IDM (GDM)' },
  { code: 'P70.1', description: 'Syndrome of infant of diabetic mother', category: 'Metabolic', shortName: 'IDM' },
  { code: 'P71.1', description: 'Other neonatal hypocalcemia', category: 'Metabolic', shortName: 'Hypocalcemia' },
  { code: 'P71.3', description: 'Neonatal tetany without calcium or magnesium deficiency', category: 'Metabolic', shortName: 'Neonatal Tetany' },
  { code: 'P74.1', description: 'Dehydration of newborn', category: 'Metabolic', shortName: 'Dehydration' },
  { code: 'P74.21', description: 'Hypernatremia of newborn', category: 'Metabolic', shortName: 'Hypernatremia' },
  { code: 'P74.22', description: 'Hyponatremia of newborn', category: 'Metabolic', shortName: 'Hyponatremia' },
  { code: 'P74.31', description: 'Hyperkalemia of newborn', category: 'Metabolic', shortName: 'Hyperkalemia' },
  { code: 'P74.32', description: 'Hypokalemia of newborn', category: 'Metabolic', shortName: 'Hypokalemia' },

  // Cardiac
  { code: 'Q25.0', description: 'Patent ductus arteriosus (PDA)', category: 'Cardiac', shortName: 'PDA' },
  { code: 'Q21.1', description: 'Atrial septal defect (ASD)', category: 'Cardiac', shortName: 'ASD' },
  { code: 'Q21.0', description: 'Ventricular septal defect (VSD)', category: 'Cardiac', shortName: 'VSD' },
  { code: 'P29.30', description: 'Pulmonary hypertension of newborn', category: 'Cardiac', shortName: 'PPHN' },
  { code: 'Q20.0', description: 'Common arterial trunk', category: 'Cardiac', shortName: 'Truncus Arteriosus' },
  { code: 'Q20.3', description: 'Transposition of great arteries (TGA)', category: 'Cardiac', shortName: 'TGA' },
  { code: 'Q21.3', description: 'Tetralogy of Fallot (TOF)', category: 'Cardiac', shortName: 'TOF' },
  { code: 'Q23.4', description: 'Hypoplastic left heart syndrome (HLHS)', category: 'Cardiac', shortName: 'HLHS' },
  { code: 'Q25.1', description: 'Coarctation of aorta', category: 'Cardiac', shortName: 'CoA' },

  // Gastrointestinal
  { code: 'P77.1', description: 'Stage 1 necrotizing enterocolitis in newborn', category: 'Gastrointestinal', shortName: 'NEC Stage I' },
  { code: 'P77.2', description: 'Stage 2 necrotizing enterocolitis in newborn', category: 'Gastrointestinal', shortName: 'NEC Stage II' },
  { code: 'P77.3', description: 'Stage 3 necrotizing enterocolitis in newborn', category: 'Gastrointestinal', shortName: 'NEC Stage III' },
  { code: 'P76.0', description: 'Meconium plug syndrome', category: 'Gastrointestinal', shortName: 'Meconium Plug' },
  { code: 'P76.1', description: 'Transitory ileus of newborn', category: 'Gastrointestinal', shortName: 'Ileus' },
  { code: 'K21.0', description: 'Gastroesophageal reflux disease with esophagitis', category: 'Gastrointestinal', shortName: 'GERD' },
  { code: 'Q79.0', description: 'Congenital diaphragmatic hernia', category: 'Gastrointestinal', shortName: 'CDH' },
  { code: 'Q42.3', description: 'Congenital absence, atresia and stenosis of anus', category: 'Gastrointestinal', shortName: 'Imperforate Anus' },
  { code: 'Q41.0', description: 'Congenital absence, atresia and stenosis of duodenum', category: 'Gastrointestinal', shortName: 'Duodenal Atresia' },

  // Neurological
  { code: 'P90', description: 'Convulsions of newborn', category: 'Neurological', shortName: 'Neonatal Seizures' },
  { code: 'P91.0', description: 'Neonatal cerebral ischemia', category: 'Neurological', shortName: 'Cerebral Ischemia' },
  { code: 'P91.1', description: 'Acquired periventricular cysts of newborn', category: 'Neurological', shortName: 'PVL' },
  { code: 'P91.2', description: 'Neonatal cerebral leukomalacia', category: 'Neurological', shortName: 'Leukomalacia' },
  { code: 'P91.4', description: 'Neonatal cerebral depression', category: 'Neurological', shortName: 'Cerebral Depression' },
  { code: 'P91.5', description: 'Neonatal coma', category: 'Neurological', shortName: 'Neonatal Coma' },
  { code: 'Q03.9', description: 'Congenital hydrocephalus, unspecified', category: 'Neurological', shortName: 'Hydrocephalus' },
  { code: 'Q05.9', description: 'Spina bifida, unspecified', category: 'Neurological', shortName: 'Spina Bifida' },

  // Anemia
  { code: 'P61.2', description: 'Anemia of prematurity', category: 'Hematological', shortName: 'Anemia of Prematurity' },
  { code: 'P61.0', description: 'Transient neonatal thrombocytopenia', category: 'Hematological', shortName: 'Thrombocytopenia' },
  { code: 'P61.1', description: 'Polycythemia neonatorum', category: 'Hematological', shortName: 'Polycythemia' },
  { code: 'P61.4', description: 'Other congenital anemias, not elsewhere classified', category: 'Hematological', shortName: 'Congenital Anemia' },

  // ROP
  { code: 'H35.10', description: 'Retinopathy of prematurity, unspecified', category: 'Ophthalmological', shortName: 'ROP' },
  { code: 'H35.111', description: 'Retinopathy of prematurity, stage 1, right eye', category: 'Ophthalmological', shortName: 'ROP Stage 1' },
  { code: 'H35.121', description: 'Retinopathy of prematurity, stage 2, right eye', category: 'Ophthalmological', shortName: 'ROP Stage 2' },
  { code: 'H35.131', description: 'Retinopathy of prematurity, stage 3, right eye', category: 'Ophthalmological', shortName: 'ROP Stage 3' },
  { code: 'H35.141', description: 'Retinopathy of prematurity, stage 4, right eye', category: 'Ophthalmological', shortName: 'ROP Stage 4' },
  { code: 'H35.151', description: 'Retinopathy of prematurity, stage 5, right eye', category: 'Ophthalmological', shortName: 'ROP Stage 5' },

  // Maternal Factors
  { code: 'P00.0', description: 'Newborn affected by maternal hypertensive disorders', category: 'Maternal Factors', shortName: 'Maternal HTN' },
  { code: 'P00.1', description: 'Newborn affected by maternal renal and urinary tract diseases', category: 'Maternal Factors', shortName: 'Maternal Renal Disease' },
  { code: 'P00.2', description: 'Newborn affected by maternal infectious and parasitic diseases', category: 'Maternal Factors', shortName: 'Maternal Infection' },
  { code: 'P01.0', description: 'Newborn affected by incompetent cervix', category: 'Maternal Factors', shortName: 'Incompetent Cervix' },
  { code: 'P01.1', description: 'Newborn affected by premature rupture of membranes', category: 'Maternal Factors', shortName: 'PROM' },
  { code: 'P02.7', description: 'Newborn affected by chorioamnionitis', category: 'Maternal Factors', shortName: 'Chorioamnionitis' },
  { code: 'P02.1', description: 'Newborn affected by other forms of placental separation and hemorrhage', category: 'Maternal Factors', shortName: 'Placental Abruption' },
  { code: 'P02.0', description: 'Newborn affected by placenta previa', category: 'Maternal Factors', shortName: 'Placenta Previa' },

  // Birth Trauma
  { code: 'P10.0', description: 'Subdural hemorrhage due to birth injury', category: 'Birth Trauma', shortName: 'SDH - Birth' },
  { code: 'P10.1', description: 'Cerebral hemorrhage due to birth injury', category: 'Birth Trauma', shortName: 'ICH - Birth' },
  { code: 'P11.0', description: 'Cerebral edema due to birth injury', category: 'Birth Trauma', shortName: 'Cerebral Edema' },
  { code: 'P14.0', description: "Erb's paralysis due to birth injury", category: 'Birth Trauma', shortName: "Erb's Palsy" },
  { code: 'P14.1', description: "Klumpke's paralysis due to birth injury", category: 'Birth Trauma', shortName: "Klumpke's Palsy" },
  { code: 'P12.0', description: 'Cephalohematoma due to birth injury', category: 'Birth Trauma', shortName: 'Cephalohematoma' },
  { code: 'P12.1', description: 'Chignon (from vacuum extraction) due to birth injury', category: 'Birth Trauma', shortName: 'Chignon' },
  { code: 'P13.4', description: 'Fracture of clavicle due to birth injury', category: 'Birth Trauma', shortName: 'Clavicle Fracture' },

  // Congenital Anomalies
  { code: 'Q00.0', description: 'Anencephaly', category: 'Congenital', shortName: 'Anencephaly' },
  { code: 'Q01.9', description: 'Encephalocele, unspecified', category: 'Congenital', shortName: 'Encephalocele' },
  { code: 'Q35.9', description: 'Cleft palate, unspecified', category: 'Congenital', shortName: 'Cleft Palate' },
  { code: 'Q36.9', description: 'Cleft lip, unilateral', category: 'Congenital', shortName: 'Cleft Lip' },
  { code: 'Q37.9', description: 'Unspecified cleft palate with unilateral cleft lip', category: 'Congenital', shortName: 'Cleft Lip & Palate' },
  { code: 'Q39.0', description: 'Atresia of esophagus without fistula', category: 'Congenital', shortName: 'EA' },
  { code: 'Q39.1', description: 'Atresia of esophagus with tracheo-esophageal fistula', category: 'Congenital', shortName: 'TEF' },
  { code: 'Q60.0', description: 'Renal agenesis, unilateral', category: 'Congenital', shortName: 'Renal Agenesis' },
  { code: 'Q61.4', description: 'Renal dysplasia', category: 'Congenital', shortName: 'Renal Dysplasia' },
  { code: 'Q64.0', description: 'Epispadias', category: 'Congenital', shortName: 'Epispadias' },
  { code: 'Q54.9', description: 'Hypospadias, unspecified', category: 'Congenital', shortName: 'Hypospadias' },
  { code: 'Q53.9', description: 'Undescended testicle, unspecified', category: 'Congenital', shortName: 'UDT' },
  { code: 'Q65.0', description: 'Congenital dislocation of hip, unilateral', category: 'Congenital', shortName: 'DDH' },
  { code: 'Q66.0', description: 'Congenital talipes equinovarus', category: 'Congenital', shortName: 'CTEV' },
  { code: 'Q90.9', description: 'Down syndrome, unspecified', category: 'Congenital', shortName: 'Down Syndrome' },
];

// ==================== DIAGNOSIS ITEM INTERFACE ====================

interface DiagnosisItem {
  id: string;
  text: string;
  icd10Code?: string;
  category: 'principal' | 'primary' | 'secondary' | 'comorbidity' | 'maternal';
  details?: string;
  treatment?: string;
  status?: 'active' | 'resolved' | 'chronic';
}

// ==================== TEMPLATE DEFINITIONS ====================

interface DiagnosisTemplate {
  id: string;
  name: string;
  description: string;
  diagnoses: Omit<DiagnosisItem, 'id'>[];
}

const DIAGNOSIS_TEMPLATES: DiagnosisTemplate[] = [
  {
    id: 'preterm-rds',
    name: 'Preterm with RDS',
    description: 'Premature baby with respiratory distress syndrome',
    diagnoses: [
      { text: 'Preterm newborn', category: 'principal', icd10Code: 'P07.3' },
      { text: 'Very Low Birth Weight', category: 'primary', icd10Code: 'P07.1' },
      { text: 'Respiratory Distress Syndrome (RDS)', category: 'secondary', icd10Code: 'P22.0', treatment: 'Treated with surfactant therapy' },
      { text: 'Apnea of prematurity', category: 'secondary', icd10Code: 'P28.4' },
      { text: 'Anemia of prematurity', category: 'comorbidity', icd10Code: 'P61.2' },
    ]
  },
  {
    id: 'preterm-sepsis',
    name: 'Preterm with Sepsis',
    description: 'Premature baby with neonatal sepsis',
    diagnoses: [
      { text: 'Preterm newborn', category: 'principal', icd10Code: 'P07.3' },
      { text: 'Low Birth Weight', category: 'primary', icd10Code: 'P07.1' },
      { text: 'Early Onset Neonatal Sepsis', category: 'secondary', icd10Code: 'P36.9', treatment: 'Completed antibiotics course' },
      { text: 'Hyperbilirubinemia', category: 'comorbidity', icd10Code: 'P59.9' },
    ]
  },
  {
    id: 'birth-asphyxia',
    name: 'Birth Asphyxia with HIE',
    description: 'Birth asphyxia with hypoxic-ischemic encephalopathy',
    diagnoses: [
      { text: 'Severe Birth Asphyxia', category: 'principal', icd10Code: 'P21.0' },
      { text: 'Hypoxic Ischemic Encephalopathy (HIE)', category: 'primary', icd10Code: 'P91.6' },
      { text: 'Neonatal Seizures', category: 'secondary', icd10Code: 'P90', treatment: 'Controlled with anticonvulsants' },
      { text: 'Meconium Aspiration Syndrome', category: 'secondary', icd10Code: 'P24.01' },
    ]
  },
  {
    id: 'mas',
    name: 'Meconium Aspiration Syndrome',
    description: 'MAS with respiratory distress',
    diagnoses: [
      { text: 'Meconium Aspiration Syndrome (MAS)', category: 'principal', icd10Code: 'P24.01' },
      { text: 'Persistent Pulmonary Hypertension of Newborn', category: 'secondary', icd10Code: 'P29.30' },
      { text: 'Respiratory Failure', category: 'secondary', icd10Code: 'P28.5' },
    ]
  },
  {
    id: 'neonatal-jaundice',
    name: 'Neonatal Hyperbilirubinemia',
    description: 'Jaundice requiring phototherapy',
    diagnoses: [
      { text: 'Neonatal Hyperbilirubinemia', category: 'principal', icd10Code: 'P59.9', treatment: 'Treated with phototherapy' },
      { text: 'ABO Incompatibility', category: 'secondary', icd10Code: 'P55.1' },
    ]
  },
  {
    id: 'lbw-observation',
    name: 'Low Birth Weight Observation',
    description: 'LBW baby for observation and feeding establishment',
    diagnoses: [
      { text: 'Low Birth Weight newborn', category: 'principal', icd10Code: 'P07.1' },
      { text: 'Poor feeding', category: 'secondary' },
      { text: 'Hypothermia of newborn', category: 'comorbidity', icd10Code: 'P80.9' },
    ]
  },
  {
    id: 'term-sepsis',
    name: 'Term Newborn with Sepsis',
    description: 'Full term baby with suspected/confirmed sepsis',
    diagnoses: [
      { text: 'Neonatal Sepsis', category: 'principal', icd10Code: 'P36.9', treatment: 'Completed 7 days IV antibiotics' },
      { text: 'Hyperbilirubinemia', category: 'secondary', icd10Code: 'P59.9' },
      { text: 'Chorioamnionitis (maternal)', category: 'maternal', icd10Code: 'P02.7' },
    ]
  },
];

// ==================== COMPONENT PROPS ====================

interface FinalDiagnosisBuilderProps {
  patient: Patient;
  value: string;
  onChange: (value: string) => void;
  isNICU: boolean;
}

// ==================== MAIN COMPONENT ====================

const FinalDiagnosisBuilder: React.FC<FinalDiagnosisBuilderProps> = ({
  patient,
  value,
  onChange,
  isNICU
}) => {
  const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showICD10Search, setShowICD10Search] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  // Generate formatted diagnosis text
  const generateDiagnosisText = (items: DiagnosisItem[]): string => {
    if (items.length === 0) return '';

    const principal = items.filter(d => d.category === 'principal');
    const primary = items.filter(d => d.category === 'primary');
    const secondary = items.filter(d => d.category === 'secondary');
    const comorbidity = items.filter(d => d.category === 'comorbidity');
    const maternal = items.filter(d => d.category === 'maternal');

    let text = 'FINAL DIAGNOSIS:\n\n';

    const formatItem = (item: DiagnosisItem, index: number): string => {
      let line = `${index + 1}. ${item.text}`;
      if (item.icd10Code) line += ` [${item.icd10Code}]`;
      if (item.details) line += `\n   - ${item.details}`;
      if (item.treatment) line += `\n   - ${item.treatment}`;
      return line;
    };

    let counter = 1;

    if (principal.length > 0 || primary.length > 0) {
      [...principal, ...primary].forEach(item => {
        text += formatItem(item, counter - 1) + '\n';
        counter++;
      });
    }

    if (secondary.length > 0) {
      text += '\n';
      secondary.forEach(item => {
        text += formatItem(item, counter - 1) + '\n';
        counter++;
      });
    }

    if (comorbidity.length > 0) {
      text += '\n';
      comorbidity.forEach(item => {
        text += formatItem(item, counter - 1) + '\n';
        counter++;
      });
    }

    if (maternal.length > 0) {
      text += '\nMATERNAL FACTORS:\n';
      maternal.forEach((item, idx) => {
        text += `- ${item.text}`;
        if (item.icd10Code) text += ` [${item.icd10Code}]`;
        text += '\n';
      });
    }

    // Add condition at discharge
    text += `\nCONDITION AT DISCHARGE: Stable, Improved`;

    return text.trim();
  };

  // Update parent when diagnoses change
  useEffect(() => {
    if (diagnoses.length > 0) {
      onChange(generateDiagnosisText(diagnoses));
    }
  }, [diagnoses]);

  // Filter ICD-10 codes based on search
  const filteredCodes = useMemo(() => {
    let codes = NEONATAL_ICD10_CODES;

    if (selectedCategory !== 'all') {
      codes = codes.filter(c => c.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      codes = codes.filter(c =>
        c.code.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.shortName.toLowerCase().includes(query)
      );
    }

    return codes;
  }, [searchQuery, selectedCategory]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(NEONATAL_ICD10_CODES.map(c => c.category));
    return ['all', ...Array.from(cats)];
  }, []);

  const addDiagnosis = (icd?: ICD10Code) => {
    const newItem: DiagnosisItem = {
      id: Date.now().toString(),
      text: icd?.description || '',
      icd10Code: icd?.code,
      category: 'secondary'
    };
    setDiagnoses([...diagnoses, newItem]);
    setShowICD10Search(false);
    setEditingId(newItem.id);
  };

  const updateDiagnosis = (id: string, updates: Partial<DiagnosisItem>) => {
    setDiagnoses(diagnoses.map(d =>
      d.id === id ? { ...d, ...updates } : d
    ));
  };

  const removeDiagnosis = (id: string) => {
    setDiagnoses(diagnoses.filter(d => d.id !== id));
  };

  const applyTemplate = (template: DiagnosisTemplate) => {
    const newDiagnoses: DiagnosisItem[] = template.diagnoses.map((d, idx) => ({
      ...d,
      id: Date.now().toString() + idx
    }));
    setDiagnoses(newDiagnoses);
    setShowTemplates(false);
  };

  const moveDiagnosis = (id: string, direction: 'up' | 'down') => {
    const index = diagnoses.findIndex(d => d.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= diagnoses.length) return;

    const newDiagnoses = [...diagnoses];
    [newDiagnoses[index], newDiagnoses[newIndex]] = [newDiagnoses[newIndex], newDiagnoses[index]];
    setDiagnoses(newDiagnoses);
  };

  const getCategoryColor = (category: DiagnosisItem['category']) => {
    switch (category) {
      case 'principal': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'primary': return 'bg-sky-100 text-sky-700 border-sky-300';
      case 'secondary': return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'comorbidity': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'maternal': return 'bg-pink-100 text-pink-700 border-pink-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getCategoryLabel = (category: DiagnosisItem['category']) => {
    switch (category) {
      case 'principal': return 'Principal';
      case 'primary': return 'Primary';
      case 'secondary': return 'Secondary';
      case 'comorbidity': return 'Comorbidity';
      case 'maternal': return 'Maternal Factor';
      default: return category;
    }
  };

  return (
    <div className="space-y-4">
      {/* Toggle between Simple and Builder Mode */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBuilder(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              !showBuilder
                ? isNICU ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Simple
          </button>
          <button
            onClick={() => setShowBuilder(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              showBuilder
                ? isNICU ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Structured Builder
          </button>
        </div>
        {showBuilder && (
          <button
            onClick={() => setShowTemplates(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isNICU ? 'bg-sky-100 text-sky-700 hover:bg-sky-200' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            Templates
          </button>
        )}
      </div>

      {/* Simple Mode - Just Text Area */}
      {!showBuilder && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter the final diagnosis..."
          className={`w-full h-32 p-3 border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 ${
            isNICU
              ? 'border-sky-200 bg-white focus:ring-sky-500 text-sky-900 placeholder-sky-400'
              : 'border-violet-200 bg-white focus:ring-violet-500 text-violet-900 placeholder-violet-400'
          }`}
          style={{ lineHeight: '1.6' }}
        />
      )}

      {/* Builder Mode */}
      {showBuilder && (
        <div className="space-y-3">
          {/* Diagnosis List */}
          <div className="space-y-2">
            {diagnoses.map((diagnosis, index) => (
              <motion.div
                key={diagnosis.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-3 rounded-xl border-2 ${
                  editingId === diagnosis.id
                    ? isNICU ? 'border-sky-400 bg-sky-50' : 'border-violet-400 bg-violet-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-2">
                  {/* Order number */}
                  <div className="flex flex-col items-center gap-1">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isNICU ? 'bg-sky-500 text-white' : 'bg-violet-500 text-white'
                    }`}>
                      {index + 1}
                    </span>
                    <button
                      onClick={() => moveDiagnosis(diagnosis.id, 'up')}
                      disabled={index === 0}
                      className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveDiagnosis(diagnosis.id, 'down')}
                      disabled={index === diagnoses.length - 1}
                      className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-2">
                    {/* Category selector and text */}
                    <div className="flex items-start gap-2">
                      <select
                        value={diagnosis.category}
                        onChange={(e) => updateDiagnosis(diagnosis.id, { category: e.target.value as DiagnosisItem['category'] })}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold border ${getCategoryColor(diagnosis.category)}`}
                      >
                        <option value="principal">Principal</option>
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                        <option value="comorbidity">Comorbidity</option>
                        <option value="maternal">Maternal</option>
                      </select>
                      <input
                        type="text"
                        value={diagnosis.text}
                        onChange={(e) => updateDiagnosis(diagnosis.id, { text: e.target.value })}
                        onFocus={() => setEditingId(diagnosis.id)}
                        placeholder="Diagnosis description..."
                        className="flex-1 px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>

                    {/* ICD-10 and details */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">ICD-10:</span>
                        <input
                          type="text"
                          value={diagnosis.icd10Code || ''}
                          onChange={(e) => updateDiagnosis(diagnosis.id, { icd10Code: e.target.value })}
                          placeholder="Code"
                          className="w-20 px-2 py-0.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-sky-400"
                        />
                      </div>
                      <input
                        type="text"
                        value={diagnosis.treatment || ''}
                        onChange={(e) => updateDiagnosis(diagnosis.id, { treatment: e.target.value })}
                        placeholder="Treatment/Notes (optional)"
                        className="flex-1 min-w-[150px] px-2 py-0.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-sky-400"
                      />
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => removeDiagnosis(diagnosis.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            ))}

            {diagnoses.length === 0 && (
              <div className={`p-6 rounded-xl border-2 border-dashed text-center ${
                isNICU ? 'border-sky-300 bg-sky-50' : 'border-violet-300 bg-violet-50'
              }`}>
                <p className={`text-sm ${isNICU ? 'text-sky-600' : 'text-violet-600'}`}>
                  No diagnoses added. Click "Add Diagnosis" or use a template.
                </p>
              </div>
            )}
          </div>

          {/* Add Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => addDiagnosis()}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                isNICU
                  ? 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                  : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Diagnosis
            </button>
            <button
              onClick={() => setShowICD10Search(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              ICD-10 Lookup
            </button>
          </div>

          {/* Preview */}
          {diagnoses.length > 0 && (
            <div className={`p-3 rounded-xl border ${isNICU ? 'border-sky-200 bg-sky-50' : 'border-violet-200 bg-violet-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${isNICU ? 'text-sky-700' : 'text-violet-700'}`}>
                  Preview
                </span>
              </div>
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-white p-2 rounded-lg border border-slate-200 max-h-32 overflow-y-auto">
                {generateDiagnosisText(diagnoses)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Templates Modal */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"
            onClick={() => setShowTemplates(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-4 py-3 ${isNICU ? 'bg-sky-500' : 'bg-violet-500'} text-white`}>
                <h3 className="font-bold">Diagnosis Templates</h3>
                <p className="text-sm opacity-80">Select a template to auto-fill diagnoses</p>
              </div>
              <div className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
                {DIAGNOSIS_TEMPLATES.map(template => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                      isNICU ? 'border-sky-200 hover:border-sky-400' : 'border-violet-200 hover:border-violet-400'
                    }`}
                  >
                    <div className="font-semibold text-slate-800">{template.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{template.description}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.diagnoses.slice(0, 3).map((d, idx) => (
                        <span key={idx} className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(d.category)}`}>
                          {d.text.substring(0, 20)}...
                        </span>
                      ))}
                      {template.diagnoses.length > 3 && (
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
                          +{template.diagnoses.length - 3} more
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ICD-10 Search Modal */}
      <AnimatePresence>
        {showICD10Search && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"
            onClick={() => setShowICD10Search(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-4 py-3 ${isNICU ? 'bg-sky-500' : 'bg-violet-500'} text-white`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">ICD-10 Code Lookup</h3>
                    <p className="text-sm opacity-80">Search neonatal diagnosis codes</p>
                  </div>
                  <button onClick={() => setShowICD10Search(false)} className="p-1 hover:bg-white/20 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-4 border-b">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by code, description, or keyword..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  autoFocus
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                        selectedCategory === cat
                          ? isNICU ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat === 'all' ? 'All' : cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-y-auto max-h-[50vh] p-2">
                {filteredCodes.length > 0 ? (
                  <div className="space-y-1">
                    {filteredCodes.map(code => (
                      <button
                        key={code.code}
                        onClick={() => addDiagnosis(code)}
                        className="w-full p-3 rounded-xl border border-slate-200 text-left hover:border-sky-300 hover:bg-sky-50 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                              isNICU ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
                            }`}>
                              {code.code}
                            </span>
                            <span className="ml-2 text-xs text-slate-500">{code.category}</span>
                            <p className="text-sm text-slate-800 mt-1">{code.description}</p>
                          </div>
                          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    No matching ICD-10 codes found
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FinalDiagnosisBuilder;
