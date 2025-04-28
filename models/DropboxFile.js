const mongoose = require('mongoose');

const DropboxFileSchema = new mongoose.Schema({
    fileId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    webUrl: {
        type: String,
        required: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastChecked: {
        type: Date,
        default: Date.now
    },
    lastModified: {
        type: Date,
        default: Date.now
    },
    isPaperDoc: {
        type: Boolean,
        default: false
    },
    paperDocId: {
        type: String,
        required: false
    },
    changes: [{
        type: {
            type: String,
            enum: ['comment', 'suggestion', 'modification', 'paper_comment', 'paper_suggestion'],
            required: true
        },
        author: {
            type: String,
            required: true
        },
        content: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        isRead: {
            type: Boolean,
            default: false
        },
        paperCommentId: {
            type: String,
            required: false
        },
        paperSuggestionId: {
            type: String,
            required: false
        }
    }],
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    }
}, {
    timestamps: true
});

// Index for efficient querying
DropboxFileSchema.index({ ownerId: 1, lastChecked: 1 });
DropboxFileSchema.index({ projectId: 1, lastModified: 1 });
DropboxFileSchema.index({ paperDocId: 1 });

module.exports = mongoose.model('DropboxFile', DropboxFileSchema); 