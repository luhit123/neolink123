import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Referral, UserRole } from '../types';
import ReferralStatusUpdate from './ReferralStatusUpdate';
import ReferralTicket from './ReferralTicket';
import {
  ArrowLeft,
  Search,
  Calendar,
  Filter,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  Download,
  Users,
  Activity,
  ArrowRight,
  Building2,
  Baby,
  FileText,
  BarChart3,
  PieChart,
  RefreshCw,
  Bell,
  ChevronRight,
  ChevronDown,
  Eye,
  MoreVertical,
  Zap,
  Target,
  Heart,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type DateFilterType = 'All Time' | 'Today' | 'This Week' | 'This Month' | 'Custom';
type ViewMode = 'dashboard' | 'list' | 'kanban';
type StatusFilter = 'all' | 'Pending' | 'Accepted' | 'Rejected' | 'Patient Admitted' | 'Patient Discharged' | 'Patient Deceased';

interface ReferralManagementPageProps {
  institutionId: string;
  institutionName: string;
  userEmail: string;
  userRole: UserRole;
  userName: string;
  onBack: () => void;
}

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

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
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

  // Advanced Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('This Month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

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
  const incomingReferrals = useMemo(() =>
    referrals.filter(r => r.toInstitutionId === institutionId),
    [referrals, institutionId]
  );

  const outgoingReferrals = useMemo(() =>
    referrals.filter(r => r.fromInstitutionId === institutionId),
    [referrals, institutionId]
  );

  const filteredReferrals = useMemo(() => {
    let result = activeTab === 'incoming' ? incomingReferrals : outgoingReferrals;

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.patientName.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (activeTab === 'incoming' ? r.fromInstitutionName : r.toInstitutionName).toLowerCase().includes(q)
      );
    }

    // Status Filter
    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }

    // Priority Filter
    if (priorityFilter !== 'all') {
      result = result.filter(r => r.priority === priorityFilter);
    }

    // Date Filter
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
        default:
          return true;
      }
    });

    return result;
  }, [activeTab, incomingReferrals, outgoingReferrals, searchQuery, statusFilter, priorityFilter, dateFilter, customStartDate, customEndDate]);

  // Enhanced Statistics
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthIncoming = incomingReferrals.filter(r => new Date(r.referralDate) >= thisMonth);
    const lastMonthIncoming = incomingReferrals.filter(r => {
      const date = new Date(r.referralDate);
      return date >= lastMonth && date <= lastMonthEnd;
    });

    const thisMonthOutgoing = outgoingReferrals.filter(r => new Date(r.referralDate) >= thisMonth);
    const lastMonthOutgoing = outgoingReferrals.filter(r => {
      const date = new Date(r.referralDate);
      return date >= lastMonth && date <= lastMonthEnd;
    });

    const incomingTrend = lastMonthIncoming.length > 0
      ? ((thisMonthIncoming.length - lastMonthIncoming.length) / lastMonthIncoming.length * 100).toFixed(0)
      : thisMonthIncoming.length > 0 ? '+100' : '0';

    const outgoingTrend = lastMonthOutgoing.length > 0
      ? ((thisMonthOutgoing.length - lastMonthOutgoing.length) / lastMonthOutgoing.length * 100).toFixed(0)
      : thisMonthOutgoing.length > 0 ? '+100' : '0';

    // Calculate average response time
    const acceptedReferrals = incomingReferrals.filter(r => r.status === 'Accepted' || r.status === 'Patient Admitted');
    let avgResponseTime = 0;
    if (acceptedReferrals.length > 0) {
      const totalTime = acceptedReferrals.reduce((sum, r) => {
        const acceptedUpdate = r.statusUpdates?.find(u => u.status === 'Accepted');
        if (acceptedUpdate) {
          return sum + (new Date(acceptedUpdate.timestamp).getTime() - new Date(r.referralDate).getTime());
        }
        return sum;
      }, 0);
      avgResponseTime = Math.round(totalTime / acceptedReferrals.length / (1000 * 60 * 60)); // In hours
    }

    // Calculate acceptance rate
    const resolvedIncoming = incomingReferrals.filter(r => r.status !== 'Pending');
    const acceptanceRate = resolvedIncoming.length > 0
      ? Math.round((incomingReferrals.filter(r => r.status === 'Accepted' || r.status === 'Patient Admitted' || r.status === 'Patient Discharged').length / resolvedIncoming.length) * 100)
      : 0;

    return {
      incoming: {
        total: incomingReferrals.length,
        pending: incomingReferrals.filter(r => r.status === 'Pending').length,
        accepted: incomingReferrals.filter(r => r.status === 'Accepted').length,
        admitted: incomingReferrals.filter(r => r.status === 'Patient Admitted').length,
        rejected: incomingReferrals.filter(r => r.status === 'Rejected').length,
        thisMonth: thisMonthIncoming.length,
        trend: incomingTrend,
        critical: incomingReferrals.filter(r => r.priority === 'Critical' && r.status === 'Pending').length,
      },
      outgoing: {
        total: outgoingReferrals.length,
        pending: outgoingReferrals.filter(r => r.status === 'Pending').length,
        accepted: outgoingReferrals.filter(r => r.status === 'Accepted').length,
        rejected: outgoingReferrals.filter(r => r.status === 'Rejected').length,
        thisMonth: thisMonthOutgoing.length,
        trend: outgoingTrend,
      },
      overall: {
        avgResponseTime,
        acceptanceRate,
        unreadCount: incomingReferrals.filter(r => !r.isRead).length,
      }
    };
  }, [incomingReferrals, outgoingReferrals]);

  // Grouped by status for Kanban view
  const kanbanColumns = useMemo(() => {
    const current = activeTab === 'incoming' ? incomingReferrals : outgoingReferrals;
    return {
      pending: current.filter(r => r.status === 'Pending'),
      accepted: current.filter(r => r.status === 'Accepted'),
      admitted: current.filter(r => r.status === 'Patient Admitted'),
      discharged: current.filter(r => r.status === 'Patient Discharged'),
      rejected: current.filter(r => r.status === 'Rejected'),
    };
  }, [activeTab, incomingReferrals, outgoingReferrals]);

  // Recent activity
  const recentActivity = useMemo(() => {
    return [...referrals]
      .sort((a, b) => {
        const aLatest = a.statusUpdates?.[a.statusUpdates.length - 1]?.timestamp || a.referralDate;
        const bLatest = b.statusUpdates?.[b.statusUpdates.length - 1]?.timestamp || b.referralDate;
        return new Date(bLatest).getTime() - new Date(aLatest).getTime();
      })
      .slice(0, 5);
  }, [referrals]);

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

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50', border: 'border-red-200', icon: <Zap className="w-3 h-3" /> };
      case 'High':
        return { bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50', border: 'border-orange-200', icon: <AlertTriangle className="w-3 h-3" /> };
      case 'Medium':
        return { bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50', border: 'border-amber-200', icon: <Target className="w-3 h-3" /> };
      case 'Low':
        return { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-50', border: 'border-green-200', icon: <Heart className="w-3 h-3" /> };
      default:
        return { bg: 'bg-slate-500', text: 'text-slate-700', light: 'bg-slate-50', border: 'border-slate-200', icon: null };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'Pending':
        return { bg: 'bg-amber-500', text: 'text-amber-800', light: 'bg-amber-50', border: 'border-amber-200', icon: <Clock className="w-3.5 h-3.5" /> };
      case 'Accepted':
        return { bg: 'bg-blue-500', text: 'text-blue-800', light: 'bg-blue-50', border: 'border-blue-200', icon: <CheckCircle className="w-3.5 h-3.5" /> };
      case 'Rejected':
        return { bg: 'bg-red-500', text: 'text-red-800', light: 'bg-red-50', border: 'border-red-200', icon: <XCircle className="w-3.5 h-3.5" /> };
      case 'Patient Admitted':
        return { bg: 'bg-emerald-500', text: 'text-emerald-800', light: 'bg-emerald-50', border: 'border-emerald-200', icon: <Baby className="w-3.5 h-3.5" /> };
      case 'Patient Discharged':
        return { bg: 'bg-slate-500', text: 'text-slate-800', light: 'bg-slate-100', border: 'border-slate-300', icon: <CheckCircle className="w-3.5 h-3.5" /> };
      case 'Patient Deceased':
        return { bg: 'bg-purple-500', text: 'text-purple-800', light: 'bg-purple-50', border: 'border-purple-200', icon: <Heart className="w-3.5 h-3.5" /> };
      default:
        return { bg: 'bg-gray-500', text: 'text-gray-800', light: 'bg-gray-50', border: 'border-gray-200', icon: null };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-500/30 rounded-full animate-spin border-t-indigo-500" />
            <Send className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-indigo-200 font-medium mt-4">Loading Referral Network...</p>
        </motion.div>
      </div>
    );
  }

  // Render stat card
  const StatCard = ({ title, value, trend, trendLabel, icon: Icon, color, subtitle }: {
    title: string;
    value: number | string;
    trend?: string;
    trendLabel?: string;
    icon: any;
    color: string;
    subtitle?: string;
  }) => (
    <motion.div
      variants={fadeInUp}
      className={`relative overflow-hidden bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-lg transition-shadow group`}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 ${color} opacity-5 rounded-full transform translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-500`} />
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
          <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          {Number(trend) >= 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-xs font-semibold ${Number(trend) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {Number(trend) >= 0 ? '+' : ''}{trend}%
          </span>
          <span className="text-xs text-slate-400">{trendLabel || 'vs last month'}</span>
        </div>
      )}
    </motion.div>
  );

  // Render referral card for list view
  const ReferralCard = ({ referral, compact = false }: { referral: Referral; compact?: boolean }) => {
    const priorityConfig = getPriorityConfig(referral.priority);
    const statusConfig = getStatusConfig(referral.status);
    const isUnread = !referral.isRead && referral.toInstitutionId === institutionId;

    return (
      <motion.div
        layout
        variants={fadeInUp}
        whileHover={{ scale: 1.01 }}
        onClick={() => handleViewReferral(referral)}
        className={`relative bg-white rounded-xl border transition-all cursor-pointer group ${
          isUnread
            ? 'border-indigo-300 ring-2 ring-indigo-100 shadow-md'
            : 'border-slate-200 hover:border-indigo-200 hover:shadow-md'
        }`}
      >
        {/* Priority indicator bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${priorityConfig.bg}`} />

        <div className={`p-4 ${compact ? 'space-y-2' : 'space-y-3'}`}>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                referral.patientGender === 'Male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
              }`}>
                {referral.patientName.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                  {referral.patientName}
                </h3>
                <p className="text-xs text-slate-500">
                  {referral.patientAge} {referral.patientAgeUnit} • {referral.patientGender}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isUnread && (
                <span className="flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600" />
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${statusConfig.light} ${statusConfig.text} ${statusConfig.border} border`}>
                {statusConfig.icon}
                {referral.status}
              </span>
            </div>
          </div>

          {/* Transfer info */}
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-slate-600 truncate">
              {activeTab === 'incoming' ? referral.fromInstitutionName : referral.toInstitutionName}
            </span>
            <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            <span className="text-slate-500 text-xs">
              {activeTab === 'incoming' ? 'to you' : 'from you'}
            </span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${priorityConfig.light} ${priorityConfig.text}`}>
                {priorityConfig.icon}
                {referral.priority}
              </span>
              <span className="text-xs text-slate-400">
                {formatTimeAgo(referral.referralDate)}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </motion.div>
    );
  };

  // Render Kanban column
  const KanbanColumn = ({ title, referrals: columnReferrals, color, icon: Icon }: {
    title: string;
    referrals: Referral[];
    color: string;
    icon: any;
  }) => (
    <div className="flex-1 min-w-[280px] max-w-[350px]">
      <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg ${color}`}>
        <Icon className="w-4 h-4" />
        <span className="font-semibold text-sm">{title}</span>
        <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold">
          {columnReferrals.length}
        </span>
      </div>
      <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto pr-1 custom-scrollbar">
        {columnReferrals.map((referral) => (
          <ReferralCard key={referral.id} referral={referral} compact />
        ))}
        {columnReferrals.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">
            No referrals
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold">Referral Network</h1>
                <p className="text-indigo-200 text-sm">{institutionName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Notifications badge */}
              {stats.overall.unreadCount > 0 && (
                <div className="relative">
                  <Bell className="w-5 h-5 text-white/80" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">
                    {stats.overall.unreadCount}
                  </span>
                </div>
              )}

              {/* View mode switcher */}
              <div className="flex bg-white/10 rounded-lg p-1">
                {[
                  { mode: 'dashboard' as ViewMode, icon: BarChart3, label: 'Dashboard' },
                  { mode: 'list' as ViewMode, icon: FileText, label: 'List' },
                  { mode: 'kanban' as ViewMode, icon: PieChart, label: 'Kanban' }
                ].map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                      viewMode === mode
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                    title={label}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('incoming')}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'incoming'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <Download className="w-4 h-4" />
                Incoming
                {stats.incoming.pending > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-xs font-bold animate-pulse">
                    {stats.incoming.pending}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('outgoing')}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'outgoing'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <Send className="w-4 h-4" />
                Outgoing
                {stats.outgoing.pending > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-amber-400 text-slate-900 rounded-full text-xs font-bold">
                    {stats.outgoing.pending}
                  </span>
                )}
              </button>
            </div>

            {/* Quick stats */}
            <div className="hidden lg:flex items-center gap-6 ml-auto text-white/80 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Avg Response: <strong className="text-white">{stats.overall.avgResponseTime}h</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Acceptance Rate: <strong className="text-white">{stats.overall.acceptanceRate}%</strong></span>
              </div>
              {stats.incoming.critical > 0 && (
                <div className="flex items-center gap-2 text-red-300">
                  <AlertTriangle className="w-4 h-4" />
                  <span><strong className="text-red-200">{stats.incoming.critical}</strong> Critical Pending</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Dashboard View */}
        {viewMode === 'dashboard' && (
          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="space-y-6"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Total Incoming"
                value={stats.incoming.total}
                trend={stats.incoming.trend}
                icon={Download}
                color="bg-indigo-500"
                subtitle={`${stats.incoming.thisMonth} this month`}
              />
              <StatCard
                title="Pending Review"
                value={stats.incoming.pending}
                icon={Clock}
                color="bg-amber-500"
                subtitle={stats.incoming.critical > 0 ? `${stats.incoming.critical} critical` : undefined}
              />
              <StatCard
                title="Accepted"
                value={stats.incoming.accepted + stats.incoming.admitted}
                icon={CheckCircle}
                color="bg-emerald-500"
              />
              <StatCard
                title="Total Outgoing"
                value={stats.outgoing.total}
                trend={stats.outgoing.trend}
                icon={Send}
                color="bg-purple-500"
                subtitle={`${stats.outgoing.thisMonth} this month`}
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Referrals */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-bold text-slate-900 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-indigo-500" />
                      Recent {activeTab === 'incoming' ? 'Incoming' : 'Outgoing'} Referrals
                    </h2>
                    <button
                      onClick={() => setViewMode('list')}
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                    >
                      View All
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-5 space-y-3">
                    {filteredReferrals.slice(0, 5).map((referral) => (
                      <ReferralCard key={referral.id} referral={referral} />
                    ))}
                    {filteredReferrals.length === 0 && (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FileText className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-medium">No referrals found</p>
                        <p className="text-slate-400 text-sm mt-1">
                          {activeTab === 'incoming' ? 'Incoming' : 'Outgoing'} referrals will appear here
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Quick Actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Quick Overview
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800">Awaiting Response</span>
                      </div>
                      <span className="text-lg font-bold text-amber-600">{stats.incoming.pending}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Being Processed</span>
                      </div>
                      <span className="text-lg font-bold text-blue-600">{stats.incoming.accepted}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="flex items-center gap-2">
                        <Baby className="w-5 h-5 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-800">Patients Admitted</span>
                      </div>
                      <span className="text-lg font-bold text-emerald-600">{stats.incoming.admitted}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-indigo-500" />
                    Recent Activity
                  </h3>
                  <div className="space-y-3">
                    {recentActivity.map((referral) => {
                      const lastUpdate = referral.statusUpdates?.[referral.statusUpdates.length - 1];
                      return (
                        <div
                          key={referral.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => handleViewReferral(referral)}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            referral.patientGender === 'Male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                          }`}>
                            {referral.patientName.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 truncate">{referral.patientName}</p>
                            <p className="text-xs text-slate-500">
                              {lastUpdate?.status || 'Created'} • {formatTimeAgo(lastUpdate?.timestamp || referral.referralDate)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="space-y-4"
          >
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search patients, hospitals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Patient Admitted">Admitted</option>
                  <option value="Rejected">Rejected</option>
                </select>

                {/* Priority Filter */}
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Priority</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>

                {/* Date Filter */}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as DateFilterType)}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="All Time">All Time</option>
                  <option value="Today">Today</option>
                  <option value="This Week">This Week</option>
                  <option value="This Month">This Month</option>
                </select>
              </div>
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Showing <strong>{filteredReferrals.length}</strong> referrals
              </p>
            </div>

            {/* Referral Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredReferrals.map((referral) => (
                <ReferralCard key={referral.id} referral={referral} />
              ))}
            </div>

            {filteredReferrals.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No Referrals Found</h3>
                <p className="text-slate-500 text-sm">
                  Try adjusting your filters or search query
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Kanban View */}
        {viewMode === 'kanban' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="overflow-x-auto pb-4"
          >
            <div className="flex gap-4 min-w-max">
              <KanbanColumn
                title="Pending"
                referrals={kanbanColumns.pending}
                color="bg-amber-100 text-amber-800"
                icon={Clock}
              />
              <KanbanColumn
                title="Accepted"
                referrals={kanbanColumns.accepted}
                color="bg-blue-100 text-blue-800"
                icon={CheckCircle}
              />
              <KanbanColumn
                title="Admitted"
                referrals={kanbanColumns.admitted}
                color="bg-emerald-100 text-emerald-800"
                icon={Baby}
              />
              <KanbanColumn
                title="Discharged"
                referrals={kanbanColumns.discharged}
                color="bg-slate-200 text-slate-700"
                icon={CheckCircle}
              />
              <KanbanColumn
                title="Rejected"
                referrals={kanbanColumns.rejected}
                color="bg-red-100 text-red-800"
                icon={XCircle}
              />
            </div>
          </motion.div>
        )}
      </main>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedReferral && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedReferral(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between text-white">
                <div>
                  <h2 className="text-lg font-bold">{selectedReferral.patientName}</h2>
                  <p className="text-indigo-200 text-sm">Referral ID: {selectedReferral.id.slice(0, 8)}</p>
                </div>
                <button
                  onClick={() => setSelectedReferral(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                {/* Status Banner */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-wrap gap-4 justify-between items-center">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Current Status</p>
                    {(() => {
                      const config = getStatusConfig(selectedReferral.status);
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${config.light} ${config.text} ${config.border} border`}>
                          {config.icon}
                          {selectedReferral.status}
                        </span>
                      );
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Priority</p>
                    {(() => {
                      const config = getPriorityConfig(selectedReferral.priority);
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${config.light} ${config.text}`}>
                          {config.icon}
                          {selectedReferral.priority}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Date</p>
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(selectedReferral.referralDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Ticket */}
                  <div className="lg:col-span-2">
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
                          ipNumber: undefined,
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

                  {/* Right: Actions & Timeline */}
                  <div className="space-y-6">
                    {/* Actions */}
                    {(selectedReferral.toInstitutionId === institutionId ||
                      (selectedReferral.fromInstitutionId === institutionId && selectedReferral.status === 'Accepted')) && (
                      <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100">
                        <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                          <Zap className="w-5 h-5 text-indigo-600" />
                          Actions
                        </h3>

                        {selectedReferral.toInstitutionId === institutionId && selectedReferral.status === 'Pending' && (
                          <div className="space-y-3">
                            <button
                              onClick={() => handleAcceptReferral(selectedReferral)}
                              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
                            >
                              <CheckCircle className="w-5 h-5" />
                              Accept Referral
                            </button>
                            <button
                              onClick={() => handleRejectReferral(selectedReferral)}
                              className="w-full py-3 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                            >
                              <XCircle className="w-5 h-5" />
                              Reject
                            </button>
                          </div>
                        )}

                        {selectedReferral.toInstitutionId === institutionId &&
                         (selectedReferral.status === 'Accepted' || selectedReferral.status === 'Patient Admitted') && (
                          <button
                            onClick={() => setShowStatusUpdate(true)}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
                          >
                            <RefreshCw className="w-5 h-5" />
                            Update Patient Status
                          </button>
                        )}

                        {selectedReferral.status === 'Rejected' && (
                          <p className="text-sm text-center text-slate-500 italic">
                            No further actions available.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-500" />
                        Status History
                      </h3>
                      <div className="relative border-l-2 border-slate-200 ml-2 space-y-4 pl-5">
                        {selectedReferral.statusUpdates.map((update, idx) => {
                          const isLatest = idx === selectedReferral.statusUpdates.length - 1;
                          const config = getStatusConfig(update.status);
                          return (
                            <div key={idx} className="relative">
                              <span className={`absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 border-white ${isLatest ? config.bg : 'bg-slate-300'}`} />
                              <p className="text-sm font-semibold text-slate-800">{update.status}</p>
                              <p className="text-xs text-slate-400">
                                {new Date(update.timestamp).toLocaleString()}
                              </p>
                              {update.notes && (
                                <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mt-1 border border-slate-100">
                                  {update.notes}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-1">by {update.updatedBy}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default ReferralManagementPage;
