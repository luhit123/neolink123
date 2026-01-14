import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo, useAnimation } from 'framer-motion';
import { Patient, Unit } from '../../types';
import { haptics } from '../../utils/haptics';
import CardProgressIndicator from './CardProgressIndicator';
import QuickStatsCard from './cards/QuickStatsCard';
import ChartsCard from './cards/ChartsCard';
import CaseListCard from './cards/CaseListCard';
import AIInsightsCard from './cards/AIInsightsCard';
import IndividualMortalityViewer from '../IndividualMortalityViewer';

interface MobileAnalyticsViewProps {
  patients: Patient[];
  allPatients: Patient[];
  institutionName: string;
  onClose: () => void;
}

const CARD_LABELS = ['Stats', 'Charts', 'Cases', 'AI'];
const TOTAL_CARDS = 4;

const MobileAnalyticsView: React.FC<MobileAnalyticsViewProps> = ({
  patients,
  allPatients,
  institutionName,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [cardWidth, setCardWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 375);
  const controls = useAnimation();

  // Filter deceased patients
  const deceasedPatients = patients.filter(p => p.outcome === 'Deceased');

  // Update card width on resize
  useEffect(() => {
    const handleResize = () => setCardWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle drag end with snap to nearest card
  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = cardWidth * 0.2;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    let newIndex = currentIndex;

    // Velocity-based or distance-based swipe detection
    if (velocity < -300 || offset < -threshold) {
      newIndex = Math.min(currentIndex + 1, TOTAL_CARDS - 1);
    } else if (velocity > 300 || offset > threshold) {
      newIndex = Math.max(currentIndex - 1, 0);
    }

    if (newIndex !== currentIndex) {
      haptics.selection();
    }

    setCurrentIndex(newIndex);
    controls.start({ x: -newIndex * cardWidth });
  };

  // Navigate to specific card
  const goToCard = (index: number) => {
    setCurrentIndex(index);
    controls.start({ x: -index * cardWidth });
  };

  // Handle patient selection from case list
  const handlePatientSelect = (patient: Patient) => {
    haptics.tap();
    setSelectedPatient(patient);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-slate-900"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Safe area top padding */}
      <div className="h-full flex flex-col pt-safe">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700">
          <button
            onClick={() => {
              haptics.tap();
              onClose();
            }}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-white">Mortality Analytics</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {/* Progress Indicator */}
        <CardProgressIndicator
          totalCards={TOTAL_CARDS}
          currentIndex={currentIndex}
          onDotClick={goToCard}
          labels={CARD_LABELS}
        />

        {/* Swipeable Cards Container */}
        <div className="flex-1 overflow-hidden bg-slate-100">
          <motion.div
            className="h-full flex"
            drag="x"
            dragConstraints={{ left: -(TOTAL_CARDS - 1) * cardWidth, right: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            animate={controls}
            initial={{ x: 0 }}
            style={{ width: cardWidth * TOTAL_CARDS }}
          >
            {/* Card 1: Quick Stats */}
            <div className="h-full p-4" style={{ width: cardWidth }}>
              <QuickStatsCard
                deceasedPatients={deceasedPatients}
                allPatients={allPatients}
                institutionName={institutionName}
              />
            </div>

            {/* Card 2: Charts */}
            <div className="h-full p-4" style={{ width: cardWidth }}>
              <ChartsCard
                deceasedPatients={deceasedPatients}
              />
            </div>

            {/* Card 3: Case List */}
            <div className="h-full p-4" style={{ width: cardWidth }}>
              <CaseListCard
                deceasedPatients={deceasedPatients}
                onPatientSelect={handlePatientSelect}
              />
            </div>

            {/* Card 4: AI Insights */}
            <div className="h-full p-4" style={{ width: cardWidth }}>
              <AIInsightsCard
                deceasedPatients={deceasedPatients}
                institutionName={institutionName}
              />
            </div>
          </motion.div>
        </div>

        {/* Bottom Safe Area */}
        <div className="bg-slate-100 pb-safe" />
      </div>

      {/* Individual Patient Viewer Modal */}
      <AnimatePresence>
        {selectedPatient && (
          <IndividualMortalityViewer
            patient={selectedPatient}
            institutionName={institutionName}
            onClose={() => setSelectedPatient(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MobileAnalyticsView;
