const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  goal: { type: Number, required: true },           
  deadline: { type: Date, required: true },         
  category: { type: String, required: true },
  imageUrl: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'                             
  },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Campaign', campaignSchema);