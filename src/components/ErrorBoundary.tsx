import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
// A class component can't use hooks; i18n.t reads the current language when the fallback renders
import i18n from '../i18n';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  autoReloadOnCriticalError?: boolean;
  autoReloadDelay?: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  countdown: number;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays a fallback UI
 * Can automatically reload the page on critical errors (like missing services)
 */
export class ErrorBoundary extends Component<Props, State> {
  private countdownInterval: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      countdown: props.autoReloadDelay || 3,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Check if this is a critical error that should trigger auto-reload
    const isCriticalError = this.isCriticalError(error);
    
    if (isCriticalError && this.props.autoReloadOnCriticalError) {
      console.log('Critical error detected, will auto-reload in', this.state.countdown, 'seconds');
      this.startCountdown();
    }
  }

  componentWillUnmount() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  isCriticalError(error: Error): boolean {
    const criticalPatterns = [
      /is not defined/i,
      /Cannot read property.*of undefined/i,
      /Cannot read properties of undefined/i,
      /is not a function/i,
      /Service.*not defined/i,
    ];

    return criticalPatterns.some(pattern => pattern.test(error.message));
  }

  startCountdown() {
    this.countdownInterval = setInterval(() => {
      this.setState(prevState => {
        const newCountdown = prevState.countdown - 1;
        
        if (newCountdown <= 0) {
          if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
          }
          window.location.reload();
          return null;
        }
        
        return { 
          countdown: newCountdown,
          hasError: prevState.hasError,
          error: prevState.error,
          errorInfo: prevState.errorInfo
        };
      });
    }, 1000);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      countdown: this.props.autoReloadDelay || 3,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, countdown } = this.state;
      const isCritical = error ? this.isCriticalError(error) : false;
      const willAutoReload = isCritical && this.props.autoReloadOnCriticalError;

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center mb-6">
              <div className="flex-shrink-0">
                <svg
                  className="h-12 w-12 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="ms-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  {i18n.t(isCritical ? 'errorScreen.criticalTitle' : 'errorScreen.title')}
                </h1>
                <p className="text-gray-600 mt-1">
                  {i18n.t(isCritical ? 'errorScreen.criticalBody' : 'errorScreen.body')}
                </p>
              </div>
            </div>

            {willAutoReload && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center">
                  <svg
                    className="h-5 w-5 text-blue-500 me-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <p className="text-blue-800 font-medium">
                    {i18n.t('errorScreen.autoReload', { count: countdown })}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{i18n.t('errorScreen.details')}</h2>
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-red-800 font-mono text-sm break-all">
                    {error.toString()}
                  </p>
                </div>
              </div>
            )}

            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="mb-6">
                <summary className="cursor-pointer text-gray-700 font-medium hover:text-gray-900">
                  Stack trace (development only)
                </summary>
                <pre className="mt-2 bg-gray-100 border border-gray-200 rounded-md p-4 overflow-auto text-xs text-gray-800">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {i18n.t('errorScreen.reload')}
              </button>
              {!isCritical && (
                <button
                  onClick={this.handleReset}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
                >
                  {i18n.t('errorScreen.tryAgain')}
                </button>
              )}
            </div>

            <p className="text-sm text-gray-500 mt-4 text-center">
              {i18n.t('errorScreen.persists')}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
