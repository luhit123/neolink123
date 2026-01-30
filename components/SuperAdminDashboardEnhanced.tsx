/**
 * Enhanced SuperAdmin Dashboard
 * 100+ Features organized into logical categories
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  setDoc,
  onSnapshot,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Institution, UserRole, Unit, PasswordResetRequest } from '../types';
import { INSTITUTION_TYPES } from '../constants';

// Existing components
import AdmissionIndicationsManager from './AdmissionIndicationsManager';
import ObservationIndicationsManager from './ObservationIndicationsManager';
import MedicationManagementPanel from './MedicationManagementPanel';
import SystemHealthPanel from './superadmin/SystemHealthPanel';
import STTSettingsPanel from './superadmin/STTSettingsPanel';
import ClinicalNoteAISettingsPanel from './superadmin/ClinicalNoteAISettingsPanel';
import AdvancedAnalyticsDashboard from './superadmin/AdvancedAnalyticsDashboard';
import AddressInput, { AddressData } from './forms/AddressInput';
import CredentialsModal from './CredentialsModal';
import ReportsPage from './ReportsPage';
import DataExportPage from './DataExportPage';
import DataMigrationPanel from './DataMigrationPanel';

// Services
import {
  getSystemStats,
  getSystemHealth,
  getAllInstitutionsWithStats,
  getPatientAnalytics,
  getAuditLogs,
  getReferralAnalytics,
  getMortalityAnalytics,
  getAnnouncements,
  createAnnouncement,
  toggleAnnouncement,
  deleteAnnouncement,
  logAuditEvent,
  SystemStats,
  SystemHealth,
  InstitutionStats,
  AuditLog
} from '../services/superAdminService';
import { generateUserID, getNextSequenceNumber } from '../utils/userIdGenerator';
import { generateAlphanumericPassword } from '../utils/passwordUtils';
import {
  getPasswordResetRequests,
  approvePasswordResetRequest,
  rejectPasswordResetRequest,
  deletePasswordResetRequest
} from '../services/passwordResetService';

// Icons (using inline SVG for consistency)
const Icons = {
  Dashboard: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  Hospital: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Users: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Patients: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Analytics: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Clinical: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  AI: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  Reports: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Security: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Backup: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  Bell: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  Refresh: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  ChevronRight: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  Check: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  X: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  Search: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Download: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  Eye: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  EyeOff: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Edit: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Key: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  Activity: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
};

// ============================================
// TYPES
// ============================================

type MainCategory =
  | 'overview'
  | 'institutions'
  | 'users'
  | 'patients'
  | 'clinical'
  | 'ai'
  | 'reports'
  | 'security'
  | 'settings';

type SubCategory = string;

interface CategoryConfig {
  id: MainCategory;
  label: string;
  icon: React.FC;
  color: string;
  subCategories: { id: SubCategory; label: string }[];
}

// ============================================
// CATEGORY CONFIGURATION
// ============================================

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'overview',
    label: 'Dashboard',
    icon: Icons.Dashboard,
    color: 'from-violet-500 to-purple-600',
    subCategories: [
      { id: 'system-health', label: 'System Health' },
      { id: 'quick-stats', label: 'Quick Stats' },
      { id: 'recent-activity', label: 'Recent Activity' },
      { id: 'announcements', label: 'Announcements' },
    ],
  },
  {
    id: 'institutions',
    label: 'Institutions',
    icon: Icons.Hospital,
    color: 'from-blue-500 to-cyan-600',
    subCategories: [
      { id: 'manage', label: 'Manage Institutions' },
      { id: 'add-new', label: 'Add Institution' },
      { id: 'bed-capacity', label: 'Bed Capacity' },
      { id: 'performance', label: 'Performance' },
    ],
  },
  {
    id: 'users',
    label: 'Users',
    icon: Icons.Users,
    color: 'from-emerald-500 to-teal-600',
    subCategories: [
      { id: 'all-users', label: 'All Users' },
      { id: 'add-user', label: 'Add User' },
      { id: 'roles', label: 'Roles & Permissions' },
      { id: 'password-reset', label: 'Password Requests' },
      { id: 'activity', label: 'User Activity' },
    ],
  },
  {
    id: 'patients',
    label: 'Patients',
    icon: Icons.Patients,
    color: 'from-rose-500 to-pink-600',
    subCategories: [
      { id: 'analytics', label: 'Patient Analytics' },
      { id: 'mortality', label: 'Mortality Analysis' },
      { id: 'referrals', label: 'Referral Network' },
      { id: 'search', label: 'Patient Search' },
    ],
  },
  {
    id: 'clinical',
    label: 'Clinical',
    icon: Icons.Clinical,
    color: 'from-amber-500 to-orange-600',
    subCategories: [
      { id: 'medications', label: 'Medications' },
      { id: 'indications', label: 'Admission Indications' },
      { id: 'observation-indications', label: 'Observation Indications' },
      { id: 'protocols', label: 'Clinical Protocols' },
      { id: 'alerts', label: 'Alert Configuration' },
    ],
  },
  {
    id: 'ai',
    label: 'AI & ML',
    icon: Icons.AI,
    color: 'from-indigo-500 to-blue-600',
    subCategories: [
      { id: 'stt', label: 'Speech-to-Text' },
      { id: 'clinical-ai', label: 'Clinical AI' },
      { id: 'usage', label: 'AI Usage Stats' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: Icons.Reports,
    color: 'from-cyan-500 to-blue-600',
    subCategories: [
      { id: 'generate', label: 'Generate Reports' },
      { id: 'export', label: 'Data Export' },
      { id: 'scheduled', label: 'Scheduled Reports' },
      { id: 'supabase', label: 'Supabase Reports' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    icon: Icons.Security,
    color: 'from-red-500 to-rose-600',
    subCategories: [
      { id: 'audit-logs', label: 'Audit Logs' },
      { id: 'access-control', label: 'Access Control' },
      { id: 'sessions', label: 'Active Sessions' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Icons.Settings,
    color: 'from-slate-500 to-gray-600',
    subCategories: [
      { id: 'general', label: 'General Settings' },
      { id: 'backup', label: 'Backup & Recovery' },
      { id: 'maintenance', label: 'Maintenance Mode' },
      { id: 'migration', label: 'Data Migration' },
    ],
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

interface SuperAdminDashboardEnhancedProps {
  userEmail: string;
  onBack: () => void;
  onViewInstitutionDashboard?: (institutionId: string, institutionName: string) => void;
}

const SuperAdminDashboardEnhanced: React.FC<SuperAdminDashboardEnhancedProps> = ({
  userEmail,
  onBack,
  onViewInstitutionDashboard,
}) => {
  // State
  const [activeCategory, setActiveCategory] = useState<MainCategory>('overview');
  const [activeSubCategory, setActiveSubCategory] = useState<SubCategory>('system-health');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Data state
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionStats, setInstitutionStats] = useState<InstitutionStats[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form states
  const [showAddInstitution, setShowAddInstitution] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState({
    userName: '',
    userEmail: '',
    userID: '',
    password: '',
    userType: '',
  });

  // Error/Success states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ============================================
  // EFFECTS
  // ============================================

  // Load initial data
  useEffect(() => {
    loadAllData();
  }, []);

  // Real-time listeners
  useEffect(() => {
    const unsubInstitutions = onSnapshot(collection(db, 'institutions'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as Institution[];
      setInstitutions(data);
    });

    const unsubUsers = onSnapshot(collection(db, 'approved_users'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(data);
    });

    return () => {
      unsubInstitutions();
      unsubUsers();
    };
  }, []);

  // Load data when category changes
  useEffect(() => {
    if (activeCategory === 'security' && activeSubCategory === 'audit-logs') {
      loadAuditLogs();
    }
    if (activeCategory === 'users' && activeSubCategory === 'password-reset') {
      loadPasswordResetRequests();
    }
    if (activeCategory === 'overview' && activeSubCategory === 'announcements') {
      loadAnnouncements();
    }
  }, [activeCategory, activeSubCategory]);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [stats, health, instStats] = await Promise.all([
        getSystemStats(),
        getSystemHealth(),
        getAllInstitutionsWithStats(),
      ]);
      setSystemStats(stats);
      setSystemHealth(health);
      setInstitutionStats(instStats);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await getAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    }
  };

  const loadPasswordResetRequests = async () => {
    try {
      const requests = await getPasswordResetRequests();
      setPasswordResetRequests(requests);
    } catch (err) {
      console.error('Error loading password reset requests:', err);
    }
  };

  const loadAnnouncements = async () => {
    try {
      const data = await getAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      console.error('Error loading announcements:', err);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
    setSuccess('Data refreshed successfully');
    setTimeout(() => setSuccess(''), 3000);
  };

  // ============================================
  // HANDLERS
  // ============================================

  const handleCategoryChange = (category: MainCategory) => {
    setActiveCategory(category);
    const categoryConfig = CATEGORIES.find((c) => c.id === category);
    if (categoryConfig && categoryConfig.subCategories.length > 0) {
      setActiveSubCategory(categoryConfig.subCategories[0].id);
    }
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const currentCategory = CATEGORIES.find((c) => c.id === activeCategory);

  const renderStatCard = (
    label: string,
    value: number | string,
    icon: React.ReactNode,
    color: string,
    change?: number
  ) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-6 rounded-2xl bg-gradient-to-br ${color} text-white shadow-lg`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-white/20 rounded-xl">{icon}</div>
        {change !== undefined && (
          <span className={`text-sm font-medium ${change >= 0 ? 'text-green-200' : 'text-red-200'}`}>
            {change >= 0 ? '+' : ''}
            {change}%
          </span>
        )}
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm text-white/80 mt-1">{label}</p>
    </motion.div>
  );

  // ============================================
  // CONTENT RENDERERS
  // ============================================

  const renderOverviewContent = () => {
    if (activeSubCategory === 'system-health') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {renderStatCard(
              'Total Patients',
              systemStats?.totalPatients || 0,
              <Icons.Patients />,
              'from-violet-500 to-purple-600'
            )}
            {renderStatCard(
              'Active Patients',
              systemStats?.activePatients || 0,
              <Icons.Activity />,
              'from-blue-500 to-cyan-600'
            )}
            {renderStatCard(
              'Total Users',
              systemStats?.totalUsers || 0,
              <Icons.Users />,
              'from-emerald-500 to-teal-600'
            )}
            {renderStatCard(
              'Institutions',
              systemStats?.totalInstitutions || 0,
              <Icons.Hospital />,
              'from-amber-500 to-orange-600'
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SystemHealthPanel />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Today's Activity</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Icons.Plus />
                    </div>
                    <span className="font-medium text-slate-700">Admissions Today</span>
                  </div>
                  <span className="text-2xl font-bold text-green-600">
                    {systemStats?.totalAdmissionsToday || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icons.Check />
                    </div>
                    <span className="font-medium text-slate-700">Discharges Today</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">
                    {systemStats?.totalDischargesToday || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Icons.Clinical />
                    </div>
                    <span className="font-medium text-slate-700">Medications in DB</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-600">
                    {systemStats?.totalMedications || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-green-50 rounded-xl border border-green-200">
              <p className="text-sm text-green-600 font-medium">Discharged</p>
              <p className="text-2xl font-bold text-green-700">{systemStats?.dischargedPatients || 0}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-xl border border-red-200">
              <p className="text-sm text-red-600 font-medium">Deceased</p>
              <p className="text-2xl font-bold text-red-700">{systemStats?.deceasedPatients || 0}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
              <p className="text-sm text-orange-600 font-medium">Referred</p>
              <p className="text-2xl font-bold text-orange-700">{systemStats?.referredPatients || 0}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-sm text-slate-600 font-medium">Database Status</p>
              <p className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${systemHealth?.status === 'healthy' ? 'bg-green-500' : systemHealth?.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                {systemHealth?.status || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (activeSubCategory === 'quick-stats') {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">Institution Performance Overview</h2>
          <div className="grid gap-4">
            {institutionStats.map((inst) => (
              <div
                key={inst.institutionId}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800">{inst.institutionName}</h3>
                  <button
                    onClick={() => onViewInstitutionDashboard?.(inst.institutionId, inst.institutionName)}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    View Dashboard
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Total Patients</p>
                    <p className="text-xl font-bold text-slate-800">{inst.totalPatients}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Active</p>
                    <p className="text-xl font-bold text-blue-600">{inst.activePatients}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Discharged</p>
                    <p className="text-xl font-bold text-green-600">{inst.discharged}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Users</p>
                    <p className="text-xl font-bold text-purple-600">{inst.totalUsers}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Bed Occupancy</p>
                    <p className="text-xl font-bold text-amber-600">{inst.bedOccupancy}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeSubCategory === 'announcements') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">System Announcements</h2>
            <button
              onClick={() => {/* Show add announcement modal */}}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors flex items-center gap-2"
            >
              <Icons.Plus />
              New Announcement
            </button>
          </div>
          <div className="space-y-4">
            {announcements.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No announcements yet
              </div>
            ) : (
              announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className={`p-6 rounded-xl border ${
                    announcement.priority === 'high'
                      ? 'bg-red-50 border-red-200'
                      : announcement.priority === 'medium'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800">{announcement.title}</h3>
                      <p className="text-slate-600 mt-1">{announcement.message}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(announcement.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleAnnouncement(announcement.id, !announcement.active)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          announcement.active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {announcement.active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => deleteAnnouncement(announcement.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    return <div>Select a subcategory</div>;
  };

  const renderInstitutionsContent = () => {
    if (activeSubCategory === 'manage') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">Manage Institutions</h2>
            <button
              onClick={() => setActiveSubCategory('add-new')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Icons.Plus />
              Add Institution
            </button>
          </div>
          <div className="grid gap-4">
            {institutions.map((inst) => (
              <div
                key={inst.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{inst.name}</h3>
                    <p className="text-sm text-slate-500">
                      {inst.district}, {inst.state}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">Admin: {inst.adminEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onViewInstitutionDashboard?.(inst.id, inst.name)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="View Dashboard"
                    >
                      <Icons.Eye />
                    </button>
                    <button
                      onClick={() => setSelectedInstitution(inst)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                      title="Edit"
                    >
                      <Icons.Edit />
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {inst.facilities?.map((facility) => (
                    <span
                      key={facility}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium"
                    >
                      {facility}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return <div className="text-slate-500">Select a subcategory</div>;
  };

  const renderUsersContent = () => {
    if (activeSubCategory === 'all-users') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">All Users ({users.length})</h2>
            <button
              onClick={() => setActiveSubCategory('add-user')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Icons.Plus />
              Add User
            </button>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Institution</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.slice(0, 20).map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-800">{user.displayName || user.email}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        user.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'Doctor' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{user.institutionName || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        user.enabled !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.enabled !== false ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                        <Icons.Edit />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeSubCategory === 'password-reset') {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">Password Reset Requests</h2>
          <div className="space-y-4">
            {passwordResetRequests.length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
                No pending password reset requests
              </div>
            ) : (
              passwordResetRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">{request.userName}</p>
                      <p className="text-sm text-slate-500">{request.userEmail}</p>
                      <p className="text-sm text-slate-500">
                        Institution: {request.institutionName}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Requested: {new Date(request.requestedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => approvePasswordResetRequest(request.id, 'NewPass123!')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => rejectPasswordResetRequest(request.id)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    return <div className="text-slate-500">Select a subcategory</div>;
  };

  const renderPatientsContent = () => {
    if (activeSubCategory === 'analytics') {
      return <AdvancedAnalyticsDashboard institutions={institutions} />;
    }

    return <div className="text-slate-500">Select a subcategory</div>;
  };

  const renderClinicalContent = () => {
    if (activeSubCategory === 'medications') {
      return <MedicationManagementPanel userEmail={userEmail} isEmbedded />;
    }

    if (activeSubCategory === 'indications') {
      return <AdmissionIndicationsManager userEmail={userEmail} />;
    }

    if (activeSubCategory === 'observation-indications') {
      return <ObservationIndicationsManager userEmail={userEmail} />;
    }

    return <div className="text-slate-500">Select a subcategory</div>;
  };

  const renderAIContent = () => {
    if (activeSubCategory === 'stt') {
      return <STTSettingsPanel />;
    }

    if (activeSubCategory === 'clinical-ai') {
      return <ClinicalNoteAISettingsPanel />;
    }

    return <div className="text-slate-500">Select a subcategory</div>;
  };

  const renderReportsContent = () => {
    if (activeSubCategory === 'supabase') {
      return (
        <ReportsPage
          institutionId="all"
          institutionName="All Institutions"
          onBack={() => setActiveSubCategory('generate')}
          userRole={UserRole.SuperAdmin}
        />
      );
    }

    if (activeSubCategory === 'export') {
      return (
        <DataExportPage
          institutionId="all"
          institutionName="All Institutions"
          onBack={() => setActiveSubCategory('generate')}
          userRole={UserRole.SuperAdmin}
        />
      );
    }

    if (activeSubCategory === 'generate') {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">Reports & Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => setActiveSubCategory('supabase')}
              className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-cyan-100 rounded-xl">
                  <Icons.Reports />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Supabase Reports</h3>
              </div>
              <p className="text-slate-600">View monthly summaries, patient hierarchies, and outcome statistics from Supabase.</p>
            </button>
            <button
              onClick={() => setActiveSubCategory('export')}
              className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <Icons.Download />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Data Export</h3>
              </div>
              <p className="text-slate-600">Export patient data, mortality records, and hierarchical data to CSV.</p>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Reports & Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setActiveSubCategory('supabase')}
            className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-cyan-100 rounded-xl">
                <Icons.Reports />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Supabase Reports</h3>
            </div>
            <p className="text-slate-600">View monthly summaries, patient hierarchies, and outcome statistics.</p>
          </button>
          <button
            onClick={() => setActiveSubCategory('export')}
            className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <Icons.Download />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Data Export</h3>
            </div>
            <p className="text-slate-600">Export patient data, mortality records, and hierarchical data to CSV.</p>
          </button>
        </div>
      </div>
    );
  };

  const renderSecurityContent = () => {
    if (activeSubCategory === 'audit-logs') {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">Audit Logs</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Performed By</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Target</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-800">{log.action}</td>
                      <td className="px-6 py-4 text-slate-600">{log.performedByEmail}</td>
                      <td className="px-6 py-4 text-slate-600">{log.targetType}: {log.targetId}</td>
                      <td className="px-6 py-4 text-slate-500 text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return <div className="text-slate-500">Select a subcategory</div>;
  };

  const renderSettingsContent = () => {
    if (activeSubCategory === 'migration') {
      return <DataMigrationPanel userEmail={userEmail} />;
    }

    if (activeSubCategory === 'general') {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">General Settings</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <p className="text-slate-500">System settings coming soon...</p>
          </div>
        </div>
      );
    }

    return <div className="text-slate-500">Select a subcategory</div>;
  };

  const renderContent = () => {
    switch (activeCategory) {
      case 'overview':
        return renderOverviewContent();
      case 'institutions':
        return renderInstitutionsContent();
      case 'users':
        return renderUsersContent();
      case 'patients':
        return renderPatientsContent();
      case 'clinical':
        return renderClinicalContent();
      case 'ai':
        return renderAIContent();
      case 'reports':
        return renderReportsContent();
      case 'security':
        return renderSecurityContent();
      case 'settings':
        return renderSettingsContent();
      default:
        return <div>Select a category</div>;
    }
  };

  // ============================================
  // MAIN RENDER
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading SuperAdmin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-20' : 'w-72'
        } bg-slate-900 text-white flex flex-col transition-all duration-300 fixed h-full z-40`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold">N</span>
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="font-bold text-lg">NeoLink</h1>
                <p className="text-xs text-slate-400">Super Admin</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;

            return (
              <div key={category.id}>
                <button
                  onClick={() => handleCategoryChange(category.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? `bg-gradient-to-r ${category.color} text-white shadow-lg`
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon />
                  {!sidebarCollapsed && (
                    <>
                      <span className="font-medium flex-1 text-left">{category.label}</span>
                      {isActive && <Icons.ChevronRight />}
                    </>
                  )}
                </button>

                {/* Sub-categories */}
                {!sidebarCollapsed && isActive && (
                  <div className="mt-2 ml-4 space-y-1">
                    {category.subCategories.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => setActiveSubCategory(sub.id)}
                        className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                          activeSubCategory === sub.id
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            {sidebarCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronRight />}
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
          <button
            onClick={onBack}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
          >
            <Icons.X />
            {!sidebarCollapsed && <span>Exit Admin</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 ${sidebarCollapsed ? 'ml-20' : 'ml-72'} transition-all duration-300`}
      >
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{currentCategory?.label}</h1>
              <p className="text-sm text-slate-500">
                Welcome back, {userEmail}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Icons.Search />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-100 border-0 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Refresh */}
              <button
                onClick={refreshData}
                disabled={refreshing}
                className={`p-2 rounded-xl hover:bg-slate-100 transition-colors ${
                  refreshing ? 'animate-spin' : ''
                }`}
              >
                <Icons.Refresh />
              </button>

              {/* Notifications */}
              <button className="p-2 rounded-xl hover:bg-slate-100 transition-colors relative">
                <Icons.Bell />
                {passwordResetRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {passwordResetRequests.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8">
          {/* Alerts */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700"
              >
                {error}
                <button onClick={() => setError('')} className="float-right">
                  <Icons.X />
                </button>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700"
              >
                {success}
                <button onClick={() => setSuccess('')} className="float-right">
                  <Icons.X />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content */}
          {renderContent()}
        </div>
      </main>

      {/* Credentials Modal */}
      {showCredentialsModal && (
        <CredentialsModal
          isOpen={showCredentialsModal}
          onClose={() => setShowCredentialsModal(false)}
          credentials={createdCredentials}
        />
      )}

      {/* Edit Institution Modal */}
      <AnimatePresence>
        {selectedInstitution && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedInstitution(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Edit Institution</h2>
                <button
                  onClick={() => setSelectedInstitution(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Icons.X />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Institution Name</label>
                  <input
                    type="text"
                    value={selectedInstitution.name}
                    onChange={(e) => setSelectedInstitution({ ...selectedInstitution, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin Email</label>
                  <input
                    type="email"
                    value={selectedInstitution.adminEmail || ''}
                    onChange={(e) => setSelectedInstitution({ ...selectedInstitution, adminEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">District</label>
                    <input
                      type="text"
                      value={selectedInstitution.district || ''}
                      onChange={(e) => setSelectedInstitution({ ...selectedInstitution, district: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      value={selectedInstitution.state || ''}
                      onChange={(e) => setSelectedInstitution({ ...selectedInstitution, state: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Facilities</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(Unit).map((unit) => (
                      <button
                        key={unit}
                        onClick={() => {
                          const facilities = selectedInstitution.facilities || [];
                          const newFacilities = facilities.includes(unit)
                            ? facilities.filter((f) => f !== unit)
                            : [...facilities, unit];
                          setSelectedInstitution({ ...selectedInstitution, facilities: newFacilities });
                        }}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          selectedInstitution.facilities?.includes(unit)
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Bed Capacity</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* NICU Inborn */}
                    <div className="flex items-center gap-2 p-3 bg-sky-50 rounded-lg">
                      <label className="text-sm text-slate-700 font-medium flex-1">NICU Inborn</label>
                      <input
                        type="number"
                        min="0"
                        value={selectedInstitution.bedCapacity?.NICU_INBORN || 0}
                        onChange={(e) => setSelectedInstitution({
                          ...selectedInstitution,
                          bedCapacity: {
                            ...selectedInstitution.bedCapacity,
                            NICU_INBORN: parseInt(e.target.value) || 0
                          }
                        })}
                        className="w-20 px-3 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                      />
                    </div>
                    {/* NICU Outborn */}
                    <div className="flex items-center gap-2 p-3 bg-sky-50 rounded-lg">
                      <label className="text-sm text-slate-700 font-medium flex-1">NICU Outborn</label>
                      <input
                        type="number"
                        min="0"
                        value={selectedInstitution.bedCapacity?.NICU_OUTBORN || 0}
                        onChange={(e) => setSelectedInstitution({
                          ...selectedInstitution,
                          bedCapacity: {
                            ...selectedInstitution.bedCapacity,
                            NICU_OUTBORN: parseInt(e.target.value) || 0
                          }
                        })}
                        className="w-20 px-3 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                      />
                    </div>
                    {/* PICU */}
                    <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-lg">
                      <label className="text-sm text-slate-700 font-medium flex-1">PICU</label>
                      <input
                        type="number"
                        min="0"
                        value={selectedInstitution.bedCapacity?.PICU || 0}
                        onChange={(e) => setSelectedInstitution({
                          ...selectedInstitution,
                          bedCapacity: {
                            ...selectedInstitution.bedCapacity,
                            PICU: parseInt(e.target.value) || 0
                          }
                        })}
                        className="w-20 px-3 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                      />
                    </div>
                    {/* SNCU */}
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg">
                      <label className="text-sm text-slate-700 font-medium flex-1">SNCU</label>
                      <input
                        type="number"
                        min="0"
                        value={selectedInstitution.bedCapacity?.SNCU || 0}
                        onChange={(e) => setSelectedInstitution({
                          ...selectedInstitution,
                          bedCapacity: {
                            ...selectedInstitution.bedCapacity,
                            SNCU: parseInt(e.target.value) || 0
                          }
                        })}
                        className="w-20 px-3 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                      />
                    </div>
                    {/* HDU */}
                    <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg">
                      <label className="text-sm text-slate-700 font-medium flex-1">HDU</label>
                      <input
                        type="number"
                        min="0"
                        value={selectedInstitution.bedCapacity?.HDU || 0}
                        onChange={(e) => setSelectedInstitution({
                          ...selectedInstitution,
                          bedCapacity: {
                            ...selectedInstitution.bedCapacity,
                            HDU: parseInt(e.target.value) || 0
                          }
                        })}
                        className="w-20 px-3 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                      />
                    </div>
                    {/* General Ward */}
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <label className="text-sm text-slate-700 font-medium flex-1">General Ward</label>
                      <input
                        type="number"
                        min="0"
                        value={selectedInstitution.bedCapacity?.GENERAL_WARD || 0}
                        onChange={(e) => setSelectedInstitution({
                          ...selectedInstitution,
                          bedCapacity: {
                            ...selectedInstitution.bedCapacity,
                            GENERAL_WARD: parseInt(e.target.value) || 0
                          }
                        })}
                        className="w-20 px-3 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => setSelectedInstitution(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      // Build bed capacity object with all fields
                      const bedCapacity = {
                        NICU: (selectedInstitution.bedCapacity?.NICU_INBORN || 0) + (selectedInstitution.bedCapacity?.NICU_OUTBORN || 0), // Total NICU for legacy
                        NICU_INBORN: selectedInstitution.bedCapacity?.NICU_INBORN || 0,
                        NICU_OUTBORN: selectedInstitution.bedCapacity?.NICU_OUTBORN || 0,
                        PICU: selectedInstitution.bedCapacity?.PICU || 0,
                        SNCU: selectedInstitution.bedCapacity?.SNCU || 0,
                        HDU: selectedInstitution.bedCapacity?.HDU || 0,
                        GENERAL_WARD: selectedInstitution.bedCapacity?.GENERAL_WARD || 0
                      };

                      await updateDoc(doc(db, 'institutions', selectedInstitution.id), {
                        name: selectedInstitution.name,
                        adminEmail: selectedInstitution.adminEmail,
                        district: selectedInstitution.district,
                        state: selectedInstitution.state,
                        facilities: selectedInstitution.facilities,
                        bedCapacity: bedCapacity,
                        updatedAt: new Date().toISOString()
                      });
                      setSuccess('Institution updated successfully');
                      setSelectedInstitution(null);
                      setTimeout(() => setSuccess(''), 3000);
                    } catch (err: any) {
                      setError('Failed to update institution: ' + err.message);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SuperAdminDashboardEnhanced;
