import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_KEY = '437c3163d43f1fd52151d2ae4a8caaa1'; 
const BASE_URL = 'https://api.themoviedb.org/3';

const MovieContext = createContext();

export const useMovies = () => {
  const context = useContext(MovieContext);
  if (!context) {
    throw new Error('useMovies must be used within MovieProvider');
  }
  return context;
};

export const MovieProvider = ({ children }) => {
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);

  const fetchTrendingMovies = useCallback(async (page = 1) => {
    try {
      setIsRefreshing(true);
      const response = await fetch(
        `${BASE_URL}/trending/movie/week?api_key=${API_KEY}&page=${page}`
      );
      const data = await response.json();
      setTrendingMovies(data.results || []);
    } catch (error) {
      console.error('Error fetching trending movies:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const searchMovies = useCallback(async (query, page = 1) => {
    try {
      const response = await fetch(
        `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${page}`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error searching movies:', error);
      setSearchResults([]);
    }
  }, []);

  const fetchMovieDetails = useCallback(async (movieId) => {
    try {
      const response = await fetch(
        `${BASE_URL}/movie/${movieId}?api_key=${API_KEY}&append_to_response=videos,images`
      );
      const data = await response.json();
      setSelectedMovie(data);
    } catch (error) {
      console.error('Error fetching movie details:', error);
    }
  }, []);

  const addToWatchlist = (movie) => {
    if (!watchlist.find(item => item.id === movie.id)) {
      setWatchlist(prev => [...prev, movie]);
    }
  };

  const removeFromWatchlist = (movieId) => {
    setWatchlist(prev => prev.filter(movie => movie.id !== movieId));
  };

  useEffect(() => {
    fetchTrendingMovies(1);
    const interval = setInterval(() => {
      fetchTrendingMovies(currentPage);
    }, 300000); 

    return () => clearInterval(interval);
  }, [fetchTrendingMovies, currentPage]);

  return (
    <MovieContext.Provider
      value={{
        trendingMovies,
        searchResults,
        watchlist,
        currentPage,
        isRefreshing,
        selectedMovie,
        fetchTrendingMovies,
        searchMovies,
        fetchMovieDetails,
        addToWatchlist,
        removeFromWatchlist,
        setCurrentPage,
      }}
    >
      {children}
    </MovieContext.Provider>
  );
};