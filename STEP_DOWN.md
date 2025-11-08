# PICU Step Down Feature - NeoLink

## 🎯 Overview
The Step Down feature allows PICU patients to be transferred to lower-level care units within the hospital. This provides a graduated approach to patient care, allowing for better resource utilization and appropriate level of care based on patient condition.

## 🏥 How Step Down Works

### **Step Down Process:**
1. **PICU Patient** → Select "Step Down" from outcome options
2. **Step Down Date Recorded** → System records when step down occurred
3. **Patient Status Changes** → Outcome becomes "Step Down"
4. **Lower Level Care** → Patient moves to general ward or step-down unit

### **From Step Down:**
1. **Final Discharge** → Patient recovers completely, discharged home
2. **Readmission to PICU** → Condition worsens, needs higher level care again

## 📋 Patient Journey Example

```
PICU Admission → PICU Care → Step Down → Final Discharge
                                    ↓
                            Readmission to PICU (if needed)
```

## 🔐 Access Control

### **Who Can Use Step Down:**
- ✅ **Doctors** - Can step down patients and manage step down care
- ✅ **Administrators** - Full access to step down functionality
- ❌ **Nurses** - Cannot initiate step down (can only create drafts)

## 🎨 Visual Indicators

### **Status Colors:**
- **🟣 Purple**: Step Down patients in patient lists
- **🟣 Purple Stat Card**: Step Down count on PICU dashboard

### **Action Buttons:**
- **🟢 Green Arrow Up**: Final discharge from step down
- **🟠 Orange Arrow Down**: Readmit to PICU from step down

## 📊 Dashboard Integration

### **PICU Dashboard Shows:**
- **Step Down Stat Card** (only visible in PICU view)
- **Updated Pie Chart** includes Step Down distribution
- **7-Column Grid** adapts to include Step Down when in PICU

### **Statistics Include:**
- Step Down count in patient outcomes
- Step Down patients excluded from "In Progress" counts
- Separate tracking for step down vs active PICU patients

## 🔄 Step Down Actions

### **1. Step Down a Patient:**
1. Go to PICU dashboard
2. Find patient in "In Progress" status
3. Click "Edit" (pencil icon)
4. Change outcome to "Step Down"
5. Enter step down date
6. Save changes

### **2. Final Discharge from Step Down:**
1. Find patient with "Step Down" status (purple badge)
2. Click green arrow up icon
3. Confirm discharge
4. Patient status changes to "Discharged"

### **3. Readmit from Step Down:**
1. Find patient with "Step Down" status (purple badge)
2. Click orange arrow down icon
3. Confirm readmission
4. Patient returns to PICU as "In Progress"

## 📋 Patient Status Flow

### **PICU Patient States:**
```
In Progress → Step Down → Discharged (Final)
                    ↓
               Readmission → In Progress
```

### **Data Tracking:**
- **stepDownDate**: When patient was stepped down
- **stepDownFrom**: Always "PICU" for this feature
- **isStepDown**: Boolean flag for current step down status
- **readmissionFromStepDown**: Tracks if patient was readmitted
- **finalDischargeDate**: When finally discharged from step down

## 📈 Reporting & Analytics

### **Step Down Metrics:**
- Step down rate (patients stepped down vs total PICU admissions)
- Length of stay in step down
- Readmission rate from step down
- Final discharge rate from step down

### **Dashboard Charts:**
- Pie chart includes step down distribution
- Separate stat card for step down count
- Trends can show step down utilization over time

## 🏥 Clinical Workflow

### **When to Step Down:**
- Patient stable and no longer needs PICU-level care
- Respiratory support weaned
- Vital signs stable
- Ready for general ward monitoring

### **Step Down Benefits:**
- **Resource Optimization**: Free up PICU beds for critical patients
- **Cost Efficiency**: Lower cost of care in general wards
- **Patient Flow**: Better hospital throughput
- **Appropriate Care**: Right level of care for patient condition

### **Readmission Triggers:**
- Respiratory distress recurrence
- Hemodynamic instability
- Neurological deterioration
- Need for invasive monitoring/support

## 🔍 Patient List Features

### **Step Down Patients Show:**
- **Purple Status Badge**: "Step Down"
- **Two Action Buttons**:
  - Final Discharge (green up arrow)
  - Readmit to PICU (orange down arrow)
- **Step Down Date**: Visible in patient details

### **Filtering:**
- Step down patients appear in PICU view
- Can be filtered by date, unit, and outcome
- Separate from active PICU patients

## 📱 Mobile Compatibility

### **Responsive Design:**
- Action buttons stack appropriately on mobile
- Step down stat card adapts to screen size
- Touch-friendly step down actions

## ⚡ Technical Implementation

### **Database Fields Added:**
```typescript
stepDownDate?: string;        // ISO string
stepDownFrom?: Unit;         // PICU
isStepDown?: boolean;        // Current status
readmissionFromStepDown?: boolean; // History
finalDischargeDate?: string; // Final discharge
```

### **UI Components Updated:**
- PatientForm: Step down outcome option for PICU
- PatientList: Step down action buttons
- Dashboard: Step down statistics and charts

### **State Management:**
- Step down patients tracked separately
- Readmission history preserved
- Audit trail for all step down actions

## 🎯 Use Cases

### **Clinical Scenarios:**

1. **Post-Cardiac Surgery**: Patient stable after surgery, ready for ward monitoring
2. **Weaned Ventilation**: Successfully extubated, needs observation
3. **Recovered Sepsis**: Antibiotics completed, vitals stable
4. **Trauma Recovery**: Initial critical phase over, ongoing recovery

### **Quality Metrics:**
- Appropriate step down timing
- Readmission rates (should be low)
- Length of PICU stay optimization
- Resource utilization efficiency

## 🚀 Future Enhancements

### **Potential Additions:**
- Step down unit selection (different wards)
- Step down criteria checklists
- Automated step down suggestions
- Step down outcome tracking
- Multi-level step down (PICU → HDU → Ward)

### **Advanced Analytics:**
- Step down success rates
- Readmission prediction models
- Cost savings calculations
- Quality of care metrics

---

## 🎉 Benefits Summary

**For Patients:**
- Appropriate level of care
- Reduced PICU length of stay when possible
- Better resource allocation

**For Hospital:**
- Improved bed utilization
- Cost optimization
- Better patient flow
- Enhanced care coordination

**For Staff:**
- Clear workflow for patient transitions
- Better visibility of patient status
- Comprehensive tracking and reporting

The Step Down feature transforms PICU care delivery by enabling graduated care levels while maintaining full patient tracking and clinical oversight! 🏥🟣✨
