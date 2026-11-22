import React from 'react';
import { Link } from 'react-router-dom';
import { useMovies } from '../contexts/MovieContext';

const Watchlist = () => {
  const { watchlist, removeFromWatchlist } = useMovies();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📺 My Watchlist ({watchlist.length})</h1>
        <Link to="/" className="button-secondary">
          ← Browse More Movies
        </Link>
      </div>
      
      {watchlist.length === 0 ? (
        <div className="movie-card error-fallback">
          <h3>Your watchlist is empty 😢</h3>
          <p>Add movies from trending or search results to get started!</p>
          <Link to="/" className="button-primary">
            Start Browsing
          </Link>
        </div>
      ) : (
        <div className="movies-grid">
          {watchlist.map(movie => (
            <div key={movie.id} className="movie-card">
              {movie.poster_path && (
                <img 
                  src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                  alt={movie.title}
                  className="movie-poster-small"
                />
              )}
              <div>
                <Link to={`/movie/${movie.id}`} className="movie-title">
                  {movie.title}
                </Link>
                <p>{movie.release_date?.substring(0, 4) || 'TBA'}</p>
                <div className="movie-actions">
                  <button 
                    onClick={() => removeFromWatchlist(movie.id)}
                    className="button-danger"
                  >
                    ❌ Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Watchlist;