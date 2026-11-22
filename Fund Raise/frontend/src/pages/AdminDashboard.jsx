import { useCallback, useEffect, useState } from 'react';
import { request } from '../api';

export default function AdminDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [campaignList, overallStats] = await Promise.all([
        request('/admin/campaigns'),
        request('/admin/stats')
      ]);
      setCampaigns(campaignList);
      setStats(overallStats);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function changeStatus(id, action) {
    setError('');
    try {
      await request('/admin/campaigns/' + id + '/' + action, 'PUT');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const pending = campaigns.filter((c) => c.status === 'pending');

  return (
    <div>
      <h1>Admin Dashboard</h1>
      {error && <p className="error">{error}</p>}

      {stats && (
        <div className="card">
          <h3>Overall Stats</h3>
          <p>Total raised: {stats.totalRaised}</p>
          <p>Supporters (unique): {stats.supportersCount}</p>
          <p>Pledges: {stats.pledgesCount}</p>
          <p>Campaigns: {stats.campaignsCount} (pending: {stats.pendingCount})</p>
          <p>Users: {stats.usersCount}</p>
        </div>
      )}

      <h2>Pending approval ({pending.length})</h2>
      {pending.length === 0 && <p>Nothing to review.</p>}

      {pending.map((c) => (
        <div className="card" key={c._id}>
          <h3>{c.title}</h3>
          <p className="small">
            {c.category} | by {c.creator ? c.creator.name : 'unknown'} | goal {c.goal}
          </p>
          <p>{c.description}</p>
          <button onClick={() => changeStatus(c._id, 'approve')}>Approve</button>
          <button onClick={() => changeStatus(c._id, 'reject')}>Reject</button>
        </div>
      ))}

      <h2>All campaigns</h2>
      <table>
        <thead>
          <tr>
            <th>Title</th><th>Category</th><th>Status</th><th>Raised</th><th>Supporters</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c._id}>
              <td>{c.title}</td>
              <td>{c.category}</td>
              <td>{c.status}</td>
              <td>{c.totalRaised}</td>
              <td>{c.supportersCount}</td>
              <td>
                {c.status !== 'approved' && (
                  <button onClick={() => changeStatus(c._id, 'approve')}>Approve</button>
                )}
                {c.status !== 'rejected' && (
                  <button onClick={() => changeStatus(c._id, 'reject')}>Reject</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
