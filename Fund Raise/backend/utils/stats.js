const mongoose = require('mongoose');
const Pledge = require('../models/Pledge');


async function getCampaignStats(campaignId) {
  if (!mongoose.isValidObjectId(campaignId)) {
    return { totalRaised: 0, supportersCount: 0 };
  }

  const rows = await Pledge.aggregate([
    { $match: { campaign: new mongoose.Types.ObjectId(String(campaignId)), paymentStatus: 'paid' } },
    {
      $group: {
        _id: null,
        totalRaised: { $sum: '$amount' },
        supporters: { $addToSet: '$supporter' }   
      }
    }
  ]);

  if (rows.length === 0) return { totalRaised: 0, supportersCount: 0 };
  return { totalRaised: rows[0].totalRaised, supportersCount: rows[0].supporters.length };
}

module.exports = { getCampaignStats };