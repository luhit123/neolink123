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
import { Institution, UserRole, Unit, PasswordResetRequest, Official } from '../types';
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
// Note: generateUserID and getNextSequenceNumber are not used for officials - they generate inline
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
  ChevronLeft: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
  ArrowLeft: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
  Shield: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Heart: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
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
      { id: 'officials', label: 'Officials' },
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
  const [officials, setOfficials] = useState<Official[]>([]);

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

  // Add User Form State
  const [newUserForm, setNewUserForm] = useState({
    displayName: '',
    email: '',
    role: 'Doctor' as 'Admin' | 'Doctor' | 'Nurse',
    institutionId: '',
    userID: '',
    password: '',
  });
  const [addingUser, setAddingUser] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // Officials Form State
  const [showAddOfficial, setShowAddOfficial] = useState(false);
  const [addingOfficial, setAddingOfficial] = useState(false);
  const [editingOfficial, setEditingOfficial] = useState<Official | null>(null);
  const [officialForm, setOfficialForm] = useState({
    displayName: '',
    email: '',
    designation: '',
    department: '',
    district: '',
    state: '',
    phoneNumber: '',
    canViewAllInstitutions: true,
    assignedInstitutionIds: [] as string[],
  });

  // Institution Form State
  const [addingInstitution, setAddingInstitution] = useState(false);
  const [institutionForm, setInstitutionForm] = useState({
    name: '',
    adminEmail: '',
    institutionType: INSTITUTION_TYPES[0],
    customInstitutionType: '',
    facilities: [Unit.NICU, Unit.PICU] as Unit[],
    address: '',
    village: '',
    postOffice: '',
    pinCode: '',
    district: '',
    state: 'Assam',
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

    const unsubOfficials = onSnapshot(collection(db, 'officials'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Official[];
      setOfficials(data);
    });

    return () => {
      unsubInstitutions();
      unsubUsers();
      unsubOfficials();
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

  // Handle Add User
  const handleAddUser = async () => {
    if (!newUserForm.displayName || !newUserForm.email || !newUserForm.institutionId) {
      setError('Please fill in all required fields');
      return;
    }

    setAddingUser(true);
    setError('');
    try {
      const selectedInst = institutions.find(i => i.id === newUserForm.institutionId);
      const generatedUserID = `${newUserForm.role.toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;
      const generatedPassword = generateAlphanumericPassword(10);

      // Add user to approved_users collection
      await addDoc(collection(db, 'approved_users'), {
        displayName: newUserForm.displayName,
        email: newUserForm.email.toLowerCase(),
        role: newUserForm.role,
        institutionId: newUserForm.institutionId,
        institutionName: selectedInst?.name || '',
        userID: generatedUserID,
        enabled: true,
        createdAt: new Date().toISOString(),
        createdBy: userEmail,
      });

      setCreatedCredentials({
        userName: newUserForm.displayName,
        userEmail: newUserForm.email,
        userID: generatedUserID,
        password: generatedPassword,
        userType: newUserForm.role,
      });
      setShowCredentialsModal(true);

      // Reset form
      setNewUserForm({
        displayName: '',
        email: '',
        role: 'Doctor',
        institutionId: '',
        userID: '',
        password: '',
      });

      setSuccess('User added successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error adding user:', err);
      setError('Failed to add user. Please try again.');
    } finally {
      setAddingUser(false);
    }
  };

  // Handle Add Institution
  const handleAddInstitution = async () => {
    if (!institutionForm.name.trim()) {
      setError('Institution name is required');
      return;
    }

    if (!institutionForm.adminEmail.trim() || !institutionForm.adminEmail.includes('@')) {
      setError('Valid admin email is required');
      return;
    }

    setAddingInstitution(true);
    setError('');

    try {
      // Generate UserID
      const districtName = institutionForm.district || 'UNK';
      const districtPrefix = districtName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
      const existingUserIDs = institutions.filter(inst => inst.userID).map(inst => inst.userID!);
      let sequenceNumber = 1;
      existingUserIDs.forEach(id => {
        if (id.startsWith(districtPrefix)) {
          const num = parseInt(id.replace(districtPrefix, ''), 10);
          if (!isNaN(num) && num >= sequenceNumber) {
            sequenceNumber = num + 1;
          }
        }
      });
      const generatedUserID = `${districtPrefix}${String(sequenceNumber).padStart(3, '0')}`;
      const generatedPassword = generateAlphanumericPassword(10);

      // Create institution document
      const newInstitution = {
        name: institutionForm.name.trim(),
        adminEmail: institutionForm.adminEmail.trim().toLowerCase(),
        userID: generatedUserID,
        password: generatedPassword,
        facilities: institutionForm.facilities,
        address: institutionForm.address || '',
        village: institutionForm.village || '',
        postOffice: institutionForm.postOffice || '',
        pinCode: institutionForm.pinCode || '',
        district: institutionForm.district || '',
        state: institutionForm.state || 'Assam',
        institutionType: institutionForm.institutionType === 'Other'
          ? institutionForm.customInstitutionType.trim()
          : institutionForm.institutionType,
        createdAt: new Date().toISOString(),
        createdBy: userEmail,
      };

      const institutionDoc = await addDoc(collection(db, 'institutions'), newInstitution);

      // Add admin to approved_users
      await addDoc(collection(db, 'approved_users'), {
        uid: '',
        email: institutionForm.adminEmail.trim().toLowerCase(),
        displayName: `${institutionForm.name.trim()} Admin`,
        role: UserRole.Admin,
        institutionId: institutionDoc.id,
        institutionName: institutionForm.name.trim(),
        addedBy: userEmail,
        addedAt: new Date().toISOString(),
        enabled: true,
      });

      // Show credentials
      setCreatedCredentials({
        userName: `${institutionForm.name.trim()} Admin`,
        userEmail: institutionForm.adminEmail,
        userID: generatedUserID,
        password: generatedPassword,
        userType: 'Institution Admin',
      });
      setShowCredentialsModal(true);

      // Reset form
      setInstitutionForm({
        name: '',
        adminEmail: '',
        institutionType: INSTITUTION_TYPES[0],
        customInstitutionType: '',
        facilities: [Unit.NICU, Unit.PICU],
        address: '',
        village: '',
        postOffice: '',
        pinCode: '',
        district: '',
        state: 'Assam',
      });

      setSuccess('Institution created successfully!');
      setActiveSubCategory('manage');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating institution:', err);
      setError('Failed to create institution. Please try again.');
    } finally {
      setAddingInstitution(false);
    }
  };

  // Handle Toggle User Status
  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'approved_users', userId), {
        enabled: !currentStatus,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: userEmail,
      });
      setSuccess(`User ${currentStatus ? 'disabled' : 'enabled'} successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error toggling user status:', err);
      setError('Failed to update user status');
    }
  };

  // Handle Update User Role
  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'approved_users', userId), {
        role: newRole,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: userEmail,
      });
      setSuccess('User role updated successfully');
      setEditingUser(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating user role:', err);
      setError('Failed to update user role');
    }
  };

  // Handle Add Official
  const handleAddOfficial = async () => {
    if (!officialForm.displayName || !officialForm.email || !officialForm.designation) {
      setError('Please fill in all required fields');
      return;
    }

    setAddingOfficial(true);
    setError('');

    try {
      // Get existing officials to generate next sequence number
      const existingUserIDs = officials.map(o => o.userID).filter(id => id && id.startsWith('OFF'));

      // Find the highest sequence number
      let maxSeq = 0;
      existingUserIDs.forEach(id => {
        const numPart = parseInt(id.replace('OFF', ''), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      });

      // Generate UserID: OFF001, OFF002, etc.
      const nextSeq = maxSeq + 1;
      const generatedUserID = `OFF${nextSeq.toString().padStart(3, '0')}`;
      const generatedPassword = generateAlphanumericPassword();

      const newOfficial: Omit<Official, 'id'> = {
        email: officialForm.email.toLowerCase(),
        displayName: officialForm.displayName,
        designation: officialForm.designation,
        department: officialForm.department || undefined,
        district: officialForm.district || undefined,
        state: officialForm.state || undefined,
        phoneNumber: officialForm.phoneNumber || undefined,
        userID: generatedUserID,
        password: generatedPassword,
        enabled: true,
        canViewAllInstitutions: officialForm.canViewAllInstitutions,
        assignedInstitutionIds: officialForm.canViewAllInstitutions ? undefined : officialForm.assignedInstitutionIds,
        addedBy: userEmail,
        addedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'officials'), newOfficial);

      // Log audit event
      await logAuditEvent({
        action: 'CREATE_OFFICIAL',
        performedBy: userEmail,
        targetType: 'official',
        targetId: generatedUserID,
        details: `Created official: ${officialForm.displayName} (${generatedUserID})`,
        status: 'success',
      });

      // Show credentials modal
      setCreatedCredentials({
        userName: officialForm.displayName,
        userEmail: officialForm.email,
        userID: generatedUserID,
        password: generatedPassword,
        userType: 'Official',
      });
      setShowCredentialsModal(true);

      // Reset form
      setOfficialForm({
        displayName: '',
        email: '',
        designation: '',
        department: '',
        district: '',
        state: '',
        phoneNumber: '',
        canViewAllInstitutions: true,
        assignedInstitutionIds: [],
      });
      setShowAddOfficial(false);
      setSuccess('Official created successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error adding official:', err);
      setError(err.message || 'Failed to create official');
    } finally {
      setAddingOfficial(false);
    }
  };

  // Handle Toggle Official Status
  const handleToggleOfficialStatus = async (officialId: string, currentEnabled: boolean) => {
    try {
      await updateDoc(doc(db, 'officials', officialId), {
        enabled: !currentEnabled,
        updatedAt: new Date().toISOString(),
        updatedBy: userEmail,
      });
      setSuccess(`Official ${currentEnabled ? 'disabled' : 'enabled'} successfully`);
      setEditingOfficial(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error toggling official status:', err);
      setError('Failed to update official status');
    }
  };

  // Handle Update Official
  const handleUpdateOfficial = async () => {
    if (!editingOfficial) return;

    try {
      await updateDoc(doc(db, 'officials', editingOfficial.id), {
        displayName: officialForm.displayName || editingOfficial.displayName,
        designation: officialForm.designation || editingOfficial.designation,
        department: officialForm.department || editingOfficial.department,
        district: officialForm.district || editingOfficial.district,
        state: officialForm.state || editingOfficial.state,
        phoneNumber: officialForm.phoneNumber || editingOfficial.phoneNumber,
        canViewAllInstitutions: officialForm.canViewAllInstitutions,
        assignedInstitutionIds: officialForm.canViewAllInstitutions ? [] : officialForm.assignedInstitutionIds,
        updatedAt: new Date().toISOString(),
        updatedBy: userEmail,
      });
      setSuccess('Official updated successfully');
      setEditingOfficial(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating official:', err);
      setError('Failed to update official');
    }
  };

  // Handle Delete Official
  const handleDeleteOfficial = async (officialId: string, officialName: string) => {
    if (!confirm(`Are you sure you want to delete official "${officialName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'officials', officialId));
      await logAuditEvent({
        action: 'DELETE_OFFICIAL',
        performedBy: userEmail,
        targetType: 'official',
        targetId: officialId,
        details: `Deleted official: ${officialName}`,
        status: 'success',
      });
      setSuccess('Official deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting official:', err);
      setError('Failed to delete official');
    }
  };

  // Handle Reset Official Password
  const handleResetOfficialPassword = async (official: Official) => {
    const newPassword = generateAlphanumericPassword();

    try {
      await updateDoc(doc(db, 'officials', official.id), {
        password: newPassword,
        updatedAt: new Date().toISOString(),
        updatedBy: userEmail,
      });

      // Show the new password in credentials modal
      setCreatedCredentials({
        userName: official.displayName,
        userEmail: official.email,
        userID: official.userID || '',
        password: newPassword,
        userType: 'Official (Password Reset)',
      });
      setShowCredentialsModal(true);

      await logAuditEvent({
        action: 'RESET_OFFICIAL_PASSWORD',
        performedBy: userEmail,
        targetType: 'official',
        targetId: official.id,
        details: `Reset password for official: ${official.displayName}`,
        status: 'success',
      });

      setSuccess('Password reset successfully! New credentials are shown in the modal.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Error resetting official password:', err);
      setError('Failed to reset password');
    }
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
              onClick={() => {/* Show add announcement modal */ }}
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
                  className={`p-6 rounded-xl border ${announcement.priority === 'high'
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
                        className={`px-3 py-1 rounded-lg text-sm font-medium ${announcement.active
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

    if (activeSubCategory === 'add-new') {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveSubCategory('manage')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Icons.ChevronLeft />
            </button>
            <h2 className="text-2xl font-bold text-slate-800">Add New Institution</h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            {/* Institution Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Institution Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={institutionForm.name}
                onChange={(e) => setInstitutionForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Gauhati Medical College Hospital"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Admin Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Admin Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={institutionForm.adminEmail}
                onChange={(e) => setInstitutionForm(prev => ({ ...prev, adminEmail: e.target.value }))}
                placeholder="admin@hospital.com"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Institution Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Institution Type
              </label>
              <select
                value={institutionForm.institutionType}
                onChange={(e) => setInstitutionForm(prev => ({ ...prev, institutionType: e.target.value }))}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {INSTITUTION_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {institutionForm.institutionType === 'Other' && (
                <input
                  type="text"
                  value={institutionForm.customInstitutionType}
                  onChange={(e) => setInstitutionForm(prev => ({ ...prev, customInstitutionType: e.target.value }))}
                  placeholder="Specify institution type"
                  className="mt-2 w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {/* Facilities */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Facilities / Units
              </label>
              <div className="flex flex-wrap gap-3">
                {[Unit.NICU, Unit.PICU, Unit.SNCU, Unit.HDU, Unit.GENERAL_WARD].map(facility => (
                  <button
                    key={facility}
                    type="button"
                    onClick={() => {
                      setInstitutionForm(prev => ({
                        ...prev,
                        facilities: prev.facilities.includes(facility)
                          ? prev.facilities.filter(f => f !== facility)
                          : [...prev.facilities, facility]
                      }));
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      institutionForm.facilities.includes(facility)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {facility === Unit.NICU ? 'NICU' :
                     facility === Unit.PICU ? 'PICU' :
                     facility === Unit.SNCU ? 'SNCU' :
                     facility === Unit.HDU ? 'HDU' : 'General Ward'}
                  </button>
                ))}
              </div>
            </div>

            {/* Address Section */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Address Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">District</label>
                  <input
                    type="text"
                    value={institutionForm.district}
                    onChange={(e) => setInstitutionForm(prev => ({ ...prev, district: e.target.value }))}
                    placeholder="e.g., Kamrup Metro"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">State</label>
                  <input
                    type="text"
                    value={institutionForm.state}
                    onChange={(e) => setInstitutionForm(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="e.g., Assam"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Full Address</label>
                  <textarea
                    value={institutionForm.address}
                    onChange={(e) => setInstitutionForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Complete address"
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Village/Ward</label>
                  <input
                    type="text"
                    value={institutionForm.village}
                    onChange={(e) => setInstitutionForm(prev => ({ ...prev, village: e.target.value }))}
                    placeholder="Village or Ward name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Post Office</label>
                  <input
                    type="text"
                    value={institutionForm.postOffice}
                    onChange={(e) => setInstitutionForm(prev => ({ ...prev, postOffice: e.target.value }))}
                    placeholder="Post Office name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={institutionForm.pinCode}
                    onChange={(e) => setInstitutionForm(prev => ({ ...prev, pinCode: e.target.value }))}
                    placeholder="6-digit PIN code"
                    maxLength={6}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => setActiveSubCategory('manage')}
                className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddInstitution}
                disabled={addingInstitution}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {addingInstitution ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Icons.Plus />
                    Create Institution
                  </>
                )}
              </button>
            </div>
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
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${user.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'Doctor' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{user.institutionName || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${user.enabled !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
                        onClick={() => approvePasswordResetRequest(request.id, 'NewPass123!', userEmail)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => rejectPasswordResetRequest(request.id, userEmail)}
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

    // Add User Form
    if (activeSubCategory === 'add-user') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">Add New User</h2>
            <button
              onClick={() => setActiveSubCategory('all-users')}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium flex items-center gap-2"
            >
              <Icons.ArrowLeft />
              Back to Users
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-2xl">
            <div className="space-y-6">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUserForm.displayName}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="Enter full name"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Admin', 'Doctor', 'Nurse'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setNewUserForm(prev => ({ ...prev, role }))}
                      className={`p-4 rounded-xl border-2 transition-all ${newUserForm.role === role
                        ? role === 'Admin' ? 'border-purple-500 bg-purple-50 text-purple-700' :
                          role === 'Doctor' ? 'border-blue-500 bg-blue-50 text-blue-700' :
                            'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                    >
                      <div className="text-center">
                        <div className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center ${role === 'Admin' ? 'bg-purple-100' :
                          role === 'Doctor' ? 'bg-blue-100' : 'bg-green-100'
                          }`}>
                          {role === 'Admin' ? <Icons.Shield /> :
                            role === 'Doctor' ? <Icons.Users /> : <Icons.Heart />}
                        </div>
                        <span className="font-semibold">{role}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Institution Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Institution <span className="text-red-500">*</span>
                </label>
                <select
                  value={newUserForm.institutionId}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, institutionId: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select an institution</option>
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>

              {/* Role Permissions Info */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="font-semibold text-slate-700 mb-2">Role Permissions</h4>
                <div className="text-sm text-slate-600 space-y-1">
                  {newUserForm.role === 'Admin' && (
                    <>
                      <p>• Full access to institution dashboard</p>
                      <p>• Can manage doctors and nurses</p>
                      <p>• Can view all patient records</p>
                      <p>• Can generate reports</p>
                    </>
                  )}
                  {newUserForm.role === 'Doctor' && (
                    <>
                      <p>• Can view and edit patient records</p>
                      <p>• Can add clinical notes</p>
                      <p>• Can update patient status</p>
                      <p>• Can refer patients</p>
                    </>
                  )}
                  {newUserForm.role === 'Nurse' && (
                    <>
                      <p>• Can view patient records</p>
                      <p>• Can add vital signs and observations</p>
                      <p>• Can update patient notes</p>
                      <p>• Limited edit permissions</p>
                    </>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleAddUser}
                disabled={addingUser || !newUserForm.displayName || !newUserForm.email || !newUserForm.institutionId}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {addingUser ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating User...
                  </>
                ) : (
                  <>
                    <Icons.Plus />
                    Create User
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Roles & Permissions
    if (activeSubCategory === 'roles') {
      const roleGroups = {
        Admin: users.filter(u => u.role === 'Admin'),
        Doctor: users.filter(u => u.role === 'Doctor'),
        Nurse: users.filter(u => u.role === 'Nurse'),
      };

      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">Roles & Permissions Management</h2>

          {/* Role Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(roleGroups).map(([role, roleUsers]) => (
              <div
                key={role}
                className={`bg-white rounded-2xl shadow-lg border-2 p-6 ${role === 'Admin' ? 'border-purple-200' :
                  role === 'Doctor' ? 'border-blue-200' : 'border-green-200'
                  }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${role === 'Admin' ? 'bg-purple-100 text-purple-600' :
                    role === 'Doctor' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                    }`}>
                    {role === 'Admin' ? <Icons.Shield /> :
                      role === 'Doctor' ? <Icons.Users /> : <Icons.Heart />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{role}s</h3>
                    <p className="text-sm text-slate-500">{roleUsers.length} users</p>
                  </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {roleUsers.slice(0, 10).map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 text-sm truncate">{user.displayName || user.email}</p>
                        <p className="text-xs text-slate-500 truncate">{user.institutionName}</p>
                      </div>
                      <button
                        onClick={() => setEditingUser(user)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                      >
                        <Icons.Edit />
                      </button>
                    </div>
                  ))}
                  {roleUsers.length > 10 && (
                    <p className="text-xs text-slate-400 text-center pt-2">+{roleUsers.length - 10} more</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Permissions Matrix */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800">Permissions Matrix</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Permission</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-purple-600">Admin</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-blue-600">Doctor</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-green-600">Nurse</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { name: 'View Patients', admin: true, doctor: true, nurse: true },
                    { name: 'Add Patients', admin: true, doctor: true, nurse: false },
                    { name: 'Edit Patients', admin: true, doctor: true, nurse: false },
                    { name: 'Delete Patients', admin: true, doctor: false, nurse: false },
                    { name: 'View Clinical Notes', admin: true, doctor: true, nurse: true },
                    { name: 'Add Clinical Notes', admin: true, doctor: true, nurse: true },
                    { name: 'Update Patient Status', admin: true, doctor: true, nurse: true },
                    { name: 'Discharge Patients', admin: true, doctor: true, nurse: false },
                    { name: 'Refer Patients', admin: true, doctor: true, nurse: true },
                    { name: 'Generate Reports', admin: true, doctor: true, nurse: true },
                    { name: 'Manage Users', admin: true, doctor: false, nurse: false },
                    { name: 'View Analytics', admin: true, doctor: true, nurse: false },
                    { name: 'Access AI Reports', admin: true, doctor: true, nurse: true },
                  ].map((perm) => (
                    <tr key={perm.name} className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-sm font-medium text-slate-700">{perm.name}</td>
                      <td className="px-6 py-3 text-center">
                        {perm.admin ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full">✓</span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 text-red-600 rounded-full">✗</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        {perm.doctor ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full">✓</span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 text-red-600 rounded-full">✗</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        {perm.nurse ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full">✓</span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 text-red-600 rounded-full">✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit User Role Modal */}
          {editingUser && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Edit User Role</h3>
                <div className="mb-4">
                  <p className="font-medium text-slate-700">{editingUser.displayName || editingUser.email}</p>
                  <p className="text-sm text-slate-500">{editingUser.email}</p>
                </div>

                <div className="space-y-3 mb-6">
                  <label className="block text-sm font-semibold text-slate-700">Select New Role</label>
                  {(['Admin', 'Doctor', 'Nurse'] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => handleUpdateUserRole(editingUser.id, role)}
                      className={`w-full p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${editingUser.role === role
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                        }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${role === 'Admin' ? 'bg-purple-100 text-purple-600' :
                        role === 'Doctor' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                        }`}>
                        {role === 'Admin' ? <Icons.Shield /> :
                          role === 'Doctor' ? <Icons.Users /> : <Icons.Heart />}
                      </div>
                      <span className="font-medium">{role}</span>
                      {editingUser.role === role && <span className="ml-auto text-emerald-600 text-sm font-medium">Current</span>}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleToggleUserStatus(editingUser.id, editingUser.enabled !== false)}
                    className={`flex-1 py-2 rounded-lg font-medium ${editingUser.enabled !== false
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                  >
                    {editingUser.enabled !== false ? 'Disable User' : 'Enable User'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // User Activity
    if (activeSubCategory === 'activity') {
      const recentUsers = [...users].sort((a, b) => {
        const dateA = new Date(a.lastLoginAt || a.createdAt || 0);
        const dateB = new Date(b.lastLoginAt || b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });

      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">User Activity</h2>

          {/* Activity Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-3xl font-bold text-emerald-600">{users.filter(u => u.enabled !== false).length}</p>
              <p className="text-sm text-slate-500">Active Users</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-3xl font-bold text-red-600">{users.filter(u => u.enabled === false).length}</p>
              <p className="text-sm text-slate-500">Disabled Users</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-3xl font-bold text-blue-600">
                {users.filter(u => {
                  const created = new Date(u.createdAt);
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return created > weekAgo;
                }).length}
              </p>
              <p className="text-sm text-slate-500">New This Week</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-3xl font-bold text-slate-600">{institutions.length}</p>
              <p className="text-sm text-slate-500">Institutions</p>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800">Recent User Activity</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Institution</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentUsers.slice(0, 25).map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-800">{user.displayName || 'N/A'}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${user.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                          user.role === 'Doctor' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm">{user.institutionName || '-'}</td>
                      <td className="px-6 py-4 text-slate-600 text-sm">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${user.enabled !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                          {user.enabled !== false ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    // Officials Management
    if (activeSubCategory === 'officials') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Government Officials</h2>
              <p className="text-slate-500 text-sm mt-1">Manage health officials with view-only access to institutions</p>
            </div>
            <button
              onClick={() => setShowAddOfficial(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <Icons.Plus />
              Add Official
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-3xl font-bold text-indigo-600">{officials.length}</p>
              <p className="text-sm text-slate-500">Total Officials</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-3xl font-bold text-emerald-600">{officials.filter(o => o.enabled).length}</p>
              <p className="text-sm text-slate-500">Active</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-3xl font-bold text-red-600">{officials.filter(o => !o.enabled).length}</p>
              <p className="text-sm text-slate-500">Disabled</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-3xl font-bold text-blue-600">{officials.filter(o => o.canViewAllInstitutions).length}</p>
              <p className="text-sm text-slate-500">Full Access</p>
            </div>
          </div>

          {/* Officials Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Official</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Designation</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">UserID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Access</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {officials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No officials added yet. Click "Add Official" to create one.
                    </td>
                  </tr>
                ) : (
                  officials.map((official) => (
                    <tr key={official.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-800">{official.displayName}</p>
                          <p className="text-sm text-slate-500">{official.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-slate-700">{official.designation}</p>
                          {official.department && (
                            <p className="text-xs text-slate-400">{official.department}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded text-slate-700">
                          {official.userID}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {official.canViewAllInstitutions ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                            All Institutions
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                            {official.assignedInstitutionIds?.length || 0} Assigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${official.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                          {official.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingOfficial(official);
                              setOfficialForm({
                                displayName: official.displayName,
                                email: official.email,
                                designation: official.designation,
                                department: official.department || '',
                                district: official.district || '',
                                state: official.state || '',
                                phoneNumber: official.phoneNumber || '',
                                canViewAllInstitutions: official.canViewAllInstitutions,
                                assignedInstitutionIds: official.assignedInstitutionIds || [],
                              });
                            }}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                            title="Edit Official"
                          >
                            <Icons.Edit />
                          </button>
                          <button
                            onClick={() => handleToggleOfficialStatus(official.id, official.enabled)}
                            className={`p-2 rounded-lg ${official.enabled
                              ? 'text-red-500 hover:bg-red-50'
                              : 'text-green-500 hover:bg-green-50'
                              }`}
                            title={official.enabled ? 'Disable' : 'Enable'}
                          >
                            {official.enabled ? <Icons.EyeOff /> : <Icons.Eye />}
                          </button>
                          <button
                            onClick={() => handleResetOfficialPassword(official)}
                            className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg"
                            title="Reset Password"
                          >
                            <Icons.Key />
                          </button>
                          <button
                            onClick={() => handleDeleteOfficial(official.id, official.displayName)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            title="Delete Official"
                          >
                            <Icons.Trash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add Official Modal */}
          {showAddOfficial && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-2xl">
                  <h3 className="text-xl font-bold">Add New Official</h3>
                  <p className="text-indigo-100 text-sm mt-1">Create a government health official with view-only access</p>
                </div>

                <div className="p-6 space-y-5">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={officialForm.displayName}
                      onChange={(e) => setOfficialForm(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="e.g., Dr. John Smith"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white placeholder-slate-400"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={officialForm.email}
                      onChange={(e) => setOfficialForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="official@health.gov.in"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white placeholder-slate-400"
                    />
                  </div>

                  {/* Designation */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Designation <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={officialForm.designation}
                      onChange={(e) => setOfficialForm(prev => ({ ...prev, designation: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white"
                    >
                      <option value="" className="text-slate-400">Select Designation</option>
                      <option value="Director of Medical Education">Director of Medical Education</option>
                      <option value="Principal cum Chief Superintendent">Principal cum Chief Superintendent</option>
                      <option value="District Health Officer">District Health Officer</option>
                      <option value="Chief Medical Officer">Chief Medical Officer</option>
                      <option value="Joint Director">Joint Director</option>
                      <option value="Deputy Director">Deputy Director</option>
                      <option value="State Nodal Officer">State Nodal Officer</option>
                      <option value="District Nodal Officer">District Nodal Officer</option>
                      <option value="Program Manager">Program Manager</option>
                      <option value="Medical Superintendent">Medical Superintendent</option>
                      <option value="Dean">Dean</option>
                      <option value="Vice Principal">Vice Principal</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Department */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Department</label>
                      <input
                        type="text"
                        value={officialForm.department}
                        onChange={(e) => setOfficialForm(prev => ({ ...prev, department: e.target.value }))}
                        placeholder="e.g., NHM, Health Department"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white placeholder-slate-400"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={officialForm.phoneNumber}
                        onChange={(e) => setOfficialForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        placeholder="+91 9876543210"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white placeholder-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* District */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">District</label>
                      <input
                        type="text"
                        value={officialForm.district}
                        onChange={(e) => setOfficialForm(prev => ({ ...prev, district: e.target.value }))}
                        placeholder="e.g., Kathmandu"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white placeholder-slate-400"
                      />
                    </div>

                    {/* State */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">State/Province</label>
                      <input
                        type="text"
                        value={officialForm.state}
                        onChange={(e) => setOfficialForm(prev => ({ ...prev, state: e.target.value }))}
                        placeholder="e.g., Bagmati"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white placeholder-slate-400"
                      />
                    </div>
                  </div>

                  {/* Access Level */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Institution Access</label>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                          type="radio"
                          checked={officialForm.canViewAllInstitutions}
                          onChange={() => setOfficialForm(prev => ({ ...prev, canViewAllInstitutions: true }))}
                          className="w-5 h-5 text-indigo-600"
                        />
                        <div>
                          <p className="font-medium text-slate-800">All Institutions</p>
                          <p className="text-sm text-slate-500">Can view all institutions in the system</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                          type="radio"
                          checked={!officialForm.canViewAllInstitutions}
                          onChange={() => setOfficialForm(prev => ({ ...prev, canViewAllInstitutions: false }))}
                          className="w-5 h-5 text-indigo-600"
                        />
                        <div>
                          <p className="font-medium text-slate-800">Specific Institutions Only</p>
                          <p className="text-sm text-slate-500">Select specific institutions they can access</p>
                        </div>
                      </label>
                    </div>

                    {/* Institution Selection (if specific) */}
                    {!officialForm.canViewAllInstitutions && (
                      <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Select Institutions
                        </label>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {institutions.map((inst) => (
                            <label key={inst.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={officialForm.assignedInstitutionIds.includes(inst.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setOfficialForm(prev => ({
                                      ...prev,
                                      assignedInstitutionIds: [...prev.assignedInstitutionIds, inst.id]
                                    }));
                                  } else {
                                    setOfficialForm(prev => ({
                                      ...prev,
                                      assignedInstitutionIds: prev.assignedInstitutionIds.filter(id => id !== inst.id)
                                    }));
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 rounded"
                              />
                              <span className="text-sm text-slate-700">{inst.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info Box */}
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Icons.Key />
                      </div>
                      <div>
                        <p className="font-medium text-indigo-800">Login Credentials</p>
                        <p className="text-sm text-indigo-600 mt-1">
                          A unique UserID and password will be automatically generated after creation.
                          Make sure to share these credentials securely with the official.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowAddOfficial(false);
                      setOfficialForm({
                        displayName: '',
                        email: '',
                        designation: '',
                        department: '',
                        district: '',
                        state: '',
                        phoneNumber: '',
                        canViewAllInstitutions: true,
                        assignedInstitutionIds: [],
                      });
                    }}
                    className="px-6 py-2.5 text-slate-700 hover:bg-slate-200 rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddOfficial}
                    disabled={addingOfficial || !officialForm.displayName || !officialForm.email || !officialForm.designation}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {addingOfficial ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Icons.Plus />
                        Create Official
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Edit Official Modal */}
          {editingOfficial && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-2xl">
                  <h3 className="text-xl font-bold text-white">Edit Official</h3>
                  <p className="text-indigo-100 text-sm mt-1">{editingOfficial.email}</p>
                </div>

                <div className="p-6 space-y-5">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={officialForm.displayName}
                      onChange={(e) => setOfficialForm(prev => ({ ...prev, displayName: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white placeholder-slate-400"
                    />
                  </div>

                  {/* Designation */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Designation</label>
                    <select
                      value={officialForm.designation}
                      onChange={(e) => setOfficialForm(prev => ({ ...prev, designation: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white"
                    >
                      <option value="" className="text-slate-400">Select Designation</option>
                      <option value="Director of Medical Education">Director of Medical Education</option>
                      <option value="Principal cum Chief Superintendent">Principal cum Chief Superintendent</option>
                      <option value="District Health Officer">District Health Officer</option>
                      <option value="Chief Medical Officer">Chief Medical Officer</option>
                      <option value="Joint Director">Joint Director</option>
                      <option value="Deputy Director">Deputy Director</option>
                      <option value="State Nodal Officer">State Nodal Officer</option>
                      <option value="District Nodal Officer">District Nodal Officer</option>
                      <option value="Program Manager">Program Manager</option>
                      <option value="Medical Superintendent">Medical Superintendent</option>
                      <option value="Dean">Dean</option>
                      <option value="Vice Principal">Vice Principal</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Department</label>
                      <input
                        type="text"
                        value={officialForm.department}
                        onChange={(e) => setOfficialForm(prev => ({ ...prev, department: e.target.value }))}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white placeholder-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={officialForm.phoneNumber}
                        onChange={(e) => setOfficialForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white placeholder-slate-400"
                      />
                    </div>
                  </div>

                  {/* Access Level */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Institution Access</label>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                          type="radio"
                          checked={officialForm.canViewAllInstitutions}
                          onChange={() => setOfficialForm(prev => ({ ...prev, canViewAllInstitutions: true }))}
                          className="w-5 h-5 text-indigo-600"
                        />
                        <div>
                          <p className="font-medium text-slate-800">All Institutions</p>
                          <p className="text-sm text-slate-500">Can view all institutions</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                          type="radio"
                          checked={!officialForm.canViewAllInstitutions}
                          onChange={() => setOfficialForm(prev => ({ ...prev, canViewAllInstitutions: false }))}
                          className="w-5 h-5 text-indigo-600"
                        />
                        <div>
                          <p className="font-medium text-slate-800">Specific Institutions Only</p>
                          <p className="text-sm text-slate-500">Select specific institutions</p>
                        </div>
                      </label>
                    </div>

                    {!officialForm.canViewAllInstitutions && (
                      <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Select Institutions
                        </label>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {institutions.map((inst) => (
                            <label key={inst.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={officialForm.assignedInstitutionIds.includes(inst.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setOfficialForm(prev => ({
                                      ...prev,
                                      assignedInstitutionIds: [...prev.assignedInstitutionIds, inst.id]
                                    }));
                                  } else {
                                    setOfficialForm(prev => ({
                                      ...prev,
                                      assignedInstitutionIds: prev.assignedInstitutionIds.filter(id => id !== inst.id)
                                    }));
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 rounded"
                              />
                              <span className="text-sm text-slate-700">{inst.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Credentials Info */}
                  <div className="bg-slate-100 rounded-xl p-4">
                    <p className="text-sm text-slate-600">
                      <strong>UserID:</strong> <span className="font-mono">{editingOfficial.userID}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Password can be reset from the Password Requests section if needed.
                    </p>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-between">
                  <button
                    onClick={() => handleToggleOfficialStatus(editingOfficial.id, editingOfficial.enabled)}
                    className={`px-4 py-2 rounded-xl font-medium ${editingOfficial.enabled
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                  >
                    {editingOfficial.enabled ? 'Disable Official' : 'Enable Official'}
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setEditingOfficial(null);
                      }}
                      className="px-6 py-2.5 text-slate-700 hover:bg-slate-200 rounded-xl font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateOfficial}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
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
        className={`${sidebarCollapsed ? 'w-20' : 'w-72'
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
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
                        className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${activeSubCategory === sub.id
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
                className={`p-2 rounded-xl hover:bg-slate-100 transition-colors ${refreshing ? 'animate-spin' : ''
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
          userName={createdCredentials.userName}
          userEmail={createdCredentials.userEmail}
          userID={createdCredentials.userID}
          password={createdCredentials.password}
          userType={createdCredentials.userType}
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
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${selectedInstitution.facilities?.includes(unit)
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
