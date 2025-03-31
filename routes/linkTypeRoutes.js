const express = require('express');
const LinkType = require('../models/LinkType');

const router = express.Router();

router.post('/add', async(req, res) => {
    const { name, icon } = req.body;

    const existingType = await LinkType.findOne({ name });
    if (existingType) return res.status(400).json({ message: "Link type already exists" });

    const linkType = new LinkType({ name, icon });
    await linkType.save();

    res.json({ message: "New link type added!", linkType });
});

router.get('/all', async(req, res) => {
    const types = await LinkType.find();
    res.json(types);
});


module.exports = router;