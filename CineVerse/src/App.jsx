import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import MovieDetail from './pages/MovieDetail';
import Search from './pages/Search';
import Watchlist from './pages/Watchlist';
import MovieErrorBoundary from './components/MovieErrorBoundary';
import { useTheme } from './contexts/ThemeContext';

function App() {
  const { theme } = useTheme();
  const location = useLocation();

  return (
    <div className={theme}>
      <nav>
        <Link to="/">🏠 Home</Link>
        <Link to="/search">🔍 Search</Link>
        <Link to="/watchlist">📺 Watchlist</Link>
      </nav>
      <main className="page-container">
        <Routes>
          <Route path="/" element={
            <MovieErrorBoundary>
              <Home />
            </MovieErrorBoundary>
          } />
          <Route path="/movie/:id" element={
            <MovieErrorBoundary>
              <MovieDetail />
            </MovieErrorBoundary>
          } />
          <Route path="/search" element={
            <MovieErrorBoundary>
              <Search />
            </MovieErrorBoundary>
          } />
          <Route path="/watchlist" element={
            <MovieErrorBoundary>
              <Watchlist />
            </MovieErrorBoundary>
          } />
        </Routes>
      </main>
    </div>
  );
}

export default App;