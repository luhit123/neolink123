/**
 * ICD-10 Selector Component
 * Allows searching and selecting ICD-10 codes with AI suggestions
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  X,
  Check,
  Sparkles,
  FileCode,
  ChevronDown,
  ChevronUp,
  Star,
  Info,
  Loader2
} from 'lucide-react';
import { ICD10Code, ICD10Suggestion, PatientICD10 } from '../types/icd10';
import { icd10Service } from '../services/icd10Service';
import { Patient } from '../types';

interface ICD10SelectorProps {
  patient: Patient;
  clinicalText?: string;
  selectedCodes: PatientICD10[];
  onCodesChange: (codes: PatientICD10[]) => void;
  userId: string;
  userName: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const ICD10Selector: React.FC<ICD10SelectorProps> = ({
  patient,
  clinicalText,
  selectedCodes,
  onCodesChange,
  userId,
  userName,
  isExpanded = true,
  onToggleExpand
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ICD10Code[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<ICD10Suggestion[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showCommon, setShowCommon] = useState(true);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'search' | 'common'>('suggestions');

  // Get common codes
  const commonCodes = useMemo(() => icd10Service.getCommonCodes(), []);

  // Search codes when search term changes
  useEffect(() => {
    if (searchTerm.length >= 2) {
      const results = icd10Service.search(searchTerm, 15);
      setSearchResults(results.map(r => r.code));
      if (results.length > 0) {
        setActiveTab('search');
      }
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  // Get AI suggestions when clinical text or patient changes
  useEffect(() => {
    const fetchAISuggestions = async () => {
      if (!patient.diagnosis && !clinicalText) {
        setAiSuggestions([]);
        return;
      }

      setIsLoadingAI(true);
      try {
        const suggestions = await icd10Service.getComprehensiveSuggestions(
          clinicalText || patient.diagnosis || '',
          patient
        );
        setAiSuggestions(suggestions);
      } catch (error) {
        console.warn('Failed to get ICD-10 suggestions:', error);
        // Fall back to diagnosis-based suggestions
        const fallbackSuggestions = icd10Service.getSuggestionsFromDiagnosis(
          patient.diagnosis || ''
        );
        setAiSuggestions(fallbackSuggestions);
      } finally {
        setIsLoadingAI(false);
      }
    };

    fetchAISuggestions();
  }, [patient.diagnosis, patient.id, clinicalText]);

  // Add a code
  const handleAddCode = useCallback((code: ICD10Code, source: 'template' | 'ai' | 'manual' = 'manual', confidence?: number) => {
    // Check if already selected
    if (selectedCodes.some(c => c.code === code.code)) return;

    const isPrimary = selectedCodes.length === 0;
    const newCode = icd10Service.createPatientICD10(
      patient.id || '',
      code.code,
      userId,
      userName,
      {
        isPrimary,
        source,
        aiConfidence: confidence
      }
    );

    if (newCode) {
      onCodesChange([...selectedCodes, newCode]);
    }
  }, [selectedCodes, patient.id, userId, userName, onCodesChange]);

  // Remove a code
  const handleRemoveCode = useCallback((codeId: string) => {
    const newCodes = selectedCodes.filter(c => c.id !== codeId);

    // Reassign primary if needed
    if (newCodes.length > 0 && !newCodes.some(c => c.isPrimary)) {
      newCodes[0].isPrimary = true;
    }

    onCodesChange(newCodes);
  }, [selectedCodes, onCodesChange]);

  // Set primary code
  const handleSetPrimary = useCallback((codeId: string) => {
    const newCodes = selectedCodes.map(c => ({
      ...c,
      isPrimary: c.id === codeId
    }));
    onCodesChange(newCodes);
  }, [selectedCodes, onCodesChange]);

  // Add from suggestion
  const handleAddSuggestion = (suggestion: ICD10Suggestion) => {
    const code = icd10Service.getCode(suggestion.code);
    if (code) {
      handleAddCode(code, suggestion.source, suggestion.confidence);
    }
  };

  // Check if code is selected
  const isCodeSelected = (code: string) => selectedCodes.some(c => c.code === code);

  if (!isExpanded) {
    return (
      <div
        onClick={onToggleExpand}
        className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700">ICD-10 Codes</span>
            {selectedCodes.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                {selectedCodes.length} selected
              </span>
            )}
          </div>
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        onClick={onToggleExpand}
        className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-800">ICD-10 Codes</span>
            {selectedCodes.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                {selectedCodes.length}
              </span>
            )}
          </div>
          <ChevronUp className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Selected codes */}
      {selectedCodes.length > 0 && (
        <div className="p-3 bg-gray-50 border-b">
          <div className="text-xs font-medium text-gray-500 mb-2">Selected Codes</div>
          <div className="flex flex-wrap gap-2">
            {selectedCodes.map(code => (
              <div
                key={code.id}
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm
                  ${code.isPrimary ? 'bg-blue-100 border border-blue-300' : 'bg-gray-100 border border-gray-200'}
                `}
              >
                {code.isPrimary && (
                  <Star className="w-3 h-3 text-blue-600 fill-blue-600" />
                )}
                <span className="font-medium text-gray-700">{code.code}</span>
                <span className="text-gray-500 text-xs truncate max-w-32">
                  {code.description.split(',')[0]}
                </span>
                {!code.isPrimary && selectedCodes.length > 1 && (
                  <button
                    onClick={() => handleSetPrimary(code.id)}
                    className="p-0.5 hover:bg-blue-200 rounded"
                    title="Set as primary"
                  >
                    <Star className="w-3 h-3 text-gray-400" />
                  </button>
                )}
                <button
                  onClick={() => handleRemoveCode(code.id)}
                  className="p-0.5 hover:bg-red-100 rounded"
                >
                  <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search ICD-10 codes..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab === 'suggestions'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <Sparkles className="w-4 h-4" />
            Suggestions
            {aiSuggestions.length > 0 && (
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                {aiSuggestions.length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab === 'search'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <Search className="w-4 h-4" />
            Search
            {searchResults.length > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {searchResults.length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('common')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab === 'common'
              ? 'text-green-600 border-b-2 border-green-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <Star className="w-4 h-4" />
            Common
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        {/* AI Suggestions */}
        {activeTab === 'suggestions' && (
          <div className="p-2">
            {isLoadingAI ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Analyzing clinical text...
              </div>
            ) : aiSuggestions.length > 0 ? (
              <div className="space-y-1">
                {aiSuggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.code}-${index}`}
                    onClick={() => handleAddSuggestion(suggestion)}
                    disabled={isCodeSelected(suggestion.code)}
                    className={`
                      w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors
                      ${isCodeSelected(suggestion.code)
                        ? 'bg-green-50 border border-green-200 cursor-default'
                        : 'hover:bg-purple-50 border border-transparent'
                      }
                    `}
                  >
                    <div className={`
                      p-1.5 rounded
                      ${suggestion.isPrimary ? 'bg-purple-100' : 'bg-gray-100'}
                    `}>
                      {suggestion.source === 'ai' ? (
                        <Sparkles className="w-4 h-4 text-purple-600" />
                      ) : (
                        <FileCode className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-800">
                          {suggestion.code}
                        </span>
                        {suggestion.isPrimary && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                            Primary
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {Math.round(suggestion.confidence * 100)}% match
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {suggestion.description}
                      </p>
                    </div>
                    {isCodeSelected(suggestion.code) ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Plus className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No suggestions available</p>
                <p className="text-xs mt-1">Enter diagnosis or clinical text to get suggestions</p>
              </div>
            )}
          </div>
        )}

        {/* Search Results */}
        {activeTab === 'search' && (
          <div className="p-2">
            {searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map(code => (
                  <button
                    key={code.code}
                    onClick={() => handleAddCode(code)}
                    disabled={isCodeSelected(code.code)}
                    className={`
                      w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors
                      ${isCodeSelected(code.code)
                        ? 'bg-green-50 border border-green-200 cursor-default'
                        : 'hover:bg-blue-50 border border-transparent'
                      }
                    `}
                  >
                    <div className="p-1.5 bg-gray-100 rounded">
                      <FileCode className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-800">
                          {code.code}
                        </span>
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {code.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {code.description}
                      </p>
                    </div>
                    {isCodeSelected(code.code) ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Plus className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                ))}
              </div>
            ) : searchTerm.length >= 2 ? (
              <div className="text-center py-8 text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No codes found for "{searchTerm}"</p>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Type at least 2 characters to search</p>
              </div>
            )}
          </div>
        )}

        {/* Common Codes */}
        {activeTab === 'common' && (
          <div className="p-2">
            <div className="space-y-1">
              {commonCodes.map(code => (
                <button
                  key={code.code}
                  onClick={() => handleAddCode(code)}
                  disabled={isCodeSelected(code.code)}
                  className={`
                    w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors
                    ${isCodeSelected(code.code)
                      ? 'bg-green-50 border border-green-200 cursor-default'
                      : 'hover:bg-green-50 border border-transparent'
                    }
                  `}
                >
                  <div className="p-1.5 bg-green-100 rounded">
                    <Star className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-800">
                        {code.code}
                      </span>
                      <span className="text-xs text-gray-500">
                        {code.shortDescription}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {code.description}
                    </p>
                  </div>
                  {isCodeSelected(code.code) ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Plus className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t bg-gray-50">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Info className="w-3 h-3" />
          <span>First code added is marked as primary. Click star to change.</span>
        </div>
      </div>
    </div>
  );
};

export default ICD10Selector;
