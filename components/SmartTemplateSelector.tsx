/**
 * Smart Template Selector Component
 * Auto-suggests clinical templates based on patient context and diagnosis
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  FileText,
  Check,
  ChevronRight,
  X,
  AlertTriangle,
  Thermometer,
  Heart,
  Stethoscope,
  Baby,
  Brain,
  Activity
} from 'lucide-react';
import { Patient, VitalSigns, ClinicalExamination } from '../types';

// Enhanced template with trigger conditions
interface SmartTemplate {
  id: string;
  name: string;
  category: string;
  icon: React.ReactNode;
  description: string;
  triggerKeywords: string[];
  triggerConditions?: {
    vitalAbnormality?: {
      vital: keyof VitalSigns;
      condition: 'above' | 'below';
      threshold: number;
    }[];
  };
  suggestedICD10: string[];
  vitals: Partial<VitalSigns>;
  examination: Partial<ClinicalExamination>;
  note: string;
  priority: number; // Higher = more specific/important
}

// Smart templates with trigger conditions
const SMART_TEMPLATES: SmartTemplate[] = [
  {
    id: 'sepsis',
    name: 'Neonatal Sepsis',
    category: 'Infections',
    icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
    description: 'For suspected or confirmed neonatal sepsis with fever/hypothermia',
    triggerKeywords: ['sepsis', 'septicemia', 'infection', 'fever', 'febrile'],
    triggerConditions: {
      vitalAbnormality: [
        { vital: 'temperature', condition: 'above', threshold: 38.0 },
        { vital: 'temperature', condition: 'below', threshold: 36.0 },
        { vital: 'hr', condition: 'above', threshold: 180 }
      ]
    },
    suggestedICD10: ['P36.9', 'P36.0'],
    vitals: {
      temperature: '',
      hr: '',
      rr: '',
      spo2: '',
      crt: ''
    },
    examination: {
      cns: 'Level of activity: , Tone: , Fontanelle: ',
      cvs: 'Heart sounds: , Perfusion: , CRT: ',
      chest: 'Air entry: , Work of breathing: , Added sounds: ',
      perAbdomen: 'Soft/Distended: , Bowel sounds: , Feeding tolerance: '
    },
    note: 'Infant being monitored for sepsis. Cultures sent. Empirical antibiotics started.',
    priority: 90
  },
  {
    id: 'rds',
    name: 'Respiratory Distress (RDS)',
    category: 'Respiratory',
    icon: <Activity className="w-4 h-4 text-blue-500" />,
    description: 'For respiratory distress syndrome with tachypnea and desaturation',
    triggerKeywords: ['rds', 'respiratory distress', 'tachypnea', 'grunting', 'retractions', 'hyaline'],
    triggerConditions: {
      vitalAbnormality: [
        { vital: 'rr', condition: 'above', threshold: 60 },
        { vital: 'spo2', condition: 'below', threshold: 92 }
      ]
    },
    suggestedICD10: ['P22.0', 'P22.1'],
    vitals: {
      rr: '',
      spo2: '',
      hr: ''
    },
    examination: {
      chest: 'Respiratory effort: , Retractions: , Grunting: , Air entry: bilateral/unilateral, Added sounds: ',
      cvs: 'Heart sounds: , Perfusion: '
    },
    note: 'Infant with respiratory distress. Currently on respiratory support. Monitoring for improvement.',
    priority: 85
  },
  {
    id: 'jaundice',
    name: 'Neonatal Jaundice',
    category: 'Metabolic',
    icon: <Baby className="w-4 h-4 text-yellow-500" />,
    description: 'For hyperbilirubinemia requiring phototherapy assessment',
    triggerKeywords: ['jaundice', 'hyperbilirubinemia', 'icterus', 'yellow', 'phototherapy'],
    suggestedICD10: ['P59.9', 'P59.0', 'P58.0'],
    vitals: {
      weight: ''
    },
    examination: {
      cns: 'Activity: , Tone: , Feeding: ',
      perAbdomen: 'Liver: , Spleen: '
    },
    note: 'Infant with neonatal jaundice. TSB levels being monitored. Assessment for phototherapy/exchange transfusion as indicated.',
    priority: 70
  },
  {
    id: 'hie',
    name: 'HIE / Birth Asphyxia',
    category: 'Neurological',
    icon: <Brain className="w-4 h-4 text-purple-500" />,
    description: 'For hypoxic-ischemic encephalopathy staging and monitoring',
    triggerKeywords: ['hie', 'asphyxia', 'encephalopathy', 'birth asphyxia', 'perinatal asphyxia', 'sarnat'],
    suggestedICD10: ['P91.60', 'P91.61', 'P91.62', 'P91.63', 'P21.0'],
    vitals: {
      temperature: '',
      hr: '',
      rr: '',
      spo2: ''
    },
    examination: {
      cns: 'Level of consciousness: , Tone: , Posture: , Reflexes: , Seizures: , Fontanelle: ',
      cvs: 'Heart sounds: , Perfusion: ',
      chest: 'Air entry: , Respiratory effort: '
    },
    note: 'Infant with HIE. Currently on therapeutic hypothermia protocol / observation. Neurological monitoring ongoing.',
    priority: 95
  },
  {
    id: 'nec',
    name: 'NEC (Necrotizing Enterocolitis)',
    category: 'Gastrointestinal',
    icon: <AlertTriangle className="w-4 h-4 text-orange-500" />,
    description: 'For suspected or confirmed necrotizing enterocolitis',
    triggerKeywords: ['nec', 'necrotizing enterocolitis', 'abdominal distension', 'bloody stool', 'feed intolerance'],
    suggestedICD10: ['P77.9', 'P77.1', 'P77.2', 'P77.3'],
    vitals: {
      temperature: '',
      hr: '',
      rr: ''
    },
    examination: {
      perAbdomen: 'Distension: , Tenderness: , Bowel sounds: , Discoloration: , Abdominal girth: cm',
      cns: 'Activity: , Tone: '
    },
    note: 'Infant with suspected/confirmed NEC. NPO, OGT on free drainage. Serial abdominal examinations and X-rays.',
    priority: 92
  },
  {
    id: 'preterm',
    name: 'Preterm Infant Monitoring',
    category: 'Prematurity',
    icon: <Baby className="w-4 h-4 text-pink-500" />,
    description: 'Standard monitoring template for preterm infants',
    triggerKeywords: ['preterm', 'premature', 'prematurity', 'vlbw', 'elbw', 'low birth weight'],
    suggestedICD10: ['P07.30', 'P07.20', 'P07.10'],
    vitals: {
      temperature: '',
      hr: '',
      rr: '',
      spo2: '',
      weight: ''
    },
    examination: {
      cns: 'Activity: , Tone: , Fontanelle: ',
      cvs: 'Heart sounds: , Murmur: , Perfusion: ',
      chest: 'Air entry: , Work of breathing: ',
      perAbdomen: 'Soft: , Bowel sounds: , Feeding: '
    },
    note: 'Preterm infant on standard monitoring. Current feeds: . Growth: . Issues: ',
    priority: 60
  },
  {
    id: 'apnea',
    name: 'Apnea of Prematurity',
    category: 'Respiratory',
    icon: <Activity className="w-4 h-4 text-indigo-500" />,
    description: 'For monitoring and management of apnea episodes',
    triggerKeywords: ['apnea', 'apnoea', 'desaturation', 'bradycardia', 'spell'],
    suggestedICD10: ['P28.4', 'P28.3'],
    vitals: {
      hr: '',
      rr: '',
      spo2: ''
    },
    examination: {
      cns: 'Activity: , Tone: , Response to stimulation: ',
      chest: 'Air entry: , Respiratory pattern: '
    },
    note: 'Infant with apnea of prematurity. Number of episodes: . Requiring stimulation/intervention: . Currently on: ',
    priority: 75
  },
  {
    id: 'pda',
    name: 'Patent Ductus Arteriosus',
    category: 'Cardiac',
    icon: <Heart className="w-4 h-4 text-red-400" />,
    description: 'For PDA assessment and monitoring',
    triggerKeywords: ['pda', 'patent ductus', 'ductus arteriosus', 'murmur'],
    suggestedICD10: ['Q25.0'],
    vitals: {
      hr: '',
      bp: '',
      spo2: ''
    },
    examination: {
      cvs: 'Heart sounds: S1 S2, Murmur: grade/location, Pulses: bounding/normal, Precordium: active/normal',
      chest: 'Air entry: , Work of breathing: '
    },
    note: 'Infant with PDA. Echo findings: . Management: observation/medical/surgical. Fluid restriction: ',
    priority: 72
  },
  {
    id: 'seizures',
    name: 'Neonatal Seizures',
    category: 'Neurological',
    icon: <Brain className="w-4 h-4 text-red-600" />,
    description: 'For seizure documentation and anticonvulsant monitoring',
    triggerKeywords: ['seizure', 'seizures', 'convulsion', 'fits', 'tonic', 'clonic'],
    suggestedICD10: ['P90'],
    vitals: {
      hr: '',
      spo2: '',
      temperature: ''
    },
    examination: {
      cns: 'Level of consciousness: , Tone: , Seizure type: , Duration: , Frequency: , Post-ictal state: '
    },
    note: 'Infant with neonatal seizures. Type: . Frequency: . Currently on: . EEG findings: ',
    priority: 88
  },
  {
    id: 'hypoglycemia',
    name: 'Neonatal Hypoglycemia',
    category: 'Metabolic',
    icon: <Thermometer className="w-4 h-4 text-green-500" />,
    description: 'For hypoglycemia monitoring and management',
    triggerKeywords: ['hypoglycemia', 'hypoglycaemia', 'low sugar', 'glucose', 'idm', 'sga'],
    suggestedICD10: ['P70.4', 'P70.0', 'P70.1'],
    vitals: {
      weight: ''
    },
    examination: {
      cns: 'Activity: , Tone: , Jitteriness: , Feeding: '
    },
    note: 'Infant with hypoglycemia. Last blood glucose: mg/dL. Currently on: feeds/IV dextrose. Monitoring frequency: ',
    priority: 78
  }
];

interface SmartTemplateSelectorProps {
  patient: Patient;
  currentVitals?: Partial<VitalSigns>;
  onSelectTemplate: (template: {
    vitals: Partial<VitalSigns>;
    examination: Partial<ClinicalExamination>;
    note: string;
    suggestedICD10?: string[];
  }) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SmartTemplateSelector: React.FC<SmartTemplateSelectorProps> = ({
  patient,
  currentVitals,
  onSelectTemplate,
  isOpen,
  onClose
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Get auto-suggested templates based on patient context
  const autoSuggestedTemplates = useMemo(() => {
    const suggestions: { template: SmartTemplate; reason: string; score: number }[] = [];
    const diagnosis = patient.diagnosis?.toLowerCase() || '';

    for (const template of SMART_TEMPLATES) {
      let score = 0;
      let reason = '';

      // Check diagnosis keywords
      for (const keyword of template.triggerKeywords) {
        if (diagnosis.includes(keyword.toLowerCase())) {
          score += template.priority;
          reason = `Matches diagnosis: ${keyword}`;
          break;
        }
      }

      // Check vital abnormalities
      if (currentVitals && template.triggerConditions?.vitalAbnormality) {
        for (const condition of template.triggerConditions.vitalAbnormality) {
          const vitalValue = currentVitals[condition.vital];
          if (vitalValue !== undefined && vitalValue !== '') {
            const numValue = typeof vitalValue === 'string' ? parseFloat(vitalValue) : vitalValue;
            if (!isNaN(numValue)) {
              if (condition.condition === 'above' && numValue > condition.threshold) {
                score += 30;
                reason = reason || `High ${condition.vital}: ${numValue}`;
              } else if (condition.condition === 'below' && numValue < condition.threshold) {
                score += 30;
                reason = reason || `Low ${condition.vital}: ${numValue}`;
              }
            }
          }
        }
      }

      if (score > 0) {
        suggestions.push({ template, reason, score });
      }
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [patient.diagnosis, currentVitals]);

  // Get all templates filtered by search/category
  const filteredTemplates = useMemo(() => {
    return SMART_TEMPLATES.filter(template => {
      if (selectedCategory && template.category !== selectedCategory) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          template.name.toLowerCase().includes(search) ||
          template.description.toLowerCase().includes(search) ||
          template.triggerKeywords.some(k => k.toLowerCase().includes(search))
        );
      }
      return true;
    });
  }, [selectedCategory, searchTerm]);

  // Get unique categories
  const categories = useMemo(() => {
    return Array.from(new Set(SMART_TEMPLATES.map(t => t.category)));
  }, []);

  const handleSelectTemplate = (template: SmartTemplate) => {
    onSelectTemplate({
      vitals: template.vitals,
      examination: template.examination,
      note: template.note,
      suggestedICD10: template.suggestedICD10
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-800">Smart Templates</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Auto-suggestions */}
        {autoSuggestedTemplates.length > 0 && !searchTerm && (
          <div className="p-3 bg-purple-50 border-b">
            <div className="flex items-center gap-1 mb-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">Suggested for this patient</span>
            </div>
            <div className="space-y-2">
              {autoSuggestedTemplates.map(({ template, reason }) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="w-full flex items-center gap-3 p-2 bg-white rounded-lg border border-purple-200 hover:border-purple-400 hover:shadow-sm transition-all text-left"
                >
                  <div className="p-2 bg-purple-100 rounded-lg">
                    {template.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-800">{template.name}</div>
                    <div className="text-xs text-purple-600 truncate">{reason}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category filter */}
        <div className="p-3 border-b flex gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === null
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            {filteredTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className="w-full flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
              >
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  {template.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-800">{template.name}</span>
                    <span className="px-2 py-0.5 bg-gray-200 rounded text-xs text-gray-600">
                      {template.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.triggerKeywords.slice(0, 4).map(keyword => (
                      <span
                        key={keyword}
                        className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
              </button>
            ))}

            {filteredTemplates.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No templates found</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            Templates auto-fill vitals fields and examination findings. Review and modify as needed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SmartTemplateSelector;
