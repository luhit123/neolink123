# NeoLink - PICU/NICU Medical Records System

## 🎯 Overview
NeoLink is a comprehensive medical records management system designed specifically for Pediatric Intensive Care Units (PICU) and Neonatal Intensive Care Units (NICU). Built with modern web technologies, it provides role-based access control and powerful analytics.

## ✨ Key Features

### 🔐 Role-Based Access Control
The system supports three user roles with different permissions:

#### 👨‍⚕️ **Nurse Role**
- **Basic Patient Entry**: Nurses can add new patient records with essential information
- **Draft System**: Records created by nurses are saved as drafts
- **Limited Fields**: Can enter:
  - Patient name, age, gender
  - Admission date
  - Unit (NICU/PICU)
  - NICU-specific: Admission type (Inborn/Outborn), referring hospital/district
- **Restricted Fields**: Cannot edit diagnosis or add progress notes (doctor-only)
- **Save as Draft**: All nurse entries are marked as drafts for doctor completion

#### 👨‍⚕️ **Doctor Role**
- **Complete Patient Records**: Full access to all patient fields
- **Diagnosis Entry**: Can add and edit primary diagnosis
- **Progress Notes**: Can add, edit, and remove clinical progress notes
- **Draft Completion**: Can complete draft records created by nurses
- **Full CRUD**: Create, Read, Update, Delete patient records
- **Status Management**: Can update patient outcome status

#### 👨‍💼 **Administrator Role**
- **All Doctor Permissions**: Full access to patient management
- **Analytics Dashboard**: Access to comprehensive summary and analytics
- **System Overview**: Can view all units and data across the system
- **Advanced Reports**: Access to detailed statistical analysis

### 📊 Comprehensive Analytics

#### Main Dashboard Metrics
- **Total Patients**: Overall patient count with time filtering
- **In Progress**: Currently admitted patients
- **Discharged**: Successfully discharged patients
- **Referred**: Patients referred to other facilities
- **Deceased**: Mortality tracking
- **Discharge Rate**: Percentage of successful discharges
- **Referral Rate**: Percentage of referrals
- **Mortality Rate**: Percentage of deaths

#### Rate Cards (Beautiful Gradient Design)
- **💚 Discharge Rate**: Green gradient card showing discharge percentage
- **🔄 Referral Rate**: Orange gradient card showing referral percentage
- **⚠️ Mortality Rate**: Red gradient card showing mortality percentage

#### Comprehensive Summary (Admin Only)
Accessible via the "Summary" button, includes:

**PICU Summary:**
- Total patients, in progress, discharged, referred, deceased
- Average length of stay
- 📊 Admissions vs. Discharges trend (last 12 months)
- 📈 Outcome distribution pie chart
- 🔬 Rates comparison bar chart
- 🩺 Top 5 diagnoses
- 👥 Gender distribution

**NICU Summary (3 Tabs):**
1. **Overall**: All NICU patients combined
2. **Inborn**: Patients born in the hospital
3. **Outborn**: Patients referred from other facilities

Each tab includes:
- All metrics from PICU summary
- 🏥 Top 5 referring hospitals (for Outborn view)
- Specialized NICU analytics

### 🏥 Unit Management

#### NICU (Neonatal Intensive Care Unit)
- **Admission Types**: Inborn vs Outborn tracking
- **Referral Tracking**: Hospital and district information for outborn patients
- **Mortality Breakdown**: Separate tracking for inborn/outborn deaths
- **Specialized Views**: Filter by All/Inborn/Outborn

#### PICU (Pediatric Intensive Care Unit)
- General pediatric patient management
- Age range: Days to Years
- Comprehensive outcome tracking

### 📅 Date Filtering
- **Today**: Current day's admissions
- **This Week**: Current week's data
- **This Month**: Current month's data
- **Custom Range**: Select specific date ranges
- **Monthly Selection**: Choose specific months (YYYY-MM format)
- **All Time**: View all historical data

### 📋 Patient Management

#### Patient List Features
- **Search**: Search by patient name or diagnosis
- **Draft Indicators**: Yellow "DRAFT" badge for incomplete records
- **Visual Cues**: Yellow left border for draft records
- **Status Badges**: Color-coded outcome status
  - 🔵 In Progress (Blue)
  - 🟢 Discharged (Green)
  - 🟡 Referred (Yellow)
  - 🔴 Deceased (Red)

#### Patient Form
- **Responsive Design**: Works on all screen sizes
- **Role-Aware**: Adapts based on user role
- **Validation**: Required field validation
- **Progress Notes**: Multiple notes with timestamps
- **NICU-Specific Fields**: Conditional fields for NICU patients

### 📈 Visualizations

#### Chart Types
1. **Line Charts**: Admission vs discharge trends over time
2. **Pie Charts**: Outcome distribution, gender distribution
3. **Bar Charts**: 
   - Rates comparison (discharge, referral, mortality)
   - Top diagnoses
   - Top referring hospitals

#### Chart Features
- Responsive design
- Interactive tooltips
- Color-coded data
- Professional styling with dark theme
- Empty state handling

### 🎨 UI/UX Features

#### Modern Design
- **Dark Theme**: Easy on the eyes for long sessions
- **Gradient Accents**: Cyan/blue gradients throughout
- **Glassmorphism**: Backdrop blur effects
- **Smooth Animations**: Transitions and hover effects
- **Responsive Layout**: Mobile, tablet, and desktop support

#### Visual Indicators
- **Emojis**: Used strategically for quick recognition
- **Color Coding**: Consistent color scheme for different metrics
- **Icons**: Professional icon set for actions and metrics
- **Badges**: Status indicators and labels

#### Accessibility
- **Clear Typography**: Readable fonts and sizes
- **High Contrast**: Good color contrast ratios
- **Semantic HTML**: Proper HTML structure
- **Keyboard Navigation**: Full keyboard support

### 💾 Data Persistence
- **Local Storage**: All data persists in browser
- **Auto-Save**: Changes saved immediately
- **Role Persistence**: User role remembered across sessions
- **Draft System**: Incomplete records preserved

### 🔄 Workflow

#### Typical Nurse Workflow
1. Login as Nurse
2. Click "Add Patient (Draft)"
3. Enter basic patient information
4. Click "💾 Save as Draft"
5. Record appears with DRAFT badge

#### Typical Doctor Workflow
1. Login as Doctor
2. See draft records (yellow border + badge)
3. Click edit on draft record
4. See warning: "⚠️ Draft record - Please complete diagnosis and notes"
5. Add diagnosis and progress notes
6. Click "✓ Complete & Save"
7. Record no longer shows as draft

#### Administrator Workflow
1. Login as Administrator
2. View all metrics on dashboard
3. Click "Summary" for comprehensive analytics
4. Switch between PICU and NICU summaries
5. Analyze trends and patterns
6. Export insights for reporting

## 🛠️ Technical Stack
- **React 19**: Latest React with hooks
- **TypeScript**: Type-safe development
- **Recharts**: Beautiful, responsive charts
- **Vite**: Fast build tool and dev server
- **TailwindCSS**: Utility-first CSS (via inline styles)
- **Local Storage**: Client-side data persistence

## 📱 Responsive Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

## 🎯 Future Enhancements
- Backend integration
- Real-time collaboration
- PDF report generation
- Advanced filtering
- Data export (CSV/Excel)
- Print-friendly views
- Audit logs
- Advanced search
- Patient history timeline
- Medication tracking
- Vital signs monitoring

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📝 Notes
- All rates are calculated as percentages
- Draft records are clearly marked throughout the system
- Date filtering applies to admission dates
- Charts show "No data available" when empty
- System uses ISO date strings for consistency
- All timestamps include time zone information

---

**Built with ❤️ for Nalbari Medical College and Hospital**
