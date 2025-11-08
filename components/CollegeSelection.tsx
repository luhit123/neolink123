import React, { useState } from 'react';

interface CollegeSelectionProps {
  onSelectCollege: (collegeName: string, collegeId: string) => void;
}

interface MedicalCollege {
  id: string;
  name: string;
  location: string;
  enabled: boolean;
}

const assamMedicalColleges: MedicalCollege[] = [
  {
    id: 'nalbari-medical-college',
    name: 'Nalbari Medical College and Hospital',
    location: 'Nalbari',
    enabled: true
  },
  {
    id: 'gauhati-medical-college',
    name: 'Gauhati Medical College and Hospital',
    location: 'Guwahati',
    enabled: false
  },
  {
    id: 'assam-medical-college',
    name: 'Assam Medical College and Hospital',
    location: 'Dibrugarh',
    enabled: false
  },
  {
    id: 'silchar-medical-college',
    name: 'Silchar Medical College and Hospital',
    location: 'Silchar',
    enabled: false
  },
  {
    id: 'jorhat-medical-college',
    name: 'Jorhat Medical College and Hospital',
    location: 'Jorhat',
    enabled: false
  },
  {
    id: 'tezpur-medical-college',
    name: 'Tezpur Medical College and Hospital',
    location: 'Tezpur',
    enabled: false
  },
  {
    id: 'diphu-medical-college',
    name: 'Diphu Medical College and Hospital',
    location: 'Diphu',
    enabled: false
  },
  {
    id: 'barpeta-medical-college',
    name: 'Barpeta Medical College and Hospital',
    location: 'Barpeta',
    enabled: false
  },
  {
    id: 'lakhimpur-medical-college',
    name: 'Lakhimpur Medical College and Hospital',
    location: 'North Lakhimpur',
    enabled: false
  },
  {
    id: 'fakhruddin-medical-college',
    name: 'Fakhruddin Ali Ahmed Medical College',
    location: 'Barpeta',
    enabled: false
  }
];

const CollegeSelection: React.FC<CollegeSelectionProps> = ({ onSelectCollege }) => {
  const [selectedCollege, setSelectedCollege] = useState<MedicalCollege>(assamMedicalColleges[0]);

  const handleSelectCollege = (college: MedicalCollege) => {
    if (college.enabled) {
      setSelectedCollege(college);
    }
  };

  const handleContinue = () => {
    onSelectCollege(selectedCollege.name, selectedCollege.id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl p-6 sm:p-10 space-y-6 sm:space-y-8 bg-slate-800/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-cyan-500/20">
        <div className="text-center">
          <div className="inline-block p-4 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl mb-4">
            <h1 className="text-4xl sm:text-5xl font-bold text-white">
              <span className="text-cyan-400">Neo</span>Link
            </h1>
          </div>
          <p className="mt-3 text-base sm:text-lg text-slate-300 font-medium">
            🏥 Medical Records Management System
          </p>
          <h2 className="mt-6 sm:mt-8 text-xl sm:text-2xl font-bold text-white">
            Select Your Medical College
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-400">
            Choose your institution to continue
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 max-h-[50vh] overflow-y-auto p-2">
          {assamMedicalColleges.map((college) => (
            <div
              key={college.name}
              onClick={() => handleSelectCollege(college)}
              className={`p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 ${
                college.enabled
                  ? selectedCollege.name === college.name
                    ? 'bg-cyan-500/20 border-cyan-500 shadow-lg shadow-cyan-500/20 cursor-pointer'
                    : 'bg-slate-700/50 border-slate-600 hover:border-slate-500 cursor-pointer'
                  : 'bg-slate-700/20 border-slate-700 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className={`font-bold text-sm sm:text-base mb-1 ${
                    college.enabled && selectedCollege.name === college.name
                      ? 'text-cyan-300'
                      : college.enabled
                      ? 'text-slate-200'
                      : 'text-slate-500'
                  }`}>
                    {college.name}
                  </h3>
                  <p className={`text-xs sm:text-sm ${
                    college.enabled ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    📍 {college.location}
                  </p>
                </div>
                {!college.enabled && (
                  <span className="ml-2 px-2 py-1 bg-slate-600 text-slate-300 rounded text-xs font-medium whitespace-nowrap">
                    Coming Soon
                  </span>
                )}
                {college.enabled && selectedCollege.name === college.name && (
                  <span className="ml-2 text-cyan-400 text-xl">✓</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={handleContinue}
            className="w-full py-3 sm:py-4 px-4 border border-transparent text-sm sm:text-base font-semibold rounded-xl text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-slate-800 transition-all shadow-lg hover:shadow-cyan-500/50"
          >
            ✓ Continue to {selectedCollege.name === 'Nalbari Medical College and Hospital' ? 'Nalbari Medical College' : 'Login'}
          </button>
        </div>

        <div className="text-center">
          <p className="text-xs text-slate-500">
            More medical colleges will be available soon
          </p>
        </div>

        <div className="text-center text-xs text-slate-500 pt-4 border-t border-slate-700">
          © 2024 NeoLink - Advanced Medical Records System for Assam
        </div>
      </div>
    </div>
  );
};

export default CollegeSelection;
