/**
 * AppSkeleton - Skeleton loading screen for initial app load
 * Provides a better UX than a simple spinner by showing the shape of the content
 */

import React from 'react';
import { motion } from 'framer-motion';

// Reusable skeleton pulse animation
const SkeletonPulse: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] ${className}`} />
);

// Shimmer effect for premium feel
const Shimmer: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`relative overflow-hidden ${className}`}>
        <div className="animate-pulse bg-slate-200 w-full h-full" />
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
    </div>
);

// Initial app loading skeleton - shown before auth is determined
export const AppLoadingSkeleton: React.FC = () => {
    return (
        <div className="bg-gradient-to-br from-sky-50 via-white to-teal-50 min-h-screen flex flex-col">
            {/* Header Skeleton */}
            <div className="bg-white/80 backdrop-blur-lg shadow-sm border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <img
                            src="/neolink-logo.png"
                            alt="NeoLink"
                            className="w-10 h-10 rounded-xl object-cover shadow-sm"
                        />
                        <div className="hidden sm:block">
                            <Shimmer className="w-24 h-4 rounded-lg mb-1" />
                            <Shimmer className="w-16 h-3 rounded-lg" />
                        </div>
                    </div>

                    {/* Nav items */}
                    <div className="flex items-center gap-4">
                        <Shimmer className="w-8 h-8 rounded-full" />
                        <Shimmer className="w-8 h-8 rounded-full" />
                        <Shimmer className="w-24 h-8 rounded-xl" />
                    </div>
                </div>
            </div>

            {/* Main Content Skeleton */}
            <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
                {/* Welcome Section */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-6"
                >
                    <Shimmer className="w-48 h-8 rounded-xl mb-2" />
                    <Shimmer className="w-64 h-4 rounded-lg" />
                </motion.div>

                {/* Stats Cards Skeleton */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
                >
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-100 shadow-sm">
                            <Shimmer className="w-10 h-10 rounded-xl mb-3" />
                            <Shimmer className="w-16 h-6 rounded-lg mb-2" />
                            <Shimmer className="w-24 h-3 rounded-lg" />
                        </div>
                    ))}
                </motion.div>

                {/* Main Content Area Skeleton */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                >
                    {/* Main Panel */}
                    <div className="lg:col-span-2 bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <Shimmer className="w-40 h-6 rounded-lg mb-4" />
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4 p-3 bg-slate-50/50 rounded-xl">
                                    <Shimmer className="w-12 h-12 rounded-xl flex-shrink-0" />
                                    <div className="flex-1">
                                        <Shimmer className="w-3/4 h-4 rounded-lg mb-2" />
                                        <Shimmer className="w-1/2 h-3 rounded-lg" />
                                    </div>
                                    <Shimmer className="w-20 h-8 rounded-lg" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Side Panel */}
                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <Shimmer className="w-32 h-6 rounded-lg mb-4" />
                        <div className="space-y-4">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="p-3 bg-slate-50/50 rounded-xl">
                                    <Shimmer className="w-full h-4 rounded-lg mb-2" />
                                    <Shimmer className="w-2/3 h-3 rounded-lg" />
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Bottom Nav Skeleton (Mobile) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-100 p-2">
                <div className="flex justify-around items-center">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-1 p-2">
                            <Shimmer className="w-6 h-6 rounded-lg" />
                            <Shimmer className="w-10 h-2 rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Loading indicator overlay */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:bottom-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex items-center gap-3 bg-white/90 backdrop-blur-xl px-4 py-2 rounded-full shadow-lg border border-slate-100"
                >
                    <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-slate-600 font-medium">Loading NeoLink...</span>
                </motion.div>
            </div>
        </div>
    );
};

// Dashboard-specific skeleton for lazy-loaded components
export const DashboardSkeleton: React.FC<{ title?: string }> = ({ title = 'Dashboard' }) => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-teal-50 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-600 text-lg">Loading {title}...</p>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[...Array(4)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-100"
                        >
                            <Shimmer className="w-10 h-10 rounded-xl mb-3" />
                            <Shimmer className="w-16 h-6 rounded-lg mb-2" />
                            <Shimmer className="w-24 h-3 rounded-lg" />
                        </motion.div>
                    ))}
                </div>

                {/* Content skeleton */}
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-100">
                    <div className="space-y-4">
                        {[...Array(6)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 + i * 0.05 }}
                                className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-xl"
                            >
                                <Shimmer className="w-12 h-12 rounded-xl flex-shrink-0" />
                                <div className="flex-1">
                                    <Shimmer className="w-3/4 h-4 rounded-lg mb-2" />
                                    <Shimmer className="w-1/2 h-3 rounded-lg" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Login page skeleton
export const LoginSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md"
            >
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <Shimmer className="w-20 h-20 rounded-2xl" />
                    </div>

                    {/* Title */}
                    <div className="text-center mb-8">
                        <Shimmer className="w-48 h-8 rounded-xl mx-auto mb-2" />
                        <Shimmer className="w-64 h-4 rounded-lg mx-auto" />
                    </div>

                    {/* Form fields */}
                    <div className="space-y-4">
                        <Shimmer className="w-full h-12 rounded-xl" />
                        <Shimmer className="w-full h-12 rounded-xl" />
                        <Shimmer className="w-full h-12 rounded-xl" />
                    </div>

                    {/* Button */}
                    <div className="mt-6">
                        <Shimmer className="w-full h-12 rounded-xl" />
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AppLoadingSkeleton;
