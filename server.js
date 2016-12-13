const path = require('path');
const webpack = require('webpack');
const express = require('express');
const config = require('./webpack.config');
const proxy = require('express-http-proxy');


const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
http.listen(8080, '127.0.0.1');

const usernames = {};

const rooms = [];

io.on('connection', function (socket) {
  socket.on('adduser', function(username, room) {
        socket.username = username;
        socket.room = room;
        usernames[username] = username;
        if(!rooms.includes(room)){
          rooms.push(room)
        }
        socket.join(room);
        socket.emit('updatechat', 'SERVER', 'you have connected to Lobby');
        socket.broadcast.to(room).emit('updatechat', 'SERVER', username + ' has connected to this room');
        socket.emit('updaterooms', rooms, room);
    });

    socket.on('sendchat', function(data) {
        io.sockets["in"](socket.room).emit('updatechat', socket.username, data);
    });

    socket.on('switchRoom', function(newroom) {
        var oldroom;
        oldroom = socket.room;
        socket.leave(socket.room);
        socket.join(newroom);
        socket.emit('updatechat', 'SERVER', 'you have connected to ' + newroom);
        socket.broadcast.to(oldroom).emit('updatechat', 'SERVER', socket.username + ' has left this room');
        socket.room = newroom;
        socket.broadcast.to(newroom).emit('updatechat', 'SERVER', socket.username + ' has joined this room');
        socket.emit('updaterooms', rooms, newroom);
    });

    socket.on('disconnect', function() {
        delete usernames[socket.username];
        io.sockets.emit('updateusers', usernames);
        socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected');
        socket.leave(socket.room);
    });
});

const compiler = webpack(config);

app.use(require('webpack-dev-middleware')(compiler, {
  publicPath: config.output.publicPath,
}));

app.use(require('webpack-hot-middleware')(compiler));

app.use('/v1/users', proxy('http://localhost:3000', {
  forwardPath: function(req, res) {
    return '/v1/users' + require('url').parse(req.url).path;
  },
}));

app.use('/v1/access_tokens', proxy('http://localhost:3000', {
  forwardPath: function(req, res) {
    return '/v1/access_tokens' + require('url').parse(req.url).path;
  },
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(8100, (err) => {
  if (err) {
    console.error(err);
  }
  console.log('Listening at http://localhost:8100/');
});
