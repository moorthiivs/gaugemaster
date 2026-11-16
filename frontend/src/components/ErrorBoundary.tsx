import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-center space-y-3 m-4">
          <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            {this.props.fallbackTitle || "Something went wrong loading this section"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto font-mono text-[11px] bg-background/60 p-2 rounded border border-border/50">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
