import 'dotenv/config';
import { IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import url from 'url';
import Timer = NodeJS.Timer;

const wss = new WebSocketServer({ port: 8080 });

let timer: Timer;

wss.on("connection", (ws: WebSocket, request: IncomingMessage) => {
  console.log("url: ", request.url);

  const paramsString = url.parse(request.url || '/').search || '';
  const searchParams = new URLSearchParams(paramsString);
  const min = searchParams.get("min") || 0;
  const max = searchParams.get("max") || 1000;

  timer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const data = {
        timestamp: Date.now(),
        value: Math.floor(Math.random() * (+max - +min + 1) + +min),
      };
      console.log('response: %s', data);
      ws.send(JSON.stringify(data));
    } else {
      clearInterval(timer.toString());
    }
  }, 1000);
});
