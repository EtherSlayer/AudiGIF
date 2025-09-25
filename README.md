# AudiGIF - (AGIF) is a revolutionary new media format that brings sound to GIFs! Imagine animated images with frame-specific audio triggers—perfect for memes, games, educational content, or creative storytelling. Upload images and audio clips, assign sounds to specific frames, preview the hybrid animation, and download your .agif file. No video conversion needed—just lightweight, browser-based magic.
<img width="1338" height="363" alt="image" src="https://github.com/user-attachments/assets/020e73c4-5473-4a95-b978-12d7a9d66d7e" />

Created by Luke Hofmann/Neru in 2025. Open-source under MIT—fork, remix, and build on it! FeaturesHybrid Format: Embed PNG frames and WAV audio clips in a single .agif file using a custom length-prefixed binary structure (magic: "AGIF", header JSON, base64 frames, audio buffers, triggers).
Frame-Triggered Audio: Select which audio clip plays on each frame for precise, event-driven sound (e.g., a "hard drop" sound in a Tetris animation).
Customizable: Set frame rates (1-60 FPS), titles, and loop behavior.
Browser-Native: Processes everything client-side with Canvas (images) and Web Audio API (sound)—no installs or servers.
Preview & Export: Real-time preview with synced audio; download ready-to-play .agif files.
Player Included: Simple .agif viewer with looping playback and triggers.

 DemoTry it live: AudiGIF Creator - (https://f43574-5000.csb.app/)
Play .agif files: AudiGIF Player
<img width="1350" height="213" alt="image" src="https://github.com/user-attachments/assets/46bff8dc-0fbd-42b2-82c2-9eb86fb2ad36" />


How to UseUpload Assets:Images: Select PNG/JPEG files (multiple)—they auto-resize to 300x300 for consistency.
Audio: MP3/WAV clips (multiple)—converted to WAV internally.

Assign Triggers:A timeline appears with thumbnails.
Use dropdowns to link audio clips to frames (or "No Audio").

Preview & Process:Click "Preview AGIF" to see the animation with triggered sounds.
Tweak frame rate/title, then "Process AGIF" to download your .agif file.

Play It:Open in the Player: Upload .agif and watch it loop with audio cues.

Pro Tip: Keep audio short (<10s) for snappy files. Supports looping by default.

Tech StackFrontend: Vanilla HTML/CSS/JavaScript (lightweight, no frameworks).
Image Handling: HTML Canvas API for resizing/encoding.
Audio Processing: Web Audio API + audiobuffer-to-wav for WAV export.
Format: Custom binary (4-byte lengths for sections: header, frames, audio, triggers).

Fork the repo, make changes, and submit a pull request! Ideas for enhancements:Multi-channel audio support.
Compression for smaller files.
Export to WebP for better perf.

Report issues or share your .agif creations in the Discussions tab. AudiGIF project is licensed under the MIT License - Credit goes to Luke Hofmann/Neru as the creator in any implementations Acknowledgments, this was inspired by classic GIFs and the need for sound without video bloat. Thanks to the open-source community for Web Audio and Canvas APIs! Star this repo if you love AudiGIF! Follow on X @NeruETH
 for updates. Questions? Open an issue.
