import React from 'react';

class MovieErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MovieErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-container">
          <div className="error-fallback movie-card">
            <h2>⚠️ Movie data unavailable</h2>
            <p>Something went wrong while loading movies. This could be due to:</p>
            <ul>
              <li>Network connection issues</li>
              <li>TMDb API temporarily unavailable</li>
              <li>Movie data not available in your region</li>
            </ul>
            <div>
              <button onClick={() => window.location.reload()}>
                🔄 Reload Page
              </button>
              <Link to="/" className="button-secondary">
                🏠 Go Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MovieErrorBoundary;