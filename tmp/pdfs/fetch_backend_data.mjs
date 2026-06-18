import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { initializeApp } from 'firebase/app';
import {
  collection,
  collectionGroup,
  getDocs,
  getFirestore,
  initializeFirestore,
  query,
  where,
} from 'firebase/firestore';

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const root = process.cwd();
const env = { ...loadEnv(path.join(root, '.env')), ...process.env };
const months = ['2026-02', '2026-03'];
const outputPath = path.join(root, 'tmp', 'pdfs', 'neolink_feb_march_2026_aggregates.json');

function normalizeMonth(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}$/.test(dateValue)) return dateValue;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeUnit(unitValue, unitsById = {}) {
  const raw = unitsById[unitValue] || unitValue || 'Unknown';
  const text = String(raw).toUpperCase();
  if (text.includes('NICU')) return 'NICU';
  if (text.includes('PICU')) return 'PICU';
  if (text.includes('SNCU')) return 'SNCU';
  if (text.includes('OBS')) return 'Observation';
  return String(raw || 'Unknown');
}

function firestoreDateToISOString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return null;
}

function normalizeOutcome(outcomeValue) {
  const text = String(outcomeValue || 'In Progress').trim().toLowerCase();
  if (text.includes('discharge')) return 'Discharged';
  if (text.includes('refer')) return 'Referred';
  if (text.includes('death') || text.includes('deceas')) return 'Deceased';
  if (text.includes('step')) return 'Step Down';
  if (text.includes('progress') || text.includes('admit')) return 'In Progress';
  return outcomeValue || 'In Progress';
}

function normalizeAdmissionType(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text.includes('inborn')) return 'Inborn';
  if (text.includes('outborn')) return 'Outborn';
  return value ? String(value) : 'Not recorded';
}

function emptyMonth() {
  return {
    admissions: 0,
    discharges: 0,
    referred: 0,
    deceased: 0,
    inProgress: 0,
    stepDown: 0,
    nicu: 0,
    picu: 0,
    sncu: 0,
    observation: 0,
    unknownUnit: 0,
    inborn: 0,
    outborn: 0,
    admissionTypeNotRecorded: 0,
    male: 0,
    female: 0,
    genderNotRecorded: 0,
  };
}

function buildAggregate(rawPatients, sourceLabel) {
  const aggregate = {
    source: sourceLabel,
    generatedAt: new Date().toISOString(),
    periodLabel: 'Two-month pilot project: February-March 2026',
    months: Object.fromEntries(months.map((month) => [month, emptyMonth()])),
    totals: emptyMonth(),
    outcomes: {},
    units: {},
    admissionTypes: {},
    gender: {},
    topDiagnoses: [],
    topReferralSources: [],
    dataNotes: [],
    patientRecordCount: rawPatients.length,
  };

  const diagnosisCounts = new Map();
  const referralCounts = new Map();

  for (const p of rawPatients) {
    const admissionMonth = p.admission_month || normalizeMonth(p.admission_year_month || p.admissionYearMonth || p.admission_date || p.admissionDate);
    if (!months.includes(admissionMonth)) continue;
    const monthBucket = aggregate.months[admissionMonth];

    const outcome = normalizeOutcome(p.outcome);
    const unit = normalizeUnit(p.unit || p.unit_name || p.admission_unit || p.admission_unit_name);
    const admissionType = normalizeAdmissionType(p.admission_type || p.admissionType);
    const gender = String(p.gender || '').trim().toLowerCase();
    const diagnosis = String(p.final_diagnosis || p.admission_diagnosis || p.diagnosis || '').trim();
    const refSource = String(p.referring_hospital || p.referringHospital || '').trim();

    monthBucket.admissions += 1;
    aggregate.totals.admissions += 1;

    if (outcome === 'Discharged') {
      monthBucket.discharges += 1;
      aggregate.totals.discharges += 1;
    } else if (outcome === 'Referred') {
      monthBucket.referred += 1;
      aggregate.totals.referred += 1;
    } else if (outcome === 'Deceased') {
      monthBucket.deceased += 1;
      aggregate.totals.deceased += 1;
    } else if (outcome === 'Step Down') {
      monthBucket.stepDown += 1;
      aggregate.totals.stepDown += 1;
    } else {
      monthBucket.inProgress += 1;
      aggregate.totals.inProgress += 1;
    }
    aggregate.outcomes[outcome] = (aggregate.outcomes[outcome] || 0) + 1;

    if (unit === 'NICU') {
      monthBucket.nicu += 1;
      aggregate.totals.nicu += 1;
    } else if (unit === 'PICU') {
      monthBucket.picu += 1;
      aggregate.totals.picu += 1;
    } else if (unit === 'SNCU') {
      monthBucket.sncu += 1;
      aggregate.totals.sncu += 1;
    } else if (unit === 'Observation') {
      monthBucket.observation += 1;
      aggregate.totals.observation += 1;
    } else {
      monthBucket.unknownUnit += 1;
      aggregate.totals.unknownUnit += 1;
    }
    aggregate.units[unit] = (aggregate.units[unit] || 0) + 1;

    if (admissionType === 'Inborn') {
      monthBucket.inborn += 1;
      aggregate.totals.inborn += 1;
    } else if (admissionType === 'Outborn') {
      monthBucket.outborn += 1;
      aggregate.totals.outborn += 1;
    } else {
      monthBucket.admissionTypeNotRecorded += 1;
      aggregate.totals.admissionTypeNotRecorded += 1;
    }
    aggregate.admissionTypes[admissionType] = (aggregate.admissionTypes[admissionType] || 0) + 1;

    if (gender === 'male') {
      monthBucket.male += 1;
      aggregate.totals.male += 1;
      aggregate.gender.Male = (aggregate.gender.Male || 0) + 1;
    } else if (gender === 'female') {
      monthBucket.female += 1;
      aggregate.totals.female += 1;
      aggregate.gender.Female = (aggregate.gender.Female || 0) + 1;
    } else {
      monthBucket.genderNotRecorded += 1;
      aggregate.totals.genderNotRecorded += 1;
      aggregate.gender['Not recorded'] = (aggregate.gender['Not recorded'] || 0) + 1;
    }

    if (diagnosis) diagnosisCounts.set(diagnosis, (diagnosisCounts.get(diagnosis) || 0) + 1);
    if (refSource) referralCounts.set(refSource, (referralCounts.get(refSource) || 0) + 1);
  }

  aggregate.topDiagnoses = [...diagnosisCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
  aggregate.topReferralSources = [...referralCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  if (aggregate.totals.admissions === 0) {
    aggregate.dataNotes.push('No February-March 2026 patient records were returned from the configured backend.');
  }
  if (aggregate.totals.admissionTypeNotRecorded > 0) {
    aggregate.dataNotes.push('Some records did not contain NICU admission type; these are counted as Not recorded.');
  }
  if (aggregate.totals.unknownUnit > 0) {
    aggregate.dataNotes.push('Some records did not contain a recognized unit field.');
  }

  return aggregate;
}

async function fetchSupabase() {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('your-project-ref')) return null;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: units } = await supabase.from('units').select('id,name');
  const unitsById = Object.fromEntries((units || []).map((u) => [u.id, u.name]));

  const { data, error } = await supabase
    .from('patients')
    .select('id,institution_id,admission_unit_id,current_unit_id,admission_date,discharge_date,admission_year_month,discharge_year_month,outcome,admission_type,referring_hospital,referring_district,admission_diagnosis,final_diagnosis,gender')
    .in('admission_year_month', months)
    .limit(10000);

  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  const normalized = (data || []).map((p) => ({
    ...p,
    unit_name: unitsById[p.admission_unit_id] || unitsById[p.current_unit_id] || null,
  }));
  return buildAggregate(normalized, 'Supabase');
}

async function fetchFirebase() {
  const required = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ];
  if (required.some((key) => !env[key])) return null;

  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
  }, 'neolink-report-fetch');

  let db;
  try {
    db = initializeFirestore(app, { ignoreUndefinedProperties: true }, 'neolink');
  } catch {
    db = getFirestore(app, 'neolink');
  }

  const collected = new Map();
  const addDocs = (snapshot) => {
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const admissionDate = firestoreDateToISOString(data.admissionDate || data.admission_date);
      collected.set(docSnap.ref.path, {
        id: docSnap.id,
        admissionYearMonth: data.admissionYearMonth || data.admission_year_month,
        admissionDate,
        outcome: data.outcome,
        unit: data.unit || data.currentUnit || data.current_unit,
        admissionType: data.admissionType || data.nicuSpecific?.admissionType,
        referringHospital: data.referringHospital || data.nicuSpecific?.referringHospital || data.referralInfo?.referredTo,
        referringDistrict: data.referringDistrict || data.nicuSpecific?.referringDistrict,
        diagnosis: data.finalDiagnosis || data.final_diagnosis || data.diagnosis || data.admission_diagnosis,
        gender: data.gender,
      });
    }
  };

  for (const field of ['admissionYearMonth', 'admission_year_month']) {
    try {
      const topLevel = await getDocs(query(collection(db, 'patients'), where(field, 'in', months)));
      addDocs(topLevel);
    } catch {
      // Try the collectionGroup path below.
    }
    try {
      const grouped = await getDocs(query(collectionGroup(db, 'patients'), where(field, 'in', months)));
      addDocs(grouped);
    } catch {
      // Security rules or index availability may prevent this read.
    }
  }

  return buildAggregate([...collected.values()], 'Firebase Firestore');
}

async function main() {
  let aggregate = null;
  const notes = [];
  try {
    aggregate = await fetchSupabase();
  } catch (error) {
    notes.push(`Supabase query failed: ${error.message}`);
  }

  if (!aggregate || aggregate.totals.admissions === 0) {
    try {
      const firebaseAggregate = await fetchFirebase();
      if (firebaseAggregate && firebaseAggregate.totals.admissions > 0) {
        aggregate = firebaseAggregate;
      } else if (firebaseAggregate) {
        notes.push(...firebaseAggregate.dataNotes);
      }
    } catch (error) {
      notes.push(`Firebase query failed: ${error.message}`);
    }
  }

  if (!aggregate) {
    aggregate = buildAggregate([], 'Backend');
    aggregate.dataNotes.push('No configured backend returned aggregate records for February-March 2026.');
  }
  aggregate.dataNotes = [...new Set([...(aggregate.dataNotes || []), ...notes])];

  fs.writeFileSync(outputPath, JSON.stringify(aggregate, null, 2));
  console.log(JSON.stringify({
    outputPath,
    source: aggregate.source,
    totalAdmissions: aggregate.totals.admissions,
    febAdmissions: aggregate.months['2026-02'].admissions,
    marAdmissions: aggregate.months['2026-03'].admissions,
    notes: aggregate.dataNotes,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
