const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
connectDB();

const app = express();
const authRoutes = require("./routes/authRoutes");
const fileRoutes = require("./routes/fileRoutes");
const linkType = require("./routes/linkTypeRoutes")
const seedLinkTypes = require("./utils/seedLinkTypes");
seedLinkTypes();

app.use(cors());
app.use(express.json());

app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/files", fileRoutes);
app.use('/api/projects', require('./routes/projectRoutes'));
app.use("/auth", authRoutes);
app.use('/api/linktypes', linkType)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));