// index.js

const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;

// Objeto para almacenar los nombres de usuario por socket.id
const users = {}; // { 'socket.id1': 'NombreUsuario1', 'socket.id2': 'NombreUsuario2' }

// Sirve archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para la página principal del chat
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Lógica del Servidor Socket.IO ---

io.on('connection', (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  // 1. Escuchar el evento 'set username' cuando el cliente envía su nombre
  socket.on('set username', (username) => {
    // Validar y limpiar el nombre de usuario
    if (!username || typeof username !== 'string' || username.trim() === '') {
      // Si el nombre de usuario es inválido, puedes enviar un error al cliente
      socket.emit('username error', 'El nombre de usuario no puede estar vacío.');
      return;
    }

    const trimmedUsername = username.trim();

    // Opcional: Verificar si el nombre de usuario ya está en uso
    const usernameInUse = Object.values(users).some(u => u === trimmedUsername);
    if (usernameInUse) {
      socket.emit('username error', `El nombre de usuario '${trimmedUsername}' ya está en uso.`);
      return;
    }

    users[socket.id] = trimmedUsername; // Almacena el nombre de usuario
    console.log(`Usuario ${socket.id} se ha identificado como: ${trimmedUsername}`);

    // Confirmar al cliente que el nombre de usuario fue establecido
    socket.emit('username set', trimmedUsername);

    // Notificar a todos que un nuevo usuario se ha unido (con su nombre)
    io.emit('chat message', {
      user: 'Sistema',
      text: `${trimmedUsername} se ha unido al chat.`,
      isSystem: true // Flag para identificar mensajes del sistema
    });
  });

  // Escucha el evento 'chat message' desde el cliente
  socket.on('chat message', (msg) => {
    const username = users[socket.id] || `Anónimo-${socket.id.substring(0, 4)}`; // Obtiene el nombre o usa uno por defecto
    console.log(`Mensaje de ${username} (${socket.id}): ${msg}`);

    // 'io.emit()' envía el mensaje a *todos* los clientes conectados
    // Ahora enviamos un objeto con user y text
    io.emit('chat message', { user: username, text: msg });
  });

  // 'disconnect' es un evento especial que se dispara cuando un cliente se desconecta
  socket.on('disconnect', () => {
    const disconnectedUsername = users[socket.id];
    if (disconnectedUsername) {
      delete users[socket.id]; // Elimina el usuario del almacenamiento
      console.log(`Usuario desconectado: ${disconnectedUsername} (${socket.id})`);
      // Notificar a todos que un usuario se ha desconectado (con su nombre)
      io.emit('chat message', {
        user: 'Sistema',
        text: `${disconnectedUsername} ha abandonado el chat.`,
        isSystem: true
      });
    } else {
      console.log(`Usuario anónimo desconectado: ${socket.id}`);
    }
  });

  // Manejo de eventos 'typing' (opcional, pero útil para mostrar quién escribe)
  socket.on('typing', () => {
    const username = users[socket.id] || `Anónimo-${socket.id.substring(0, 4)}`;
    socket.broadcast.emit('user typing', `${username} está escribiendo...`);
  });

  socket.on('stop typing', () => {
    socket.broadcast.emit('user typing', '');
  });
});

// Inicia el servidor HTTP (que Socket.IO está escuchando)
server.listen(port, () => {
  console.log(`Servidor de chat escuchando en http://localhost:${port}`);
});