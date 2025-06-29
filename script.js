// Main game coordinator (Previously very large)
// This file has been refactored. Its contents have been moved to:
// - game-controller.js (main logic)
// - ui-manager.js (screen and UI updates)
// - multiplayer-manager.js (websim socket and presence)
// - image-manager.js (themed image generation)
//
// The new entry point for the application is game-controller.js