import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMovies } from '../contexts/MovieContext';
import { useTheme } from '../contexts/ThemeContext';

const Home = () => {
  const { trendingMovies, fetchTrendingMovies, currentPage, setCurrentPage, isRefreshing } = useMovies();
  const { toggleTheme } = useTheme();

  useEffect(() => {
    fetchTrendingMovies(currentPage);
  }, [currentPage, fetchTrendingMovies]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🎬 Trending Movies</h1>
        <button onClick={toggleTheme}>🌙 Dark Mode</button>
        {isRefreshing && <span>🔄 Refreshing...</span>}
      </div>
      
      <div className="api-data-container">
        {trendingMovies.map(movie => (
          <div key={movie.id} className="movie-card">
            <img 
              src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '/path-to-placeholder-image.png'} 
              alt={movie.title} 
              className="movie-poster" 
            />
            <h3 className="movie-title">{movie.title}</h3>
            <Link to={`/movie/${movie.id}`}>
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
          Previous
        </button>
        <span>Page {currentPage}</span>
        <button 
          onClick={() => handlePageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Home;