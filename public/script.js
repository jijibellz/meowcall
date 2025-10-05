const socket = io();
let localStream;
const peers = {};
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const videosDiv = document.getElementById("videos");

document.getElementById("join").onclick = async () => {
  const roomId = document.getElementById("room").value;
  if (!roomId) return alert("Enter a room name!");

  socket.emit("join-room", roomId);

  // Get camera + mic
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const localVideo = document.createElement("video");
  localVideo.srcObject = localStream;
  localVideo.autoplay = true;
  localVideo.muted = true;
  localVideo.classList.add("video-box");
  videosDiv.appendChild(localVideo);
};

// Handle already existing users
socket.on("all-users", async (users) => {
  for (let userId of users) {
    const peer = createPeer(userId, true);
    peers[userId] = peer;
  }
});

// When a new user joins
socket.on("user-joined", (id) => {
  console.log("New user joined:", id);
  const peer = createPeer(id, false);
  peers[id] = peer;
});

// Signaling messages
socket.on("signal", async (data) => {
  const { from, signal } = data;
  let peer = peers[from];
  if (!peer) {
    peer = createPeer(from, false);
    peers[from] = peer;
  }

  if (signal.sdp) {
    await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    if (signal.sdp.type === "offer") {
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("signal", { to: from, signal: { sdp: answer } });
    }
  } else if (signal.candidate) {
    await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
  }
});

// When someone leaves
socket.on("user-left", (id) => {
  console.log("User left:", id);
  const video = document.getElementById(id);
  if (video) video.remove();
  delete peers[id];
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

  if (isInitiator) {
    peer.createOffer().then((offer) => {
      peer.setLocalDescription(offer);
      socket.emit("signal", { to: id, signal: { sdp: offer } });
    });
  }

  return peer;
}
