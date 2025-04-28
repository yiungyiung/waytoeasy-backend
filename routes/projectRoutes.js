const express = require('express');
const Project = require('../models/Project');
const User = require('../models/User');
const Todo = require('../models/Todo')
const mongoose = require('mongoose');

const router = express.Router();

router.post('/create', async(req, res) => {
    try {
        const { name, ownerId } = req.body;

        if (!name || !ownerId) {
            return res.status(400).json({ error: "Name and ownerId are required" });
        }

        if (!mongoose.Types.ObjectId.isValid(ownerId)) {
            return res.status(400).json({ error: "Invalid ownerId format" });
        }

        // 1. Create empty Todo first
        const todo = new Todo({ items: [] });
        await todo.save();

        // 2. Create the Project and link the todo
        const project = new Project({ name, ownerId, files: [], todos: todo._id });
        await project.save();

        // 3. Update the User with this Project ID
        await User.findByIdAndUpdate(ownerId, { $push: { projects: project._id } });

        res.json({ message: "Project and Todo Created!", project });
    } catch (error) {
        console.error("Error creating project:", error);
        res.status(500).json({ error: "Error creating project" });
    }
});

router.get('/todo/:projectId', async(req, res) => {
    try {
        const { projectId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ error: "Invalid projectId format" });
        }

        // Find project first
        const project = await Project.findById(projectId);

        if (!project || !project.todos) {
            return res.status(404).json({ error: "Todo not found for this project" });
        }

        // Now fetch the Todo
        const todo = await Todo.findById(project.todos);

        res.json(todo);
    } catch (error) {
        console.error("Error fetching todo:", error);
        res.status(500).json({ error: "Error fetching todo" });
    }
});


router.get('/:userId', async(req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid userId format" });
        }

        const projects = await Project.find({ ownerId: userId }).populate('files');
        res.json(projects);
    } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).json({ error: "Error fetching projects" });
    }
});

router.delete('/:projectId', async(req, res) => {
    try {
        const { projectId } = req.params;
        const { userId } = req.body; // Get userId from request body

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ error: "Invalid projectId format" });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid userId format" });
        }

        // Find the project and verify ownership
        const project = await Project.findOne({ _id: projectId, ownerId: userId });

        if (!project) {
            return res.status(404).json({ error: "Project not found or unauthorized" });
        }

        // Delete the project
        await Project.findByIdAndDelete(projectId);

        // Remove project reference from user's projects array
        await User.findByIdAndUpdate(userId, { $pull: { projects: projectId } });

        res.json({ message: "Project deleted successfully" });
    } catch (error) {
        console.error("Error deleting project:", error);
        res.status(500).json({ error: "Error deleting project" });
    }
});

module.exports = router;