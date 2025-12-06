const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Import modules
const { initSqlite } = require('./server/database/init');
const { initClient } = require('./server/whatsapp/client');
const { initSocketHandlers } = require('./server/sockets/handlers');
const tagsRoutes = require('./server/routes/tags');
const notesRoutes = require('./server/routes/notes');
const quickRepliesRoutes = require('./server/routes/quickReplies');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Make io available to routes
app.set('io', io);

// Mount routes
app.use('/api/tags', tagsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/quick-replies', quickRepliesRoutes);

// Initialize socket handlers
initSocketHandlers(io);

// Initialize database
initSqlite().catch(err => {
  console.error('Failed to initialize sql.js DB', err);
});

// Initialize WhatsApp client
initClient(io);

// Error handlers
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server listening on port', PORT));
