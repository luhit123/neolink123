import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassModal } from '../premium/GlassModal';
import { PremiumButton, IconButton } from '../premium/PremiumButton';
import { GlassCard } from '../premium/GlassCard';
import { glassmorphism, glassClasses } from '../../theme/glassmorphism';
import {
  ClinicalTemplate,
  getAllTemplates,
  getTemplatesByCategory,
  searchTemplates,
  getRecentTemplates,
  getFavoriteTemplates,
  toggleTemplateFavorite,
  isTemplateFavorite,
  markTemplateAsUsed,
} from '../../services/smartTemplates';
import { ProgressNote } from '../../types';

export interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ClinicalTemplate) => void;
  currentUnit?: string;
}

/**
 * TemplatePickerModal - Beautiful template selection interface
 *
 * Features:
 * - Search templates by name/keyword
 * - Filter by category (NICU, PICU, SNCU, General)
 * - Recently used templates
 * - Favorite templates
 * - Template preview with detailed information
 * - Glassmorphism design
 *
 * @example
 * <TemplatePickerModal
 *   isOpen={showTemplatePicker}
 *   onClose={() => setShowTemplatePicker(false)}
 *   onSelectTemplate={(template) => applyTemplate(template)}
 *   currentUnit="NICU"
 * />
 */
export const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  currentUnit,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'NICU' | 'PICU' | 'SNCU' | 'General'>('All');
  const [previewTemplate, setPreviewTemplate] = useState<ClinicalTemplate | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites on mount
  React.useEffect(() => {
    if (isOpen) {
      const favTemplates = getFavoriteTemplates();
      setFavorites(favTemplates.map((t) => t.id));
    }
  }, [isOpen]);

  // Get templates based on filters
  const filteredTemplates = useMemo(() => {
    let templates = searchQuery ? searchTemplates(searchQuery) : getAllTemplates();

    if (selectedCategory !== 'All') {
      templates = templates.filter((t) => t.category === selectedCategory);
    }

    return templates;
  }, [searchQuery, selectedCategory]);

  const recentTemplates = useMemo(() => getRecentTemplates(), [isOpen]);
  const favoriteTemplates = useMemo(() => getFavoriteTemplates(), [favorites, isOpen]);

  const handleSelectTemplate = (template: ClinicalTemplate) => {
    markTemplateAsUsed(template.id);
    onSelectTemplate(template);
    onClose();
  };

  const handleToggleFavorite = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFav = toggleTemplateFavorite(templateId);
    setFavorites((prev) => (isFav ? [...prev, templateId] : prev.filter((id) => id !== templateId)));
  };

  const categories: Array<'All' | 'NICU' | 'PICU' | 'SNCU' | 'General'> = ['All', 'NICU', 'PICU', 'SNCU', 'General'];

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="Select Clinical Template" size="xl" variant="center">
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search templates (e.g., RDS, sepsis, pneumonia)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={glassClasses(
              glassmorphism.components.input,
              'w-full pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400'
            )}
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={glassClasses(
                'px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                selectedCategory === category
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg'
                  : glassmorphism.components.chip + ' text-slate-700 hover:bg-white/80'
              )}
            >
              {category}
              {category !== 'All' && (
                <span className="ml-2 text-xs opacity-75">
                  ({getTemplatesByCategory(category as any).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Recently Used Templates */}
        {!searchQuery && recentTemplates.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Recently Used
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => handleSelectTemplate(template)}
                  onPreview={() => setPreviewTemplate(template)}
                  isFavorite={isTemplateFavorite(template.id)}
                  onToggleFavorite={(e) => handleToggleFavorite(template.id, e)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Favorite Templates */}
        {!searchQuery && favoriteTemplates.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Favorites
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {favoriteTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => handleSelectTemplate(template)}
                  onPreview={() => setPreviewTemplate(template)}
                  isFavorite={true}
                  onToggleFavorite={(e) => handleToggleFavorite(template.id, e)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Templates */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            {searchQuery ? `Search Results (${filteredTemplates.length})` : 'All Templates'}
          </h3>
          <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
            {filteredTemplates.length > 0 ? (
              filteredTemplates.map((template, index) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <TemplateListItem
                    template={template}
                    onSelect={() => handleSelectTemplate(template)}
                    onPreview={() => setPreviewTemplate(template)}
                    isFavorite={isTemplateFavorite(template.id)}
                    onToggleFavorite={(e) => handleToggleFavorite(template.id, e)}
                  />
                </motion.div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500">
                <svg
                  className="w-16 h-16 mx-auto mb-3 opacity-30"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p>No templates found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Preview Modal */}
      <AnimatePresence>
        {previewTemplate && (
          <TemplatePreviewModal
            template={previewTemplate}
            onClose={() => setPreviewTemplate(null)}
            onUse={() => handleSelectTemplate(previewTemplate)}
          />
        )}
      </AnimatePresence>
    </GlassModal>
  );
};

/**
 * Template Card Component (Grid View)
 */
const TemplateCard: React.FC<{
  template: ClinicalTemplate;
  onSelect: () => void;
  onPreview: () => void;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
}> = ({ template, onSelect, onPreview, isFavorite, onToggleFavorite }) => {
  return (
    <GlassCard variant="light" shadow="card" padding="sm" hoverable onClick={onPreview} className="cursor-pointer group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={glassClasses(
                'px-2 py-0.5 rounded-full text-xs font-semibold',
                template.category === 'NICU'
                  ? 'bg-blue-100 text-blue-700'
                  : template.category === 'PICU'
                  ? 'bg-purple-100 text-purple-700'
                  : template.category === 'SNCU'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-700'
              )}
            >
              {template.category}
            </span>
          </div>
          <h4 className="font-semibold text-sm text-slate-800 mb-1 truncate group-hover:text-sky-600 transition-colors">
            {template.name}
          </h4>
          <p className="text-xs text-slate-600 line-clamp-2">{template.description}</p>
        </div>
        <button
          onClick={onToggleFavorite}
          className="flex-shrink-0 p-1 hover:scale-110 transition-transform"
        >
          <svg
            className={glassClasses('w-5 h-5', isFavorite ? 'fill-yellow-500 text-yellow-500' : 'fill-none text-slate-400')}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
      </div>
    </GlassCard>
  );
};

/**
 * Template List Item Component
 */
const TemplateListItem: React.FC<{
  template: ClinicalTemplate;
  onSelect: () => void;
  onPreview: () => void;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
}> = ({ template, onSelect, onPreview, isFavorite, onToggleFavorite }) => {
  return (
    <div
      onClick={onPreview}
      className={glassClasses(
        glassmorphism.backdrop.light,
        glassmorphism.border.light,
        'p-3 rounded-xl hover:bg-white/80 cursor-pointer transition-all group flex items-center justify-between gap-3'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={glassClasses(
              'px-2 py-0.5 rounded text-xs font-semibold',
              template.category === 'NICU'
                ? 'bg-blue-100 text-blue-700'
                : template.category === 'PICU'
                ? 'bg-purple-100 text-purple-700'
                : template.category === 'SNCU'
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-700'
            )}
          >
            {template.category}
          </span>
          <h4 className="font-semibold text-sm text-slate-800 truncate group-hover:text-sky-600 transition-colors">
            {template.name}
          </h4>
        </div>
        <p className="text-xs text-slate-600 truncate">{template.description}</p>
      </div>
      <button onClick={onToggleFavorite} className="flex-shrink-0 p-2 hover:scale-110 transition-transform">
        <svg
          className={glassClasses('w-5 h-5', isFavorite ? 'fill-yellow-500 text-yellow-500' : 'fill-none text-slate-400')}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      </button>
    </div>
  );
};

/**
 * Template Preview Modal
 */
const TemplatePreviewModal: React.FC<{
  template: ClinicalTemplate;
  onClose: () => void;
  onUse: () => void;
}> = ({ template, onClose, onUse }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={glassClasses(
          'relative max-w-2xl w-full max-h-[80vh] overflow-auto',
          glassmorphism.backdrop.heavy,
          glassmorphism.border.light,
          'rounded-3xl p-6 shadow-2xl'
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <span
              className={glassClasses(
                'inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2',
                template.category === 'NICU'
                  ? 'bg-blue-100 text-blue-700'
                  : template.category === 'PICU'
                  ? 'bg-purple-100 text-purple-700'
                  : template.category === 'SNCU'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-700'
              )}
            >
              {template.category}
            </span>
            <h2 className="text-xl font-bold text-slate-800">{template.name}</h2>
            <p className="text-sm text-slate-600 mt-1">{template.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/30 transition-colors"
          >
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Vitals */}
          {template.vitals && Object.keys(template.vitals).length > 0 && (
            <div className={glassClasses('p-4 rounded-xl', glassmorphism.backdrop.tintedGreen, 'border border-emerald-200')}>
              <h3 className="font-semibold text-emerald-800 mb-2 text-sm">Vital Signs</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(template.vitals).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-slate-600 capitalize">{key}:</span>{' '}
                    <span className="font-medium text-slate-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Examination */}
          {template.examination && Object.keys(template.examination).length > 0 && (
            <div className={glassClasses('p-4 rounded-xl', glassmorphism.backdrop.tinted, 'border border-sky-200')}>
              <h3 className="font-semibold text-sky-800 mb-2 text-sm">Clinical Examination</h3>
              <div className="space-y-2 text-sm">
                {Object.entries(template.examination).map(([key, value]) => (
                  <div key={key}>
                    <span className="font-medium text-slate-700 uppercase text-xs">{key}:</span>
                    <p className="text-slate-600">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medications */}
          {template.medications && template.medications.length > 0 && (
            <div className={glassClasses('p-4 rounded-xl', glassmorphism.backdrop.tintedPurple, 'border border-purple-200')}>
              <h3 className="font-semibold text-purple-800 mb-2 text-sm">Medications</h3>
              <div className="space-y-2 text-sm">
                {template.medications.map((med, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-purple-600">•</span>
                    <span className="text-slate-700">
                      <span className="font-medium">{med.name}</span> {med.dose} {med.route} {med.frequency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clinical Note */}
          <div className={glassClasses('p-4 rounded-xl', glassmorphism.backdrop.light, 'border border-slate-200')}>
            <h3 className="font-semibold text-slate-800 mb-2 text-sm">Clinical Note</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{template.note}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <PremiumButton variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </PremiumButton>
          <PremiumButton
            variant="primary"
            fullWidth
            onClick={onUse}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            }
          >
            Use This Template
          </PremiumButton>
        </div>
      </motion.div>
    </div>
  );
};

export default TemplatePickerModal;
