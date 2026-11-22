import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMovies } from '../contexts/MovieContext';

const MovieDetail = () => {
  const { id } = useParams();
  const { fetchMovieDetails, selectedMovie, addToWatchlist } = useMovies();
  const navigate = useNavigate();
  const [isRatingRefreshing, setIsRatingRefreshing] = useState(false);

  useEffect(() => {
    fetchMovieDetails(id);
  }, [id, fetchMovieDetails]);

  const refreshRating = async () => {
    setIsRatingRefreshing(true);
    try {
      await fetchMovieDetails(id);
    } finally {
      setIsRatingRefreshing(false);
    }
  };

  if (!selectedMovie) {
    return (
      <div className="page-container error-fallback">
        <div className="movie-card">
          <h2>🎥 Loading movie details...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container movie-detail">
      <button onClick={() => navigate(-1)}>← Back to Results</button>
      
      <div className="movie-card detail-grid">
        {selectedMovie.poster_path && (
          <img 
            src={`https://image.tmdb.org/t/p/w500${selectedMovie.poster_path}`} 
            alt={selectedMovie.title}
            className="movie-poster"
          />
        )}
        
        <div>
          <h1 className="movie-title">{selectedMovie.title}</h1>
          
          <div className="detail-grid">
            <p><strong>🎬 Release Date:</strong> {selectedMovie.release_date || 'TBA'}</p>
            <p><strong>⏱️ Runtime:</strong> {selectedMovie.runtime ? `${selectedMovie.runtime} min` : 'TBA'}</p>
            
            <div className="rating-badge">
              ⭐ {selectedMovie.vote_average?.toFixed(1) || 'N/A'}/10
              {isRatingRefreshing ? (
                <span>🔄 Refreshing...</span>
              ) : (
                <button onClick={refreshRating}>↻ Refresh</button>
              )}
            </div>
          </div>

          <p>{selectedMovie.overview || 'No description available.'}</p>
          
          <div>
            <button onClick={() => addToWatchlist(selectedMovie)}>
              ➕ Add to Watchlist
            </button>
            <Link to="/watchlist" className="button-secondary">
              📺 View Watchlist
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieDetail;