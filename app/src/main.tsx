import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

type RootErrorBoundaryState = {
  hasError: boolean
  message: string
}

class RootErrorBoundary extends Component<{ children: React.ReactNode }, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = {
    hasError: false,
    message: '',
  }

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.stack ?? error.message : String(error),
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ padding: 16, fontFamily: 'Segoe UI, sans-serif' }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Runtime error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.message}</pre>
        </main>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
