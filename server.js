const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Routes
const authRoutes = require("./routes/authRoutes");
const fileRoutes = require("./routes/fileRoutes");
const linkType = require("./routes/linkTypeRoutes");
const projectRoutes = require("./routes/projectRoutes");
const userRoutes = require("./routes/userRoutes");
const dropboxRoutes = require("./routes/dropboxRoutes");
const githubrepo = require("./routes/github_repo");
const googledoc = require("./routes/google_docs");

// Seed link types
const seedLinkTypes = require("./utils/seedLinkTypes");
seedLinkTypes();

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/files", fileRoutes);
app.use("/api/v1/link-types", linkType);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/dropbox", dropboxRoutes);
app.use("/api/v1/repo", githubrepo);
app.use("/api/v1/googledoc", googledoc);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: "error",
    message: "Something went wrong!",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
