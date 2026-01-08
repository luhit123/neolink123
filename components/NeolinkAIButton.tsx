import React, { useState } from 'react';
import { explainChartData } from '../services/geminiService';

interface DataPoint {
    label: string;
    value: number | string;
}

interface NeolinkAIButtonProps {
    chartTitle: string;
    chartType: string;
    dataPoints: DataPoint[];
    context?: string;
}

const NeolinkAIButton: React.FC<NeolinkAIButtonProps> = ({
    chartTitle,
    chartType,
    dataPoints,
    context
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleClick = async () => {
        setIsOpen(true);
        setLoading(true);
        setExplanation(null);

        try {
            const result = await explainChartData(chartTitle, chartType, dataPoints, context);
            setExplanation(result);
        } catch (error) {
            setExplanation('Error: Unable to generate explanation. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (explanation) {
            navigator.clipboard.writeText(explanation);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        setExplanation(null);
    };

    return (
        <>
            {/* NeolinkAI Button - Mobile optimized */}
            <button
                onClick={handleClick}
                className="flex items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg hover:from-violet-600 hover:to-purple-700 transition-all font-semibold text-[10px] sm:text-xs shadow-md"
                title="Get AI explanation for this chart"
            >
                <span className="text-xs sm:text-sm">✨</span>
                <span className="hidden sm:inline">NeolinkAI</span>
                <span className="sm:hidden">AI</span>
            </button>

            {/* Modal Overlay - Full screen on mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center"
                    onClick={handleClose}
                >
                    <div
                        className="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] sm:max-h-[80vh] overflow-hidden animate-slide-up sm:animate-none"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header - Compact on mobile */}
                        <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xl sm:text-2xl">✨</span>
                                <div className="min-w-0">
                                    <h3 className="text-white font-bold text-base sm:text-lg">NeolinkAI</h3>
                                    <p className="text-violet-100 text-[10px] sm:text-xs truncate max-w-[200px] sm:max-w-none">{chartTitle}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="text-white/80 hover:text-white text-xl sm:text-2xl font-bold hover:bg-white/20 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            >
                                ×
                            </button>
                        </div>

                        {/* Content - Scrollable */}
                        <div className="p-4 sm:p-5 overflow-y-auto max-h-[55vh] sm:max-h-[50vh]">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-8 sm:py-10">
                                    <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-purple-200 border-t-purple-600 mb-3 sm:mb-4"></div>
                                    <p className="text-slate-600 dark:text-slate-300 font-medium text-sm sm:text-base">Analyzing chart data...</p>
                                    <p className="text-slate-400 text-xs sm:text-sm">NeolinkAI is generating insights</p>
                                </div>
                            ) : explanation ? (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <div
                                        className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap text-xs sm:text-sm leading-relaxed"
                                        dangerouslySetInnerHTML={{
                                            __html: explanation
                                                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-purple-600 dark:text-purple-400">$1</strong>')
                                                .replace(/\n/g, '<br/>')
                                        }}
                                    />
                                </div>
                            ) : null}
                        </div>

                        {/* Footer - Sticky at bottom */}
                        {explanation && !loading && (
                            <div className="border-t border-slate-200 dark:border-slate-700 px-4 sm:px-5 py-2.5 sm:py-3 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                                <p className="text-[10px] sm:text-xs text-slate-400">Powered by NeolinkAI</p>
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1 sm:gap-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-xs sm:text-sm font-medium"
                                >
                                    {copied ? (
                                        <>
                                            <span>✓</span>
                                            <span>Copied!</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>📋</span>
                                            <span>Copy</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add slide-up animation for mobile */}
            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </>
    );
};

export default NeolinkAIButton;
