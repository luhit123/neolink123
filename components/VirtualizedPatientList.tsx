import React, { memo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { motion } from 'framer-motion';
import { Patient, PatientOutcome } from '../types';
import SimplePatientRow from './SimplePatientRow';
import { glassmorphism } from '../theme/glassmorphism';

export interface VirtualizedPatientListProps {
  patients: Patient[];
  onView: (patient: Patient) => void;
  onEdit?: (patient: Patient) => void;
  canEdit: boolean;
  onQuickRecord?: (patient: Patient) => void;
  onUpdateStatus?: (patient: Patient, status: PatientOutcome) => void;
  onGenerateDischarge?: (patient: Patient) => void;
  onViewDischargeCertificate?: (patient: Patient) => void;
  onPreviewDischarge?: (patient: Patient) => void;
  onDownloadDischarge?: (patient: Patient) => void;
  onDeathCertificate?: (patient: Patient) => void;
  onStepDown?: (patient: Patient) => void;
  onRefer?: (patient: Patient) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (patientId: string) => void;
}

export const VirtualizedPatientList: React.FC<VirtualizedPatientListProps> = memo(
  ({ patients, onView, onEdit, canEdit, onQuickRecord, onUpdateStatus, onGenerateDischarge, onViewDischargeCertificate, onPreviewDischarge, onDownloadDischarge, onDeathCertificate, onStepDown, onRefer, selectionMode, selectedIds, onToggleSelection }) => {
    if (patients.length === 0) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={glassmorphism.animation.smooth}
          className="flex flex-col items-center justify-center py-16 px-4"
        >
          <svg
            className="w-24 h-24 text-slate-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Patients Found</h3>
          <p className="text-sm text-slate-500 text-center max-w-md">
            There are no patients matching your current filters. Try adjusting your search criteria or date range.
          </p>
        </motion.div>
      );
    }

    return (
      <Virtuoso
        className="h-full w-full"
        data={patients}
        overscan={5}
        increaseViewportBy={{ top: 200, bottom: 200 }}
        itemContent={(index, patient) => (
          <SimplePatientRow
            key={patient.id}
            patient={patient}
            onClick={() => selectionMode && onToggleSelection ? onToggleSelection(patient.id) : onView(patient)}
            onQuickRecord={onQuickRecord}
            onUpdateStatus={onUpdateStatus}
            onGenerateDischarge={onGenerateDischarge}
            onViewDischargeCertificate={onViewDischargeCertificate}
            onPreviewDischarge={onPreviewDischarge}
            onDownloadDischarge={onDownloadDischarge}
            onDeathCertificate={onDeathCertificate}
            onStepDown={onStepDown}
            onRefer={onRefer}
            selectionMode={selectionMode}
            isSelected={selectedIds?.has(patient.id)}
            onToggleSelection={onToggleSelection}
          />
        )}
      />
    );
  }
);

VirtualizedPatientList.displayName = 'VirtualizedPatientList';

export const GridVirtualizedPatientList: React.FC<VirtualizedPatientListProps> = memo(
  ({ patients, onView, onEdit, canEdit }) => {
    const itemsPerRow = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;

    if (patients.length === 0) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={glassmorphism.animation.smooth}
          className="flex flex-col items-center justify-center py-16"
        >
          <svg
            className="w-24 h-24 text-slate-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Patients Found</h3>
          <p className="text-sm text-slate-500 text-center max-w-md">
            There are no patients matching your current filters.
          </p>
        </motion.div>
      );
    }

    return (
      <Virtuoso
        style={{ height: '100%', width: '100%' }}
        data={patients}
        overscan={2}
        itemContent={(index, patient) => (
          <SimplePatientRow
            key={patient.id}
            patient={patient}
            onClick={() => onView(patient)}
          />
        )}
      />
    );
  }
);

GridVirtualizedPatientList.displayName = 'GridVirtualizedPatientList';

export default VirtualizedPatientList;
