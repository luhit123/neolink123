/**
 * Clinical Note AI Settings Panel
 *
 * SuperAdmin panel for managing Clinical Note AI provider configuration
 * Allows switching between Google Gemini and OpenAI GPT-4o providers
 */

import React, { useState, useEffect } from 'react';
import {
  getClinicalNoteAIConfig,
  updateClinicalNoteAIConfig,
  checkAIProviderAvailability,
  ClinicalNoteAIProvider,
  ClinicalNoteAIConfig
} from '../../services/clinicalNoteAIService';

interface ClinicalNoteAISettingsPanelProps {
  userEmail?: string;
}

const ClinicalNoteAISettingsPanel: React.FC<ClinicalNoteAISettingsPanelProps> = ({ userEmail }) => {
  const [config, setConfig] = useState<ClinicalNoteAIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [availability, setAvailability] = useState({ gemini: false, gpt4o: false });

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const loadedConfig = await getClinicalNoteAIConfig();
        setConfig(loadedConfig);
        const avail = checkAIProviderAvailability();
        setAvailability(avail);
      } catch (err) {
        console.error('Failed to load Clinical Note AI config:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Handle provider change
  const handleProviderChange = async (provider: ClinicalNoteAIProvider) => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await updateClinicalNoteAIConfig(provider, userEmail || 'superadmin');
      setConfig(prev => prev ? { ...prev, provider } : null);
      const displayName = provider === 'gpt4o' ? 'OpenAI GPT-4o' : 'Google Gemini';
      setSuccess(`Clinical Note AI provider changed to ${displayName}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/10 rounded-lg">
          <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Clinical Note AI Provider</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select the AI model used for generating clinical notes
          </p>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Provider Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* GPT-4o Option */}
        <button
          onClick={() => handleProviderChange('gpt4o')}
          disabled={saving || !availability.gpt4o}
          className={`relative p-4 rounded-xl border-2 transition-all text-left ${
            config?.provider === 'gpt4o'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-slate-200 dark:border-slate-600 hover:border-green-300 dark:hover:border-green-600'
          } ${!availability.gpt4o ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {config?.provider === 'gpt4o' && (
            <div className="absolute top-2 right-2">
              <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-white">OpenAI GPT-4o</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Recommended</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Latest GPT-4o model with excellent clinical reasoning
          </p>
          {!availability.gpt4o && (
            <div className="mt-2 text-xs text-red-500">API key not configured</div>
          )}
        </button>

        {/* Gemini Option */}
        <button
          onClick={() => handleProviderChange('gemini')}
          disabled={saving || !availability.gemini}
          className={`relative p-4 rounded-xl border-2 transition-all text-left ${
            config?.provider === 'gemini'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600'
          } ${!availability.gemini ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {config?.provider === 'gemini' && (
            <div className="absolute top-2 right-2">
              <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm0 3.6c2.1 0 4 .7 5.5 2L12 12 6.5 5.6c1.5-1.3 3.4-2 5.5-2zm-8.4 8.4c0-2.1.7-4 2-5.5L12 12l-6.5 5.5c-1.3-1.5-2-3.4-2-5.5zm8.4 8.4c-2.1 0-4-.7-5.5-2L12 12l5.5 6.5c-1.5 1.3-3.4 2-5.5 2zm6.5-2.9L12 12l6.5-5.5c1.3 1.5 2 3.4 2 5.5s-.7 4-2 5.5z"/>
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-white">Google Gemini</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Gemini 2.0 Flash</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Fast and capable model from Google
          </p>
          {!availability.gemini && (
            <div className="mt-2 text-xs text-red-500">API key not configured</div>
          )}
        </button>
      </div>

      {/* Saving Indicator */}
      {saving && (
        <div className="flex items-center justify-center gap-2 text-slate-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-500"></div>
          <span className="text-sm">Saving...</span>
        </div>
      )}

      {/* Current Config Info */}
      {config && (
        <div className="text-xs text-slate-400 text-center">
          Last updated: {new Date(config.updatedAt).toLocaleString()} by {config.updatedBy}
        </div>
      )}
    </div>
  );
};

export default ClinicalNoteAISettingsPanel;
