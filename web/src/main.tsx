import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ConfigurationProvider } from './contexts/ConfigurationContext.tsx'
import './index.css'

// Note: StrictMode is disabled to prevent duplicate API calls in development
// StrictMode intentionally double-renders components to help detect side effects
// Re-enable for debugging if needed: Wrap <App /> in <React.StrictMode>
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigurationProvider>
    <App />
  </ConfigurationProvider>
)
