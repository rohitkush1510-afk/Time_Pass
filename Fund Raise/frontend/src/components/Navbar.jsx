import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';

function Icon({ name }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
      {name === 'heart' && (
        <path d="M12 20.3s-7.3-4.6-7.3-9.7A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.3 3.3c0 5.1-7.3 9.7-7.3 9.7z" />
      )}
      {name === 'home' && (
        <>
          <path d="M3.5 10.5 12 3.5l8.5 7" />
          <path d="M5.5 9.5V20h13V9.5" />
        </>
      )}
      {name === 'plus' && <path d="M12 5v14M5 12h14" />}
      {name === 'grid' && (
        <>
          <rect x="4" y="4" width="7" height="7" rx="2" />
          <rect x="13" y="4" width="7" height="7" rx="2" />
          <rect x="4" y="13" width="7" height="7" rx="2" />
          <rect x="13" y="13" width="7" height="7" rx="2" />
        </>
      )}
      {name === 'list' && (
        <>
          <path d="M8 6h12M8 12h12M8 18h12" />
          <path d="M3.8 6h.01M3.8 12h.01M3.8 18h.01" />
        </>
      )}
      {name === 'shield' && (
        <>
          <path d="M12 3 5 6v5c0 4.4 2.9 8 7 10 4.1-2 7-5.6 7-10V6z" />
          <path d="m9.5 12 1.8 1.8 3.4-3.6" />
        </>
      )}
      {name === 'logout' && (
        <>
          <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
          <path d="M15 8l4 4-4 4M19 12H9" />
        </>
      )}
    </svg>
  );
}

function linkClass({ isActive }) {
  return 'nav-link' + (isActive ? ' active' : '');
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  const initials = user?.name
    ? user.name.split(' ').map((part) => part.charAt(0)).slice(0, 2).join('').toUpperCase()
    : '';

  return (
    <header className="site-nav">
      <NavLink to="/" className="brand" aria-label="FundRaise home">
        <span className="brand-mark"><Icon name="heart" /></span>
        <span className="brand-text">Fund<span>Raise</span></span>
      </NavLink>

      <nav className="nav-links" aria-label="Main navigation">
        <NavLink to="/" end className={linkClass}>
          <Icon name="home" />
          <span>Explore</span>
        </NavLink>

        {user?.role === 'creator' && (
          <>
            <NavLink to="/create" className={linkClass}>
              <Icon name="plus" />
              <span>Create</span>
            </NavLink>
            <NavLink to="/my-campaigns" className={linkClass}>
              <Icon name="grid" />
              <span>Campaigns</span>
            </NavLink>
          </>
        )}

        {user && (
          <NavLink to="/my-pledges" className={linkClass}>
            <Icon name="list" />
            <span>Pledges</span>
          </NavLink>
        )}

        {user?.role === 'admin' && (
          <NavLink to="/admin" className={linkClass}>
            <Icon name="shield" />
            <span>Admin</span>
          </NavLink>
        )}
      </nav>

      <div className="nav-account">
        <ThemeToggle />
        {user ? (
          <>
            <span className={'role-badge role-' + user.role}>{user.role}</span>
            <span className="nav-avatar" aria-hidden="true">{initials}</span>
            <span className="nav-user">{user.name}</span>
            <button
              type="button"
              className="nav-logout"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
            >
              <Icon name="logout" />
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className={linkClass}>Login</NavLink>
            <NavLink to="/register" className="nav-cta">Get started</NavLink>
          </>
        )}
      </div>
    </header>
  );
}
