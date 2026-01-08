import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary Component
 * Catches all React errors and provides user-friendly fallback UI
 * Ensures zero crashes and maintains medical professional aesthetic
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // In production, you would log this to an external service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Reload the page to reset state
    window.location.href = '/';
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI with medical theme
      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 via-sky-100 to-blue-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full border border-red-200">
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="bg-red-500/10 p-4 rounded-full">
                <svg
                  className="w-16 h-16 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">
              Something Went Wrong
            </h1>
            <p className="text-slate-600 text-center mb-6">
              We encountered an unexpected error. Your data is safe, but the app needs to restart.
            </p>

            {/* Error Details (collapsed by default) */}
            <details className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
                Technical Details
              </summary>
              <div className="mt-4 space-y-2">
                <div className="text-xs font-mono text-red-600 break-words">
                  <strong>Error:</strong> {this.state.error?.message}
                </div>
                {this.state.errorInfo && (
                  <div className="text-xs font-mono text-slate-600 max-h-48 overflow-auto">
                    <strong>Stack Trace:</strong>
                    <pre className="mt-2 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full bg-medical-teal hover:bg-medical-blue text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 active:scale-98 shadow-md hover:shadow-lg"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReset}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-lg transition-all duration-200 active:scale-98 border border-slate-300"
              >
                Go to Dashboard
              </button>
            </div>

            {/* Help Text */}
            <div className="mt-6 text-center text-sm text-slate-500">
              If this problem persists, please contact support.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
