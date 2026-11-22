import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../api';

export default function MyPledges() {
  const [pledges, setPledges] = useState([]);

  useEffect(() => {
    request('/pledges/mine').then(setPledges).catch((err) => alert(err.message));
  }, []);

  return (
    <div>
      <h1>My Pledges</h1>

      {pledges.length === 0 && <p>You have not pledged to anything yet.</p>}

      {pledges.map((p) => (
        <div className="card" key={p._id}>
          <b>{p.amount}</b> to{' '}
          {p.campaign ? (
            <Link to={'/campaign/' + p.campaign._id}>{p.campaign.title}</Link>
          ) : (
            'deleted campaign'
          )}
          <p className="small">
            {p.paymentStatus} | {new Date(p.createdAt).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}