import { MonthlyAdmission } from "../types";

// NICU Data - September 2025: Total 197 admissions (156 Inborn + 41 Outborn)
export const nicuLastSixMonthsData: MonthlyAdmission[] = [
    { month: 'Apr', admissions: 178, discharges: 174 },
    { month: 'May', admissions: 182, discharges: 179 },
    { month: 'Jun', admissions: 189, discharges: 186 },
    { month: 'Jul', admissions: 194, discharges: 190 },
    { month: 'Aug', admissions: 201, discharges: 198 },
    { month: 'Sep', admissions: 197, discharges: 192 }, // 156 Inborn + 41 Outborn
];

// PICU Data - Typical pediatric admissions
export const picuLastSixMonthsData: MonthlyAdmission[] = [
    { month: 'Apr', admissions: 45, discharges: 43 },
    { month: 'May', admissions: 48, discharges: 46 },
    { month: 'Jun', admissions: 52, discharges: 50 },
    { month: 'Jul', admissions: 49, discharges: 47 },
    { month: 'Aug', admissions: 54, discharges: 52 },
    { month: 'Sep', admissions: 51, discharges: 50 },
];
