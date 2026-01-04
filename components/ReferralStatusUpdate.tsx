import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Referral, UserRole, VitalSigns } from '../types';

interface ReferralStatusUpdateProps {
  referral: Referral;
  userEmail: string;
  userRole: UserRole;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ReferralStatusUpdate: React.FC<ReferralStatusUpdateProps> = ({
  referral,
  userEmail,
  userRole,
  userName,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>(
    referral.status === 'Accepted' ? 'Patient Admitted' : referral.status
  );
  const [condition, setCondition] = useState('');
  const [notes, setNotes] = useState('');
  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({
    temperature: '',
    hr: '',
    rr: '',
    bp: '',
    spo2: '',
    crt: '',
    weight: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const statusOptions = [
    'Patient Admitted',
    'Patient Discharged',
    'Patient Deceased'
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!status) newErrors.status = 'Status is required';
    if (!condition.trim()) newErrors.condition = 'Patient condition is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const newStatusUpdate = {
        timestamp: new Date().toISOString(),
        updatedBy: userName,
        updatedByEmail: userEmail,
        updatedByRole: userRole,
        status,
        condition: condition.trim(),
        notes: notes.trim() || undefined,
        vitalSigns: Object.values(vitalSigns).some((v) => v)
          ? vitalSigns
          : undefined
      };

      await updateDoc(doc(db, 'referrals', referral.id), {
        status,
        lastUpdatedAt: new Date().toISOString(),
        statusUpdates: [...referral.statusUpdates, newStatusUpdate]
      });

      alert('Status updated successfully! The referring hospital has been notified.');
      onSuccess();
    } catch (error) {
      console.error('Error updating status:', error);
      alert(
        `Failed to update status: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-500 to-blue-500 text-white p-6 rounded-t-2xl sticky top-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Update Patient Status</h2>
              <p className="text-sky-100 text-sm mt-1">
                {referral.patientName} - Referral from {referral.fromInstitutionName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Status Selection */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Update Status <span className="text-red-500">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setErrors((prev) => ({ ...prev, status: '' }));
              }}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                errors.status ? 'border-red-500' : 'border-sky-200'
              }`}
            >
              <option value="">Select status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {errors.status && (
              <p className="text-red-500 text-sm mt-1">{errors.status}</p>
            )}
          </div>

          {/* Patient Condition */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Current Patient Condition <span className="text-red-500">*</span>
            </label>
            <textarea
              value={condition}
              onChange={(e) => {
                setCondition(e.target.value);
                setErrors((prev) => ({ ...prev, condition: '' }));
              }}
              rows={3}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                errors.condition ? 'border-red-500' : 'border-sky-200'
              }`}
              placeholder="Describe the current clinical condition of the patient..."
            />
            {errors.condition && (
              <p className="text-red-500 text-sm mt-1">{errors.condition}</p>
            )}
          </div>

          {/* Vital Signs */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Current Vital Signs (Optional)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-sky-700 mb-1">
                  Temp (°C)
                </label>
                <input
                  type="text"
                  placeholder="37.5"
                  value={vitalSigns.temperature}
                  onChange={(e) =>
                    setVitalSigns((prev) => ({
                      ...prev,
                      temperature: e.target.value
                    }))
                  }
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs text-sky-700 mb-1">
                  HR (bpm)
                </label>
                <input
                  type="text"
                  placeholder="120"
                  value={vitalSigns.hr}
                  onChange={(e) =>
                    setVitalSigns((prev) => ({ ...prev, hr: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs text-sky-700 mb-1">
                  RR (br/min)
                </label>
                <input
                  type="text"
                  placeholder="40"
                  value={vitalSigns.rr}
                  onChange={(e) =>
                    setVitalSigns((prev) => ({ ...prev, rr: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs text-sky-700 mb-1">
                  BP (mmHg)
                </label>
                <input
                  type="text"
                  placeholder="90/60"
                  value={vitalSigns.bp}
                  onChange={(e) =>
                    setVitalSigns((prev) => ({ ...prev, bp: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs text-sky-700 mb-1">
                  SpO2 (%)
                </label>
                <input
                  type="text"
                  placeholder="98"
                  value={vitalSigns.spo2}
                  onChange={(e) =>
                    setVitalSigns((prev) => ({ ...prev, spo2: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs text-sky-700 mb-1">
                  CRT (sec)
                </label>
                <input
                  type="text"
                  placeholder="<2"
                  value={vitalSigns.crt}
                  onChange={(e) =>
                    setVitalSigns((prev) => ({ ...prev, crt: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs text-sky-700 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="text"
                  placeholder="3.5"
                  value={vitalSigns.weight}
                  onChange={(e) =>
                    setVitalSigns((prev) => ({
                      ...prev,
                      weight: e.target.value
                    }))
                  }
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Any additional information, treatment updates, or observations..."
            />
          </div>

          {/* Info Alert */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg
                className="w-6 h-6 text-blue-600 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 mb-1">
                  Real-time Notification
                </h4>
                <p className="text-sm text-blue-700">
                  The referring institution ({referral.fromInstitutionName}) will be
                  immediately notified of this status update and can view all
                  details in their referral tracking system.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 border-2 border-sky-300 text-sky-700 rounded-lg hover:bg-sky-50 transition-all font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white px-6 py-3 rounded-lg transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                  Updating...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Update Status
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReferralStatusUpdate;
