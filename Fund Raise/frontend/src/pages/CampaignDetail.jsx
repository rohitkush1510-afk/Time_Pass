import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { request } from '../api';
import { useAuth } from '../context/AuthContext';
import ProgressBar from '../components/ProgressBar';


const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || undefined;

export default function CampaignDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [campaign, setCampaign] = useState(null);
  const [raised, setRaised] = useState(0);
  const [supporters, setSupporters] = useState(0);
  const [pledges, setPledges] = useState([]);

  const [amount, setAmount] = useState('');
  const [card, setCard] = useState('');
  const [message, setMessage] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [live, setLive] = useState(false);

  const loadCampaign = useCallback(async () => {
    try {
      const data = await request('/campaigns/' + id);
      setCampaign(data);
      setRaised(data.totalRaised || 0);
      setSupporters(data.supportersCount || 0);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    }
  }, [id]);

  const loadPledges = useCallback(async () => {
    try {
      const data = await request('/pledges/campaign/' + id);
      setPledges(data);
    } catch {
      setPledges([]);
    }
  }, [id]);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadCampaign(), loadPledges()]);
    })();

    const socket = io(SOCKET_URL);

    socket.on('connect', () => setLive(true));
    socket.on('disconnect', () => setLive(false));
    socket.on('connect_error', () => setLive(false));

    socket.on('newPledge', (data) => {
      // update only if the pledge is for THIS campaign
      if (data.campaignId === id) {
        setRaised(data.totalRaised);
        setSupporters(data.supportersCount);
        loadPledges();
      }
    });

    return () => socket.disconnect();
  }, [id, loadCampaign, loadPledges]);

  async function handlePledge(e) {
    e.preventDefault();
    setError('');
    setInfo('');

    try {
      const data = await request('/pledges', 'POST', {
        campaignId: id,
        amount,
        cardNumber: card,
        message
      });

      
      setRaised(data.totalRaised);
      setSupporters(data.supportersCount);
      setInfo('Payment successful (mock). Thank you for your pledge!');
      setAmount('');
      setCard('');
      setMessage('');
      loadPledges();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loadError) return <p className="error">{loadError}</p>;
  if (!campaign) return <p>Loading...</p>;

  const creatorId = campaign.creator ? campaign.creator._id : null;
  const isOwner = Boolean(user && creatorId && String(user.id) === String(creatorId));
  const canPledge = Boolean(
    user && !isOwner &&
    campaign.status === 'approved' &&
    new Date(campaign.deadline) >= new Date()
  );

  return (
    <div>
      <h1>{campaign.title}</h1>
      <p className="small">
        Category: {campaign.category} | By {campaign.creator ? campaign.creator.name : 'unknown'} |
        Deadline: {new Date(campaign.deadline).toLocaleDateString()}
      </p>

      <div className="card">
        {campaign.imageUrl && (
          <img src={campaign.imageUrl} alt={campaign.title} style={{ maxWidth: '100%', maxHeight: 320 }} />
        )}
        <p>{campaign.description}</p>
        <ProgressBar raised={raised} goal={campaign.goal} />
        <p className="small">Supporters: {supporters}</p>
        <p className="small">
          Socket status: {live ? 'connected (live)' : 'not connected'}
        </p>
      </div>

      <div className="card">
        <h3>Back this campaign</h3>

        {!user && <p>Please login to pledge.</p>}
        {isOwner && <p>You cannot pledge to your own campaign.</p>}
        {user && !isOwner && campaign.status !== 'approved' && (
          <p>This campaign is not approved yet, so pledging is closed.</p>
        )}
        {user && !isOwner && new Date(campaign.deadline) < new Date() && (
          <p>This campaign's deadline has passed.</p>
        )}

        {canPledge && (
          <form id="pledge-form" onSubmit={handlePledge}>
            {error && <p className="error">{error}</p>}
            {info && <p className="success">{info}</p>}

            <label>Amount</label>
            <input
              type="number"
              min="10"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <label>Card number (mock, 16 digits)</label>
            <input
              value={card}
              onChange={(e) => setCard(e.target.value)}
              placeholder="1111222233334444"
            />

            <label>Message (optional)</label>
            <input value={message} onChange={(e) => setMessage(e.target.value)} />

            <button type="submit">Pledge (mock payment)</button>
          </form>
        )}
      </div>

      <h2>Pledges</h2>
      {pledges.length === 0 && <p>No pledges yet. Be the first!</p>}

      {pledges.map((p) => (
        <div className="card" key={p._id}>
          <b>{p.supporter ? p.supporter.name : 'someone'}</b> pledged {p.amount}
          {p.message && <p className="small">"{p.message}"</p>}
        </div>
      ))}

      {canPledge && (
        <button type="submit" form="pledge-form" className="fab" title="Pledge now" aria-label="Pledge now">
          ♥
        </button>
      )}
    </div>
  );
}
