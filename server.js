import http from "http";
import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import cors from "cors";
import bodyParser from "body-parser";
import * as crypto from "crypto";

const app = express();

// безопасность в браузере (несовпадение origin):
app.use(cors());

// парсинг body на сервере (из строки получаем json):
app.use(
  bodyParser.json({
    type(req) {
      return true;
    },
  })
);

// установка заголовков ответа:
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

// проверка подключения к серверу:
app.get("/ping-server", async (request, response) => {
  response.status(204).end();
});

const userState = []; // массив юзеров [{ 'id': '...', 'name': '...' }, ... ]

// добавление нового юзера на сервере:
app.post("/new-user", async (request, response) => {
  if (Object.keys(request.body).length === 0) {
    const result = {
      status: "error",
      message: "This name is already taken!",
    };
    response.status(400).send(JSON.stringify(result)).end();
  }
  const { name } = request.body;
  const isExist = userState.find((user) => user.name === name);
  if (!isExist) {
    const newUser = {
      id: crypto.randomUUID(),
      name: name,
    };
    userState.push(newUser);
    const result = {
      status: "ok",
      user: newUser,
    };
    response.send(JSON.stringify(result)).end();
  } else {
    const result = {
      status: "error",
      message: "This name is already taken!",
    };
    response.status(409).send(JSON.stringify(result)).end();
  }
});

const server = http.createServer(app); // текущий настроенный http-сервер
const wsServer = new WebSocketServer({ server });

// событие 'connection' - при входе каждого! нового пользователя
wsServer.on("connection", (ws) => {
  // событие 'message' - при отправке данных через ws.send()
  ws.on("message", (msg, isBinary) => {
    const receivedMSG = JSON.parse(msg);

    // receivedMSG = { type: 'exit', user: { id: '...', name: '...' } }
    if (receivedMSG.type === "exit") {
      const idx = userState.findIndex(
        (user) => user.id === receivedMSG.user.id
      );

      userState.splice(idx, 1);
      [...wsServer.clients]
        .filter((o) => o.readyState === WebSocket.OPEN)
        .forEach((o) => o.send(JSON.stringify(userState)));
      return;
    }

    // receivedMSG = { type: 'send', msg: '...', user: { id: '...', name: '...' }, created: '...' }
    if (receivedMSG.type === "send") {
      [...wsServer.clients]
        .filter((o) => o.readyState === WebSocket.OPEN)
        .forEach((o) => o.send(msg, { binary: isBinary }));
    }
  });

  [...wsServer.clients]
    .filter((o) => o.readyState === WebSocket.OPEN)
    .forEach((o) => o.send(JSON.stringify(userState)));
});

const port = process.env.PORT || 7070;

const bootstrap = async () => {
  try {
    server.listen(port, () =>
      console.log(`Server has been started on http://localhost:${port}`)
    );
  } catch (error) {
    console.error(error);
  }
};

bootstrap();
