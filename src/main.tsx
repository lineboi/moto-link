import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from '@/theme/provider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import App from '@/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Provider>
  </StrictMode>,
)
