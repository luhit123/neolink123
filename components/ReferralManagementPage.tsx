import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Referral, UserRole } from '../types';
import ReferralStatusUpdate from './ReferralStatusUpdate';
import ReferralTicket from './ReferralTicket';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

type DateFilterType = 'All Time' | 'Today' | 'This Week' | 'This Month' | 'Custom';

interface ReferralManagementPageProps {
    institutionId: string;
    institutionName: string;
    userEmail: string;
    userRole: UserRole;
    userName: string;
    onBack: () => void;
}

const ReferralManagementPage: React.FC<ReferralManagementPageProps> = ({
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

    // Advanced Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState<DateFilterType>('This Month');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [showDateFilterDropdown, setShowDateFilterDropdown] = useState(false);

    // Load referrals
    useEffect(() => {
        setLoading(true);

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

                setReferrals([...incomingReferrals, ...outgoingReferrals]);
                setLoading(false);
            });

            return () => unsubscribeOutgoing();
        });

        return () => unsubscribeIncoming();
    }, [institutionId]);

    // Derived State
    // Derived State
    const incomingReferrals = useMemo(() => referrals.filter(r => r.toInstitutionId === institutionId), [referrals, institutionId]);
    const outgoingReferrals = useMemo(() => referrals.filter(r => r.fromInstitutionId === institutionId), [referrals, institutionId]);

    const filteredReferrals = useMemo(() => {
        let result = activeTab === 'incoming' ? incomingReferrals : outgoingReferrals;

        // 1. Search Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(r =>
                r.patientName.toLowerCase().includes(query) ||
                r.id.toLowerCase().includes(query) ||
                (activeTab === 'incoming' ? r.fromInstitutionName : r.toInstitutionName).toLowerCase().includes(query)
            );
        }

        // 2. Date Filter
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        result = result.filter(r => {
            const date = new Date(r.referralDate);
            switch (dateFilter) {
                case 'Today':
                    return date >= startOfDay;
                case 'This Week':
                    const startOfWeek = new Date(now);
                    startOfWeek.setDate(now.getDate() - now.getDay());
                    startOfWeek.setHours(0, 0, 0, 0);
                    return date >= startOfWeek;
                case 'This Month':
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    return date >= startOfMonth;
                case 'Custom':
                    if (customStartDate && customEndDate) {
                        const start = new Date(customStartDate);
                        const end = new Date(customEndDate);
                        end.setHours(23, 59, 59, 999);
                        return date >= start && date <= end;
                    }
                    return true;
                default: // All Time
                    return true;
            }
        });

        return result;
    }, [activeTab, incomingReferrals, outgoingReferrals, searchQuery, dateFilter, customStartDate, customEndDate]);

    const stats = useMemo(() => {
        return {
            incomingPending: incomingReferrals.filter(r => r.status === 'Pending').length,
            incomingAccepted: incomingReferrals.filter(r => r.status === 'Accepted').length,
            outgoingPending: outgoingReferrals.filter(r => r.status === 'Pending').length,
            totalActive: incomingReferrals.length + outgoingReferrals.length
        };
    }, [incomingReferrals, outgoingReferrals]);

    // Actions
    const handleViewReferral = async (referral: Referral) => {
        setSelectedReferral(referral);
        if (referral.toInstitutionId === institutionId && !referral.isRead) {
            try {
                await updateDoc(doc(db, 'referrals', referral.id), { isRead: true });
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
        const reason = prompt('Reason for rejection:');
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
            case 'Critical': return 'bg-red-500/20 text-red-600 border-red-500/50';
            case 'High': return 'bg-orange-500/20 text-orange-600 border-orange-500/50';
            case 'Medium': return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/50';
            case 'Low': return 'bg-green-500/20 text-green-600 border-green-500/50';
            default: return 'bg-slate-500/20 text-slate-600 border-slate-500/50';
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            'Pending': 'bg-amber-100 text-amber-800 ring-amber-500/30',
            'Accepted': 'bg-blue-100 text-blue-800 ring-blue-500/30',
            'Rejected': 'bg-red-100 text-red-800 ring-red-500/30',
            'Patient Admitted': 'bg-emerald-100 text-emerald-800 ring-emerald-500/30',
            'Patient Discharged': 'bg-slate-100 text-slate-800 ring-slate-500/30',
            'Patient Deceased': 'bg-purple-100 text-purple-800 ring-purple-500/30',
        }[status] || 'bg-gray-100 text-gray-800';

        return <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${styles}`}>{status}</span>
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-indigo-900 font-medium">Loading Referral Network...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-r from-violet-600 to-indigo-600 skew-y-3 origin-top-left transform -translate-y-20 z-0"></div>

            <div className="relative z-10 container mx-auto px-4 py-8">

                {/* Header Section with Filters */}
                <div className="flex flex-col gap-6 mb-8">
                    {/* Title & Stats Row */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-white">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <button
                                    onClick={onBack}
                                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm transition-all text-white/90 hover:text-white"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                </button>
                                <h1 className="text-3xl font-bold tracking-tight">Referral Network</h1>
                            </div>
                            <p className="text-indigo-100 ml-12">Seamless patient transfer management for {institutionName}</p>
                        </div>

                        <div className="flex gap-4">
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[140px]">
                                <p className="text-indigo-100 text-xs uppercase font-semibold mb-1">Pending Requests</p>
                                <p className="text-3xl font-bold">{stats.incomingPending}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[140px]">
                                <p className="text-indigo-100 text-xs uppercase font-semibold mb-1">Total Active</p>
                                <p className="text-3xl font-bold">{stats.totalActive}</p>
                            </div>
                        </div>
                    </div>

                    {/* Controls Row (Search & Filter) */}
                    <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
                        {/* Tabs */}
                        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                            <button
                                onClick={() => setActiveTab('incoming')}
                                className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === 'incoming' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Incoming
                                {stats.incomingPending > 0 && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                            </button>
                            <button
                                onClick={() => setActiveTab('outgoing')}
                                className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all ${activeTab === 'outgoing' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Outgoing
                            </button>
                        </div>

                        <div className="flex flex-1 w-full md:w-auto gap-3">
                            {/* Search */}
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder="Search patients, hospitals..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
                                />
                                <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>

                            {/* Date Filter */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowDateFilterDropdown(!showDateFilterDropdown)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors h-full whitespace-nowrap"
                                >
                                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    {dateFilter}
                                </button>

                                {showDateFilterDropdown && (
                                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 animate-in fade-in zoom-in duration-200">
                                        {(['All Time', 'Today', 'This Week', 'This Month', 'Custom'] as DateFilterType[]).map((filter) => (
                                            <button
                                                key={filter}
                                                onClick={() => {
                                                    setDateFilter(filter);
                                                    if (filter !== 'Custom') setShowDateFilterDropdown(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilter === filter ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                {filter}
                                            </button>
                                        ))}

                                        {/* Custom Range Inputs */}
                                        {dateFilter === 'Custom' && (
                                            <div className="pt-2 mt-2 border-t border-slate-100 space-y-2">
                                                <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full text-xs p-2 bg-slate-50 border rounded-lg" />
                                                <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full text-xs p-2 bg-slate-50 border rounded-lg" />
                                                <button onClick={() => setShowDateFilterDropdown(false)} className="w-full py-1 bg-indigo-600 text-white text-xs rounded-lg font-bold">Apply</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[600px]">
                    {/* Content View */}
                    <div className="p-6 md:p-8">
                        {activeTab === 'create' ? (
                            <div className="text-center py-20 text-slate-400">
                                <p>Creation flow is initiated from Patient List.</p>
                            </div>
                        ) : (
                            <>
                                {filteredReferrals.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-600">No {activeTab} referrals found</h3>
                                        <p className="text-sm">Requests will appear here when generated.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                        {filteredReferrals.map((referral) => (
                                            <div
                                                key={referral.id}
                                                onClick={() => handleViewReferral(referral)}
                                                className={`group relative bg-white border rounded-2xl p-5 hover:shadow-lg transition-all cursor-pointer ${!referral.isRead && referral.toInstitutionId === institutionId ? 'border-indigo-400 ring-4 ring-indigo-50' : 'border-slate-200 hover:border-indigo-200'}`}
                                            >
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${referral.patientGender === 'Male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                                                            {referral.patientName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{referral.patientName}</h3>
                                                            <p className="text-xs text-slate-500">{referral.patientAge} {referral.patientAgeUnit} • {referral.patientGender}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {(() => {
                                                            const lastUpdate = referral.statusUpdates?.[referral.statusUpdates.length - 1];
                                                            const isRecent = lastUpdate && (new Date().getTime() - new Date(lastUpdate.timestamp).getTime() < 86400000);
                                                            const isOthers = lastUpdate?.updatedByEmail !== userEmail;

                                                            if (isRecent && isOthers) {
                                                                return (
                                                                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-bold bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-700/10 animate-pulse">
                                                                        New Update
                                                                    </span>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                        {getStatusBadge(referral.status)}
                                                    </div>
                                                </div>

                                                <div className="space-y-2 mb-4">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-500">From</span>
                                                        <span className="font-medium text-slate-700">{referral.fromInstitutionName}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-500">To</span>
                                                        <span className="font-medium text-slate-700">{referral.toInstitutionName}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-500">Priority</span>
                                                        <span className={`px-2 py-0.5 rounded textxs font-semibold border ${getPriorityColor(referral.priority)}`}>{referral.priority} Priority</span>
                                                    </div>
                                                </div>

                                                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(referral.referralDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className="text-indigo-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                        View Details <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                    </span>
                                                </div>

                                                {!referral.isRead && referral.toInstitutionId === institutionId && (
                                                    <span className="absolute top-4 right-4 flex h-3 w-3">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600"></span>
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Detail Modal Component */}
            {
                selectedReferral && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                            {/* Detail Header */}
                            <div className="bg-slate-50 border-b border-slate-200 p-6 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">{selectedReferral.patientName}</h2>
                                    <p className="text-slate-500 text-sm">Referral ID: {selectedReferral.id.slice(0, 8)}</p>
                                </div>
                                <button onClick={() => setSelectedReferral(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            {/* Detail Body */}
                            <div className="p-6 overflow-y-auto bg-slate-50 min-h-0 flex-1">

                                {/* Status Banner */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-wrap gap-4 justify-between items-center">
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Current Status</p>
                                        {getStatusBadge(selectedReferral.status)}
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Priority</p>
                                        <span className={`px-2 py-1 rounded text-sm font-semibold border ${getPriorityColor(selectedReferral.priority)}`}>{selectedReferral.priority}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Date</p>
                                        <p className="text-sm font-medium text-slate-900">{new Date(selectedReferral.referralDate).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                                    {/* Left Column: Data - REPLACED with Full Ticket View */}
                                    <div className="lg:col-span-2 space-y-6">
                                        <ReferralTicket
                                            data={{
                                                priority: selectedReferral.priority || 'Medium',
                                                referralDate: selectedReferral.referralDate,
                                                patient: {
                                                    name: selectedReferral.patientName,
                                                    age: selectedReferral.patientAge,
                                                    ageUnit: selectedReferral.patientAgeUnit,
                                                    gender: selectedReferral.patientGender,
                                                    admissionDate: selectedReferral.patientAdmissionDate,
                                                    ipNumber: undefined, // Not stored in flat object currently
                                                    unit: selectedReferral.fromUnit
                                                },
                                                from: {
                                                    institutionName: selectedReferral.fromInstitutionName,
                                                    unit: selectedReferral.fromUnit,
                                                    referredBy: selectedReferral.referredBy,
                                                    referredByRole: selectedReferral.referredByRole
                                                },
                                                to: {
                                                    institutionName: selectedReferral.toInstitutionName,
                                                    district: undefined,
                                                    unit: selectedReferral.toUnit
                                                },
                                                clinical: selectedReferral.referralDetails,
                                                vitals: selectedReferral.referralDetails.vitalSignsAtReferral,
                                                referralLetter: selectedReferral.referralLetter
                                            }}
                                        />
                                    </div>

                                    {/* Right Column: Timeline & Actions */}
                                    <div className="space-y-6">

                                        {/* Action Box */}
                                        {(selectedReferral.toInstitutionId === institutionId || (selectedReferral.fromInstitutionId === institutionId && selectedReferral.status === 'Accepted')) && (
                                            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100">
                                                <h3 className="font-bold text-indigo-900 mb-4">Actions</h3>

                                                {selectedReferral.toInstitutionId === institutionId && selectedReferral.status === 'Pending' && (
                                                    <div className="space-y-3">
                                                        <button onClick={() => handleAcceptReferral(selectedReferral)} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm transition-all flex items-center justify-center gap-2">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                            Accept Referral
                                                        </button>
                                                        <button onClick={() => handleRejectReferral(selectedReferral)} className="w-full py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold shadow-sm transition-all flex items-center justify-center gap-2">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            Reject
                                                        </button>
                                                    </div>
                                                )}

                                                {selectedReferral.toInstitutionId === institutionId && (selectedReferral.status === 'Accepted' || selectedReferral.status === 'Patient Admitted') && (
                                                    <button onClick={() => setShowStatusUpdate(true)} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-sm transition-all">
                                                        Update Patient Status
                                                    </button>
                                                )}

                                                {selectedReferral.status === 'Rejected' && <p className="text-sm text-center text-slate-500 italic">No further actions available.</p>}
                                            </div>
                                        )}

                                        {/* Status Timeline */}
                                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                                            <h3 className="font-bold text-slate-900 mb-4">History</h3>
                                            <div className="relative border-l-2 border-slate-100 ml-2 space-y-6 pl-6">
                                                {selectedReferral.statusUpdates.map((update, idx) => (
                                                    <div key={idx} className="relative">
                                                        <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ring-1 ring-slate-200 bg-slate-400"></span>
                                                        {idx === selectedReferral.statusUpdates.length - 1 && <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ring-1 ring-indigo-200 bg-indigo-500 animate-pulse"></span>}

                                                        <p className="text-sm font-semibold text-slate-800">{update.status}</p>
                                                        <p className="text-xs text-slate-400 mb-1">{new Date(update.timestamp).toLocaleString()}</p>
                                                        {update.notes && <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded mt-1 border border-slate-100">{update.notes}</p>}
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <p className="text-[10px] text-slate-400">by {update.updatedBy}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Status Update Modal */}
            {
                showStatusUpdate && selectedReferral && (
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
                )
            }
        </div >
    );
};

export default ReferralManagementPage;
