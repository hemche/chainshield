'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-20">
          <div className="glass-card rounded-2xl p-8 max-w-md text-center space-y-4">
            <div className="text-red-400 text-4xl mb-2">!</div>
            <h2 className="text-white text-lg font-semibold">Something went wrong</h2>
            <p className="text-gray-400 text-sm">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
