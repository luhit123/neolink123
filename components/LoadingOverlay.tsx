import React from 'react';

interface LoadingOverlayProps {
    message?: string;
    show: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = 'Please wait...', show }) => {
    if (!show) return null;

    const isSuccess = message.includes('✓') || message.toLowerCase().includes('success');

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4 animate-scaleIn">
                {isSuccess ? (
                    /* Success Checkmark */
                    <div className="relative w-20 h-20">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center animate-pulse">
                                <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Animated Medical Cross */
                    <div className="relative w-20 h-20">
                        {/* Rotating outer ring */}
                        <svg className="absolute inset-0 w-20 h-20 animate-spin" viewBox="0 0 80 80">
                            <circle
                                cx="40"
                                cy="40"
                                r="35"
                                fill="none"
                                stroke="url(#gradient1)"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray="150 100"
                            />
                            <defs>
                                <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#0ea5e9" />
                                    <stop offset="100%" stopColor="#3b82f6" />
                                </linearGradient>
                            </defs>
                        </svg>

                        {/* Medical cross icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-10 h-10 text-sky-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Message */}
                <div className="text-center">
                    <h3 className={`text-lg font-bold mb-1 ${isSuccess ? 'text-emerald-600' : 'text-slate-800'}`}>{message}</h3>
                    {!isSuccess && (
                        <div className="flex items-center justify-center gap-1">
                            <div className="w-2 h-2 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    )}
                </div>

                {/* Subtle progress indication - only show when loading */}
                {!isSuccess && (
                    <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-sky-400 to-blue-600 animate-progress"></div>
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                @keyframes scaleIn {
                    from {
                        transform: scale(0.9);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                @keyframes progress {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(400%);
                    }
                }

                .animate-fadeIn {
                    animation: fadeIn 0.2s ease-out;
                }

                .animate-scaleIn {
                    animation: scaleIn 0.3s ease-out;
                }

                .animate-progress {
                    animation: progress 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default LoadingOverlay;
