-- Supabase Database Schema for Hybrid Architecture
-- Run this SQL in your Supabase SQL Editor to set up the tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== TABLES ====================

-- Institutions table
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_id TEXT UNIQUE,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  address TEXT,
  district TEXT,
  state TEXT,
  pin_code TEXT,
  institution_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Units within institutions
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, name)
);

-- Monthly records for easy extraction
CREATE TABLE IF NOT EXISTS monthly_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, year, month)
);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_id TEXT UNIQUE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  admission_unit_id UUID REFERENCES units(id),
  current_unit_id UUID REFERENCES units(id),
  monthly_record_id UUID REFERENCES monthly_records(id),

  -- Patient identification
  ntid TEXT,
  name TEXT NOT NULL,
  ip_number TEXT,

  -- Demographics
  date_of_birth DATE,
  gender TEXT,
  age INT,
  age_unit TEXT,

  -- Admission/Discharge
  admission_date TIMESTAMPTZ,
  discharge_date TIMESTAMPTZ,
  admission_year_month TEXT,
  discharge_year_month TEXT,
  outcome TEXT,

  -- Diagnosis
  admission_diagnosis TEXT,
  final_diagnosis TEXT,

  -- Weight tracking
  birth_weight DECIMAL,
  weight_on_admission DECIMAL,
  weight_on_discharge DECIMAL,

  -- Admission details
  admission_type TEXT,
  place_of_delivery TEXT,
  referring_hospital TEXT,
  referring_district TEXT,

  -- Family information
  mother_name TEXT,
  father_name TEXT,

  -- Address
  address TEXT,
  village TEXT,
  district TEXT,
  state TEXT,
  pin_code TEXT,
  contact_no TEXT,

  -- Gestational age
  gestational_age_weeks INT,
  gestational_age_days INT,

  -- Step down tracking
  is_step_down BOOLEAN DEFAULT FALSE,
  step_down_date TIMESTAMPTZ,
  step_down_from TEXT,

  -- Metadata
  is_draft BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progress notes
CREATE TABLE IF NOT EXISTS progress_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  firebase_id TEXT,

  date DATE NOT NULL,
  year_month TEXT,

  -- Vitals
  temperature DECIMAL,
  heart_rate INT,
  respiratory_rate INT,
  spo2 INT,
  blood_pressure TEXT,
  weight DECIMAL,

  -- Clinical
  examination JSONB,
  assessment TEXT,
  plan TEXT,
  note TEXT,
  medications JSONB,
  icd10_codes TEXT,

  -- Author
  added_by TEXT,
  added_by_email TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clinical notes (voice notes, AI notes)
CREATE TABLE IF NOT EXISTS clinical_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  firebase_id TEXT,

  type TEXT,
  content TEXT,
  author_email TEXT,
  author_name TEXT,
  year_month TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discharge summaries
CREATE TABLE IF NOT EXISTS discharge_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  firebase_id TEXT,

  summary_data JSONB,
  discharge_type TEXT,
  discharge_date TIMESTAMPTZ,
  prepared_by TEXT,
  verified_by TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Death records (for mortality analytics)
CREATE TABLE IF NOT EXISTS death_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,

  date_of_death TIMESTAMPTZ,
  cause_of_death TEXT,
  diagnosis_at_death TEXT,
  ai_interpreted_diagnosis TEXT,
  ai_analysis JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== INDEXES ====================

-- For monthly queries
CREATE INDEX IF NOT EXISTS idx_patients_admission_month ON patients(institution_id, admission_year_month);
CREATE INDEX IF NOT EXISTS idx_patients_discharge_month ON patients(institution_id, discharge_year_month);
CREATE INDEX IF NOT EXISTS idx_patients_unit ON patients(current_unit_id, outcome);
CREATE INDEX IF NOT EXISTS idx_patients_firebase ON patients(firebase_id);
CREATE INDEX IF NOT EXISTS idx_progress_notes_month ON progress_notes(patient_id, year_month);
CREATE INDEX IF NOT EXISTS idx_progress_notes_date ON progress_notes(patient_id, date);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient ON clinical_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_death_records_patient ON death_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_institutions_firebase ON institutions(firebase_id);

-- ==================== VIEWS ====================

-- Monthly patient summary view
CREATE OR REPLACE VIEW monthly_patient_summary AS
SELECT
  i.name as institution_name,
  p.admission_year_month,
  u.name as unit_name,
  COUNT(*) as total_patients,
  COUNT(*) FILTER (WHERE p.outcome = 'Discharged') as discharged,
  COUNT(*) FILTER (WHERE p.outcome = 'Deceased') as deceased,
  COUNT(*) FILTER (WHERE p.outcome = 'In Progress') as in_progress,
  COUNT(*) FILTER (WHERE p.outcome = 'Referred') as referred,
  COUNT(*) FILTER (WHERE p.outcome = 'Step Down') as step_down
FROM patients p
JOIN institutions i ON p.institution_id = i.id
LEFT JOIN units u ON p.admission_unit_id = u.id
GROUP BY i.name, p.admission_year_month, u.name;

-- Deep hierarchy view
CREATE OR REPLACE VIEW patient_hierarchy AS
SELECT
  i.name as institution,
  p.admission_year_month as month,
  u.name as unit,
  p.name as patient_name,
  p.ip_number,
  p.ntid,
  p.outcome,
  p.admission_date,
  p.discharge_date,
  p.admission_diagnosis,
  p.final_diagnosis,
  (SELECT COUNT(*) FROM progress_notes pn WHERE pn.patient_id = p.id) as note_count,
  (SELECT COUNT(*) FROM clinical_notes cn WHERE cn.patient_id = p.id) as clinical_note_count
FROM patients p
JOIN institutions i ON p.institution_id = i.id
LEFT JOIN units u ON p.admission_unit_id = u.id
ORDER BY i.name, p.admission_year_month DESC, u.name, p.admission_date;

-- Death analytics view
CREATE OR REPLACE VIEW death_analytics AS
SELECT
  i.name as institution_name,
  p.admission_year_month,
  u.name as unit_name,
  p.name as patient_name,
  p.ntid,
  p.age,
  p.age_unit,
  p.gender,
  p.admission_diagnosis,
  dr.date_of_death,
  dr.diagnosis_at_death,
  dr.ai_interpreted_diagnosis,
  p.gestational_age_weeks,
  p.birth_weight
FROM death_records dr
JOIN patients p ON dr.patient_id = p.id
JOIN institutions i ON p.institution_id = i.id
LEFT JOIN units u ON p.admission_unit_id = u.id
ORDER BY dr.date_of_death DESC;

-- ==================== FUNCTIONS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_institutions_updated_at ON institutions;
CREATE TRIGGER update_institutions_updated_at
  BEFORE UPDATE ON institutions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== ROW LEVEL SECURITY ====================

-- Enable RLS on all tables
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discharge_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE death_records ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (allow all for now - customize based on your auth)
-- In production, you'd want more specific policies based on user roles

CREATE POLICY "Allow all for authenticated users" ON institutions
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON units
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON monthly_records
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON patients
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON progress_notes
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON clinical_notes
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON discharge_summaries
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON death_records
  FOR ALL USING (true);

-- ==================== SAMPLE QUERIES ====================

-- Example: Get all NICU patients from January 2025
-- SELECT * FROM patients p
-- JOIN units u ON p.admission_unit_id = u.id
-- WHERE p.admission_year_month = '2025-01'
-- AND u.name = 'NICU';

-- Example: Monthly report with aggregations
-- SELECT * FROM monthly_patient_summary
-- WHERE institution_name = 'Your Hospital'
-- AND admission_year_month = '2025-01';

-- Example: Deep hierarchy query
-- SELECT * FROM patient_hierarchy
-- WHERE month = '2025-01'
-- ORDER BY institution, unit, admission_date;

-- Example: Death analytics for a period
-- SELECT * FROM death_analytics
-- WHERE date_of_death >= '2025-01-01'
-- AND date_of_death < '2025-02-01';
