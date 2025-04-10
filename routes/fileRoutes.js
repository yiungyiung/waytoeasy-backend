const express = require("express");
const File = require("../models/File");
const Project = require("../models/Project");
const router = express.Router();
const LinkType = require("../models/LinkType");
// ✅ Add a file to a project
router.post("/add", async(req, res) => {
    try {
        const { title, url, type, projectId } = req.body;
        const typeDoc = await LinkType.findOne({ name: type });
        if (!typeDoc) return res.status(400).json({ error: "Invalid link type" });
        const file = new File({ title, url, type: typeDoc._id, projectId });
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
// Update a file
router.put("/update/:fileId", async(req, res) => {
    try {
        const { title, url, type } = req.body;
        const typeDoc = await LinkType.findOne({ name: type });
        if (!typeDoc) return res.status(400).json({ error: "Invalid link type" });

        const updatedFile = await File.findByIdAndUpdate(
            req.params.fileId, { title, url, type: typeDoc._id }, { new: true }
        );
        res.json({ message: "File updated!", file: updatedFile });
    } catch (error) {
        res.status(500).json({ error: "Error updating file" });
    }
});

// Delete a file
router.delete("/delete/:fileId", async(req, res) => {
    try {
        const file = await File.findByIdAndDelete(req.params.fileId);
        if (file) {
            await Project.findByIdAndUpdate(file.projectId, {
                $pull: { files: file._id }
            });
        }
        res.json({ message: "File deleted" });
    } catch (error) {
        res.status(500).json({ error: "Error deleting file" });
    }
});

module.exports = router;