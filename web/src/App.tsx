import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { ToolsStatus } from './pages/ToolsStatus';
import { GitHub } from './pages/GitHub';
import { Velocity } from './pages/Velocity';
import { Components } from './pages/Components';
import { SprintDetails } from './pages/SprintDetails';
import { ErrorBoundary } from './components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/tools" element={<ToolsStatus />} />
              <Route path="/github" element={<GitHub />} />
              <Route path="/velocity" element={<Velocity />} />
              <Route path="/sprint/:sprintId" element={<SprintDetails />} />
              <Route path="/components" element={<Components />} />
            </Routes>
          </Layout>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
