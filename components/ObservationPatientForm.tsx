import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ObservationPatient, ObservationOutcome, Unit, ObservationIndication } from '../types';
import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy } from 'firebase/firestore';

interface ObservationPatientFormProps {
  onClose: () => void;
  onSuccess: () => void;
  selectedUnit: Unit;
  institutionId: string;
  userEmail: string;
}

const ObservationPatientForm: React.FC<ObservationPatientFormProps> = ({
  onClose,
  onSuccess,
  selectedUnit,
  institutionId,
  userEmail
}) => {
  const [babyName, setBabyName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [isBabyOf, setIsBabyOf] = useState(true); // Default to true for auto-fill
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [timeOfBirth, setTimeOfBirth] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Ambiguous' | ''>('');
  const [birthWeight, setBirthWeight] = useState('');
  const [admissionType, setAdmissionType] = useState<'Inborn' | 'Outborn'>('Inborn');
  const [selectedIndications, setSelectedIndications] = useState<string[]>([]);
  const [otherReason, setOtherReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Indications from Firestore
  const [availableIndications, setAvailableIndications] = useState<ObservationIndication[]>([]);
  const [loadingIndications, setLoadingIndications] = useState(true);

  // Fetch observation indications on mount
  useEffect(() => {
    const fetchIndications = async () => {
      try {
        console.log('📋 Fetching observation indications for unit:', selectedUnit);
        const indicationsRef = collection(db, 'observationIndications');

        // First try with simple query (no composite index needed)
        let snapshot;
        try {
          const q = query(indicationsRef, orderBy('order', 'asc'));
          snapshot = await getDocs(q);
        } catch (indexError) {
          // Fallback: just get all docs without ordering
          console.warn('⚠️ Index not ready, fetching without order:', indexError);
          snapshot = await getDocs(indicationsRef);
        }

        console.log('📊 Total indications fetched:', snapshot.docs.length);

        const allIndications = snapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data } as ObservationIndication;
        });

        // Filter: only active indications for this unit
        const filtered = allIndications.filter(ind => {
          const isActive = ind.isActive !== false; // Default to active if not set
          const matchesUnit = !ind.applicableUnits ||
                              ind.applicableUnits.length === 0 ||
                              ind.applicableUnits.some(u => u === selectedUnit || u.includes(selectedUnit.split(' ')[0]));
          return isActive && matchesUnit;
        });

        console.log('✅ Filtered indications for', selectedUnit, ':', filtered.length);
        setAvailableIndications(filtered);
      } catch (error: any) {
        console.error('❌ Error fetching observation indications:', error.code, error.message);
        // Don't block form - just show empty with option to type
      } finally {
        setLoadingIndications(false);
      }
    };
    fetchIndications();
  }, [selectedUnit]);

  // Compute reason for observation from selected indications
  const reasonForObservation = selectedIndications.length > 0
    ? selectedIndications.join(', ') + (otherReason ? ` - ${otherReason}` : '')
    : otherReason;

  // Auto-fill baby name when "Baby of" is checked
  React.useEffect(() => {
    if (isBabyOf && motherName.trim()) {
      setBabyName(`Baby of ${motherName.trim()}`);
    } else if (!isBabyOf && babyName.startsWith('Baby of ')) {
      setBabyName('');
    }
  }, [isBabyOf, motherName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!babyName.trim() || !motherName.trim() || !dateOfBirth || !timeOfBirth) {
      alert('Please fill in all required fields');
      return;
    }

    if (selectedIndications.length === 0 && !otherReason.trim()) {
      alert('Please select at least one reason for observation');
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine date and time
      const fullDateOfBirth = `${dateOfBirth}T${timeOfBirth}`;

      const observationPatient: Omit<ObservationPatient, 'id'> = {
        babyName: babyName.trim(),
        motherName: motherName.trim(),
        dateOfBirth: fullDateOfBirth,
        gender: gender || undefined,
        birthWeight: birthWeight ? parseFloat(birthWeight) : undefined,
        reasonForObservation: reasonForObservation.trim(),
        unit: selectedUnit,
        admissionType,
        dateOfObservation: new Date().toISOString(),
        outcome: ObservationOutcome.InObservation,
        institutionId,
        createdBy: userEmail,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'observationPatients'), {
        ...observationPatient,
        createdAt: serverTimestamp()
      });

      alert('Observation patient added successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding observation patient:', error);
      alert('Failed to add observation patient. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-lg sm:max-w-2xl my-2 sm:my-8"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-4 sm:p-6 text-white rounded-t-xl sm:rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                <svg className="w-5 h-5 sm:w-7 sm:h-7 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="truncate">Add Observation</span>
              </h2>
              <p className="text-amber-100 text-xs sm:text-sm mt-1">{selectedUnit} • Quick registration</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0 ml-2"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[calc(100vh-120px)] overflow-y-auto">
          {/* Mother Name - First because it affects baby name */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Mother's Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={motherName}
              onChange={(e) => setMotherName(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none text-sm sm:text-base"
              placeholder="Enter mother's name"
              required
            />
          </div>

          {/* Baby Name with "Baby of" checkbox */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Baby Name <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="babyOf"
                checked={isBabyOf}
                onChange={(e) => setIsBabyOf(e.target.checked)}
                className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
              />
              <label htmlFor="babyOf" className="text-xs sm:text-sm text-slate-600">
                Auto-fill as "Baby of {motherName || '[Mother]'}"
              </label>
            </div>
            <input
              type="text"
              value={babyName}
              onChange={(e) => setBabyName(e.target.value)}
              disabled={isBabyOf}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none disabled:bg-amber-50 disabled:text-amber-800 disabled:border-amber-200 text-sm sm:text-base"
              placeholder={isBabyOf ? `Baby of ${motherName || '...'}` : "Enter baby's name"}
              required
            />
          </div>

          {/* Gender and Birth Weight */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none text-sm sm:text-base bg-white"
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Ambiguous">Ambiguous</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Birth Weight (g)
              </label>
              <input
                type="number"
                value={birthWeight}
                onChange={(e) => setBirthWeight(e.target.value)}
                min="0"
                step="1"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none text-sm sm:text-base"
                placeholder="e.g., 2500"
              />
            </div>
          </div>

          {/* Date and Time of Birth */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none text-sm sm:text-base"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Time of Birth <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={timeOfBirth}
                onChange={(e) => setTimeOfBirth(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none text-sm sm:text-base"
                required
              />
            </div>
          </div>

          {/* Admission Type (for NICU) */}
          {(selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Birth Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setAdmissionType('Inborn')}
                  className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all text-sm sm:text-base ${
                    admissionType === 'Inborn'
                      ? 'bg-amber-500 text-white border-2 border-amber-600 shadow-lg'
                      : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-amber-300'
                  }`}
                >
                  Inborn
                </button>
                <button
                  type="button"
                  onClick={() => setAdmissionType('Outborn')}
                  className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all text-sm sm:text-base ${
                    admissionType === 'Outborn'
                      ? 'bg-amber-500 text-white border-2 border-amber-600 shadow-lg'
                      : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-amber-300'
                  }`}
                >
                  Outborn
                </button>
              </div>
            </div>
          )}

          {/* Reason for Observation - Multi-select */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Reason for Observation <span className="text-red-500">*</span>
            </label>
            {loadingIndications ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-2 text-sm text-slate-500">Loading indications...</span>
              </div>
            ) : availableIndications.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border-2 border-slate-200 rounded-lg bg-slate-50">
                  {availableIndications.map((indication) => (
                    <label
                      key={indication.id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-sm ${
                        selectedIndications.includes(indication.name)
                          ? 'bg-amber-100 border border-amber-400'
                          : 'bg-white border border-slate-200 hover:border-amber-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIndications.includes(indication.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIndications([...selectedIndications, indication.name]);
                          } else {
                            setSelectedIndications(selectedIndications.filter(i => i !== indication.name));
                          }
                        }}
                        className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                      />
                      <span className="text-slate-700">{indication.name}</span>
                    </label>
                  ))}
                </div>
                {/* Other reason input */}
                <div className="mt-2">
                  <input
                    type="text"
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none text-sm"
                    placeholder="Other reason (optional)"
                  />
                </div>
                {selectedIndications.length > 0 && (
                  <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
                    Selected: {selectedIndications.join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-slate-500 bg-slate-100 p-3 rounded-lg">
                  No observation indications configured. Please contact SuperAdmin to add indications, or enter reason manually below.
                </div>
                <textarea
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none resize-none text-sm sm:text-base"
                  placeholder="Enter reason for observation..."
                  required={selectedIndications.length === 0}
                />
              </div>
            )}
          </div>

          {/* Info Banner */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs sm:text-sm text-amber-800">
                Quick registration for observation. Convert to full admission or handover to mother later.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 sm:gap-3 pt-2 sm:pt-4 sticky bottom-0 bg-white pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg sm:rounded-xl font-bold transition-colors text-sm sm:text-base"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg sm:rounded-xl font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Adding...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ObservationPatientForm;
