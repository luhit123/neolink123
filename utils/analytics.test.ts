// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { AdmissionType, Unit } from '../types';
import {
  getCanonicalAdmissionType,
  getCanonicalOutcome,
  isPatientActiveDuringRange,
  isPatientAdmittedWithinRange,
  matchesAdmissionTypeFilter,
  matchesRegistryUnit,
} from './analytics';

describe('analytics helpers', () => {
  it('treats admission cohort filtering independently of discharge month', () => {
    const patient = {
      admissionDate: '2026-02-17T18:40:00.000Z',
      releaseDate: '2026-03-06T09:30:00.000Z',
      outcome: 'Discharged' as const,
      unit: Unit.NICU,
    };

    const inFebruary = isPatientAdmittedWithinRange(patient, {
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-02-28T23:59:59.999Z'),
    });

    const inMarch = isPatientAdmittedWithinRange(patient, {
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T23:59:59.999Z'),
    });

    expect(inFebruary).toBe(true);
    expect(inMarch).toBe(false);
  });

  it('normalizes both outborn variants into the outborn filter', () => {
    const healthFacilityPatient = { admissionType: AdmissionType.OutbornHealthFacility };
    const communityPatient = { admissionType: AdmissionType.OutbornCommunity };

    expect(getCanonicalAdmissionType(healthFacilityPatient)).toBe('Outborn');
    expect(getCanonicalAdmissionType(communityPatient)).toBe('Outborn');
    expect(matchesAdmissionTypeFilter(healthFacilityPatient, 'outborn')).toBe(true);
    expect(matchesAdmissionTypeFilter(communityPatient, 'Outborn')).toBe(true);
    expect(matchesAdmissionTypeFilter(communityPatient, 'Inborn')).toBe(false);
  });

  it('preserves the inborn filter for exact inborn admissions', () => {
    const patient = { admissionType: AdmissionType.Inborn };

    expect(getCanonicalAdmissionType(patient)).toBe('Inborn');
    expect(matchesAdmissionTypeFilter(patient, 'Inborn')).toBe(true);
    expect(matchesAdmissionTypeFilter(patient, 'outborn')).toBe(false);
  });

  it('uses legacy nicuAdmissionType but ignores unrelated birth/referral fields', () => {
    const legacyNicuPatient = { nicuAdmissionType: 'Outborn' as any };
    const unrelatedFieldsPatient = {
      birthType: 'Outborn',
      referredFrom: 'Outborn',
    } as any;

    expect(getCanonicalAdmissionType(legacyNicuPatient)).toBe('Outborn');
    expect(getCanonicalAdmissionType(unrelatedFieldsPatient)).toBe('Unknown');
    expect(matchesAdmissionTypeFilter(unrelatedFieldsPatient, 'Outborn')).toBe(false);
  });

  it('normalizes spaced outborn variants', () => {
    const patient = { admissionType: 'Out born' as any };
    expect(getCanonicalAdmissionType(patient)).toBe('Outborn');
    expect(matchesAdmissionTypeFilter(patient, 'Outborn')).toBe(true);
  });

  it('does not infer discharged from legacy releaseDate alone when outcome is empty', () => {
    const ambiguousActivePatient = {
      outcome: '',
      releaseDate: '2026-02-10T10:00:00.000Z',
    } as any;
    const clearlyDischargedPatient = {
      outcome: '',
      dischargeDateTime: '2026-02-10T10:00:00.000Z',
    } as any;

    expect(getCanonicalOutcome(ambiguousActivePatient)).toBe('In Progress');
    expect(getCanonicalOutcome(clearlyDischargedPatient)).toBe('Discharged');
  });

  it('does not let stale referral fields override an explicit discharge outcome', () => {
    const dischargedWithReferralFields = {
      outcome: 'Discharged',
      referredTo: 'Some Hospital',
      referralReason: 'Bed not available',
    } as any;

    expect(getCanonicalOutcome(dischargedWithReferralFields)).toBe('Discharged');
  });

  it('still infers referral when outcome is empty but referral fields exist', () => {
    const referredViaFields = {
      outcome: '',
      referredTo: 'Some Hospital',
      referralReason: 'Needs higher care',
    } as any;

    expect(getCanonicalOutcome(referredViaFields)).toBe('Referred');
  });

  it('treats readmitted step-down patients as in progress even if referral fields linger', () => {
    const readmittedPatient = {
      outcome: '',
      stepDownDate: '2026-02-23T13:17:00.000Z',
      readmissionFromStepDown: true,
      referredTo: 'Some Hospital',
      referralReason: 'Stale referral info',
    } as any;

    expect(getCanonicalOutcome(readmittedPatient)).toBe('In Progress');
  });

  it('treats stale step-down records with final discharge data as discharged', () => {
    const staleStepDownPatient = {
      outcome: 'Step Down',
      stepDownDate: '2026-02-23T13:17:00.000Z',
      finalDischargeDate: '2026-02-25T10:00:00.000Z',
      isStepDown: true,
    } as any;

    expect(getCanonicalOutcome(staleStepDownPatient)).toBe('Discharged');
  });

  it('treats step-down records with releaseDate after stepDownDate as discharged', () => {
    const dischargedFromStepDownPatient = {
      outcome: 'Step Down',
      stepDownDate: '2026-02-23T13:17:00.000Z',
      releaseDate: '2026-02-25T10:00:00.000Z',
      isStepDown: true,
    } as any;

    expect(getCanonicalOutcome(dischargedFromStepDownPatient)).toBe('Discharged');
  });

  it('keeps step down patients active after their step-down date', () => {
    const patient = {
      admissionDate: '2026-02-17T18:40:00.000Z',
      stepDownDate: '2026-03-01T09:30:00.000Z',
      outcome: 'Step Down' as const,
      unit: Unit.PICU,
    };

    const inMarchWeek = isPatientActiveDuringRange(patient, {
      startDate: new Date('2026-03-05T00:00:00.000Z'),
      endDate: new Date('2026-03-12T23:59:59.999Z'),
    });

    // Step-down is a transition; patients remain in care until a terminal outcome.
    expect(inMarchWeek).toBe(true);
  });

  it('keeps step down patients visible during ranges that include the step-down date', () => {
    const patient = {
      admissionDate: '2026-02-17T18:40:00.000Z',
      stepDownDate: '2026-03-01T09:30:00.000Z',
      outcome: 'Step Down' as const,
      unit: Unit.PICU,
    };

    const duringStepDown = isPatientActiveDuringRange(patient, {
      startDate: new Date('2026-02-25T00:00:00.000Z'),
      endDate: new Date('2026-03-05T23:59:59.999Z'),
    });

    expect(duringStepDown).toBe(true);
  });

  it('still removes terminal outcomes after the patient leaves care', () => {
    const patient = {
      admissionDate: '2026-02-17T18:40:00.000Z',
      finalDischargeDate: '2026-03-01T09:30:00.000Z',
      outcome: 'Discharged' as const,
      unit: Unit.PICU,
    };

    const inMarchWeek = isPatientActiveDuringRange(patient, {
      startDate: new Date('2026-03-05T00:00:00.000Z'),
      endDate: new Date('2026-03-12T23:59:59.999Z'),
    });

    expect(inMarchWeek).toBe(false);
  });

  it('keeps step down patients attached to their original unit registry', () => {
    const steppedDownPatient = {
      unit: Unit.GENERAL_WARD,
      stepDownFrom: Unit.NICU,
      stepDownDate: '2026-03-01T09:30:00.000Z',
      outcome: 'Step Down' as const,
    } as any;

    expect(matchesRegistryUnit(steppedDownPatient, Unit.NICU)).toBe(true);
    expect(matchesRegistryUnit(steppedDownPatient, Unit.PICU)).toBe(false);
  });
});
