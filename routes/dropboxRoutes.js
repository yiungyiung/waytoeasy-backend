const express = require("express");
const axios = require("axios");
const User = require("../models/User");
const UserConnection = require("../models/UserConnection");
const DropboxFile = require("../models/DropboxFile");
const mongoose = require("mongoose");
const File = require("../models/File");

const router = express.Router();

// Connect Dropbox account
router.post("/connect", async (req, res) => {
  console.log("Received request to /api/v1/dropbox/connect");
  console.log("Request headers:", req.headers);
  console.log("Request body:", req.body);

  try {
    const { userId, accessToken, refreshToken, expiresIn } = req.body;
    console.log("Received request body:", {
      userId,
      accessToken: accessToken ? "present" : "missing",
      refreshToken: refreshToken ? "present" : "missing",
      expiresIn,
    });

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log("Invalid userId format:", userId);
      return res.status(400).json({ error: "Invalid userId format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    console.log("Attempting to get Dropbox user info...");
    // Get user info from Dropbox
    const userInfo = await axios.post(
      "https://api.dropboxapi.com/2/users/get_current_account",
      null,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Dropbox user info received:", userInfo.data);

    // Check if this Dropbox account is already connected to another user
    const existingConnection = await UserConnection.findOne({
      dropboxId: userInfo.data.account_id,
    });
    if (existingConnection && existingConnection.userId.toString() !== userId) {
      return res.status(400).json({
        error: "This Dropbox account is already connected to another user",
        details:
          "Please disconnect the account from the other user first or use a different Dropbox account",
      });
    }

    // Update user's Dropbox connection
    if (!user.authMethods.includes("dropbox")) {
      user.authMethods.push("dropbox");
    }
    await user.save();

    // Update or create user connection
    await UserConnection.findOneAndUpdate(
      { userId },
      {
        dropboxId: userInfo.data.account_id,
        dropboxAccessToken: accessToken,
        dropboxRefreshToken: refreshToken,
        dropboxTokenExpiry: new Date(Date.now() + expiresIn * 1000),
      },
      { upsert: true, new: true }
    );

    console.log("User and connection updated successfully");

    res.json({
      success: true,
      message: "Dropbox account connected successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error connecting Dropbox account:", error);
    console.error("Error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    res.status(500).json({
      error: "Error connecting Dropbox account",
      details: error.message,
      response: error.response?.data,
    });
  }
});

// Add Dropbox file to project
router.post("/files", async (req, res) => {
  try {
    const { userId, projectId, fileId, path, name, webUrl } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(projectId)
    ) {
      return res
        .status(400)
        .json({ error: "Invalid userId or projectId format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Create or update Dropbox file record
    const file = await DropboxFile.findOneAndUpdate(
      { fileId },
      {
        name,
        path,
        webUrl,
        ownerId: userId,
        projectId,
        lastChecked: new Date(),
        lastModified: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, file });
  } catch (error) {
    console.error("Error adding Dropbox file:", error);
    res.status(500).json({ error: "Error adding Dropbox file" });
  }
});

// Get file changes
router.get("/files/:fileId/changes", async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    const file = await DropboxFile.findOne({ fileId, ownerId: userId });
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Get unread changes
    const unreadChanges = file.changes.filter((change) => !change.isRead);

    res.json({ changes: unreadChanges });
  } catch (error) {
    console.error("Error fetching file changes:", error);
    res.status(500).json({ error: "Error fetching file changes" });
  }
});

// Mark changes as read
router.post("/files/:fileId/changes/read", async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId, changeIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    const file = await DropboxFile.findOne({ fileId, ownerId: userId });
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Mark specified changes as read
    file.changes.forEach((change) => {
      if (changeIds.includes(change._id.toString())) {
        change.isRead = true;
      }
    });

    await file.save();

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking changes as read:", error);
    res.status(500).json({ error: "Error marking changes as read" });
  }
});

// Webhook for Dropbox changes
router.post("/webhook", async (req, res) => {
  try {
    const { list_folder } = req.body;

    for (const change of list_folder.entries) {
      const { id, path_display } = change;

      // Find the file in our database
      const file = await DropboxFile.findOne({ fileId: id });
      if (!file) continue;

      // Get the user's access token
      const user = await User.findById(file.ownerId);
      if (!user) continue;

      // Check if token needs refresh
      if (new Date() >= user.dropboxTokenExpiry) {
        const tokenResponse = await axios.post(
          "https://api.dropbox.com/oauth2/token",
          {
            grant_type: "refresh_token",
            refresh_token: user.dropboxRefreshToken,
            client_id: process.env.DROPBOX_CLIENT_ID,
            client_secret: process.env.DROPBOX_CLIENT_SECRET,
          }
        );

        user.dropboxAccessToken = tokenResponse.data.access_token;
        user.dropboxRefreshToken = tokenResponse.data.refresh_token;
        user.dropboxTokenExpiry = new Date(
          Date.now() + tokenResponse.data.expires_in * 1000
        );
        await user.save();
      }

      // Get file changes from Dropbox
      const changes = await axios.post(
        "https://api.dropboxapi.com/2/files/get_metadata",
        {
          path: path_display,
          include_media_info: true,
        },
        {
          headers: {
            Authorization: `Bearer ${user.dropboxAccessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Process changes
      if (changes.data) {
        file.changes.push({
          type: "modification",
          author: changes.data.sharing_info.modified_by,
          content: `File modified at ${changes.data.server_modified}`,
          timestamp: new Date(changes.data.server_modified),
          isRead: false,
        });
      }

      file.lastModified = new Date();
      file.lastChecked = new Date();
      await file.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error processing Dropbox webhook:", error);
    res.status(500).json({ error: "Error processing webhook" });
  }
});

// Add Paper document to project
router.post("/paper", async (req, res) => {
  try {
    const { userId, projectId, paperUrl } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(projectId)
    ) {
      return res
        .status(400)
        .json({ error: "Invalid userId or projectId format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Extract Paper doc ID from URL
    const paperDocId = paperUrl.split("/").pop();

    // Get Paper document info
    const paperInfo = await axios.get(
      `https://api.dropboxapi.com/2/paper/docs/get_metadata`,
      {
        headers: {
          Authorization: `Bearer ${user.dropboxAccessToken}`,
          "Content-Type": "application/json",
        },
        data: {
          doc_id: paperDocId,
        },
      }
    );

    // Create or update Paper document record
    const file = await DropboxFile.findOneAndUpdate(
      { paperDocId },
      {
        name: paperInfo.data.title,
        path: paperUrl,
        webUrl: paperUrl,
        ownerId: userId,
        projectId,
        isPaperDoc: true,
        paperDocId,
        lastChecked: new Date(),
        lastModified: new Date(paperInfo.data.last_updated_time),
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, file });
  } catch (error) {
    console.error("Error adding Paper document:", error);
    res.status(500).json({ error: "Error adding Paper document" });
  }
});

// Get Paper document changes
router.get("/paper/:paperDocId/changes", async (req, res) => {
  try {
    const { paperDocId } = req.params;
    const { userId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    const file = await DropboxFile.findOne({ paperDocId, ownerId: userId });
    if (!file) {
      return res.status(404).json({ error: "Paper document not found" });
    }

    // Get Paper document comments
    const comments = await axios.get(
      `https://api.dropboxapi.com/2/paper/docs/comments/list`,
      {
        headers: {
          Authorization: `Bearer ${user.dropboxAccessToken}`,
          "Content-Type": "application/json",
        },
        data: {
          doc_id: paperDocId,
        },
      }
    );

    // Get Paper document suggestions
    const suggestions = await axios.get(
      `https://api.dropboxapi.com/2/paper/docs/suggestions/list`,
      {
        headers: {
          Authorization: `Bearer ${user.dropboxAccessToken}`,
          "Content-Type": "application/json",
        },
        data: {
          doc_id: paperDocId,
        },
      }
    );

    // Process new comments
    for (const comment of comments.data.comments) {
      if (!file.changes.some((c) => c.paperCommentId === comment.id)) {
        file.changes.push({
          type: "paper_comment",
          author: comment.author.display_name,
          content: comment.message,
          timestamp: new Date(comment.created_time),
          isRead: false,
          paperCommentId: comment.id,
        });
      }
    }

    // Process new suggestions
    for (const suggestion of suggestions.data.suggestions) {
      if (!file.changes.some((c) => c.paperSuggestionId === suggestion.id)) {
        file.changes.push({
          type: "paper_suggestion",
          author: suggestion.author.display_name,
          content: suggestion.message,
          timestamp: new Date(suggestion.created_time),
          isRead: false,
          paperSuggestionId: suggestion.id,
        });
      }
    }

    await file.save();

    // Get unread changes
    const unreadChanges = file.changes.filter((change) => !change.isRead);

    res.json({ changes: unreadChanges });
  } catch (error) {
    console.error("Error fetching Paper document changes:", error);
    res.status(500).json({ error: "Error fetching Paper document changes" });
  }
});

// Webhook for Paper document changes
router.post("/paper/webhook", async (req, res) => {
  try {
    const { list_folder } = req.body;

    for (const change of list_folder.entries) {
      if (!change.path_display.endsWith(".paper")) continue;

      const paperDocId = change.id;

      // Find the file in our database
      const file = await DropboxFile.findOne({ paperDocId });
      if (!file) continue;

      // Get the user's access token
      const user = await User.findById(file.ownerId);
      if (!user) continue;

      // Check if token needs refresh
      if (new Date() >= user.dropboxTokenExpiry) {
        const tokenResponse = await axios.post(
          "https://api.dropbox.com/oauth2/token",
          {
            grant_type: "refresh_token",
            refresh_token: user.dropboxRefreshToken,
            client_id: process.env.DROPBOX_CLIENT_ID,
            client_secret: process.env.DROPBOX_CLIENT_SECRET,
          }
        );

        user.dropboxAccessToken = tokenResponse.data.access_token;
        user.dropboxRefreshToken = tokenResponse.data.refresh_token;
        user.dropboxTokenExpiry = new Date(
          Date.now() + tokenResponse.data.expires_in * 1000
        );
        await user.save();
      }

      // Get Paper document changes
      const [comments, suggestions] = await Promise.all([
        axios.get(`https://api.dropboxapi.com/2/paper/docs/comments/list`, {
          headers: {
            Authorization: `Bearer ${user.dropboxAccessToken}`,
            "Content-Type": "application/json",
          },
          data: {
            doc_id: paperDocId,
          },
        }),
        axios.get(`https://api.dropboxapi.com/2/paper/docs/suggestions/list`, {
          headers: {
            Authorization: `Bearer ${user.dropboxAccessToken}`,
            "Content-Type": "application/json",
          },
          data: {
            doc_id: paperDocId,
          },
        }),
      ]);

      // Process new comments
      for (const comment of comments.data.comments) {
        if (!file.changes.some((c) => c.paperCommentId === comment.id)) {
          file.changes.push({
            type: "paper_comment",
            author: comment.author.display_name,
            content: comment.message,
            timestamp: new Date(comment.created_time),
            isRead: false,
            paperCommentId: comment.id,
          });
        }
      }

      // Process new suggestions
      for (const suggestion of suggestions.data.suggestions) {
        if (!file.changes.some((c) => c.paperSuggestionId === suggestion.id)) {
          file.changes.push({
            type: "paper_suggestion",
            author: suggestion.author.display_name,
            content: suggestion.message,
            timestamp: new Date(suggestion.created_time),
            isRead: false,
            paperSuggestionId: suggestion.id,
          });
        }
      }

      file.lastModified = new Date();
      file.lastChecked = new Date();
      await file.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error processing Paper webhook:", error);
    res.status(500).json({ error: "Error processing webhook" });
  }
});

// Get Dropbox file details
router.get("/files/details", async (req, res) => {
  try {
    const { fileId } = req.query;
    console.log("Received request for file details with fileId:", fileId);

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      console.log("Invalid fileId format:", fileId);
      return res.status(400).json({ error: "Invalid fileId format" });
    }

    // First find the File record
    const File = require("../models/File");
    console.log("Looking for File record with _id:", fileId);
    const fileRecord = await File.findById(fileId);
    
    if (!fileRecord) {
      console.log("No File record found for fileId:", fileId);
      return res.status(404).json({ error: "File not found" });
    }

    console.log("Found File record:", {
      _id: fileRecord._id,
      title: fileRecord.title,
      url: fileRecord.url,
      projectId: fileRecord.projectId
    });

    // Extract the Dropbox file ID from the URL
    const dropboxFileId = fileRecord.url.split('/').pop().split('?')[0];
    console.log("Extracted Dropbox file ID:", dropboxFileId);

    // Then find the corresponding DropboxFile using the fileId
    console.log("Looking for DropboxFile with:", {
      projectId: fileRecord.projectId,
      fileId: dropboxFileId
    });
    
    const dropboxFile = await DropboxFile.findOne({ 
      projectId: fileRecord.projectId,
      fileId: dropboxFileId
    });

    console.log("Found Dropbox file:", dropboxFile ? {
      _id: dropboxFile._id,
      fileId: dropboxFile.fileId,
      name: dropboxFile.name,
      webUrl: dropboxFile.webUrl,
      ownerId: dropboxFile.ownerId
    } : null);

    if (!dropboxFile) {
      console.log("No Dropbox file found for:", { 
        projectId: fileRecord.projectId, 
        fileId: dropboxFileId 
      });
      return res.status(404).json({ error: "Dropbox file not found" });
    }

    res.json({ 
      success: true, 
      file: dropboxFile,
      projectId: fileRecord.projectId,
      ownerId: dropboxFile.ownerId
    });
  } catch (error) {
    console.error("Error fetching Dropbox file details:", error);
    res.status(500).json({ error: "Error fetching Dropbox file details" });
  }
});

module.exports = router;
