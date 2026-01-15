/**
 * Clinical Alert Banner Component
 * Displays real-time clinical alerts with severity-based styling
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Bell,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Thermometer,
  Pill,
  TrendingDown,
  Heart,
  Activity,
  Info
} from 'lucide-react';
import { ClinicalAlert, AlertSeverity, AlertType } from '../types/alerts';
import { clinicalAlertService } from '../services/clinicalAlertService';

interface ClinicalAlertBannerProps {
  patientId?: string;
  onAcknowledge?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
  userId: string;
  userName: string;
  className?: string;
}

export const ClinicalAlertBanner: React.FC<ClinicalAlertBannerProps> = ({
  patientId,
  onAcknowledge,
  onDismiss,
  userId,
  userName,
  className = ''
}) => {
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([]);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // Subscribe to alert updates
  useEffect(() => {
    const unsubscribe = clinicalAlertService.subscribe((newAlert) => {
      if (!patientId || newAlert.patientId === patientId) {
        setAlerts(prev => {
          // Check if alert already exists
          const exists = prev.some(a => a.id === newAlert.id);
          if (exists) return prev;
          return [newAlert, ...prev];
        });
      }
    });

    // Load existing alerts
    const existingAlerts = patientId
      ? clinicalAlertService.getPatientAlerts(patientId)
      : clinicalAlertService.getAllActive();
    setAlerts(existingAlerts);

    return unsubscribe;
  }, [patientId]);

  const handleAcknowledge = useCallback((alertId: string) => {
    clinicalAlertService.acknowledge(alertId, userId, userName);
    setAlerts(prev => prev.map(a =>
      a.id === alertId
        ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() }
        : a
    ));
    onAcknowledge?.(alertId);
  }, [userId, userName, onAcknowledge]);

  const handleDismiss = useCallback((alertId: string) => {
    clinicalAlertService.dismiss(alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    onDismiss?.(alertId);
  }, [onDismiss]);

  const toggleExpand = (alertId: string) => {
    setExpandedAlerts(prev => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  // Get severity-based styling
  const getSeverityStyles = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.EMERGENCY:
        return {
          bg: 'bg-red-600',
          border: 'border-red-700',
          text: 'text-white',
          icon: 'text-white',
          pulse: true
        };
      case AlertSeverity.CRITICAL:
        return {
          bg: 'bg-red-100',
          border: 'border-red-400',
          text: 'text-red-800',
          icon: 'text-red-600',
          pulse: false
        };
      case AlertSeverity.WARNING:
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-400',
          text: 'text-amber-800',
          icon: 'text-amber-600',
          pulse: false
        };
      case AlertSeverity.INFO:
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-300',
          text: 'text-blue-800',
          icon: 'text-blue-600',
          pulse: false
        };
    }
  };

  // Get alert type icon
  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case AlertType.VITAL_ABNORMAL:
        return <Thermometer className="w-5 h-5" />;
      case AlertType.DRUG_INTERACTION:
        return <Pill className="w-5 h-5" />;
      case AlertType.DETERIORATION:
        return <TrendingDown className="w-5 h-5" />;
      case AlertType.SEPSIS_RISK:
        return <AlertTriangle className="w-5 h-5" />;
      case AlertType.RESPIRATORY_DISTRESS:
        return <Activity className="w-5 h-5" />;
      case AlertType.DOSING_ERROR:
        return <AlertCircle className="w-5 h-5" />;
      case AlertType.CRITICAL_FINDING:
        return <Heart className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  // Filter displayed alerts
  const displayedAlerts = showAll ? alerts : alerts.slice(0, 3);
  const hasMoreAlerts = alerts.length > 3;

  if (alerts.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {displayedAlerts.map(alert => {
        const styles = getSeverityStyles(alert.severity);
        const isExpanded = expandedAlerts.has(alert.id);

        return (
          <div
            key={alert.id}
            className={`
              ${styles.bg} ${styles.border} border rounded-lg overflow-hidden
              ${styles.pulse ? 'animate-pulse' : ''}
              ${alert.acknowledged ? 'opacity-75' : ''}
              transition-all duration-200
            `}
          >
            {/* Alert header */}
            <div className="flex items-center gap-3 p-3">
              <div className={styles.icon}>
                {getAlertIcon(alert.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold text-sm ${styles.text}`}>
                    {alert.title}
                  </span>
                  {alert.aiGenerated && (
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                      AI
                    </span>
                  )}
                  {alert.acknowledged && (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Acknowledged
                    </span>
                  )}
                </div>
                <p className={`text-sm ${styles.text} opacity-90 line-clamp-1`}>
                  {alert.message}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleExpand(alert.id)}
                  className={`p-1.5 rounded-full hover:bg-black/10 transition-colors ${styles.text}`}
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {!alert.acknowledged && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className={`p-1.5 rounded-full hover:bg-black/10 transition-colors ${styles.text}`}
                    title="Acknowledge"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => handleDismiss(alert.id)}
                  className={`p-1.5 rounded-full hover:bg-black/10 transition-colors ${styles.text}`}
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className={`px-3 pb-3 pt-0 border-t ${styles.border} ${styles.text}`}>
                <div className="space-y-2 text-sm">
                  <p>{alert.message}</p>

                  {alert.recommendation && (
                    <div className="p-2 bg-white/50 rounded-lg">
                      <span className="font-medium">Recommendation: </span>
                      {alert.recommendation}
                    </div>
                  )}

                  {alert.triggerVital && alert.triggerValue && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Trigger:</span>
                      <span>{alert.triggerVital}: {alert.triggerValue}</span>
                      {alert.expectedRange && (
                        <span className="opacity-75">
                          (expected: {alert.expectedRange.min}-{alert.expectedRange.max})
                        </span>
                      )}
                    </div>
                  )}

                  {alert.relatedMedications && alert.relatedMedications.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Medications:</span>
                      <span>{alert.relatedMedications.join(', ')}</span>
                    </div>
                  )}

                  {alert.aiConfidence !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">AI Confidence:</span>
                      <span>{Math.round(alert.aiConfidence * 100)}%</span>
                    </div>
                  )}

                  <div className="text-xs opacity-75">
                    {new Date(alert.timestamp).toLocaleString()}
                    {alert.acknowledgedAt && (
                      <span> • Acknowledged by {alert.acknowledgedByName} at {new Date(alert.acknowledgedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Show more button */}
      {hasMoreAlerts && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center gap-1"
        >
          {showAll ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {alerts.length - 3} more alerts
            </>
          )}
        </button>
      )}
    </div>
  );
};

// Alert indicator for patient cards
export const AlertIndicator: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [alertCount, setAlertCount] = useState(0);
  const [highestSeverity, setHighestSeverity] = useState<AlertSeverity | null>(null);

  useEffect(() => {
    const updateAlerts = () => {
      const alerts = clinicalAlertService.getPatientAlerts(patientId);
      setAlertCount(alerts.length);

      if (alerts.length > 0) {
        // Get highest severity
        const severityOrder = [AlertSeverity.EMERGENCY, AlertSeverity.CRITICAL, AlertSeverity.WARNING, AlertSeverity.INFO];
        for (const severity of severityOrder) {
          if (alerts.some(a => a.severity === severity)) {
            setHighestSeverity(severity);
            break;
          }
        }
      } else {
        setHighestSeverity(null);
      }
    };

    updateAlerts();
    const unsubscribe = clinicalAlertService.subscribe((alert) => {
      if (alert.patientId === patientId) {
        updateAlerts();
      }
    });

    return unsubscribe;
  }, [patientId]);

  if (alertCount === 0) return null;

  const getBadgeColor = () => {
    switch (highestSeverity) {
      case AlertSeverity.EMERGENCY:
        return 'bg-red-600 animate-pulse';
      case AlertSeverity.CRITICAL:
        return 'bg-red-500';
      case AlertSeverity.WARNING:
        return 'bg-amber-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className={`absolute -top-1 -right-1 w-5 h-5 ${getBadgeColor()} rounded-full flex items-center justify-center`}>
      <span className="text-white text-xs font-bold">
        {alertCount > 9 ? '9+' : alertCount}
      </span>
    </div>
  );
};

export default ClinicalAlertBanner;
