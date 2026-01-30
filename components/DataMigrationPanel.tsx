import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Database,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Upload,
  Clock
} from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabaseConfig';
import { migrateInstitutionPatients } from '../scripts/migrateToSupabase';

interface DataMigrationPanelProps {
  institutionId: string;
  institutionName: string;
}

interface MigrationProgress {
  current: number;
  total: number;
  status: string;
  currentPatient?: string;
}

const DataMigrationPanel: React.FC<DataMigrationPanelProps> = ({
  institutionId,
  institutionName
}) => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [result, setResult] = useState<{
    totalPatients: number;
    synced: number;
    failed: number;
    errors: Array<{ patientId: string; patientName: string; error: string }>;
  } | null>(null);

  const isConfigured = isSupabaseConfigured();

  const handleMigration = async () => {
    if (!isConfigured || isMigrating) return;

    setIsMigrating(true);
    setProgress(null);
    setResult(null);

    try {
      const migrationResult = await migrateInstitutionPatients(
        institutionId,
        (progressUpdate) => setProgress(progressUpdate)
      );
      setResult(migrationResult);
    } catch (error) {
      console.error('Migration error:', error);
      setResult({
        totalPatients: 0,
        synced: 0,
        failed: 1,
        errors: [{ patientId: 'N/A', patientName: 'N/A', error: String(error) }]
      });
    } finally {
      setIsMigrating(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">Supabase Not Configured</p>
            <p className="text-sm text-amber-600">
              Configure Supabase environment variables to enable data sync.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-purple-50">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          Data Sync & Migration
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Sync patient data from Firebase to Supabase for analytics and reporting
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Institution Info */}
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-sm text-slate-600">Institution</p>
          <p className="font-semibold text-slate-800">{institutionName}</p>
          <p className="text-xs text-slate-500 mt-1">ID: {institutionId}</p>
        </div>

        {/* Migration Button */}
        <button
          onClick={handleMigration}
          disabled={isMigrating}
          className={`w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-3 transition-all ${
            isMigrating
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
          }`}
        >
          {isMigrating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Migrating...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Start Migration
            </>
          )}
        </button>

        {/* Progress */}
        {progress && isMigrating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-700">
                {progress.status}
              </span>
              <span className="text-sm text-blue-600">
                {progress.current} / {progress.total}
              </span>
            </div>
            {progress.total > 0 && (
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            )}
            {progress.currentPatient && (
              <p className="text-xs text-blue-600 mt-2">
                Current: {progress.currentPatient}
              </p>
            )}
          </motion.div>
        )}

        {/* Result */}
        {result && !isMigrating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl p-4 ${
              result.failed === 0
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-amber-50 border border-amber-200'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              {result.failed === 0 ? (
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600" />
              )}
              <div>
                <p className={`font-semibold ${
                  result.failed === 0 ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  Migration Complete
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-lg p-2">
                <p className="text-2xl font-bold text-slate-800">{result.totalPatients}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-2xl font-bold text-emerald-600">{result.synced}</p>
                <p className="text-xs text-slate-500">Synced</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                <p className="text-xs text-slate-500">Failed</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-amber-700 mb-2">Errors:</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.errors.slice(0, 5).map((err, idx) => (
                    <div key={idx} className="text-xs bg-white p-2 rounded">
                      <p className="font-medium text-slate-700">{err.patientName}</p>
                      <p className="text-red-600">{err.error}</p>
                    </div>
                  ))}
                  {result.errors.length > 5 && (
                    <p className="text-xs text-slate-500">
                      ...and {result.errors.length - 5} more errors
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Info */}
        <div className="bg-slate-50 rounded-xl p-4">
          <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Migration Info
          </h3>
          <ul className="text-sm text-slate-600 space-y-2">
            <li>• Syncs all patients from Firebase to Supabase</li>
            <li>• Creates institution and unit records automatically</li>
            <li>• Syncs progress notes and discharge summaries</li>
            <li>• Updates Firebase records with Supabase IDs</li>
            <li>• Safe to run multiple times (updates existing records)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DataMigrationPanel;
