const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
    todos: { type: mongoose.Schema.Types.ObjectId, ref: 'Todo' }

}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);