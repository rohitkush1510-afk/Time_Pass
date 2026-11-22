const express = require('express');
const mongoose = require('mongoose');
const Pledge = require('../models/Pledge');
const Campaign = require('../models/Campaign');
const { auth } = require('../middleware/auth');
const { getCampaignStats } = require('../utils/stats');

const router = express.Router();


router.post('/', auth, async (req, res) => {
  try {
    const { campaignId, amount, cardNumber, message } = req.body;

    
    if (!campaignId || !mongoose.isValidObjectId(campaignId)) {
      return res.status(400).json({ message: 'A valid campaign is required' });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: 'Amount must be more than 0' });
    }
    if (amt < 10) return res.status(400).json({ message: 'Minimum pledge is 10' });

    
    const card = String(cardNumber || '').replace(/\s/g, '');
    if (!/^\d{16}$/.test(card)) {
      return res.status(400).json({ message: 'Card number must be 16 digits (mock payment)' });
    }

    
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    if (campaign.status !== 'approved') {
      return res.status(400).json({ message: 'This campaign is not approved, you cannot pledge' });
    }
    if (new Date(campaign.deadline) < new Date()) {
      return res.status(400).json({ message: 'This campaign deadline is over' });
    }
    if (String(campaign.creator) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot pledge to your own campaign' });
    }

    
    const pledge = await Pledge.create({
      campaign: campaign._id,
      supporter: req.user.id,
      amount: amt,
      message: message || '',
      paymentStatus: 'paid'
    });

 
    const stats = await getCampaignStats(campaign._id);

    
    const io = req.app.get('io');
    io.emit('newPledge', {
      campaignId: String(campaign._id),
      totalRaised: stats.totalRaised,
      supportersCount: stats.supportersCount
    });

    res.status(201).json({ message: 'Pledge successful', pledge, ...stats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get('/mine', auth, async (req, res) => {
  try {
    const pledges = await Pledge.find({ supporter: req.user.id })
      .populate('campaign', 'title category goal')
      .sort({ createdAt: -1 });
    res.json(pledges);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get('/campaign/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid campaign id' });
    }

    const pledges = await Pledge.find({ campaign: req.params.id })
      .populate('supporter', 'name')
      .sort({ createdAt: -1 });
    res.json(pledges);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;