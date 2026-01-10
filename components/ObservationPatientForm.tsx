import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ObservationPatient, ObservationOutcome, Unit } from '../types';
import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

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
  const [isBabyOf, setIsBabyOf] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [timeOfBirth, setTimeOfBirth] = useState('');
  const [admissionType, setAdmissionType] = useState<'Inborn' | 'Outborn'>('Inborn');
  const [reasonForObservation, setReasonForObservation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    if (!babyName.trim() || !motherName.trim() || !dateOfBirth || !timeOfBirth || !reasonForObservation.trim()) {
      alert('Please fill in all required fields');
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Add Observation Patient
              </h2>
              <p className="text-amber-100 text-sm mt-1">Quick registration for observation • {selectedUnit}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Mother Name - First because it affects baby name */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Mother's Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={motherName}
              onChange={(e) => setMotherName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none"
              placeholder="Enter mother's name"
              required
            />
          </div>

          {/* Baby Name with "Baby of" checkbox */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Baby Name <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                id="babyOf"
                checked={isBabyOf}
                onChange={(e) => setIsBabyOf(e.target.checked)}
                className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
              />
              <label htmlFor="babyOf" className="text-sm text-slate-600">
                Auto-fill as "Baby of {motherName || '[Mother Name]'}"
              </label>
            </div>
            <input
              type="text"
              value={babyName}
              onChange={(e) => setBabyName(e.target.value)}
              disabled={isBabyOf}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none disabled:bg-slate-100 disabled:text-slate-600"
              placeholder={isBabyOf ? `Baby of ${motherName || '...'}` : "Enter baby's name"}
              required
            />
          </div>

          {/* Date and Time of Birth */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Time of Birth <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={timeOfBirth}
                onChange={(e) => setTimeOfBirth(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none"
                required
              />
            </div>
          </div>

          {/* Admission Type (for NICU) */}
          {(selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Birth Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdmissionType('Inborn')}
                  className={`px-4 py-3 rounded-xl font-semibold transition-all ${
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
                  className={`px-4 py-3 rounded-xl font-semibold transition-all ${
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

          {/* Reason for Observation */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Reason for Observation <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reasonForObservation}
              onChange={(e) => setReasonForObservation(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all outline-none resize-none"
              placeholder="Brief description of why the baby is under observation..."
              required
            />
          </div>

          {/* Info Banner */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-amber-800">
                This is a quick registration for patients under observation. You can later convert them to full admission or hand over to mother.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Adding...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Add to Observation
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
