const path = require('path');
const express = require('express')
const http = require('http')
const moment = require('moment');
const socketio = require('socket.io');
const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

const io = socketio(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};
let socketroom = {};
let socketname = {};
let micSocket = {};
let videoSocket = {};
let roomBoard = {};
let hostSocketId = null;
let hostUsername = null;
const connectedUsers = {};
const activeUsers = {};
const chatMessages = [
    { username: 'User1', text: 'Hello', timestamp: 1634824387000 },
    // Other messages...
];
function getOnlineUsernames(roomid) {
    return Object.values(connectedUsers)
      .filter((user) => user.roomid === roomid)
      .map((user) => user.username);
  }
  
  // Helper function to find a user's socket by their username and room
  function findUserSocket(username, roomid) {
    return Object.keys(connectedUsers).find(
      (socketId) =>
        connectedUsers[socketId].username === username &&
        connectedUsers[socketId].roomid === roomid
    );
  }
function updateAndEmitUserCount(roomid) {
    const userCount = rooms[roomid] ? rooms[roomid].length : 0;
    io.to(roomid).emit('user count', userCount);
}
io.on('connect', socket => {

    socket.on("join room", (roomid, username) => {

        socket.join(roomid);
        socketroom[socket.id] = roomid;
        socketname[socket.id] = username;
        micSocket[socket.id] = 'on';
        videoSocket[socket.id] = 'on';
        connectedUsers[socket.id] = { username, roomid };

    // Broadcast the list of online users to the room
        io.to(roomid).emit('usernames', getOnlineUsernames(roomid));
        if (rooms[roomid] && rooms[roomid].length > 0) {
            rooms[roomid].push(socket.id);
            socket.to(roomid).emit('message', `${username} joined the room.`, 'Bot', moment().format("h:mm a"));
            io.to(socket.id).emit('join room', rooms[roomid].filter(pid => pid != socket.id), socketname, micSocket, videoSocket);
        }
        else {
            rooms[roomid] = [socket.id];
            io.to(socket.id).emit('join room', null, null, null, null);
        }

        updateAndEmitUserCount(roomid); // Update and emit the user count

        if (!activeUsers[roomid]) {
            activeUsers[roomid] = {};
        }
        activeUsers[roomid][socket.id] = username;

        // Emit the list of usernames to all clients in the room
        io.to(roomid).emit('usernames', Object.values(activeUsers[roomid]));
        if (!hostSocketId) {
            hostSocketId = socket.id; // The first person to join becomes the host
            hostUsername = username; // Store the host's username
        }
    
        // Rest of your existing code...
    
        // Send a message to the host to indicate their host status and username
        if (socket.id === hostSocketId) {
            io.to(socket.id).emit('hostStatus', true);
            io.to(socket.id).emit('hostUsername', hostUsername);
        }
       
    });
    
   
    socket.on('action', msg => {
        if (msg == 'mute')
            micSocket[socket.id] = 'off';
        else if (msg == 'unmute')
            micSocket[socket.id] = 'on';
        else if (msg == 'videoon')
            videoSocket[socket.id] = 'on';
        else if (msg == 'videooff')
            videoSocket[socket.id] = 'off';

        socket.to(socketroom[socket.id]).emit('action', msg, socket.id);
    })

    socket.on('video-offer', (offer, sid) => {
        socket.to(sid).emit('video-offer', offer, socket.id, socketname[socket.id], micSocket[socket.id], videoSocket[socket.id]);
    })

    socket.on('video-answer', (answer, sid) => {
        socket.to(sid).emit('video-answer', answer, socket.id);
    })

    socket.on('new icecandidate', (candidate, sid) => {
        socket.to(sid).emit('new icecandidate', candidate, socket.id);
    })

    socket.on('message', (msg, username, roomid) => {
        io.to(roomid).emit('message', msg, username, moment().format(
            "h:mm a"
        ));

      
    })
   
    socket.on('getCanvas', () => {
        if (roomBoard[socketroom[socket.id]])
            socket.emit('getCanvas', roomBoard[socketroom[socket.id]]);
    });

    socket.on('draw', (newx, newy, prevx, prevy, color, size) => {
        socket.to(socketroom[socket.id]).emit('draw', newx, newy, prevx, prevy, color, size);
    })

    socket.on('clearBoard', () => {
        socket.to(socketroom[socket.id]).emit('clearBoard');
    });
    

 

    socket.on('store canvas', url => {
        roomBoard[socketroom[socket.id]] = url;
    })
    
   ;
    socket.on('disconnect', () => {
        if (!socketroom[socket.id]) return;
        const roomid = socketroom[socket.id];
        if (activeUsers[roomid] && activeUsers[roomid][socket.id]) {
            delete activeUsers[roomid][socket.id];

            // Emit the updated list of usernames to all clients in the room
            io.to(roomid).emit('usernames', Object.values(activeUsers[roomid]));
        }
        socket.to(socketroom[socket.id]).emit('message', `${socketname[socket.id]} left the chat.`, `Bot`, moment().format("h:mm a"));

        socket.to(socketroom[socket.id]).emit('remove peer', socket.id);
        var index = rooms[socketroom[socket.id]].indexOf(socket.id);
        rooms[socketroom[socket.id]].splice(index, 1);
        updateAndEmitUserCount(socketroom[socket.id]); // Update and emit the user count
        delete socketroom[socket.id];
        console.log('--------------------');
        console.log(rooms[socketroom[socket.id]]);


    
    });
})


server.listen(PORT, () => console.log(`Server is up and running on port ${PORT}`));