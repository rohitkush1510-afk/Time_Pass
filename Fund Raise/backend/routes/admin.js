const express = require('express');
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const Pledge = require('../models/Pledge');
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');
const { getCampaignStats } = require('../utils/stats');

const router = express.Router();


router.get('/campaigns', auth, adminOnly, async (req, res) => {
  try {
    const campaigns = await Campaign.find()
      .populate('creator', 'name email')
      .sort({ createdAt: -1 });

    const list = [];
    for (const c of campaigns) {
      const stats = await getCampaignStats(c._id);
      list.push({ ...c.toObject(), ...stats });
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.put('/campaigns/:id/approve', auth, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid campaign id' });
    }

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    campaign.status = 'approved';
    await campaign.save();
    res.json({ message: 'Campaign approved', campaign });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.put('/campaigns/:id/reject', auth, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid campaign id' });
    }

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    campaign.status = 'rejected';
    await campaign.save();
    res.json({ message: 'Campaign rejected', campaign });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const totals = await Pledge.aggregate([
      { $match: { paymentStatus: 'paid' } },
      {
        $group: {
          _id: null,
          totalRaised: { $sum: '$amount' },
          supporters: { $addToSet: '$supporter' },
          pledgesCount: { $sum: 1 }
        }
      }
    ]);

    const totalRaised = totals.length ? totals[0].totalRaised : 0;
    const supportersCount = totals.length ? totals[0].supporters.length : 0;
    const pledgesCount = totals.length ? totals[0].pledgesCount : 0;

    const campaignsCount = await Campaign.countDocuments();
    const pendingCount = await Campaign.countDocuments({ status: 'pending' });
    const usersCount = await User.countDocuments();

    res.json({ totalRaised, supportersCount, pledgesCount, campaignsCount, pendingCount, usersCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;