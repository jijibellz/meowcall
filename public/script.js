const socket = io();
let localStream;
const peers = {};
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const videosDiv = document.getElementById("videos");

document.getElementById("join").onclick = async () => {
  const roomId = document.getElementById("room").value.trim();
  if (!roomId) return alert("Enter a room name!");

  // Get camera + mic
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const localVideo = document.createElement("video");
  localVideo.srcObject = localStream;
  localVideo.autoplay = true;
  localVideo.muted = true;
  localVideo.classList.add("video-box");
  videosDiv.appendChild(localVideo);

  socket.emit("join-room", roomId);
};

// 1️⃣ Handle users already in room
socket.on("all-users", async (users) => {
  console.log("Users already in room:", users);
  for (const userId of users) {
    const peer = createPeer(userId, true);
    peers[userId] = peer;
  }
});

// 2️⃣ New user joins
socket.on("user-joined", (id) => {
  console.log("New user joined:", id);
  const peer = createPeer(id, false);
  peers[id] = peer;
});

// 3️⃣ Handle signaling
socket.on("signal", async ({ from, signal }) => {
  let peer = peers[from];
  if (!peer) {
    peer = createPeer(from, false);
    peers[from] = peer;
  }

  if (signal.sdp) {
    await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));

    // If it's an offer, respond with an answer
    if (signal.sdp.type === "offer") {
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("signal", { to: from, signal: { sdp: peer.localDescription } });
    }
  } else if (signal.candidate) {
    try {
      await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
    } catch (err) {
      console.error("Error adding ICE candidate:", err);
    }
  }
});

// 4️⃣ Handle user leaving
socket.on("user-left", (id) => {
  console.log("User left:", id);
  if (peers[id]) peers[id].close();
  delete peers[id];
  const video = document.getElementById(id);
  if (video) video.remove();
});

function createPeer(id, isInitiator) {
  const peer = new RTCPeerConnection(config);
  localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("signal", { to: id, signal: { candidate: event.candidate } });
    }
  };

  peer.ontrack = (event) => {
    let vid = document.getElementById(id);
    if (!vid) {
      vid = document.createElement("video");
      vid.id = id;
      vid.autoplay = true;
      vid.classList.add("video-box");
      videosDiv.appendChild(vid);
    }
    vid.srcObject = event.streams[0];
  };

  // If initiator, start the offer
  if (isInitiator) {
    peer.onnegotiationneeded = async () => {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("signal", { to: id, signal: { sdp: peer.localDescription } });
    };
  }

  return peer;
}
