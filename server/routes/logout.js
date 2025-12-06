const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// POST /api/logout - Delete WhatsApp session data and logout
router.post('/', async (req, res) => {
  try {
    console.log('Logout requested - removing WhatsApp session data');
    
    const authPath = path.join(__dirname, '..', '..', '.wwebjs_auth');
    const cachePath = path.join(__dirname, '..', '..', '.wwebjs_cache');
    
    // Delete .wwebjs_auth folder
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log('Deleted .wwebjs_auth folder');
    }
    
    // Delete .wwebjs_cache folder
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true });
      console.log('Deleted .wwebjs_cache folder');
    }
    
    res.json({ 
      success: true, 
      message: 'Logged out successfully. Session data cleared.' 
    });
    
    // Exit the process so it can be restarted
    setTimeout(() => {
      console.log('Exiting process for logout...');
      process.exit(0);
    }, 1000);
    
  } catch (err) {
    console.error('Error during logout:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

module.exports = router;
