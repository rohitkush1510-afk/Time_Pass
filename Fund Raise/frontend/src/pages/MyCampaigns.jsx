import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../api';
import ProgressBar from '../components/ProgressBar';
import { toDateInputValue, toEndOfDayISO } from '../utils/dates';

const emptyForm = {
  title: '',
  description: '',
  goal: '',
  deadline: '',
  category: 'Medical',
  imageUrl: ''
};

export default function MyCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      setCampaigns(await request('/campaigns/mine'));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // data fetching is asynchronous, so this does not cause a cascading render
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(c) {
    setError('');
    setEditingId(c._id);
    setForm({
      title: c.title,
      description: c.description,
      goal: String(c.goal),
      deadline: toDateInputValue(c.deadline),
      category: c.category,
      imageUrl: c.imageUrl || ''
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    setError('');
    try {
      await request('/campaigns/' + editingId, 'PUT', {
        ...form,
        deadline: toEndOfDayISO(form.deadline)
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this campaign?')) return;
    try {
      await request('/campaigns/' + id, 'DELETE');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>My Campaigns</h1>
      {error && <p className="error">{error}</p>}

      {campaigns.length === 0 && <p>You have not created any campaign yet.</p>}

      {campaigns.map((c) => (
        <div className="card" key={c._id}>
          {editingId === c._id ? (
            <form onSubmit={saveEdit}>
              <h3>Edit campaign</h3>
              <label>Title</label>
              <input value={form.title} onChange={(e) => updateField('title', e.target.value)} />

              <label>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
              />

              <label>Goal amount</label>
              <input
                type="number"
                min="1"
                value={form.goal}
                onChange={(e) => updateField('goal', e.target.value)}
              />

              <label>Deadline</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => updateField('deadline', e.target.value)}
              />

              <label>Category</label>
              <select value={form.category} onChange={(e) => updateField('category', e.target.value)}>
                <option>Medical</option>
                <option>Education</option>
                <option>Tech</option>
                <option>Animals</option>
                <option>Other</option>
              </select>

              <label>Image URL (optional)</label>
              <input value={form.imageUrl} onChange={(e) => updateField('imageUrl', e.target.value)} />

              <button type="submit">Save</button>
              <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
            </form>
          ) : (
            <>
              <h3>{c.title}</h3>
              <p className="small">
                Status: <b>{c.status}</b> | Category: {c.category} |
                Deadline: {new Date(c.deadline).toLocaleDateString()}
              </p>

              {c.imageUrl && (
                <img src={c.imageUrl} alt={c.title} style={{ maxWidth: '100%', maxHeight: 220 }} />
              )}
              <p>{c.description}</p>

              <ProgressBar raised={c.totalRaised} goal={c.goal} />
              <p className="small">Supporters: {c.supportersCount}</p>

              <Link to={'/campaign/' + c._id}>View</Link>
              {c.status === 'pending' && (
                <>
                  <button onClick={() => startEdit(c)}>Edit</button>
                  <button onClick={() => remove(c._id)}>Delete</button>
                </>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
