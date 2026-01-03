import React, { useMemo, useState } from 'react';
import { Patient, Unit, AdmissionType } from '../types';
import StatCard from './StatCard';
import { ChevronLeftIcon, BedIcon, ChartBarIcon, ArrowRightOnRectangleIcon, HomeIcon, ArrowUpOnSquareIcon } from './common/Icons';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

interface ComprehensiveSummaryProps {
  patients: Patient[];
  onBack: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

const ChartWrapper: React.FC<{ title: string; children: React.ReactNode, noData: boolean }> = ({ title, children, noData }) => (
    <div className="bg-slate-800/50 p-3 sm:p-4 md:p-6 rounded-lg sm:rounded-xl shadow-lg border border-slate-700/50 min-h-[250px] sm:min-h-[300px] flex flex-col">
        <h3 className="text-sm sm:text-base md:text-lg font-bold text-white mb-3 sm:mb-4">{title}</h3>
        {noData ? (
             <div className="flex-grow flex items-center justify-center">
                <p className="text-slate-400 text-sm">No data available.</p>
            </div>
        ) : (
            <div className="flex-grow">
                {children}
            </div>
        )}
    </div>
);

const UnitSummary: React.FC<{ data: Patient[], title: string, isOutborn?: boolean }> = ({ data, title, isOutborn = false }) => {
    const stats = useMemo(() => {
        const total = data.length;
        const deceased = data.filter(p => p.outcome === 'Deceased').length;
        const discharged = data.filter(p => p.outcome === 'Discharged').length;
        const referred = data.filter(p => p.outcome === 'Referred').length;
        const inProgress = data.filter(p => p.outcome === 'In Progress').length;
        
        const mortalityRate = total > 0 ? ((deceased / total) * 100).toFixed(1) + '%' : '0%';
        const dischargeRate = total > 0 ? ((discharged / total) * 100).toFixed(1) + '%' : '0%';
        const referralRate = total > 0 ? ((referred / total) * 100).toFixed(1) + '%' : '0%';
        
        const patientsWithStay = data.filter(p => p.releaseDate);
        const totalStayDuration = patientsWithStay.reduce((acc, p) => {
            const admission = new Date(p.admissionDate).getTime();
            const release = new Date(p.releaseDate!).getTime();
            return acc + (release - admission);
        }, 0);
        const avgStay = patientsWithStay.length > 0 ? (totalStayDuration / patientsWithStay.length / (1000 * 60 * 60 * 24)).toFixed(1) : 'N/A';

        return { total, deceased, discharged, referred, inProgress, mortalityRate, dischargeRate, referralRate, avgStay };
    }, [data]);
    
    const monthlyTrends = useMemo(() => {
        const trends: { [key: string]: { admissions: number; discharges: number } } = {};
        const last12Months = Array.from({ length: 12 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        }).reverse();

        last12Months.forEach(month => {
            trends[month] = { admissions: 0, discharges: 0 };
        });

        data.forEach(p => {
            const admissionMonth = p.admissionDate.substring(0, 7);
            if (trends[admissionMonth]) {
                trends[admissionMonth].admissions++;
            }
            if (p.releaseDate) {
                const dischargeMonth = p.releaseDate.substring(0, 7);
                if (trends[dischargeMonth]) {
                    trends[dischargeMonth].discharges++;
                }
            }
        });

        return Object.entries(trends).map(([month, values]) => ({
            name: new Date(month + '-02').toLocaleString('default', { month: 'short', year: 'numeric' }),
            ...values
        }));
    }, [data]);

    const outcomeDistribution = useMemo(() => {
        const outcomes = data.reduce((acc, p) => {
            acc[p.outcome] = (acc[p.outcome] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(outcomes).map(([name, value]) => ({ name, value }));
    }, [data]);

    const genderDistribution = useMemo(() => {
        const genders = data.reduce((acc, p) => {
            acc[p.gender] = (acc[p.gender] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(genders).map(([name, value]) => ({ name, value }));
    }, [data]);

    const topDiagnoses = useMemo(() => {
        const diagnoses = data.reduce((acc, p) => {
            acc[p.diagnosis] = (acc[p.diagnosis] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(diagnoses)
            .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, value]) => ({ name, value }));
    }, [data]);
    
    const topReferringHospitals = useMemo(() => {
        if (!isOutborn) return [];
        const hospitals = data.reduce((acc, p) => {
            if (p.referringHospital) {
                acc[p.referringHospital] = (acc[p.referringHospital] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(hospitals)
            .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, value]) => ({ name, value }));
    }, [data, isOutborn]);

    const rateComparisonData = useMemo(() => [
        { name: 'Discharge Rate', value: parseFloat(stats.dischargeRate), color: '#10b981' },
        { name: 'Mortality Rate', value: parseFloat(stats.mortalityRate), color: '#ef4444' },
        { name: 'Referral Rate', value: parseFloat(stats.referralRate), color: '#f59e0b' },
    ], [stats]);

    return (
        <div className="p-3 sm:p-4 space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold text-sky-400">{title}</h2>
            
            {/* Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <StatCard title="Total Patients" value={stats.total} icon={<BedIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white"/>} color="bg-blue-500/80" />
                <StatCard title="In Progress" value={stats.inProgress} icon={<BedIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white"/>} color="bg-blue-400/80" />
                <StatCard title="Discharged" value={stats.discharged} icon={<ArrowRightOnRectangleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white"/>} color="bg-green-500/80" />
                <StatCard title="Referred" value={stats.referred} icon={<ArrowUpOnSquareIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white"/>} color="bg-orange-500/80" />
                <StatCard title="Deceased" value={stats.deceased} icon={<ChartBarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white"/>} color="bg-red-500/80" />
                <StatCard title="Avg. Stay (Days)" value={stats.avgStay} icon={<BedIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white"/>} color="bg-indigo-500/80" />
            </div>
            
            {/* Rates Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 p-4 sm:p-6 rounded-xl border border-green-500/30">
                    <div className="text-xs sm:text-sm text-green-300 font-medium mb-1">Discharge Rate</div>
                    <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-400">{stats.dischargeRate}</div>
                    <div className="text-xs text-green-300/70 mt-2">{stats.discharged} of {stats.total} patients</div>
                </div>
                <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 p-4 sm:p-6 rounded-xl border border-orange-500/30">
                    <div className="text-xs sm:text-sm text-orange-300 font-medium mb-1">Referral Rate</div>
                    <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-orange-400">{stats.referralRate}</div>
                    <div className="text-xs text-orange-300/70 mt-2">{stats.referred} of {stats.total} patients</div>
                </div>
                <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 p-4 sm:p-6 rounded-xl border border-red-500/30">
                    <div className="text-xs sm:text-sm text-red-300 font-medium mb-1">Mortality Rate</div>
                    <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-400">{stats.mortalityRate}</div>
                    <div className="text-xs text-red-300/70 mt-2">{stats.deceased} of {stats.total} patients</div>
                </div>
            </div>
            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <ChartWrapper title="📊 Admissions vs. Discharges (Last 12 Months)" noData={monthlyTrends.every(m => m.admissions === 0 && m.discharges === 0)}>
                    <ResponsiveContainer width="100%" height={300}>
                       <LineChart data={monthlyTrends}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                            <Legend />
                            <Line type="monotone" dataKey="admissions" stroke="#38bdf8" strokeWidth={2} />
                            <Line type="monotone" dataKey="discharges" stroke="#34d399" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartWrapper>
                 <ChartWrapper title="📈 Outcome Distribution" noData={!outcomeDistribution.length}>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                             <Pie data={outcomeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                {outcomeDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartWrapper>
                 <ChartWrapper title="🔬 Rates Comparison" noData={!rateComparisonData.length}>
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={rateComparisonData}>
                             <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                             <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }}/>
                             <YAxis stroke="#94a3b8" label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8' } }}/>
                             <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                             <Bar dataKey="value" name="Rate (%)">
                                {rateComparisonData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                             </Bar>
                         </BarChart>
                     </ResponsiveContainer>
                 </ChartWrapper>
                <ChartWrapper title="🩺 Top 5 Diagnoses" noData={!topDiagnoses.length}>
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topDiagnoses} layout="vertical" margin={{ left: 100 }}>
                             <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                             <XAxis type="number" stroke="#94a3b8" />
                             <YAxis type="category" dataKey="name" stroke="#94a3b8" width={150} tick={{ fontSize: 12 }}/>
                             <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                             <Bar dataKey="value" name="Count" fill="#0088FE" />
                         </BarChart>
                     </ResponsiveContainer>
                 </ChartWrapper>
                <ChartWrapper title="👥 Gender Distribution" noData={!genderDistribution.length}>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                             <Pie data={genderDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                                 {genderDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                             </Pie>
                             <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                             <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartWrapper>
                {isOutborn && (
                     <ChartWrapper title="🏥 Top 5 Referring Hospitals" noData={!topReferringHospitals.length}>
                         <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={topReferringHospitals} layout="vertical" margin={{ left: 100 }}>
                                 <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                                 <XAxis type="number" stroke="#94a3b8" />
                                 <YAxis type="category" dataKey="name" stroke="#94a3b8" width={150} tick={{ fontSize: 12 }}/>
                                 <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                                 <Bar dataKey="value" name="Referrals" fill="#FF8042" />
                             </BarChart>
                         </ResponsiveContainer>
                     </ChartWrapper>
                )}
            </div>
        </div>
    );
}


const ComprehensiveSummary: React.FC<ComprehensiveSummaryProps> = ({ patients, onBack }) => {
  const picuPatients = useMemo(() => patients.filter(p => p.unit === Unit.PICU), [patients]);
  const nicuPatients = useMemo(() => patients.filter(p => p.unit === Unit.NICU), [patients]);
  const nicuInborn = useMemo(() => nicuPatients.filter(p => p.admissionType === AdmissionType.Inborn), [nicuPatients]);
  const nicuOutborn = useMemo(() => nicuPatients.filter(p => p.admissionType === AdmissionType.Outborn), [nicuPatients]);
  
  const [activeNicuTab, setActiveNicuTab] = useState<'Overall' | 'Inborn' | 'Outborn'>('Overall');
  
  const nicuTabs: ('Overall' | 'Inborn' | 'Outborn')[] = ['Overall', 'Inborn', 'Outborn'];

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-300 hover:text-white active:text-white transition-colors p-2 -ml-2">
                <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Comprehensive Summary</h1>
                <p className="text-xs sm:text-sm text-slate-400">Deep dive into unit performance and patient demographics.</p>
            </div>
        </div>
        
        <details open className="bg-slate-800 rounded-lg sm:rounded-xl border border-slate-700 overflow-hidden">
            <summary className="p-3 sm:p-4 bg-slate-700/50 cursor-pointer text-base sm:text-xl font-bold text-white hover:bg-slate-700 active:bg-slate-700 transition-colors">
                PICU Summary
            </summary>
            <UnitSummary data={picuPatients} title="Pediatric Intensive Care Unit Overall" />
        </details>
        
        <details open className="bg-slate-800 rounded-lg sm:rounded-xl border border-slate-700 overflow-hidden">
            <summary className="p-3 sm:p-4 bg-slate-700/50 cursor-pointer text-base sm:text-xl font-bold text-white hover:bg-slate-700 active:bg-slate-700 transition-colors">
                NICU Summary
            </summary>
            <div className="p-3 sm:p-4 border-b border-slate-700">
                <div className="flex bg-slate-700/50 p-1 rounded-lg border border-slate-600 w-full">
                    {nicuTabs.map(tab => (
                        <button key={tab} onClick={() => setActiveNicuTab(tab)} 
                        className={`px-3 sm:px-6 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all duration-300 flex-1 ${activeNicuTab === tab ? 'bg-blue-500 text-white shadow-md' : 'text-slate-300 hover:bg-slate-600/50 active:bg-slate-600'}`}>
                            {tab}
                        </button>
                    ))}
                </div>
            </div>
            
            {activeNicuTab === 'Overall' && <UnitSummary data={nicuPatients} title="Neonatal Intensive Care Unit - Overall" />}
            {activeNicuTab === 'Inborn' && <UnitSummary data={nicuInborn} title="NICU - Inborn Patients" />}
            {activeNicuTab === 'Outborn' && <UnitSummary data={nicuOutborn} title="NICU - Outborn Patients" isOutborn={true} />}
        </details>
    </div>
  );
};

export default ComprehensiveSummary;
