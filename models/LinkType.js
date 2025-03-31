const mongoose = require('mongoose');

const LinkTypeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // e.g., "Google Drive", "GitHub"
    icon: { type: String, required: true } // URL or filename for the icon
}, { timestamps: true });

module.exports = mongoose.model('LinkType', LinkTypeSchema);