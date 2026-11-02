import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMovies } from '../contexts/MovieContext';

const Search = () => {
  const [query, setQuery] = useState('');
  const { searchMovies, searchResults, currentPage, setCurrentPage } = useMovies();

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      searchMovies(query, 1);
    }
  };

  const handlePageChange = (page) => {
    searchMovies(query, page);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🔍 Search Movies</h1>
      </div>
      
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for movies, actors, genres..."
        />
        <button type="submit">Search</button>
      </form>

      {searchResults.length > 0 && (
        <>
          <div className="movies-grid">
            {searchResults.map(movie => (
              <div key={movie.id} className="movie-card">
                <img 
                  src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '/path-to-placeholder-image.png'} 
                  alt={movie.title} 
                  className="movie-poster" 
                />
                <h3 className="movie-title">{movie.title}</h3>
                <Link to={`/movie/${movie.id}`} className="movie-title">
                  {movie.title} ({movie.release_date?.substring(0, 4)})
                </Link>
                <p>{movie.overview.substring(0, 150)}...</p>
              </div>
            ))}
          </div>

          <div className="pagination">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ← Previous
            </button>
            <span>Page {currentPage}</span>
            <button onClick={() => handlePageChange(currentPage + 1)}>
              Next →
            </button>
          </div>
        </>
      )}

      {searchResults.length === 0 && query && (
        <div className="movie-card error-fallback">
          <p>No movies found for "{query}". Try different keywords!</p>
        </div>
      )}
    </div>
  );
};

export default Search;