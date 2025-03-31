const express = require('express');
const Project = require('../models/Project');
const User = require('../models/User');

const router = express.Router();

router.post('/create', async(req, res) => {
    const { name, ownerId } = req.body;

    const project = new Project({ name, ownerId, files: [] });
    await project.save();

    await User.findByIdAndUpdate(ownerId, { $push: { projects: project._id } });

    res.json({ message: "Project Created!", project });
});

router.get('/:userId', async(req, res) => {
    try {
        const projects = await Project.find({ ownerId: req.params.userId }).populate('files');
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: "Error fetching projects" });
    }
});


module.exports = router;