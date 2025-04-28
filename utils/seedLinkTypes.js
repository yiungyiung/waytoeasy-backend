// utils/seedLinkTypes.js
const LinkType = require("../models/LinkType");

const defaultTypes = [
  {
    name: "Google Drive",
    icon: "https://img.icons8.com/color/48/google-drive.png",
  },
  { name: "GitHub", icon: "https://img.icons8.com/ios-filled/50/github.png" },
  { name: "Canva", icon: "https://img.icons8.com/color/48/canva.png" },
  { name: "Trello", icon: "https://img.icons8.com/color/48/trello.png" },
  { name: "Other", icon: "https://img.icons8.com/ios-filled/50/link.png" },
  { name: "dropbox", icon: "https://img.icons8.com/ios-filled/50/link.png" },
  {
    name: "Google_Doc",
    icon: "https://img.icons8.com/color/48/google-drive.png",
  },
];

const seedLinkTypes = async () => {
  for (const type of defaultTypes) {
    const exists = await LinkType.findOne({ name: type.name });
    if (!exists) {
      await new LinkType(type).save();
      console.log(`Seeded LinkType: ${type.name}`);
    }
  }
};

module.exports = seedLinkTypes;
