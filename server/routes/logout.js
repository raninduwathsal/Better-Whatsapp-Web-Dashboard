const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getClient } = require('../whatsapp/client');  // Import client

// Helper to safely delete deleted session folders
function forceDelete(folderPath) {
  try {
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
      console.log("Deleted:", folderPath);
    }
  } catch (err) {
    console.log("Delete warning (ignored):", err.message);
  }
}

router.post('/', async (req, res) => {
  try {
    console.log("Logout requested - destroying WhatsApp session");

    const client = getClient();   // get the WhatsApp client instance
    await client.destroy();       // VERY IMPORTANT — release puppeteer files
    console.log("WhatsApp client destroyed");

    const authPath = path.join(__dirname, '..', '..', '.wwebjs_auth');
    const cachePath = path.join(__dirname, '..', '..', '.wwebjs_cache');

    // Now safe to delete session folders fully
    forceDelete(authPath);
    forceDelete(cachePath);

    res.json({
      success: true,
      message: "Logged out successfully. Session removed."
    });

  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
