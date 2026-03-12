import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store.js';
import LoginPage from './pages/LoginPage.js';
import GamePage from './pages/GamePage.js';
import ResetPasswordPage from './pages/ResetPasswordPage.js';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/game" /> : <LoginPage />}
      />
      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />
      <Route
        path="/game"
        element={isAuthenticated ? <GamePage /> : <Navigate to="/login" />}
      />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}
