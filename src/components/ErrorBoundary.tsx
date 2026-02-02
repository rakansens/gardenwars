"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.setState({ errorInfo });

        // Here you could also log to an error reporting service
        // e.g., Sentry, LogRocket, etc.
    }

    handleRetry = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900 p-4">
                    <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
                        <div className="text-6xl mb-4">😵</div>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                            Something went wrong
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            An unexpected error occurred. Please try again.
                        </p>

                        {process.env.NODE_ENV === "development" && this.state.error && (
                            <details className="mb-6 text-left">
                                <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                                    Error details
                                </summary>
                                <pre className="mt-2 p-3 bg-gray-100 dark:bg-slate-700 rounded-lg text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40">
                                    {this.state.error.message}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all active:scale-95"
                            >
                                🔄 Try Again
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="px-6 py-3 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-white font-bold rounded-xl hover:bg-gray-300 dark:hover:bg-slate-600 transition-all"
                            >
                                🔃 Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
