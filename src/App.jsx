import { DataProvider } from './context/DataContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Dashboard />
      </DataProvider>
    </AuthProvider>
  );
}
