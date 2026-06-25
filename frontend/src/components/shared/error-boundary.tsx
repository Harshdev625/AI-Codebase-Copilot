"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    // Here we could send to Sentry or another logging service
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center rounded-3xl border border-destructive/20 bg-destructive/5 backdrop-blur-sm p-8 text-center animate-in fade-in duration-500">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20 shadow-inner">
            <AlertTriangle className="h-10 w-10 text-destructive/90" />
          </div>
          <h2 className="mb-3 text-2xl font-semibold text-foreground tracking-tight">Something went wrong</h2>
          <p className="mb-8 max-w-md text-sm text-muted-foreground leading-relaxed">
            {this.state.error?.message || "An unexpected error occurred in this component. We've logged the issue and are looking into it."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" onClick={() => window.location.href = '/dashboard'} className="rounded-xl border-border/50 text-muted-foreground hover:text-foreground">
              <Home className="mr-2 h-4 w-4" />
              Return Home
            </Button>
            <Button onClick={this.resetError} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
