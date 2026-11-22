import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { request } from '../api';
import FanGallery from '../components/FanGallery';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || undefined;

export default function Home() {
  const [campaigns, setCampaigns] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      const data = await request('/campaigns/category-stats');
      setCategoryStats(data);
    } catch {
      setCategoryStats([]);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (query) params.append('search', query);

      const data = await request('/campaigns?' + params.toString());
      setCampaigns(data);
      setError('');
    } catch (err) {
      setError(err.message);
      setCampaigns([]);
    }
  }, [category, query]);

  useEffect(() => {
    void (async () => {
      await loadCampaigns();
    })();
  }, [loadCampaigns]);

  useEffect(() => {
    void (async () => {
      await loadCategories();
    })();
  }, [loadCategories]);

  
  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('newPledge', (data) => {
      setCampaigns((current) => current.map((c) => (
        c._id === data.campaignId
          ? { ...c, totalRaised: data.totalRaised, supportersCount: data.supportersCount }
          : c
      )));
      loadCategories();
    });

    return () => socket.disconnect();
  }, [loadCategories]);

  return (
    <div>
      <h1>Live Campaigns</h1>

      <div className="card">
        <input
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setQuery(search); }}
          style={{ width: '60%' }}
        />
        <button onClick={() => setQuery(search)}>Search</button>
      </div>

      <div className="filters">
        {['', 'Medical', 'Education', 'Tech', 'Animals', 'Other'].map((c) => (
          <button
            key={c}
            className={category === c ? 'active' : ''}
            onClick={() => setCategory(c)}
          >
            {c === '' ? 'All' : c}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {campaigns.length === 0 && <p>No approved campaigns yet.</p>}

      {campaigns.length > 0 && <FanGallery campaigns={campaigns} />}

      <h2>Category wise funding</h2>
      <table>
        <thead>
          <tr><th>Category</th><th>Total Raised</th></tr>
        </thead>
        <tbody>
          {categoryStats.map((row) => (
            <tr key={row.category}>
              <td>{row.category}</td>
              <td>{row.totalRaised}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
