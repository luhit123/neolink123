import React from 'react';
import { motion } from 'framer-motion';
import { SuggestedQuery, PageType } from '../../types/chat';

interface ChatSuggestedQueriesProps {
  onQuerySelect: (query: string) => void;
  currentPage: PageType;
}

const ChatSuggestedQueries: React.FC<ChatSuggestedQueriesProps> = ({
  onQuerySelect,
  currentPage,
}) => {
  // Context-aware suggested queries
  const getSuggestedQueries = (): SuggestedQuery[] => {
    const baseQueries: SuggestedQuery[] = [
      {
        id: 'admissions-today',
        text: 'How many admissions today?',
        icon: '📊',
        context: ['dashboard', 'analytics'],
      },
      {
        id: 'mortality-rate',
        text: 'What is the mortality rate?',
        icon: '⚠️',
        context: ['dashboard', 'analytics'],
      },
      {
        id: 'birth-weight-analysis',
        text: 'Analyze birth weight vs outcomes',
        icon: '⚖️',
        context: ['dashboard', 'analytics'],
      },
      {
        id: 'clinical-guidelines',
        text: 'Latest clinical guidelines for RDS',
        icon: '📚',
        context: ['patient-detail', 'other'],
      },
      {
        id: 'unit-comparison',
        text: 'Compare PICU vs NICU outcomes',
        icon: '🏥',
        context: ['dashboard', 'analytics'],
      },
      {
        id: 'generate-report',
        text: 'Generate monthly summary report',
        icon: '📄',
        context: ['dashboard', 'analytics', 'admin'],
      },
    ];

    // Filter queries based on current page
    return baseQueries.filter((query) => {
      if (!query.context || query.context.length === 0) return true;
      return query.context.includes(currentPage);
    });
  };

  const queries = getSuggestedQueries();

  if (queries.length === 0) return null;

  return (
    <div className="px-4 py-3">
      <div className="text-xs text-slate-400 mb-2 font-medium">Quick Actions</div>
      <div className="flex flex-wrap gap-2">
        {queries.map((query, index) => (
          <motion.button
            key={query.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onQuerySelect(query.text)}
            className="
              group px-3 py-2 bg-slate-700/60 hover:bg-slate-600/80
              border border-slate-600 hover:border-blue-500
              rounded-lg text-sm text-slate-200 transition-all
              active:scale-95 flex items-center space-x-2
              min-h-[44px]
            "
          >
            {query.icon && <span className="text-base">{query.icon}</span>}
            <span className="group-hover:text-white transition-colors">{query.text}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default ChatSuggestedQueries;
