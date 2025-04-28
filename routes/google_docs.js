const express = require("express");
const { google } = require("googleapis");
const router = express.Router();

// Utility to extract doc ID from URL
function extractDocIdFromUrl(url) {
  const pattern = /\/d\/([a-zA-Z0-9-_]+)/;
  const match = url.match(pattern);
  return match ? match[1] : null;
}

// Utility to convert UTC time to local (Asia/Kolkata)
function convertUtcToLocal(utcTimestamp) {
  try {
    const utcDate = new Date(utcTimestamp);
    const options = { timeZone: "Asia/Kolkata", hour12: false };
    return utcDate.toLocaleString("en-GB", options);
  } catch (err) {
    console.error("Error converting time:", err.message);
    return utcTimestamp;
  }
}

// Main API to get document changes
router.get("/:userId/:docUrl/doc-changes", async (req, res) => {
  const { userId, docUrl } = req.params;
  const token = req.headers.authorization?.split(" ")[1]; // Bearer token

  if (!docUrl || !token) {
    return res.status(400).json({ error: "Missing docUrl or token" });
  }

  try {
    // Setup auth client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });

    const docs = google.docs({ version: "v1", auth: oauth2Client });
    const driveActivity = google.driveactivity({
      version: "v2",
      auth: oauth2Client,
    });

    const docId = extractDocIdFromUrl(docUrl);
    if (!docId) {
      return res.status(400).json({ error: "Invalid Google Doc URL" });
    }

    // Fetch document
    const document = await docs.documents.get({
      documentId: docId,
      suggestionsViewMode: "SUGGESTIONS_INLINE",
    });

    const currentRevisionId = document.data.revisionId || "Unknown";
    const content = document.data.body?.content || [];

    const changes = [];

    // Recursive function to process the document body
    function processElement(element, path = "") {
      if (element.paragraph?.elements) {
        element.paragraph.elements.forEach((elem) => {
          if (elem.textRun?.suggestedInsertion) {
            changes.push({
              type: "suggestion",
              text: elem.textRun.content || "",
              suggested_by: "Unknown", // You can fetch author info separately if needed
              revision_id: currentRevisionId,
            });
          }
          if (elem.textRun?.suggestedDeletion) {
            changes.push({
              type: "deletion",
              text: elem.textRun.content || "",
              suggested_by: "Unknown",
              revision_id: currentRevisionId,
            });
          }
        });
      }

      for (const key in element) {
        const value = element[key];
        if (Array.isArray(value)) {
          value.forEach((item) => processElement(item, `${path}.${key}`));
        } else if (typeof value === "object") {
          processElement(value, `${path}.${key}`);
        }
      }
    }

    // Process the document
    content.forEach((element) => processElement(element));

    // Fetch document activity (Drive Activity API)
    try {
      const activityResponse = await driveActivity.activity.query({
        requestBody: {
          ancestorName: `items/${docId}`,
          pageSize: 10,
        },
      });

      const activities = activityResponse.data.activities || [];

      if (activities.length > 0) {
        const firstActivity = activities[0];

        let actionType =
          Object.keys(firstActivity.primaryActionDetail || {})[0] || "Unknown";

        // Map action types
        const actionMap = {
          edit: "Document Edited",
          create: "Document Created",
          delete: "Document Deleted",
          move: "Document Moved",
          rename: "Document Renamed",
          restore: "Document Restored",
          permissionChange: "Permissions Changed",
          comment: "Comment Added",
          suggestion: "Suggestion Added",
        };

        const actor = firstActivity.actors?.[0];
        let actorName = "Unknown";

        if (actor?.user?.knownUser) {
          actorName =
            actor.user.knownUser.personName ||
            actor.user.knownUser.emailAddress ||
            "Unknown";
        } else if (actor?.user?.unknownUser) {
          actorName = "Anonymous User";
        } else if (actor?.system) {
          actorName = "System";
        }

        const target = firstActivity.targets?.[0];
        const targetName = target?.driveItem?.title || "Unknown";

        const timestamp = firstActivity.timestamp || "";

        changes.push({
          type: "activity",
          action: actionMap[actionType] || actionType,
          actor: actorName,
          target: targetName,
          utc_time: timestamp,
          local_time: convertUtcToLocal(timestamp),
          revision_id: currentRevisionId,
        });
      }
    } catch (err) {
      console.error("Drive Activity API error:", err.message);
    }

    return res.json({
      document: document.data,
      changes,
      current_revision_id: currentRevisionId,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: "Failed to fetch document changes" });
  }
});

module.exports = router;
