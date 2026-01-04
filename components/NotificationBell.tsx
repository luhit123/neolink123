import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Referral } from '../types';

interface NotificationBellProps {
    institutionId: string;
    userEmail: string;
}

interface NotificationItem {
    id: string;
    referralId: string;
    patientName: string;
    fromInstitution: string;
    toInstitution: string;
    status: string;
    previousStatus?: string;
    timestamp: string;
    isRead: boolean;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ institutionId, userEmail }) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [referrals, setReferrals] = useState<Map<string, Referral>>(new Map());
    const dropdownRef = useRef<HTMLDivElement>(null);
    const prevReferralsRef = useRef<Map<string, Referral>>(new Map());

    // Load read notifications from localStorage
    const getReadNotifications = (): Set<string> => {
        try {
            const stored = localStorage.getItem(`notifications_read_${institutionId}`);
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch {
            return new Set();
        }
    };

    const markAsRead = (notificationId: string) => {
        const readSet = getReadNotifications();
        readSet.add(notificationId);
        localStorage.setItem(`notifications_read_${institutionId}`, JSON.stringify([...readSet]));
        setNotifications(prev => prev.map(n =>
            n.id === notificationId ? { ...n, isRead: true } : n
        ));
    };

    const markAllAsRead = () => {
        const readSet = getReadNotifications();
        notifications.forEach(n => readSet.add(n.id));
        localStorage.setItem(`notifications_read_${institutionId}`, JSON.stringify([...readSet]));
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    };

    // Listen to outgoing referrals (where this institution referred patients)
    useEffect(() => {
        if (!institutionId) return;

        const referralsQuery = query(
            collection(db, 'referrals'),
            where('fromInstitutionId', '==', institutionId),
            orderBy('lastUpdatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(referralsQuery, (snapshot) => {
            const readSet = getReadNotifications();
            const newNotifications: NotificationItem[] = [];
            const currentReferrals = new Map<string, Referral>();

            snapshot.docs.forEach(doc => {
                const referral = { id: doc.id, ...doc.data() } as Referral;
                currentReferrals.set(referral.id, referral);

                // Check if status changed from previous state
                const prevReferral = prevReferralsRef.current.get(referral.id);

                // Only create notification if status is not 'Pending' anymore
                if (referral.status !== 'Pending') {
                    const notificationId = `${referral.id}_${referral.lastUpdatedAt}`;

                    newNotifications.push({
                        id: notificationId,
                        referralId: referral.id,
                        patientName: referral.patientName,
                        fromInstitution: referral.fromInstitutionName,
                        toInstitution: referral.toInstitutionName,
                        status: referral.status,
                        previousStatus: prevReferral?.status,
                        timestamp: referral.lastUpdatedAt,
                        isRead: readSet.has(notificationId)
                    });
                }
            });

            // Sort by timestamp (most recent first) and limit to 20
            newNotifications.sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            setNotifications(newNotifications.slice(0, 20));
            setReferrals(currentReferrals);
            prevReferralsRef.current = currentReferrals;
        });

        return () => unsubscribe();
    }, [institutionId]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Accepted':
                return '✓';
            case 'Rejected':
                return '✗';
            case 'Patient Admitted':
                return '🏥';
            case 'Patient Discharged':
                return '🏠';
            case 'Patient Deceased':
                return '🕯️';
            default:
                return '📋';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Accepted':
                return 'text-green-600 bg-green-50';
            case 'Rejected':
                return 'text-red-600 bg-red-50';
            case 'Patient Admitted':
                return 'text-blue-600 bg-blue-50';
            case 'Patient Discharged':
                return 'text-emerald-600 bg-emerald-50';
            case 'Patient Deceased':
                return 'text-gray-600 bg-gray-50';
            default:
                return 'text-slate-600 bg-slate-50';
        }
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all border border-amber-200"
                title="Referral Notifications"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-[70vh] overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-lg">Referral Updates</h3>
                            <p className="text-xs text-amber-100">{unreadCount} unread notifications</p>
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notifications List */}
                    <div className="overflow-y-auto max-h-[50vh]">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                <p className="font-medium">No notifications yet</p>
                                <p className="text-xs mt-1">Updates on your referrals will appear here</p>
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    onClick={() => markAsRead(notification.id)}
                                    className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${!notification.isRead ? 'bg-amber-50/50' : ''
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Status Icon */}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${getStatusColor(notification.status)}`}>
                                            {getStatusIcon(notification.status)}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getStatusColor(notification.status)}`}>
                                                    {notification.status}
                                                </span>
                                                {!notification.isRead && (
                                                    <span className="w-2 h-2 bg-amber-500 rounded-full" />
                                                )}
                                            </div>
                                            <p className="font-semibold text-slate-800 mt-1 truncate">
                                                {notification.patientName}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate">
                                                → {notification.toInstitution}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {formatTimestamp(notification.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
