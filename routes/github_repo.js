const express = require("express");
const axios = require("axios");
const UserConnection = require("../models/UserConnection");

const router = express.Router(); // Create a router

const getUserGithubAccessToken = async(userId) => {
    try {
        const userConnection = await UserConnection.findOne({ userId }).select(
            "githubAccessToken"
        );
        if (!userConnection || !userConnection.githubAccessToken) {
            throw new Error("GitHub access token not found for user");
        }
        return userConnection.githubAccessToken;
    } catch (err) {
        console.error("Error fetching GitHub access token:", err);
        throw err;
    }
};

// Your function
async function getRepoCommits(userAccessToken, owner, repo) {
    try {
        const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/commits`, {
                headers: {
                    Authorization: `Bearer ${userAccessToken}`,
                    Accept: "application/vnd.github+json",
                },
            }
        );
        return response.data; // return the data instead of console.log
    } catch (error) {
        console.error("Error fetching commits:", error.message);
        throw error;
    }
}

async function getRepoPullRequests(githubAccessToken, owner, repo) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=all`;

    const response = await axios.get(url, {
        headers: {
            Authorization: `Bearer ${githubAccessToken}`,
            "User-Agent": "your-app-name", // GitHub needs a User-Agent header
        },
    });

    return response.data; // Pull Requests list
}

// Now expose it through a route
router.get("/:userid/:owner/:repo/commits", async(req, res) => {
    const { userid, owner, repo } = req.params;

    try {
        const githubAccessToken = await getUserGithubAccessToken(userid);

        const commits = await getRepoCommits(githubAccessToken, owner, repo);

        res.json(commits); // Send commits in response
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch commits" });
    }
});

router.get("/:userid/:owner/:repo/pulls", async(req, res) => {
    const { userid, owner, repo } = req.params;

    try {
        const githubAccessToken = await getUserGithubAccessToken(userid);

        const commits = await getRepoPullRequests(githubAccessToken, owner, repo);

        res.json(commits); // Send commits in response
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch commits" });
    }
});

module.exports = router;