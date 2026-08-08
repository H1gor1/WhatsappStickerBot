import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Bans from './pages/Bans';
import Settings from './pages/Settings';
import Commands from './pages/Commands';
import History from './pages/History';
import Metrics from './pages/Metrics';
import Logs from './pages/Logs';
import './index.css';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/admin/api/status', { credentials: 'include' })
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#888' }}>Verificando...</div>;
  return authed ? <>{children}</> : <Navigate to="/admin/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/bans"
          element={
            <PrivateRoute>
              <Dashboard><Bans /></Dashboard>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <PrivateRoute>
              <Dashboard><Settings /></Dashboard>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/commands"
          element={
            <PrivateRoute>
              <Dashboard><Commands /></Dashboard>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/history"
          element={
            <PrivateRoute>
              <Dashboard><History /></Dashboard>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/metrics"
          element={
            <PrivateRoute>
              <Dashboard><Metrics /></Dashboard>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <PrivateRoute>
              <Dashboard><Logs /></Dashboard>
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/admin" />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
