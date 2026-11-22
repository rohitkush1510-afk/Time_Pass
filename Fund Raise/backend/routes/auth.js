const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();


router.post('/register', async (req, res) => {
  try {
    const { name, password, role } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill all the fields' });
    }

    const already = await User.findOne({ email });
    if (already) return res.status(400).json({ message: 'Email is already registered' });

    const hashedPassword = await bcrypt.hash(String(password), 10);

    // nobody can sign up as admin from the form
    const safeRole = role === 'creator' ? 'creator' : 'supporter';

    await User.create({ name: String(name).trim(), email, password: hashedPassword, role: safeRole });

    res.status(201).json({ message: 'Registered successfully, please login' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Wrong email or password' });

    const correct = await bcrypt.compare(String(password), user.password);
    if (!correct) return res.status(400).json({ message: 'Wrong email or password' });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get('/me', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.user.id)) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User no longer exists' });

   
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;