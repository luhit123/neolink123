import React, { useState, useEffect, lazy, Suspense } from 'react';
import { collection, getDocs, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Institution, Official, ReportRequest, ReportRequestStatus, ReportType, Unit, Patient, UserRole } from '../types';
import { ChatProvider } from '../contexts/ChatContext';

// Lazy load components for viewing institutions
const Dashboard = lazy(() => import('./Dashboard'));
const AnalyticsPage = lazy(() => import('./AnalyticsPage'));

interface OfficialDashboardProps {
  official: Official;
  userEmail: string;
  onLogout: () => void;
}

const OfficialDashboard: React.FC<OfficialDashboardProps> = ({ official, userEmail, onLogout }) => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'institutions' | 'requests' | 'responses'>('institutions');
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [viewingDashboard, setViewingDashboard] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);

  // Analytics state
  const [showAnalyticsPage, setShowAnalyticsPage] = useState(false);
  const [selectedAnalyticsUnit, setSelectedAnalyticsUnit] = useState<Unit>(Unit.NICU);

  // Report request state
  const [reportRequests, setReportRequests] = useState<ReportRequest[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestFormData, setRequestFormData] = useState({
    institutionId: '',
    reportType: ReportType.MonthlyStatistics,
    customDescription: '',
    dateRangeStart: '',
    dateRangeEnd: '',
    unit: '' as string,
    additionalNotes: '',
    priority: 'Normal' as 'Normal' | 'Urgent',
    deadline: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load institutions
  useEffect(() => {
    const loadInstitutions = async () => {
      try {
        const institutionsRef = collection(db, 'institutions');
        const snapshot = await getDocs(institutionsRef);
        let allInstitutions = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        } as Institution));

        // Filter based on official's access
        if (!official.canViewAllInstitutions && official.assignedInstitutionIds) {
          allInstitutions = allInstitutions.filter(inst =>
            official.assignedInstitutionIds!.includes(inst.id)
          );
        }

        setInstitutions(allInstitutions);
        setLoading(false);
      } catch (err) {
        console.error('Error loading institutions:', err);
        setError('Failed to load institutions');
        setLoading(false);
      }
    };

    loadInstitutions();
  }, [official]);

  // Load report requests
  useEffect(() => {
    const requestsRef = collection(db, 'reportRequests');
    const q = query(requestsRef, where('requesterEmail', '==', userEmail));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as ReportRequest));
      setReportRequests(requests.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    });

    return () => unsubscribe();
  }, [userEmail]);

  // Load patients when viewing institution dashboard
  useEffect(() => {
    if (!selectedInstitution || !viewingDashboard) {
      setPatients([]);
      return;
    }

    setPatientsLoading(true);
    const patientsRef = collection(db, 'patients');
    const q = query(patientsRef, where('institutionId', '==', selectedInstitution.id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Patient));
      setPatients(data);
      setPatientsLoading(false);
    });

    return () => unsubscribe();
  }, [selectedInstitution, viewingDashboard]);

  const handleViewDashboard = (institution: Institution) => {
    setSelectedInstitution(institution);
    setViewingDashboard(true);
  };

  const handleBackFromDashboard = () => {
    setViewingDashboard(false);
    setSelectedInstitution(null);
  };

  const handleRequestReport = (institution: Institution) => {
    setRequestFormData({
      ...requestFormData,
      institutionId: institution.id
    });
    setSelectedInstitution(institution);
    setShowRequestForm(true);
  };

  const submitReportRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!requestFormData.institutionId) {
      setError('Please select an institution');
      return;
    }

    try {
      const institution = institutions.find(i => i.id === requestFormData.institutionId);

      const newRequest: Omit<ReportRequest, 'id'> = {
        requesterId: official.id,
        requesterEmail: userEmail,
        requesterName: official.displayName,
        requesterDesignation: official.designation,
        institutionId: requestFormData.institutionId,
        institutionName: institution?.name || '',
        reportType: requestFormData.reportType,
        customReportDescription: requestFormData.reportType === ReportType.CustomReport
          ? requestFormData.customDescription
          : undefined,
        dateRangeStart: requestFormData.dateRangeStart || undefined,
        dateRangeEnd: requestFormData.dateRangeEnd || undefined,
        unit: requestFormData.unit ? requestFormData.unit as Unit : undefined,
        additionalNotes: requestFormData.additionalNotes || undefined,
        priority: requestFormData.priority,
        deadline: requestFormData.deadline || undefined,
        status: ReportRequestStatus.Pending,
        createdAt: new Date().toISOString(),
        isReadByAdmin: false,
        isReadByOfficial: true
      };

      await addDoc(collection(db, 'reportRequests'), newRequest);

      setSuccess('Report request submitted successfully!');
      setShowRequestForm(false);
      setRequestFormData({
        institutionId: '',
        reportType: ReportType.MonthlyStatistics,
        customDescription: '',
        dateRangeStart: '',
        dateRangeEnd: '',
        unit: '',
        additionalNotes: '',
        priority: 'Normal',
        deadline: ''
      });
      setActiveTab('requests');
    } catch (err: any) {
      console.error('Error submitting request:', err);
      setError('Failed to submit request: ' + err.message);
    }
  };

  const getStatusBadgeClass = (status: ReportRequestStatus) => {
    switch (status) {
      case ReportRequestStatus.Pending:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case ReportRequestStatus.InProgress:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case ReportRequestStatus.Completed:
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case ReportRequestStatus.Rejected:
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  // If showing analytics page for the selected institution
  if (showAnalyticsPage && selectedInstitution) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      }>
        <AnalyticsPage
          institutionId={selectedInstitution.id}
          selectedUnit={selectedAnalyticsUnit}
          onSelectUnit={setSelectedAnalyticsUnit}
          enabledFacilities={selectedInstitution.facilities || [Unit.NICU, Unit.PICU]}
          onBack={() => setShowAnalyticsPage(false)}
          institutionName={selectedInstitution.name}
        />
      </Suspense>
    );
  }

  // If viewing a specific institution's dashboard
  if (viewingDashboard && selectedInstitution) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackFromDashboard}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold">{selectedInstitution.name}</h1>
                <p className="text-indigo-200 text-sm">View-Only Mode</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                Official View
              </span>
              <button
                onClick={() => handleRequestReport(selectedInstitution)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Request Report
              </button>
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 p-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3 text-amber-700 dark:text-amber-400">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm">
              <strong>View-Only Mode:</strong> You can view data but cannot make any changes. To request reports, use the "Request Report" button.
            </p>
          </div>
        </div>

        {/* Dashboard Content wrapped in ChatProvider */}
        {patientsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
              <p className="text-slate-500 dark:text-slate-400">Loading dashboard data...</p>
            </div>
          </div>
        ) : (
          <ChatProvider>
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
              </div>
            }>
              <Dashboard
                userRole={UserRole.Official}
                institutionId={selectedInstitution.id}
                institutionName={selectedInstitution.name}
                userEmail={userEmail}
                displayName={official.displayName}
                allowedDashboards={selectedInstitution.facilities}
                showPatientList={false}
                setShowPatientList={() => { }}
                onShowAnalytics={() => setShowAnalyticsPage(true)}
              />
            </Suspense>
          </ChatProvider>
        )}

        {/* Report Request Form Modal - Rendered inside dashboard view */}
        {showRequestForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                  Request Report
                </h3>
                {selectedInstitution && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    From: {selectedInstitution.name}
                  </p>
                )}
              </div>
              <form onSubmit={submitReportRequest} className="p-6 space-y-4">
                {/* Report Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Report Type *
                  </label>
                  <select
                    value={requestFormData.reportType}
                    onChange={(e) => setRequestFormData({ ...requestFormData, reportType: e.target.value as ReportType })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {Object.values(ReportType).map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Custom Description (if Custom Report) */}
                {requestFormData.reportType === ReportType.CustomReport && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Custom Report Description *
                    </label>
                    <textarea
                      value={requestFormData.customDescription}
                      onChange={(e) => setRequestFormData({ ...requestFormData, customDescription: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      rows={3}
                      placeholder="Describe the custom report you need..."
                    />
                  </div>
                )}

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={requestFormData.dateRangeStart}
                      onChange={(e) => setRequestFormData({ ...requestFormData, dateRangeStart: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={requestFormData.dateRangeEnd}
                      onChange={(e) => setRequestFormData({ ...requestFormData, dateRangeEnd: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={requestFormData.priority}
                    onChange={(e) => setRequestFormData({ ...requestFormData, priority: e.target.value as 'Normal' | 'Urgent' })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    value={requestFormData.additionalNotes}
                    onChange={(e) => setRequestFormData({ ...requestFormData, additionalNotes: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    rows={2}
                    placeholder="Any additional information..."
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowRequestForm(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main Official Dashboard
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">Official Dashboard</h1>
              <p className="text-indigo-200 mt-1">
                {official.displayName} | {official.designation}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('institutions')}
              className={`px-6 py-4 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'institutions'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Institutions ({institutions.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-6 py-4 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'requests'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                My Requests
                {reportRequests.filter(r => r.status === ReportRequestStatus.Pending).length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                    {reportRequests.filter(r => r.status === ReportRequestStatus.Pending).length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('responses')}
              className={`px-6 py-4 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'responses'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Responses
                {reportRequests.filter(r => r.status === ReportRequestStatus.Completed && !r.isReadByOfficial).length > 0 && (
                  <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full">
                    {reportRequests.filter(r => r.status === ReportRequestStatus.Completed && !r.isReadByOfficial).length}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-400">
            {success}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
              <p className="text-slate-500 dark:text-slate-400">Loading institutions...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Institutions Tab */}
            {activeTab === 'institutions' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {institutions.map((institution) => (
                  <div
                    key={institution.id}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <div className="p-6">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                        {institution.name}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        {institution.district}, {institution.state}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {institution.facilities?.map((facility) => (
                          <span
                            key={facility}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs"
                          >
                            {facility.split(' ')[0]}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDashboard(institution)}
                          className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Dashboard
                        </button>
                        <button
                          onClick={() => handleRequestReport(institution)}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                          title="Request Report"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">My Report Requests</h2>
                  <button
                    onClick={() => setShowRequestForm(true)}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    New Request
                  </button>
                </div>

                {reportRequests.length === 0 ? (
                  <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-slate-500 dark:text-slate-400">No report requests yet</p>
                    <button
                      onClick={() => setShowRequestForm(true)}
                      className="mt-4 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                    >
                      Create First Request
                    </button>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-900/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Institution</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Report Type</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Date Range</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Requested</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {reportRequests.map((request) => (
                            <tr key={request.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="px-4 py-4">
                                <div className="font-medium text-slate-800 dark:text-white">
                                  {request.institutionName}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                                {request.reportType}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                                {request.dateRangeStart && request.dateRangeEnd
                                  ? `${new Date(request.dateRangeStart).toLocaleDateString()} - ${new Date(request.dateRangeEnd).toLocaleDateString()}`
                                  : '-'}
                              </td>
                              <td className="px-4 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(request.status)}`}>
                                  {request.status}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                                {new Date(request.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Responses Tab */}
            {activeTab === 'responses' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Report Responses</h2>

                {reportRequests.filter(r => r.status === ReportRequestStatus.Completed).length === 0 ? (
                  <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="text-slate-500 dark:text-slate-400">No responses yet</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                      Completed report requests will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reportRequests
                      .filter(r => r.status === ReportRequestStatus.Completed)
                      .map((request) => (
                        <div
                          key={request.id}
                          className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-bold text-slate-800 dark:text-white">
                                {request.institutionName}
                              </h3>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {request.reportType}
                              </p>
                            </div>
                            <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-xs font-medium">
                              Completed
                            </span>
                          </div>
                          {request.responseNote && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 mb-4">
                              <p className="text-sm text-slate-600 dark:text-slate-300">
                                {request.responseNote}
                              </p>
                            </div>
                          )}
                          {request.reportPdfUrl && (
                            <a
                              href={request.reportPdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Download Report ({request.reportFileName})
                            </a>
                          )}
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
                            Responded by {request.respondedBy} on {request.respondedAt ? new Date(request.respondedAt).toLocaleString() : '-'}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Report Request Form Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                Request Report
              </h3>
              {selectedInstitution && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  From: {selectedInstitution.name}
                </p>
              )}
            </div>
            <form onSubmit={submitReportRequest} className="p-6 space-y-4">
              {/* Institution Selection (if not pre-selected) */}
              {!selectedInstitution && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Institution *
                  </label>
                  <select
                    value={requestFormData.institutionId}
                    onChange={(e) => setRequestFormData({ ...requestFormData, institutionId: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="">Select Institution</option>
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Report Type *
                </label>
                <select
                  value={requestFormData.reportType}
                  onChange={(e) => setRequestFormData({ ...requestFormData, reportType: e.target.value as ReportType })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  {Object.values(ReportType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Custom Description (for custom reports) */}
              {requestFormData.reportType === ReportType.CustomReport && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Describe the Report *
                  </label>
                  <textarea
                    value={requestFormData.customDescription}
                    onChange={(e) => setRequestFormData({ ...requestFormData, customDescription: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    placeholder="Describe what data you need..."
                  />
                </div>
              )}

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={requestFormData.dateRangeStart}
                    onChange={(e) => setRequestFormData({ ...requestFormData, dateRangeStart: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={requestFormData.dateRangeEnd}
                    onChange={(e) => setRequestFormData({ ...requestFormData, dateRangeEnd: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Unit Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Unit (Optional)
                </label>
                <select
                  value={requestFormData.unit}
                  onChange={(e) => setRequestFormData({ ...requestFormData, unit: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="">All Units</option>
                  {Object.values(Unit).map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Priority
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={requestFormData.priority === 'Normal'}
                      onChange={() => setRequestFormData({ ...requestFormData, priority: 'Normal' })}
                      className="text-indigo-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">Normal</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={requestFormData.priority === 'Urgent'}
                      onChange={() => setRequestFormData({ ...requestFormData, priority: 'Urgent' })}
                      className="text-red-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">Urgent</span>
                  </label>
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Additional Notes
                </label>
                <textarea
                  value={requestFormData.additionalNotes}
                  onChange={(e) => setRequestFormData({ ...requestFormData, additionalNotes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="Any additional requirements..."
                />
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowRequestForm(false);
                    setSelectedInstitution(null);
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficialDashboard;
