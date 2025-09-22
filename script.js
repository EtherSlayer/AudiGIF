// AGIFDecoder and AGIFPlayer classes
class AGIFDecoder {
  static async decode(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const textDecoder = new TextDecoder();
    let offset = 0;

    // Magic (4 bytes)
    const magic = textDecoder.decode(new Uint8Array(arrayBuffer, offset, 4));
    if (magic !== "AGIF")
      throw new Error("Invalid AGIF file: Missing magic header");
    offset += 4;

    // Header length + JSON
    const headerLen = view.getUint32(offset, true);
    offset += 4;
    const headerStr = textDecoder.decode(
      new Uint8Array(arrayBuffer, offset, headerLen)
    );
    const header = JSON.parse(headerStr);
    offset += headerLen;

    // Validate header
    if (header.version !== "1.0" || header.audioFormat !== "wav") {
      throw new Error(
        `Unsupported AGIF version or audio format: ${header.version}/${header.audioFormat}`
      );
    }

    // Frames: numFrames * (len + base64 PNG)
    const frameData = [];
    for (let i = 0; i < header.numFrames; i++) {
      const frameLen = view.getUint32(offset, true);
      offset += 4;
      const frameBase64 = textDecoder.decode(
        new Uint8Array(arrayBuffer, offset, frameLen)
      );
      frameData.push(`data:image/png;base64,${frameBase64}`);
      offset += frameLen;
    }

    // Audio: numAudioClips * (len + WAV bytes)
    const audioData = [];
    for (let i = 0; i < header.numAudioClips; i++) {
      const audioLen = view.getUint32(offset, true);
      offset += 4;
      const audioBytes = new Uint8Array(arrayBuffer, offset, audioLen);
      audioData.push(audioBytes);
      offset += audioLen;
    }

    // Trigger map: len + JSON
    const triggerLen = view.getUint32(offset, true);
    offset += 4;
    const triggerStr = textDecoder.decode(
      new Uint8Array(arrayBuffer, offset, triggerLen)
    );
    const triggers = JSON.parse(triggerStr);
    offset += triggerLen;

    // EOF check
    if (offset !== arrayBuffer.byteLength) {
      throw new Error(
        `File parsing error: Extra ${
          arrayBuffer.byteLength - offset
        } bytes at end`
      );
    }

    // Load frame images
    const frames = await Promise.all(
      frameData.map((data) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = data;
        });
      })
    );

    // Decode audio buffers (with slice to isolate WAV data)
    const audioContext = new AudioContext(); // Temp for decoding
    const audioBuffers = await Promise.all(
      audioData.map(async (data) => {
        const isolatedBuffer = data.slice().buffer; // Copy to new ArrayBuffer
        return await audioContext.decodeAudioData(isolatedBuffer);
      })
    );

    return {
      header,
      frames, // Loaded Image objects
      audioBuffers, // AudioBuffer[] for each clip
      triggers: triggers.frame_triggers || [], // Array of {frame: number, audio: number}
      loop: triggers.loop !== false, // Default true
    };
  }
}

class AGIFPlayer {
  constructor(canvasId, audioContext) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.audioContext = audioContext || new AudioContext();
    this.isPlaying = false;
    this.currentFrame = 0;
    this.animationId = null;
  }

  async loadAndPlay(fileOrBuffer) {
    let buffer;
    if (fileOrBuffer instanceof File) {
      buffer = await fileOrBuffer.arrayBuffer();
    } else if (fileOrBuffer instanceof ArrayBuffer) {
      buffer = fileOrBuffer;
    } else if (fileOrBuffer instanceof Blob) {
      buffer = await fileOrBuffer.arrayBuffer();
    } else {
      throw new Error("Invalid input: Provide File, Blob, or ArrayBuffer");
    }

    try {
      // Resume audio context if suspended (user interaction required in some browsers)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      const decoded = await AGIFDecoder.decode(buffer);
      this.decoded = decoded;
      this.setupCanvas(decoded.header);
      this.play();
    } catch (error) {
      console.error("AGIF Load Error:", error);
      throw error; // Propagate for preview status
    }
  }

  setupCanvas(header) {
    const size = Math.max(header.width, header.height, 300); // Match preview size
    this.canvas.width = size;
    this.canvas.height = size;
    this.frameDuration = 1000 / header.frameRate; // ms per frame
  }

  play() {
    if (this.isPlaying || !this.decoded) return;
    this.isPlaying = true;
    this.animate();
  }

  pause() {
    this.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  animate() {
    if (!this.isPlaying) return;

    const { frames, header, triggers, audioBuffers } = this.decoded;
    if (!frames.length) return;

    // Clear and draw current frame (scaled)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const scaleX = this.canvas.width / header.width;
    const scaleY = this.canvas.height / header.height;
    this.ctx.drawImage(
      frames[this.currentFrame],
      0,
      0,
      header.width * scaleX,
      header.height * scaleY
    );

    // Trigger audio for this frame
    triggers.forEach((trigger) => {
      if (trigger.frame === this.currentFrame && audioBuffers[trigger.audio]) {
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffers[trigger.audio];
        source.connect(this.audioContext.destination);
        source.start(); // Plays immediately; for sync, could offset by current time
      }
    });

    // Next frame
    this.currentFrame = (this.currentFrame + 1) % header.numFrames;

    // Schedule next frame (use setTimeout for precise frameRate timing, raf for smoothness)
    this.animationId = setTimeout(() => {
      requestAnimationFrame(() => this.animate());
    }, this.frameDuration);
  }

  // Event handler example for file input
  static initFromFileInput(inputId, canvasId) {
    const input = document.getElementById(inputId);
    const player = new AGIFPlayer(canvasId);
    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file && file.name.endsWith(".agif")) {
        player.loadAndPlay(file);
      }
    });
    return player;
  }
}

// Store uploaded images and audio
let images = [];
let audioFiles = [];
let triggers = [];
let title = "output"; // Default title
let frameRate = 10; // Default frame rate

// Handle title input
const titleInput = document.getElementById("titleInput");
if (titleInput) {
  titleInput.addEventListener("input", (e) => {
    title = e.target.value.trim() || "output";
  });
}

// Handle frame rate selection
const frameRateSelect = document.getElementById("frameRateSelect");
if (frameRateSelect) {
  frameRateSelect.addEventListener("change", (e) => {
    frameRate = parseInt(e.target.value);
  });
}

// Handle image uploads
document.getElementById("imageInput").addEventListener("change", (e) => {
  images = Array.from(e.target.files);
  updateFrameList();
});

// Handle audio uploads
document.getElementById("audioInput").addEventListener("change", (e) => {
  audioFiles = Array.from(e.target.files);
  updateFrameList();
});

// Update frame list with audio selection dropdowns
function updateFrameList() {
  const frameList = document.getElementById("frameList");
  frameList.innerHTML = "";
  images.forEach((image, index) => {
    const frameItem = document.createElement("div");
    frameItem.className = "frame-item";
    frameItem.innerHTML = `
      <img src="${URL.createObjectURL(image)}" alt="Frame ${index + 1}">
      <p>Frame ${index + 1}</p>
      <select id="audioSelect${index}">
        <option value="">No Audio</option>
        ${audioFiles
          .map((audio, i) => `<option value="${i}">${audio.name}</option>`)
          .join("")}
      </select>
    `;
    frameList.appendChild(frameItem);
  });
}

// Process AudiGIF
document.getElementById("processButton").addEventListener("click", async () => {
  if (images.length === 0) {
    alert("Please upload at least one image.");
    return;
  }

  // Collect trigger data
  triggers = images
    .map((_, index) => {
      const select = document.getElementById(`audioSelect${index}`);
      const audioIndex = select.value;
      return audioIndex ? { frame: index, audio: parseInt(audioIndex) } : null;
    })
    .filter((t) => t !== null);

  // Create AudiGIF file
  try {
    const agif = await createAudiGIF();
    const output = document.getElementById("output");
    output.innerHTML = `AudiGIF created! <a download="${title}.agif" href="${agif.url}">Download ${title}.agif</a>`;
  } catch (error) {
    alert("Error creating AudiGIF: " + error.message);
  }
});

// Preview button
document.getElementById("previewButton").addEventListener("click", async () => {
  if (images.length === 0) {
    alert("Please upload at least one image.");
    return;
  }

  // Collect trigger data
  triggers = images
    .map((_, index) => {
      const select = document.getElementById(`audioSelect${index}`);
      const audioIndex = select.value;
      return audioIndex ? { frame: index, audio: parseInt(audioIndex) } : null;
    })
    .filter((t) => t !== null);

  // Generate AGIF blob for preview
  try {
    const agif = await createAudiGIF();
    const agifBlob = await (await fetch(agif.url)).blob();

    // Show preview container
    document.getElementById("previewContainer").style.display = "block";
    document.getElementById("previewStatus").textContent = "Loading Preview...";

    // Preview the AGIF using AGIFPlayer
    const previewPlayer = new AGIFPlayer("previewCanvas");
    await previewPlayer.loadAndPlay(agifBlob);
    document.getElementById("previewStatus").textContent = "Playing Preview...";
  } catch (error) {
    document.getElementById("previewStatus").textContent =
      "Preview failed: " + error.message;
  }
});

// Create AudiGIF blob (length-prefixed version)
async function createAudiGIF() {
  // Header
  const header = {
    magic: "AGIF", // Included for reference, but not stored in JSON
    version: "1.0",
    width: 300,
    height: 300,
    frameRate: frameRate,
    audioFormat: "wav",
    numFrames: images.length,
    numAudioClips: audioFiles.length,
  };

  const textEncoder = new TextEncoder();

  // Magic bytes
  const magicBytes = textEncoder.encode("AGIF");

  // Header JSON
  const headerStr = JSON.stringify(header);
  const headerBytes = textEncoder.encode(headerStr);
  const headerLenBuffer = new ArrayBuffer(4);
  new DataView(headerLenBuffer).setUint32(0, headerBytes.length, true); // Little-endian

  // Convert images to base64 PNG
  const frameData = await Promise.all(
    images.map(async (image) => {
      const img = new Image();
      img.src = URL.createObjectURL(image);
      await new Promise((resolve) => (img.onload = resolve));
      const canvas = document.createElement("canvas");
      canvas.width = header.width;
      canvas.height = header.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, header.width, header.height);
      return canvas.toDataURL("image/png").split(",")[1]; // Base64 PNG data
    })
  );

  // Frame bytes with length prefixes
  const frameBytesArr = frameData.map((data) => textEncoder.encode(data));
  const frameParts = frameBytesArr.flatMap((fb) => {
    const lenBuffer = new ArrayBuffer(4);
    new DataView(lenBuffer).setUint32(0, fb.length, true);
    return [new Uint8Array(lenBuffer), fb];
  });

  // Convert audio to WAV Uint8Array
  const audioData = await Promise.all(
    audioFiles.map(async (audio) => {
      const arrayBuffer = await audio.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const wavArrayBuffer = audioBufferToWav(audioBuffer);
      return new Uint8Array(wavArrayBuffer);
    })
  );

  // Audio with length prefixes
  const audioParts = audioData.flatMap((audio) => {
    const lenBuffer = new ArrayBuffer(4);
    new DataView(lenBuffer).setUint32(0, audio.length, true);
    return [new Uint8Array(lenBuffer), audio];
  });

  // Trigger map
  const triggerMap = { frame_triggers: triggers, loop: true };
  const triggerStr = JSON.stringify(triggerMap);
  const triggerBytes = textEncoder.encode(triggerStr);
  const triggerLenBuffer = new ArrayBuffer(4);
  new DataView(triggerLenBuffer).setUint32(0, triggerBytes.length, true);

  // Combine into Blob
  const blobParts = [
    magicBytes,
    new Uint8Array(headerLenBuffer),
    headerBytes,
    ...frameParts,
    ...audioParts,
    new Uint8Array(triggerLenBuffer),
    triggerBytes,
  ];
  const blob = new Blob(blobParts, { type: "application/octet-stream" });
  return { url: URL.createObjectURL(blob) };
}

// Reliable audioBufferToWav (fixed for mono/stereo)
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + buffer.length * numChannels * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, buffer.length * numChannels * 2, true);
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(
        -1,
        Math.min(1, buffer.getChannelData(channel)[i])
      );
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }
  }
  return arrayBuffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
