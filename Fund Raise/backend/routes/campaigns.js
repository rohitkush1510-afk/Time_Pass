const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Campaign = require('../models/Campaign');
const { auth } = require('../middleware/auth');
const { getCampaignStats } = require('../utils/stats');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB

const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};


function saveUploadedImage(imageData) {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(imageData || ''));
  if (!match) throw new Error('Invalid image data');

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw new Error('The image is empty');
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Image is too large (max 3 MB)');

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = crypto.randomUUID() + '.' + IMAGE_EXTENSIONS[match[1]];
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

  return '/api/uploads/' + filename;
}

function deleteUploadedImage(imageUrl) {
  const value = String(imageUrl || '');
  if (!value.startsWith('/api/uploads/')) return;

  const filePath = path.join(UPLOADS_DIR, path.basename(value));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}


async function addStatsToCampaigns(campaigns) {
  const finalList = [];
  for (const c of campaigns) {
    const stats = await getCampaignStats(c._id);
    finalList.push({ ...c.toObject(), ...stats });
  }
  return finalList;
}


router.get('/category-stats', async (req, res) => {
  try {
    const data = await Campaign.aggregate([
     
      { $lookup: { from: 'pledges', localField: '_id', foreignField: 'campaign', as: 'pledges' } },
      
      { $unwind: { path: '$pledges', preserveNullAndEmptyArrays: true } },
      
      {
        $group: {
          _id: '$category',
          totalRaised: { $sum: { $ifNull: ['$pledges.amount', 0] } }
        }
      },
      { $project: { _id: 0, category: '$_id', totalRaised: 1 } },
      { $sort: { totalRaised: -1 } }
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get('/', async (req, res) => {
  try {
    const filter = { status: 'approved' };

    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) filter.title = { $regex: req.query.search, $options: 'i' };

    const campaigns = await Campaign.find(filter)
      .populate('creator', 'name')
      .sort({ createdAt: -1 });

    res.json(await addStatsToCampaigns(campaigns));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get('/mine', auth, async (req, res) => {
  try {
    const campaigns = await Campaign.find({ creator: req.user.id }).sort({ createdAt: -1 });
    res.json(await addStatsToCampaigns(campaigns));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid campaign id' });
    }

    const campaign = await Campaign.findById(req.params.id).populate('creator', 'name');
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const stats = await getCampaignStats(campaign._id);
    res.json({ ...campaign.toObject(), ...stats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'creator') {
      return res.status(403).json({ message: 'Only creators can create campaigns' });
    }

    const { title, description, goal, deadline, category, imageUrl, imageData } = req.body;

    if (!title || !description || goal === undefined || goal === '' || !deadline || !category) {
      return res.status(400).json({ message: 'Please fill all the fields' });
    }

    const goalNumber = Number(goal);
    if (!Number.isFinite(goalNumber) || goalNumber <= 0) {
      return res.status(400).json({ message: 'Goal must be a valid number more than 0' });
    }

    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
      return res.status(400).json({ message: 'Deadline must be a valid date in the future' });
    }

    let finalImageUrl = String(imageUrl || '');
    if (imageData) {
      try {
        finalImageUrl = saveUploadedImage(imageData);
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    const campaign = await Campaign.create({
      title,
      description,
      goal: goalNumber,
      deadline: deadlineDate,
      category,
      imageUrl: finalImageUrl,
      creator: req.user.id          
    });

    res.status(201).json({ message: 'Campaign created, waiting for admin approval', campaign });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.put('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid campaign id' });
    }

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    if (String(campaign.creator) !== String(req.user.id)) {
      return res.status(403).json({ message: 'This is not your campaign' });
    }
    if (campaign.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending campaigns can be edited' });
    }

    const { title, description, goal, deadline, category, imageUrl, imageData } = req.body;

    if (goal !== undefined && goal !== '') {
      const goalNumber = Number(goal);
      if (!Number.isFinite(goalNumber) || goalNumber <= 0) {
        return res.status(400).json({ message: 'Goal must be a valid number more than 0' });
      }
      campaign.goal = goalNumber;
    }
    if (deadline !== undefined && deadline !== '') {
      const deadlineDate = new Date(deadline);
      if (Number.isNaN(deadlineDate.getTime())) {
        return res.status(400).json({ message: 'Deadline must be a valid date' });
      }
      campaign.deadline = deadlineDate;
    }

    if (title) campaign.title = title;
    if (description) campaign.description = description;
    if (category) campaign.category = category;

    if (imageData) {
      try {
        const newImageUrl = saveUploadedImage(imageData);
        deleteUploadedImage(campaign.imageUrl);
        campaign.imageUrl = newImageUrl;
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    } else if (imageUrl !== undefined && imageUrl !== campaign.imageUrl) {
      deleteUploadedImage(campaign.imageUrl);
      campaign.imageUrl = imageUrl;
    }

    await campaign.save();
    res.json({ message: 'Campaign updated', campaign });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.delete('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid campaign id' });
    }

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    if (String(campaign.creator) !== String(req.user.id)) {
      return res.status(403).json({ message: 'This is not your campaign' });
    }
    if (campaign.status !== 'pending') {
      return res.status(400).json({ message: 'You can only delete a pending campaign' });
    }

    await campaign.deleteOne();
    deleteUploadedImage(campaign.imageUrl);
    res.json({ message: 'Campaign deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;