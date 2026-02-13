import { Component, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-4">
          <p className="text-slate-700 font-medium">渲染出错</p>
          <pre className="text-xs text-slate-500 overflow-auto max-w-full p-4 bg-slate-100 rounded-lg">
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
