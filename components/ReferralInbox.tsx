import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Referral, UserRole } from '../types';
import ReferralStatusUpdate from './ReferralStatusUpdate';

interface ReferralInboxProps {
  institutionId: string;
  institutionName: string;
  userEmail: string;
  userRole: UserRole;
  userName: string;
  onBack: () => void;
}

const ReferralInbox: React.FC<ReferralInboxProps> = ({
  institutionId,
  institutionName,
  userEmail,
  userRole,
  userName,
  onBack
}) => {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);

  // Load referrals
  useEffect(() => {
    setLoading(true);

    // Load both incoming and outgoing referrals
    const incomingQuery = query(
      collection(db, 'referrals'),
      where('toInstitutionId', '==', institutionId),
      orderBy('createdAt', 'desc')
    );

    const outgoingQuery = query(
      collection(db, 'referrals'),
      where('fromInstitutionId', '==', institutionId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeIncoming = onSnapshot(incomingQuery, (snapshot) => {
      const incomingReferrals: Referral[] = [];
      snapshot.forEach((doc) => {
        incomingReferrals.push({ id: doc.id, ...doc.data() } as Referral);
      });

      const unsubscribeOutgoing = onSnapshot(outgoingQuery, (snapshot) => {
        const outgoingReferrals: Referral[] = [];
        snapshot.forEach((doc) => {
          outgoingReferrals.push({ id: doc.id, ...doc.data() } as Referral);
        });

        // Combine and store
        setReferrals([...incomingReferrals, ...outgoingReferrals]);
        setLoading(false);
      });

      return () => unsubscribeOutgoing();
    });

    return () => unsubscribeIncoming();
  }, [institutionId]);

  // Filter referrals by tab
  const filteredReferrals = useMemo(() => {
    if (activeTab === 'incoming') {
      return referrals.filter((r) => r.toInstitutionId === institutionId);
    } else {
      return referrals.filter((r) => r.fromInstitutionId === institutionId);
    }
  }, [referrals, activeTab, institutionId]);

  // Count unread incoming referrals
  const unreadCount = useMemo(() => {
    return referrals.filter(
      (r) => r.toInstitutionId === institutionId && !r.isRead && r.status === 'Pending'
    ).length;
  }, [referrals, institutionId]);

  const handleViewReferral = async (referral: Referral) => {
    setSelectedReferral(referral);

    // Mark as read if incoming and unread
    if (referral.toInstitutionId === institutionId && !referral.isRead) {
      try {
        await updateDoc(doc(db, 'referrals', referral.id), {
          isRead: true
        });
      } catch (error) {
        console.error('Error marking referral as read:', error);
      }
    }
  };

  const handleAcceptReferral = async (referral: Referral) => {
    if (!confirm('Accept this referral? The patient will be marked for admission.')) return;

    try {
      await updateDoc(doc(db, 'referrals', referral.id), {
        status: 'Accepted',
        acceptedBy: userName,
        acceptedByEmail: userEmail,
        acceptedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        statusUpdates: [
          ...referral.statusUpdates,
          {
            timestamp: new Date().toISOString(),
            updatedBy: userName,
            updatedByEmail: userEmail,
            updatedByRole: userRole,
            status: 'Accepted',
            notes: 'Referral accepted. Patient awaiting admission.'
          }
        ]
      });

      alert('Referral accepted successfully!');
      setSelectedReferral(null);
    } catch (error) {
      console.error('Error accepting referral:', error);
      alert('Failed to accept referral.');
    }
  };

  const handleRejectReferral = async (referral: Referral) => {
    const reason = prompt('Please provide a reason for rejecting this referral:');
    if (!reason) return;

    try {
      await updateDoc(doc(db, 'referrals', referral.id), {
        status: 'Rejected',
        responseNotes: reason,
        lastUpdatedAt: new Date().toISOString(),
        statusUpdates: [
          ...referral.statusUpdates,
          {
            timestamp: new Date().toISOString(),
            updatedBy: userName,
            updatedByEmail: userEmail,
            updatedByRole: userRole,
            status: 'Rejected',
            notes: reason
          }
        ]
      });

      alert('Referral rejected.');
      setSelectedReferral(null);
    } catch (error) {
      console.error('Error rejecting referral:', error);
      alert('Failed to reject referral.');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'High':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Low':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'Accepted':
        return 'bg-blue-100 text-blue-700';
      case 'Rejected':
        return 'bg-red-100 text-red-700';
      case 'Patient Admitted':
        return 'bg-green-100 text-green-700';
      case 'Patient Discharged':
        return 'bg-gray-100 text-gray-700';
      case 'Patient Deceased':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-sky-600 mx-auto mb-4"></div>
          <p className="text-sky-900 font-semibold">Loading referrals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg sticky top-0 z-30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all duration-200 backdrop-blur-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-semibold">Back</span>
            </button>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Referral Management
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-sm px-3 py-1 rounded-full">
                    {unreadCount} New
                  </span>
                )}
              </h1>
              <p className="text-sky-100 text-sm md:text-base">
                Manage incoming and outgoing patient referrals
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-2 bg-white rounded-xl p-2 shadow-md border border-sky-200">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'incoming'
                ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg'
                : 'text-sky-700 hover:bg-sky-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              Incoming Referrals
              {unreadCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{unreadCount}</span>}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('outgoing')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'outgoing'
                ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg'
                : 'text-sky-700 hover:bg-sky-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              Outgoing Referrals
            </div>
          </button>
        </div>

        {/* Referrals List */}
        {filteredReferrals.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md border-2 border-dashed border-sky-300 p-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-sky-100 p-6 rounded-full">
                <svg className="w-16 h-16 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-sky-900 mb-2">No Referrals Found</h3>
            <p className="text-sky-600">
              {activeTab === 'incoming'
                ? 'No incoming referrals at this time.'
                : 'No outgoing referrals have been created.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredReferrals.map((referral) => (
              <div
                key={referral.id}
                className={`bg-white rounded-xl shadow-md border p-6 hover:shadow-xl transition-all duration-200 ${
                  !referral.isRead && referral.toHospitalId === institutionId
                    ? 'border-sky-400 ring-2 ring-sky-200'
                    : 'border-sky-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-sky-900">{referral.patientName}</h3>
                      {!referral.isRead && referral.toHospitalId === institutionId && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                          NEW
                        </span>
                      )}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(
                          referral.priority || 'Medium'
                        )}`}
                      >
                        {referral.priority || 'Medium'} Priority
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(referral.status)}`}>
                        {referral.status}
                      </span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-2 text-sm text-sky-700">
                      <p>
                        <span className="font-semibold">Age/Gender:</span> {referral.patientAge}{' '}
                        {referral.patientAgeUnit} / {referral.patientGender}
                      </p>
                      <p>
                        <span className="font-semibold">Date:</span>{' '}
                        {new Date(referral.referralDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                      <p>
                        <span className="font-semibold">From:</span> {referral.fromInstitutionName}
                      </p>
                      <p>
                        <span className="font-semibold">To:</span> {referral.toInstitutionName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleViewReferral(referral)}
                    className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2 rounded-lg font-semibold transition-all shadow-md"
                  >
                    View Details
                  </button>
                </div>

                <div className="border-t border-sky-100 pt-4 mt-4">
                  <p className="text-sm text-sky-700 mb-2">
                    <span className="font-semibold">Diagnosis:</span> {referral.referralDetails.diagnosisAtReferral}
                  </p>
                  <p className="text-sm text-sky-700">
                    <span className="font-semibold">Reason:</span> {referral.referralDetails.reasonForReferral}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Referral Details Modal */}
      {selectedReferral && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-sky-500 to-blue-500 text-white p-6 rounded-t-2xl sticky top-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Referral Details</h2>
                  <p className="text-sky-100 text-sm mt-1">{selectedReferral.patientName}</p>
                </div>
                <button
                  onClick={() => setSelectedReferral(null)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Referral Letter */}
              {selectedReferral.referralLetter && (
                <div className="bg-sky-50 rounded-xl p-6 border border-sky-200">
                  <h3 className="font-bold text-sky-900 mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    AI-Generated Referral Letter
                  </h3>
                  <div className="bg-white p-6 rounded-lg border border-sky-100">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                      {selectedReferral.referralLetter}
                    </pre>
                  </div>
                </div>
              )}

              {/* Status Updates */}
              <div className="bg-white rounded-xl border border-sky-200 p-6">
                <h3 className="font-bold text-sky-900 mb-4">Status History</h3>
                <div className="space-y-3">
                  {selectedReferral.statusUpdates.map((update, index) => (
                    <div key={index} className="flex gap-3 pb-3 border-b border-sky-100 last:border-0">
                      <div className="flex-shrink-0 w-2 h-2 bg-sky-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sky-900">{update.status}</p>
                          <p className="text-xs text-sky-600">
                            {new Date(update.timestamp).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <p className="text-sm text-sky-700 mt-1">
                          By: {update.updatedBy} ({update.updatedByRole})
                        </p>
                        {update.notes && <p className="text-sm text-gray-700 mt-2">{update.notes}</p>}
                        {update.condition && (
                          <p className="text-sm text-gray-700 mt-1">
                            <span className="font-semibold">Condition:</span> {update.condition}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              {selectedReferral.toInstitutionId === institutionId && selectedReferral.status === 'Pending' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAcceptReferral(selectedReferral)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg"
                  >
                    Accept Referral
                  </button>
                  <button
                    onClick={() => handleRejectReferral(selectedReferral)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg"
                  >
                    Reject Referral
                  </button>
                </div>
              )}

              {selectedReferral.toInstitutionId === institutionId &&
                (selectedReferral.status === 'Accepted' || selectedReferral.status === 'Patient Admitted') && (
                  <button
                    onClick={() => setShowStatusUpdate(true)}
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg"
                  >
                    Update Patient Status
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusUpdate && selectedReferral && (
        <ReferralStatusUpdate
          referral={selectedReferral}
          userEmail={userEmail}
          userRole={userRole}
          userName={userName}
          onClose={() => {
            setShowStatusUpdate(false);
            setSelectedReferral(null);
          }}
          onSuccess={() => {
            setShowStatusUpdate(false);
            setSelectedReferral(null);
          }}
        />
      )}
    </div>
  );
};

export default ReferralInbox;
