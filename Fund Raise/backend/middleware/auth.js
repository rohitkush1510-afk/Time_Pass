const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'No token, please login' });

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;  
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}


function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  next();
}

module.exports = { auth, adminOnly };