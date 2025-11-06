import React, { useState, useMemo } from 'react';
import { Patient, Unit, UserRole, AdmissionType } from '../types';
import StatCard from './StatCard';
import PatientList from './PatientList';
import UnitSelection from './UnitSelection';
import PatientForm from './PatientForm';
import PatientDetailModal from './PatientDetailModal';
import { BedIcon, ArrowRightOnRectangleIcon, ChartBarIcon, PlusIcon, HomeIcon, ArrowUpOnSquareIcon, PresentationChartBarIcon } from './common/Icons';
import { initialPatients } from '../data/initialData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ResponsiveContainer, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import NicuViewSelection from './NicuViewSelection';
import DateFilter, { DateFilterValue } from './DateFilter';
import ComprehensiveSummary from './ComprehensiveSummary';
import DeathsAnalysis from './DeathsAnalysis';

interface DashboardProps {
  userRole: UserRole;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const Dashboard: React.FC<DashboardProps> = ({ userRole }) => {
  const [patients, setPatients] = useLocalStorage<Patient[]>('patients', initialPatients);
  const [selectedUnit, setSelectedUnit] = useState<Unit>(Unit.NICU);
  const [nicuView, setNicuView] = useState<'All' | 'Inborn' | 'Outborn'>('All');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ period: 'All Time' });
  const [showSummary, setShowSummary] = useState(false);
  const [showDeathsAnalysis, setShowDeathsAnalysis] = useState(false);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);
  const [patientToView, setPatientToView] = useState<Patient | null>(null);
  
  const unitPatients = useMemo(() => {
    let baseFiltered = patients.filter(p => p.unit === selectedUnit);

    if (selectedUnit === Unit.NICU && nicuView !== 'All') {
        baseFiltered = baseFiltered.filter(p => p.admissionType === nicuView);
    }

    if (dateFilter.period === 'All Time') {
        return baseFiltered;
    }

    let startDate: Date;
    let endDate: Date;

    const periodIsMonth = /\d{4}-\d{2}/.test(dateFilter.period);

    if (periodIsMonth) {
        const [year, month] = dateFilter.period.split('-').map(Number);
        startDate = new Date(year, month - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(year, month, 0); // Last day of the given month
        endDate.setHours(23, 59, 59, 999);
    } else {
        const now = new Date();
        switch (dateFilter.period) {
            case 'Today':
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'This Week':
                const firstDayOfWeek = new Date(now);
                firstDayOfWeek.setDate(now.getDate() - now.getDay()); // Assuming Sunday is the first day
                startDate = new Date(firstDayOfWeek);
                startDate.setHours(0, 0, 0, 0);
                
                const lastDayOfWeek = new Date(firstDayOfWeek);
                lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
                endDate = new Date(lastDayOfWeek);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'This Month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'Custom':
                if (!dateFilter.startDate || !dateFilter.endDate) return baseFiltered; // Don't filter if range is incomplete
                startDate = new Date(dateFilter.startDate);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(dateFilter.endDate);
                endDate.setHours(23, 59, 59, 999);
                break;
            default:
                return baseFiltered;
        }
    }

    return baseFiltered.filter(p => {
        const admissionDate = new Date(p.admissionDate);
        return admissionDate >= startDate && admissionDate <= endDate;
    });
  }, [patients, selectedUnit, nicuView, dateFilter]);

  const stats = useMemo(() => {
    const total = unitPatients.length;
    const deceased = unitPatients.filter(p => p.outcome === 'Deceased').length;
    const discharged = unitPatients.filter(p => p.outcome === 'Discharged').length;
    const referred = unitPatients.filter(p => p.outcome === 'Referred').length;
    const inProgress = unitPatients.filter(p => p.outcome === 'In Progress').length;
    
    const mortalityRate = total > 0 ? ((deceased / total) * 100).toFixed(1) + '%' : '0%';
    const dischargeRate = total > 0 ? ((discharged / total) * 100).toFixed(1) + '%' : '0%';
    const referralRate = total > 0 ? ((referred / total) * 100).toFixed(1) + '%' : '0%';

    if (selectedUnit === Unit.NICU) {
        const inbornDeaths = unitPatients.filter(p => p.outcome === 'Deceased' && p.admissionType === 'Inborn').length;
        const outbornDeaths = unitPatients.filter(p => p.outcome === 'Deceased' && p.admissionType === 'Outborn').length;
        return { total, deceased, discharged, referred, inProgress, mortalityRate, dischargeRate, referralRate, inbornDeaths, outbornDeaths };
    }

    return { total, deceased, discharged, referred, inProgress, mortalityRate, dischargeRate, referralRate };
  }, [unitPatients, selectedUnit]);

  const nicuMortalityBreakdown = useMemo(() => {
    if (selectedUnit !== Unit.NICU || !stats.inbornDeaths || !stats.outbornDeaths) return [];
    return [
        { name: 'Inborn', value: stats.inbornDeaths },
        { name: 'Outborn', value: stats.outbornDeaths }
    ].filter(item => item.value > 0);
  }, [selectedUnit, stats]);

  const getDashboardTitle = () => {
    if (selectedUnit === Unit.NICU) {
        const viewTitle = nicuView === 'All' ? '' : `- ${nicuView} Patients`;
        return `NICU Dashboard ${viewTitle}`;
    }
    return 'PICU Dashboard';
  };

  const getPeriodTitle = (period: string) => {
    if (!period || period === 'All Time') return '';
    if (period === 'Custom') return '(Custom Range)';
    if (/\d{4}-\d{2}/.test(period)) {
        const [year, month] = period.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return `(${date.toLocaleString('default', { month: 'long', year: 'numeric' })})`;
    }
    return `(${period})`;
  };

  const handleAddPatient = () => {
    setPatientToEdit(null);
    setIsFormOpen(true);
  };
  
  const handleEditPatient = (patient: Patient) => {
    setPatientToEdit(patient);
    setIsFormOpen(true);
  };

  const handleSavePatient = (patientData: Patient) => {
    if (patientToEdit) {
      setPatients(prev => prev.map(p => p.id === patientData.id ? patientData : p));
    } else {
      setPatients(prev => [...prev, patientData]);
    }
    setIsFormOpen(false);
    setPatientToEdit(null);
  };

  const handleDeletePatient = (id: string) => {
    if (window.confirm('Are you sure you want to delete this patient record?')) {
      setPatients(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleViewDetails = (patient: Patient) => {
    setPatientToView(patient);
    setIsDetailsOpen(true);
  };

  const handleSelectUnit = (unit: Unit) => {
    setSelectedUnit(unit);
    setNicuView('All'); // Reset nicu view when switching main unit
  };

  if (showSummary) {
      return <ComprehensiveSummary patients={patients} onBack={() => setShowSummary(false)} />;
  }

  if (showDeathsAnalysis) {
      return <DeathsAnalysis patients={patients} onBack={() => setShowDeathsAnalysis(false)} />;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold text-white">{getDashboardTitle()}</h1>
            <p className="text-slate-400">Overview of patient data and outcomes.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch gap-4 w-full md:w-auto">
            <UnitSelection selectedUnit={selectedUnit} onSelectUnit={handleSelectUnit} />
            {userRole === UserRole.Admin && (
                 <button onClick={() => setShowSummary(true)} className="flex items-center justify-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-500 transition-colors font-semibold">
                    <PresentationChartBarIcon className="w-5 h-5"/>
                    <span>Summary</span>
                </button>
            )}
            {(userRole === UserRole.Admin || userRole === UserRole.Doctor) && (
                 <button onClick={() => setShowDeathsAnalysis(true)} className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold">
                    <ChartBarIcon className="w-5 h-5"/>
                    <span>Deaths Analysis</span>
                </button>
            )}
            {(userRole === UserRole.Nurse || userRole === UserRole.Doctor) && (
                <button onClick={handleAddPatient} className="flex items-center justify-center gap-2 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors font-semibold">
                    <PlusIcon className="w-5 h-5"/>
                    <span>{userRole === UserRole.Nurse ? 'Add Patient (Draft)' : 'Add Patient'}</span>
                </button>
            )}
        </div>
      </div>
      
      {selectedUnit === Unit.NICU && (
          <NicuViewSelection selectedView={nicuView} onSelectView={setNicuView} />
      )}

      <DateFilter onFilterChange={setDateFilter} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard title={`Total Patients ${getPeriodTitle(dateFilter.period)}`} value={stats.total} icon={<BedIcon className="w-5 h-5 md:w-6 md:h-6 text-white"/>} color="bg-blue-500/80" />
        <StatCard title={`In Progress ${getPeriodTitle(dateFilter.period)}`} value={stats.inProgress} icon={<BedIcon className="w-5 h-5 md:w-6 md:h-6 text-white"/>} color="bg-blue-400/80" />
        <StatCard title={`Discharged ${getPeriodTitle(dateFilter.period)}`} value={stats.discharged} icon={<ArrowRightOnRectangleIcon className="w-5 h-5 md:w-6 md:h-6 text-white"/>} color="bg-green-500/80" />
        <StatCard title={`Referred ${getPeriodTitle(dateFilter.period)}`} value={stats.referred} icon={<ArrowUpOnSquareIcon className="w-5 h-5 md:w-6 md:h-6 text-white"/>} color="bg-orange-500/80" />
        <StatCard title={`Deceased ${getPeriodTitle(dateFilter.period)}`} value={stats.deceased} icon={<ChartBarIcon className="w-5 h-5 md:w-6 md:h-6 text-white"/>} color="bg-red-500/80" />
        <StatCard title={`Discharge Rate ${getPeriodTitle(dateFilter.period)}`} value={stats.dischargeRate} icon={<ChartBarIcon className="w-5 h-5 md:w-6 md:h-6 text-white"/>} color="bg-emerald-500/80" />
      </div>
      
      {/* Additional Rate Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 p-4 md:p-6 rounded-xl border border-green-500/30">
          <div className="text-xs md:text-sm text-green-300 font-medium mb-1">💚 Discharge Rate</div>
          <div className="text-2xl md:text-3xl font-bold text-green-400">{stats.dischargeRate}</div>
          <div className="text-xs text-green-300/70 mt-2">{stats.discharged} of {stats.total} patients successfully discharged</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 p-4 md:p-6 rounded-xl border border-orange-500/30">
          <div className="text-xs md:text-sm text-orange-300 font-medium mb-1">🔄 Referral Rate</div>
          <div className="text-2xl md:text-3xl font-bold text-orange-400">{stats.referralRate}</div>
          <div className="text-xs text-orange-300/70 mt-2">{stats.referred} of {stats.total} patients referred to other facilities</div>
        </div>
        <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 p-4 md:p-6 rounded-xl border border-red-500/30">
          <div className="text-xs md:text-sm text-red-300 font-medium mb-1">⚠️ Mortality Rate</div>
          <div className="text-2xl md:text-3xl font-bold text-red-400">{stats.mortalityRate}</div>
          <div className="text-xs text-red-300/70 mt-2">{stats.deceased} of {stats.total} patients</div>
        </div>
      </div>
      
      {/* Mortality Analysis Section */}
      <div className="bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-700">
        <h3 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Mortality Analysis vs Total Admissions
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Mortality vs Admissions Bar Chart */}
          <div className="bg-slate-700/30 p-4 rounded-lg">
            <h4 className="text-sm md:text-base font-semibold text-slate-300 mb-3">Mortality vs Total Admissions</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { name: 'Total Admissions', value: stats.total, fill: '#3b82f6' },
                { name: 'Deceased', value: stats.deceased, fill: '#ef4444' },
                { name: 'Survived', value: stats.total - stats.deceased, fill: '#10b981' }
              ]}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60}/>
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }}/>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {[{ fill: '#3b82f6' }, { fill: '#ef4444' }, { fill: '#10b981' }].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-slate-400 text-center">
              Mortality Rate: <span className="text-red-400 font-bold">{stats.mortalityRate}</span> ({stats.deceased}/{stats.total})
            </div>
          </div>

          {/* Outcome Breakdown Pie Chart */}
          <div className="bg-slate-700/30 p-4 rounded-lg">
            <h4 className="text-sm md:text-base font-semibold text-slate-300 mb-3">Patient Outcomes Distribution</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie 
                  data={[
                    { name: 'In Progress', value: stats.inProgress, fill: '#3b82f6' },
                    { name: 'Discharged', value: stats.discharged, fill: '#10b981' },
                    { name: 'Referred', value: stats.referred, fill: '#f59e0b' },
                    { name: 'Deceased', value: stats.deceased, fill: '#ef4444' }
                  ].filter(item => item.value > 0)}
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={80}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {[{ fill: '#3b82f6' }, { fill: '#10b981' }, { fill: '#f59e0b' }, { fill: '#ef4444' }].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-slate-400 text-center">
              Total Patients: <span className="text-cyan-400 font-bold">{stats.total}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* NICU Specific Mortality Breakdown */}
      {selectedUnit === Unit.NICU && (
        <div className="bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-700">
          <h3 className="text-lg md:text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">🏥</span>
            NICU Mortality: Inborn vs Outborn Analysis
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Inborn vs Outborn Admissions & Deaths */}
            <div className="bg-slate-700/30 p-4 rounded-lg">
              <h4 className="text-sm md:text-base font-semibold text-slate-300 mb-3">Admissions & Mortality Comparison</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  { 
                    name: 'Inborn', 
                    admissions: unitPatients.filter(p => p.admissionType === 'Inborn').length,
                    deaths: stats.inbornDeaths ?? 0
                  },
                  { 
                    name: 'Outborn', 
                    admissions: unitPatients.filter(p => p.admissionType === 'Outborn').length,
                    deaths: stats.outbornDeaths ?? 0
                  }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }}/>
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }}/>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }}/>
                  <Bar dataKey="admissions" name="Total Admissions" fill="#3b82f6" radius={[8, 8, 0, 0]}/>
                  <Bar dataKey="deaths" name="Deaths" fill="#ef4444" radius={[8, 8, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Mortality Rate Comparison */}
            <div className="bg-slate-700/30 p-4 rounded-lg">
              <h4 className="text-sm md:text-base font-semibold text-slate-300 mb-3">Mortality Rate by Type</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  { 
                    name: 'Inborn',
                    rate: unitPatients.filter(p => p.admissionType === 'Inborn').length > 0 
                      ? ((stats.inbornDeaths ?? 0) / unitPatients.filter(p => p.admissionType === 'Inborn').length * 100).toFixed(1)
                      : 0
                  },
                  { 
                    name: 'Outborn',
                    rate: unitPatients.filter(p => p.admissionType === 'Outborn').length > 0
                      ? ((stats.outbornDeaths ?? 0) / unitPatients.filter(p => p.admissionType === 'Outborn').length * 100).toFixed(1)
                      : 0
                  }
                ]} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                  <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 10 }} label={{ value: 'Mortality Rate (%)', position: 'bottom', style: { fill: '#94a3b8', fontSize: '11px' } }}/>
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }}/>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} formatter={(value) => `${value}%`}/>
                  <Bar dataKey="rate" fill="#ef4444" radius={[0, 8, 8, 0]}>
                    {[{ fill: '#a855f7' }, { fill: '#f59e0b' }].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-lg">
              <div className="text-xs text-purple-300">Inborn Admissions</div>
              <div className="text-xl md:text-2xl font-bold text-purple-400">{unitPatients.filter(p => p.admissionType === 'Inborn').length}</div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-lg">
              <div className="text-xs text-purple-300">Inborn Deaths</div>
              <div className="text-xl md:text-2xl font-bold text-red-400">{stats.inbornDeaths ?? 0}</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg">
              <div className="text-xs text-orange-300">Outborn Admissions</div>
              <div className="text-xl md:text-2xl font-bold text-orange-400">{unitPatients.filter(p => p.admissionType === 'Outborn').length}</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg">
              <div className="text-xs text-orange-300">Outborn Deaths</div>
              <div className="text-xl md:text-2xl font-bold text-red-400">{stats.outbornDeaths ?? 0}</div>
            </div>
          </div>
        </div>
      )}


      <PatientList 
        patients={unitPatients} 
        userRole={userRole}
        onEdit={handleEditPatient}
        onDelete={handleDeletePatient}
        onViewDetails={handleViewDetails}
      />

      {isFormOpen && (
        <PatientForm
          patientToEdit={patientToEdit}
          onSave={handleSavePatient}
          onClose={() => setIsFormOpen(false)}
          userRole={userRole}
          defaultUnit={selectedUnit}
        />
      )}
      
      {isDetailsOpen && patientToView && (
        <PatientDetailModal
          patient={patientToView}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;