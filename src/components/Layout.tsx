import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { currentTheme, setTheme, type Theme } from '../lib/theme';
import { StudyDataProvider } from './StudyData';

export function Layout() {
  const { profile } = useAuth();
  const [theme, setThemeState] = useState<Theme>(currentTheme);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          متابعة الثانوية الأزهرية
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>
            الرئيسية
          </NavLink>
          <NavLink to="/settings">الإعدادات</NavLink>
          {profile?.role === 'admin' && <NavLink to="/admin">لوحة المتحكم</NavLink>}
          <button
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
            title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </nav>
      </header>
      <main className="container">
        <StudyDataProvider>
          <Outlet />
        </StudyDataProvider>
      </main>
    </div>
  );
}
