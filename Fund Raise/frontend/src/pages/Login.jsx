import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const user = await login(email, password);
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'creator') navigate('/my-campaigns');
      else navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h2>Login</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <button type="submit">Login</button>
      </form>

      <p className="small">No account? <Link to="/register">Register</Link></p>
      <p className="small">Admin demo: admin@fundraise.com / admin123</p>
    </div>
  );
}