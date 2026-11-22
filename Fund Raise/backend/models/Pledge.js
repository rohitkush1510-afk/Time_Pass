const mongoose = require('mongoose');

const pledgeSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  supporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  message: { type: String, default: '' },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'paid'        
  }
}, { timestamps: true });

module.exports = mongoose.model('Pledge', pledgeSchema);