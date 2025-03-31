const express = require("express");
const File = require("../models/File");
const Project = require("../models/Project");
const router = express.Router();

// ✅ Add a file to a project
router.post("/add", async(req, res) => {
    try {
        const { title, url, type, projectId } = req.body;
        const file = new File({ title, url, type, projectId });
        await file.save();

        await Project.findByIdAndUpdate(projectId, { $push: { files: file._id } });

        res.json({ message: "File added!", file });
    } catch (error) {
        res.status(500).json({ error: "Error adding file" });
    }
});

router.get("/:projectId", async(req, res) => {
    try {
        const files = await File.find({ projectId: req.params.projectId });
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: "Error fetching files" });
    }
});


module.exports = router;