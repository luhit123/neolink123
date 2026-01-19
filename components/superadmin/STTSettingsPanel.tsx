/**
 * STT Settings Panel
 *
 * SuperAdmin panel for managing Speech-to-Text service configuration
 * Allows switching between Deepgram and Faster Whisper providers
 */

import React, { useState, useEffect } from 'react';
import {
  getSTTSettings,
  saveSTTSettings,
  subscribeToSTTSettings,
  getProviderDisplayName,
  getProviderStatus,
  STTSettings,
  STTProvider,
  DEFAULT_STT_SETTINGS
} from '../../services/sttSettingsService';
import { testDeepgramConnection } from '../../services/deepgramService';
import { testFasterWhisperConnection } from '../../services/fasterWhisperService';

interface STTSettingsPanelProps {
  userEmail?: string;
}

const STTSettingsPanel: React.FC<STTSettingsPanelProps> = ({ userEmail }) => {
  const [settings, setSettings] = useState<STTSettings>(DEFAULT_STT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<STTProvider | null>(null);
  const [testResults, setTestResults] = useState<Record<STTProvider, boolean | null>>({
    deepgram: null,
    fasterWhisper: null
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await getSTTSettings();
        setSettings(loadedSettings);
      } catch (err) {
        console.error('Failed to load STT settings:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();

    // Subscribe to real-time updates
    const unsubscribe = subscribeToSTTSettings((newSettings) => {
      setSettings(newSettings);
    });

    return () => unsubscribe();
  }, []);

  // Handle provider change
  const handleProviderChange = async (provider: STTProvider) => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updatedSettings = {
        ...settings,
        activeProvider: provider
      };
      await saveSTTSettings(updatedSettings, userEmail);
      setSettings(updatedSettings);
      setSuccess(`Active STT provider changed to ${getProviderDisplayName(provider)}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  // Test connection for a provider
  const handleTestConnection = async (provider: STTProvider) => {
    setTesting(provider);
    setTestResults(prev => ({ ...prev, [provider]: null }));

    try {
      let result = false;
      switch (provider) {
        case 'deepgram':
          result = await testDeepgramConnection();
          break;
        case 'fasterWhisper':
          result = await testFasterWhisperConnection();
          break;
      }
      setTestResults(prev => ({ ...prev, [provider]: result }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [provider]: false }));
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-400">Loading STT settings...</span>
      </div>
    );
  }

  const deepgramStatus = getProviderStatus('deepgram');
  const fasterWhisperStatus = getProviderStatus('fasterWhisper');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Speech-to-Text Configuration
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Configure the speech-to-text service for voice clinical notes
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-700 dark:text-green-400 text-sm">{success}</p>
        </div>
      )}

      {/* Current Provider Info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Provider</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {getProviderDisplayName(settings.activeProvider)}
            </p>
          </div>
          <div className={`w-4 h-4 rounded-full ${
            settings.activeProvider === 'deepgram' && deepgramStatus.configured ||
            settings.activeProvider === 'fasterWhisper' && fasterWhisperStatus.configured
              ? 'bg-green-500'
              : 'bg-red-500'
          }`} />
        </div>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Deepgram Card */}
        <div className={`relative rounded-xl border-2 p-5 transition-all ${
          settings.activeProvider === 'deepgram'
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
        }`}>
          {settings.activeProvider === 'deepgram' && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Active
              </span>
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-slate-900 dark:text-white">Deepgram Nova-3</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Real-time streaming transcription with medical keyword optimization
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {/* Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${deepgramStatus.configured ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={`text-sm ${deepgramStatus.configured ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {deepgramStatus.configured ? 'Configured' : 'Not configured'}
              </span>
            </div>

            {!deepgramStatus.configured && deepgramStatus.reason && (
              <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded p-2">
                {deepgramStatus.reason}
              </p>
            )}

            {/* Features */}
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Real-time streaming
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Medical vocabulary
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Smart formatting
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleTestConnection('deepgram')}
                disabled={!deepgramStatus.configured || testing === 'deepgram'}
                className="flex-1 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {testing === 'deepgram' ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600"></div>
                    Testing...
                  </span>
                ) : testResults.deepgram === true ? (
                  <span className="text-green-600 dark:text-green-400">✓ Connected</span>
                ) : testResults.deepgram === false ? (
                  <span className="text-red-600 dark:text-red-400">✗ Failed</span>
                ) : (
                  'Test Connection'
                )}
              </button>

              {settings.activeProvider !== 'deepgram' && (
                <button
                  onClick={() => handleProviderChange('deepgram')}
                  disabled={!deepgramStatus.configured || saving}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Switching...' : 'Activate'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Faster Whisper Card */}
        <div className={`relative rounded-xl border-2 p-5 transition-all ${
          settings.activeProvider === 'fasterWhisper'
            ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-purple-300'
        }`}>
          {settings.activeProvider === 'fasterWhisper' && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                Active
              </span>
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-slate-900 dark:text-white">Faster Whisper 1.0.10</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                High-accuracy batch transcription on RunPod serverless
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {/* Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${fasterWhisperStatus.configured ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={`text-sm ${fasterWhisperStatus.configured ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {fasterWhisperStatus.configured ? 'Configured' : 'Not configured'}
              </span>
            </div>

            {!fasterWhisperStatus.configured && fasterWhisperStatus.reason && (
              <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded p-2">
                {fasterWhisperStatus.reason}
              </p>
            )}

            {/* Endpoint Info */}
            <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded p-2">
              <span className="font-medium">Endpoint:</span> zaksh05iky86bv
            </div>

            {/* Features */}
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                High accuracy
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                GPU-accelerated
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Batch mode (not real-time)
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleTestConnection('fasterWhisper')}
                disabled={!fasterWhisperStatus.configured || testing === 'fasterWhisper'}
                className="flex-1 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {testing === 'fasterWhisper' ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600"></div>
                    Testing...
                  </span>
                ) : testResults.fasterWhisper === true ? (
                  <span className="text-green-600 dark:text-green-400">✓ Connected</span>
                ) : testResults.fasterWhisper === false ? (
                  <span className="text-red-600 dark:text-red-400">✗ Failed</span>
                ) : (
                  'Test Connection'
                )}
              </button>

              {settings.activeProvider !== 'fasterWhisper' && (
                <button
                  onClick={() => handleProviderChange('fasterWhisper')}
                  disabled={!fasterWhisperStatus.configured || saving}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Switching...' : 'Activate'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">Provider Differences:</p>
            <ul className="mt-1 list-disc list-inside space-y-1 text-amber-700 dark:text-amber-300">
              <li><strong>Deepgram:</strong> Shows transcription in real-time as you speak</li>
              <li><strong>Faster Whisper:</strong> Records audio first, then transcribes when you stop (higher accuracy but slight delay)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Last Modified Info */}
      {settings.lastModifiedBy && (
        <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
          Last modified by: {settings.lastModifiedBy}
          {settings.lastModifiedAt && (
            <span> on {new Date(settings.lastModifiedAt).toLocaleString()}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default STTSettingsPanel;
