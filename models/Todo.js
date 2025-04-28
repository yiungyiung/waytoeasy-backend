// models/Todo.js
const mongoose = require('mongoose');

const TodoSchema = new mongoose.Schema({
    items: [{
        title: String,
        completed: { type: Boolean, default: false }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Todo', TodoSchema);