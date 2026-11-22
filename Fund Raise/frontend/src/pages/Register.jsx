import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('supporter');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const user = await register(name, email, password, role);
      if (user.role === 'creator') navigate('/my-campaigns');
      else navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h2>Register</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />

        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <label>I want to join as</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="supporter">Supporter</option>
          <option value="creator">Creator</option>
        </select>

        <button type="submit">Register</button>
      </form>

      <p className="small">Already have an account? <Link to="/login">Login</Link></p>
    </div>
  );
}