import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient, PatientOutcome } from '../types';
import { MoreVertical, Mic, FileText, ArrowDownCircle, AlertTriangle, UserX, Send, CheckCircle, Activity, X, Eye, Download } from 'lucide-react';

interface PatientActionMenuProps {
  patient: Patient;
  onQuickRecord?: (patient: Patient) => void;
  onUpdateStatus?: (patient: Patient, status: PatientOutcome) => void;
  onGenerateDischarge?: (patient: Patient) => void;
  onViewDischargeCertificate?: (patient: Patient) => void;
  onPreviewDischarge?: (patient: Patient) => void;
  onDownloadDischarge?: (patient: Patient) => void;
  onDeathCertificate?: (patient: Patient) => void;
  onStepDown?: (patient: Patient) => void;
  onRefer?: (patient: Patient) => void;
  onViewDetails?: (patient: Patient) => void;
}

const PatientActionMenu: React.FC<PatientActionMenuProps> = ({
  patient,
  onQuickRecord,
  onUpdateStatus,
  onGenerateDischarge,
  onViewDischargeCertificate,
  onPreviewDischarge,
  onDownloadDischarge,
  onDeathCertificate,
  onStepDown,
  onRefer,
  onViewDetails
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showStatusSubmenu, setShowStatusSubmenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, showAbove: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate menu position when opened
  const updateMenuPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 320; // Approximate max menu height
      const menuWidth = 208; // w-52 = 13rem = 208px
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Check if menu should appear above or below
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const showAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;

      // Calculate left position, ensuring menu stays within viewport
      let left = rect.right - menuWidth;
      if (left < 8) left = 8;
      if (left + menuWidth > viewportWidth - 8) left = viewportWidth - menuWidth - 8;

      setMenuPosition({
        top: showAbove ? rect.top : rect.bottom + 4,
        left,
        showAbove
      });
    }
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
        setShowStatusSubmenu(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        setIsOpen(false);
        setShowStatusSubmenu(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      updateMenuPosition();
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, updateMenuPosition]);

  const handleAction = (e: React.MouseEvent, callback?: () => void) => {
    e.stopPropagation();
    if (callback) {
      callback();
    }
    setIsOpen(false);
    setShowStatusSubmenu(false);
  };

  const isActive = patient.outcome === 'In Progress';
  const isDeceased = patient.outcome === 'Deceased';
  const isDischarged = patient.outcome === 'Discharged';

  const statusOptions: { value: PatientOutcome; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
    { value: 'In Progress', label: 'In Progress', icon: <Activity className="w-4 h-4" />, color: 'text-blue-600', bgColor: 'hover:bg-blue-50' },
    { value: 'Discharged', label: 'Discharged', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600', bgColor: 'hover:bg-green-50' },
    { value: 'Step Down', label: 'Step Down', icon: <ArrowDownCircle className="w-4 h-4" />, color: 'text-amber-600', bgColor: 'hover:bg-amber-50' },
    { value: 'Referred', label: 'Referred', icon: <Send className="w-4 h-4" />, color: 'text-purple-600', bgColor: 'hover:bg-purple-50' },
    { value: 'Deceased', label: 'Deceased', icon: <UserX className="w-4 h-4" />, color: 'text-red-600', bgColor: 'hover:bg-red-50' },
  ];

  const dropdownMenu = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          className="fixed w-52 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
          style={{
            top: menuPosition.showAbove ? 'auto' : menuPosition.top,
            bottom: menuPosition.showAbove ? `calc(100vh - ${menuPosition.top}px + 4px)` : 'auto',
            left: menuPosition.left,
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3 py-2 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
            <p className="font-bold text-sm truncate">{patient.name}</p>
            <p className="text-xs text-slate-300">Quick Actions</p>
          </div>

          <div className="py-1 max-h-64 overflow-y-auto">
            {/* Update Status */}
            {onUpdateStatus && (
              <div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStatusSubmenu(!showStatusSubmenu);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-blue-100">
                      <Activity className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-medium text-slate-700 text-sm">Update Status</span>
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${showStatusSubmenu ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Status Submenu */}
                <AnimatePresence>
                  {showStatusSubmenu && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-slate-50 border-y border-slate-100"
                    >
                      {statusOptions.map((status) => (
                        <button
                          key={status.value}
                          onClick={(e) => handleAction(e, () => onUpdateStatus(patient, status.value))}
                          disabled={patient.outcome === status.value}
                          className={`w-full px-4 py-2 text-left flex items-center gap-2 ${status.bgColor} transition-colors ${
                            patient.outcome === status.value ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''
                          }`}
                        >
                          <span className={status.color}>{status.icon}</span>
                          <span className={`text-xs font-medium ${status.color}`}>
                            {status.label}
                            {patient.outcome === status.value && ' (Current)'}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Divider */}
            <div className="my-1 border-t border-slate-100" />

            {/* Discharge Certificate Section */}
            {isDischarged && patient.savedDischargeSummary && (
              <>
                <div className="px-3 py-1.5 bg-green-50 border-b border-green-100">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-green-600" />
                    <span className="font-semibold text-green-700 text-xs">Discharge Certificate</span>
                  </div>
                </div>

                {onPreviewDischarge && (
                  <button
                    onClick={(e) => handleAction(e, () => onPreviewDischarge(patient))}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-green-50 transition-colors"
                  >
                    <div className="p-1 rounded-lg bg-emerald-100">
                      <Eye className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="font-medium text-emerald-700 text-sm">Preview</span>
                  </button>
                )}

                {onDownloadDischarge && (
                  <button
                    onClick={(e) => handleAction(e, () => onDownloadDischarge(patient))}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-green-50 transition-colors"
                  >
                    <div className="p-1 rounded-lg bg-green-100">
                      <Download className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="font-medium text-green-700 text-sm">Download PDF</span>
                  </button>
                )}
              </>
            )}

            {isDischarged && !patient.savedDischargeSummary && (
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-500">
                  <FileText className="w-3 h-3" />
                  <span className="text-xs">No discharge certificate saved</span>
                </div>
              </div>
            )}

            {/* Step Down */}
            {onStepDown && isActive && (
              <button
                onClick={(e) => handleAction(e, () => onStepDown(patient))}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-amber-50 transition-colors"
              >
                <div className="p-1 rounded-lg bg-amber-100">
                  <ArrowDownCircle className="w-4 h-4 text-amber-600" />
                </div>
                <span className="font-medium text-amber-700 text-sm">Step Down</span>
              </button>
            )}

            {/* Refer Patient */}
            {onRefer && isActive && (
              <button
                onClick={(e) => handleAction(e, () => onRefer(patient))}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-purple-50 transition-colors"
              >
                <div className="p-1 rounded-lg bg-purple-100">
                  <Send className="w-4 h-4 text-purple-600" />
                </div>
                <span className="font-medium text-purple-700 text-sm">Refer Patient</span>
              </button>
            )}

            {/* Death Certificate */}
            {onDeathCertificate && isDeceased && (
              <button
                onClick={(e) => handleAction(e, () => onDeathCertificate(patient))}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-red-50 transition-colors"
              >
                <div className="p-1 rounded-lg bg-red-100">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <span className="font-medium text-red-700 text-sm">Death Certificate</span>
              </button>
            )}

            {/* Divider */}
            <div className="my-1 border-t border-slate-100" />

            {/* View Details */}
            {onViewDetails && (
              <button
                onClick={(e) => handleAction(e, () => onViewDetails(patient))}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors"
              >
                <div className="p-1 rounded-lg bg-slate-100">
                  <Eye className="w-4 h-4 text-slate-600" />
                </div>
                <span className="font-medium text-slate-700 text-sm">View Details</span>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative flex items-center gap-1">
      {/* Quick Voice Note Button - Always visible for active patients */}
      {onQuickRecord && isActive && (
        <button
          onClick={(e) => handleAction(e, () => onQuickRecord(patient))}
          className="p-2 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md hover:shadow-lg active:scale-95 transition-all"
          title="Quick Voice Note"
        >
          <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      )}

      {/* Main Action Menu Button */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
          setShowStatusSubmenu(false);
        }}
        className={`p-2 rounded-full transition-all ${
          isOpen
            ? 'bg-slate-700 text-white shadow-md'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300'
        }`}
        title="Patient Actions"
      >
        {isOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />}
      </button>

      {/* Render dropdown menu using Portal */}
      {typeof document !== 'undefined' && createPortal(dropdownMenu, document.body)}
    </div>
  );
};

export default PatientActionMenu;
