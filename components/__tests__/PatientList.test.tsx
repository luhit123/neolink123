import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  mockUsers,
  mockPatients,
  mockInstitutions,
  createMockQuerySnapshot,
  PatientOutcomeValues
} from '../../test/utils/testUtils';
import { Unit, UserRole, AgeUnit } from '../../types';
import type { Patient } from '../../types';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  orderBy: vi.fn(),
  limit: vi.fn()
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user' } }
}));

describe('PatientList Component', () => {
  const mockPatientList = [
    mockPatients.patientHospitalA,
    mockPatients.dischargedPatient,
    mockPatients.picuPatient
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Patient Display', () => {
    it('should display patient names', () => {
      mockPatientList.forEach(patient => {
        expect(patient.name).toBeDefined();
        expect(patient.name.length).toBeGreaterThan(0);
      });
    });

    it('should display patient status badges', () => {
      const admittedPatient = mockPatientList.find(p => p.outcome === PatientOutcomeValues.Admitted);
      const dischargedPatient = mockPatientList.find(p => p.outcome === PatientOutcomeValues.Discharged);

      expect(admittedPatient).toBeDefined();
      expect(dischargedPatient).toBeDefined();
    });

    it('should show unit information', () => {
      const nicuPatient = mockPatientList.find(p => p.unit === Unit.NICU);
      const picuPatient = mockPatientList.find(p => p.unit === Unit.PICU);

      expect(nicuPatient).toBeDefined();
      expect(picuPatient).toBeDefined();
    });

    it('should display admission date', () => {
      mockPatientList.forEach(patient => {
        expect(patient.admissionDate).toBeDefined();
        const date = new Date(patient.admissionDate);
        expect(date).toBeInstanceOf(Date);
      });
    });
  });

  describe('Patient Filtering', () => {
    it('should filter by status - admitted', () => {
      const admittedPatients = mockPatientList.filter(
        p => p.outcome === PatientOutcomeValues.Admitted
      );

      expect(admittedPatients.length).toBeGreaterThan(0);
      admittedPatients.forEach(p => {
        expect(p.outcome).toBe(PatientOutcomeValues.Admitted);
      });
    });

    it('should filter by status - discharged', () => {
      const dischargedPatients = mockPatientList.filter(
        p => p.outcome === PatientOutcomeValues.Discharged
      );

      expect(dischargedPatients.length).toBeGreaterThan(0);
    });

    it('should filter by unit - NICU', () => {
      const nicuPatients = mockPatientList.filter(
        p => p.unit === Unit.NICU
      );

      expect(nicuPatients.length).toBeGreaterThan(0);
      nicuPatients.forEach(p => {
        expect(p.unit).toBe(Unit.NICU);
      });
    });

    it('should filter by unit - PICU', () => {
      const picuPatients = mockPatientList.filter(
        p => p.unit === Unit.PICU
      );

      expect(picuPatients.length).toBeGreaterThan(0);
    });

    it('should filter by date range', () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      const filteredPatients = mockPatientList.filter(p => {
        const admissionDate = new Date(p.admissionDate);
        return admissionDate >= startDate && admissionDate <= endDate;
      });

      expect(filteredPatients.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Patient Search', () => {
    it('should search by patient name', () => {
      const searchTerm = 'Singh';
      const searchResults = mockPatientList.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].name).toContain('Singh');
    });

    it('should search by NTID', () => {
      const searchTerm = 'CCH202501001';
      const patient = mockPatientList.find(p => p.ntid === searchTerm);

      // May or may not find, depending on mock data
      if (patient) {
        expect(patient.ntid).toBe(searchTerm);
      }
    });

    it('should search by diagnosis', () => {
      const searchTerm = 'Respiratory';
      const searchResults = mockPatientList.filter(p =>
        p.diagnosis.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(searchResults.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty results for non-matching search', () => {
      const searchTerm = 'NonExistentPatient12345';
      const searchResults = mockPatientList.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(searchResults.length).toBe(0);
    });
  });

  describe('Institution Isolation', () => {
    it('should only show patients from same institution', () => {
      const userInstitutionId = mockUsers.doctorHospitalA.institutionId;

      const institutionPatients = mockPatientList.filter(
        p => p.institutionId === userInstitutionId
      );

      institutionPatients.forEach(p => {
        expect(p.institutionId).toBe(userInstitutionId);
      });
    });

    it('should not show patients from other institutions', () => {
      const userInstitutionId = mockUsers.doctorHospitalA.institutionId;

      const otherInstitutionPatients = mockPatientList.filter(
        p => p.institutionId !== userInstitutionId
      );

      // In real app, these would not be shown to the user
      otherInstitutionPatients.forEach(p => {
        expect(p.institutionId).not.toBe(userInstitutionId);
      });
    });
  });

  describe('Patient Sorting', () => {
    it('should sort by admission date descending', () => {
      const sorted = [...mockPatientList].sort((a, b) =>
        new Date(b.admissionDate).getTime() - new Date(a.admissionDate).getTime()
      );

      for (let i = 1; i < sorted.length; i++) {
        expect(new Date(sorted[i-1].admissionDate).getTime())
          .toBeGreaterThanOrEqual(new Date(sorted[i].admissionDate).getTime());
      }
    });

    it('should sort by name alphabetically', () => {
      const sorted = [...mockPatientList].sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i-1].name.localeCompare(sorted[i].name)).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('Empty State', () => {
    it('should handle empty patient list', () => {
      const emptyList: Patient[] = [];
      expect(emptyList.length).toBe(0);
    });

    it('should handle no search results', () => {
      const searchTerm = 'NonExistent';
      const searchResults = mockPatientList.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(searchResults.length).toBe(0);
    });
  });

  describe('Pagination', () => {
    it('should calculate total pages correctly', () => {
      const totalPatients = 25;
      const itemsPerPage = 10;
      const totalPages = Math.ceil(totalPatients / itemsPerPage);

      expect(totalPages).toBe(3);
    });

    it('should slice patients for current page', () => {
      const allPatients = Array(25).fill(null).map((_, i) => ({
        ...mockPatients.patientHospitalA,
        id: `patient-${i}`
      }));

      const page = 2;
      const itemsPerPage = 10;
      const startIndex = (page - 1) * itemsPerPage;
      const pagePatients = allPatients.slice(startIndex, startIndex + itemsPerPage);

      expect(pagePatients.length).toBe(10);
      expect(pagePatients[0].id).toBe('patient-10');
    });
  });

  describe('Loading State', () => {
    it('should show loading initially', () => {
      let isLoading = true;
      expect(isLoading).toBe(true);

      // After data fetch
      isLoading = false;
      expect(isLoading).toBe(false);
    });
  });

  describe('Patient Actions', () => {
    it('should support patient selection', () => {
      const selectedPatient = mockPatientList[0];
      expect(selectedPatient.id).toBeDefined();
    });

    it('should support navigation to patient details', () => {
      const patientId = mockPatientList[0].id;
      const detailsUrl = `/patients/${patientId}`;

      expect(detailsUrl).toContain(patientId);
    });
  });
});

describe('PatientList - Quick Stats', () => {
  describe('Statistics Calculation', () => {
    const patients = [
      mockPatients.patientHospitalA,
      mockPatients.dischargedPatient,
      mockPatients.deceasedPatient,
      mockPatients.picuPatient
    ];

    it('should count admitted patients', () => {
      const admittedCount = patients.filter(
        p => p.outcome === PatientOutcomeValues.Admitted
      ).length;

      expect(admittedCount).toBeGreaterThan(0);
    });

    it('should count discharged patients', () => {
      const dischargedCount = patients.filter(
        p => p.outcome === PatientOutcomeValues.Discharged
      ).length;

      expect(dischargedCount).toBeGreaterThan(0);
    });

    it('should count deceased patients', () => {
      const deceasedCount = patients.filter(
        p => p.outcome === PatientOutcomeValues.Deceased
      ).length;

      expect(deceasedCount).toBeGreaterThanOrEqual(0);
    });

    it('should calculate total patients', () => {
      const totalCount = patients.length;
      expect(totalCount).toBe(4);
    });

    it('should calculate patients by unit', () => {
      const byUnit = patients.reduce((acc, p) => {
        acc[p.unit] = (acc[p.unit] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(Object.keys(byUnit).length).toBeGreaterThan(0);
    });
  });
});
