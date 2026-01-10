import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ObservationPatient, ObservationOutcome, Unit } from '../types';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';

interface ObservationManagementProps {
  institutionId: string;
  selectedUnit?: Unit;
  onConvertToAdmission: (observationPatient: ObservationPatient) => void;
}

const ObservationManagement: React.FC<ObservationManagementProps> = ({
  institutionId,
  selectedUnit,
  onConvertToAdmission
}) => {
  const [observationPatients, setObservationPatients] = useState<ObservationPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUnit, setFilterUnit] = useState<Unit | 'all'>(selectedUnit || 'all');
  const [filterOutcome, setFilterOutcome] = useState<ObservationOutcome | 'all'>('all');

  useEffect(() => {
    const q = query(
      collection(db, 'observationPatients'),
      where('institutionId', '==', institutionId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ObservationPatient[];

      setObservationPatients(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [institutionId]);

  const handleConvertToAdmission = async (patient: ObservationPatient) => {
    try {
      // Mark observation as converted
      await updateDoc(doc(db, 'observationPatients', patient.id), {
        outcome: ObservationOutcome.ConvertedToAdmission,
        convertedAt: new Date().toISOString()
      });

      // Call parent's onConvertToAdmission to open the patient form
      onConvertToAdmission(patient);
    } catch (error) {
      console.error('Error converting to admission:', error);
      alert('Failed to convert to admission');
    }
  };

  const handleHandoverToMother = async (patient: ObservationPatient) => {
    if (!confirm(`Hand over ${patient.babyName} to mother?`)) return;

    try {
      await updateDoc(doc(db, 'observationPatients', patient.id), {
        outcome: ObservationOutcome.HandedOverToMother,
        dischargedAt: new Date().toISOString()
      });
      alert('Patient handed over to mother successfully!');
    } catch (error) {
      console.error('Error handing over patient:', error);
      alert('Failed to hand over patient');
    }
  };

  const filteredPatients = observationPatients.filter(p => {
    if (filterUnit !== 'all' && p.unit !== filterUnit) return false;
    if (filterOutcome !== 'all' && p.outcome !== filterOutcome) return false;
    return true;
  });

  const activePatients = filteredPatients.filter(p => p.outcome === ObservationOutcome.InObservation);
  const dischargedPatients = filteredPatients.filter(p => p.outcome === ObservationOutcome.HandedOverToMother);
  const convertedPatients = filteredPatients.filter(p => p.outcome === ObservationOutcome.ConvertedToAdmission);

  const getTimeSince = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${hours}h`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Observation Patients
            </h2>
            <p className="text-amber-100 text-sm mt-1">Track and manage patients under observation</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold">{activePatients.length}</div>
              <div className="text-amber-100 text-xs">Active</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{convertedPatients.length}</div>
              <div className="text-amber-100 text-xs">Admitted</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{dischargedPatients.length}</div>
              <div className="text-amber-100 text-xs">Discharged</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterUnit}
          onChange={(e) => setFilterUnit(e.target.value as Unit | 'all')}
          className="px-4 py-2 rounded-lg border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
        >
          <option value="all">All Units</option>
          <option value={Unit.NICU}>NICU</option>
          <option value={Unit.PICU}>PICU</option>
          <option value={Unit.SNCU}>SNCU</option>
          <option value={Unit.HDU}>HDU</option>
        </select>

        <select
          value={filterOutcome}
          onChange={(e) => setFilterOutcome(e.target.value as ObservationOutcome | 'all')}
          className="px-4 py-2 rounded-lg border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
        >
          <option value="all">All Statuses</option>
          <option value={ObservationOutcome.InObservation}>In Observation</option>
          <option value={ObservationOutcome.ConvertedToAdmission}>Converted to Admission</option>
          <option value={ObservationOutcome.HandedOverToMother}>Handed Over to Mother</option>
        </select>
      </div>

      {/* Patient List */}
      <div className="space-y-4">
        {filteredPatients.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl">
            <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-slate-500 font-semibold">No observation patients found</p>
            <p className="text-slate-400 text-sm mt-1">Add patients using "Add Patient" → "Observation"</p>
          </div>
        ) : (
          filteredPatients.map((patient, index) => (
            <motion.div
              key={patient.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-white rounded-xl p-5 border-2 shadow-lg ${
                patient.outcome === ObservationOutcome.InObservation
                  ? 'border-amber-300'
                  : patient.outcome === ObservationOutcome.ConvertedToAdmission
                  ? 'border-emerald-300'
                  : 'border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-slate-900">{patient.babyName}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      patient.outcome === ObservationOutcome.InObservation
                        ? 'bg-amber-100 text-amber-700'
                        : patient.outcome === ObservationOutcome.ConvertedToAdmission
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {patient.outcome}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">Mother: {patient.motherName}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-500">{patient.unit}</div>
                  {patient.admissionType && (
                    <div className="text-xs text-slate-400">{patient.admissionType}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-xs text-slate-500 font-medium">Date & Time of Birth</div>
                  <div className="text-sm text-slate-900 font-semibold">
                    {new Date(patient.dateOfBirth).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-slate-600">
                    {new Date(patient.dateOfBirth).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">Started Observation</div>
                  <div className="text-sm text-slate-900 font-semibold">
                    {new Date(patient.dateOfObservation).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-slate-600">
                    {new Date(patient.dateOfObservation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              <div className="mb-3 bg-sky-50 rounded-lg p-3 border border-sky-200">
                <div className="text-xs text-sky-700 font-semibold mb-1">⏱️ Time in Observation</div>
                <div className="text-lg font-bold text-sky-900">{getTimeSince(patient.dateOfObservation)}</div>
              </div>

              <div className="mb-4">
                <div className="text-xs text-slate-500 font-medium mb-1">Reason for Observation</div>
                <div className="text-sm text-slate-900 bg-slate-50 rounded-lg p-2">
                  {patient.reasonForObservation}
                </div>
              </div>

              {/* Actions - Only for active observation */}
              {patient.outcome === ObservationOutcome.InObservation && (
                <div className="flex gap-2 pt-3 border-t border-slate-200">
                  <button
                    onClick={() => handleConvertToAdmission(patient)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Convert to Admission
                  </button>
                  <button
                    onClick={() => handleHandoverToMother(patient)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Hand Over to Mother
                  </button>
                </div>
              )}

              {/* Show discharge time if handed over */}
              {patient.outcome === ObservationOutcome.HandedOverToMother && patient.dischargedAt && (
                <div className="pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500">
                    Handed over: {new Date(patient.dischargedAt).toLocaleString()}
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default ObservationManagement;
