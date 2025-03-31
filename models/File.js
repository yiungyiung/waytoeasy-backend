const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
    title: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: mongoose.Schema.Types.ObjectId, ref: 'LinkType', required: true }, // Dynamic Type
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true }
}, { timestamps: true });

module.exports = mongoose.model('File', FileSchema);