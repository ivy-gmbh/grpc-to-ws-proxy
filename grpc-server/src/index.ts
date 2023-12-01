import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import {createServer, Server, CallContext, ServerError, Status} from 'nice-grpc';
import { isAbortError } from 'abort-controller-x';
import { ServerReflectionService, ServerReflection } from 'nice-grpc-server-reflection';
import { TerminatorMiddleware } from 'nice-grpc-server-middleware-terminator';
import WebSocket from 'ws';
import {RandomNumberRequest, RandomNumberResponse, RandomNumberServiceDefinition, DeepPartial} from '../gen/grpc/rand/v1/rand.js';


let server: Server;
export const terminatorMiddleware = TerminatorMiddleware();

const fetchDataFromWebSocket = async (ws: WebSocket): Promise<RandomNumberResponse> => {
  return new Promise<RandomNumberResponse>((resolve, reject) => {

    function handleMessage(data: any) {
      console.log('received: %s', data);
      try {
        const randomNumberResponse = RandomNumberResponse.fromJSON(JSON.parse(data.toString()))
        resolve(randomNumberResponse);
      } catch (e) {
        reject(e);
      }
      ws.off('message', handleMessage);
    }

    ws.on('message', handleMessage);
  });
}

const randomNumber = async (request: RandomNumberRequest): Promise<RandomNumberResponse> => {
  const min = request.min || 0;
  const max = request.max || 1000;
  let finished = false;
  const ws = new WebSocket(`ws://0.0.0.0:8080/?min=${min}&max=${max}`);

  ws.on('error', console.error);

  ws.on('close', () => {
    console.log('ws closed')
    if (!finished) throw new ServerError(Status.UNAVAILABLE, 'ws closed');
  });

  try {
    const response = await fetchDataFromWebSocket(ws);
    finished = true;
    return response;
  } catch (e) {
    console.error(e);
    throw new ServerError(Status.UNKNOWN, 'unknown error');
  } finally {
    ws.close();
  }
}

async function *randomNumberStream(
  request: RandomNumberRequest,
  context: CallContext,
): AsyncIterable<DeepPartial<RandomNumberResponse>> {
  const min = request.min || 0;
  const max = request.max || 1000;
  let finished = false;
  const ws = new WebSocket(`ws://0.0.0.0:8080/?min=${min}&max=${max}`);

  try {
    ws.on('error', console.error);

    ws.on('close', () => {
      console.log('ws closed')
      if (!finished) throw new ServerError(Status.UNAVAILABLE, 'ws closed');
    });

    while (!context.signal.aborted) {
      yield await fetchDataFromWebSocket(ws);
    }
    finished = true;
  } catch (error) {
    if (isAbortError(error)) {
      console.log('aborted');
      throw new ServerError(Status.CANCELLED, 'cancelled');
    } else {
      console.error(error);
    }
  } finally {
    console.log('closing ws');
    ws.close();
  }
};

const startup = async (port: string ='8081') => {
  const server = createServer().use(terminatorMiddleware);;

  server.add(RandomNumberServiceDefinition, {
    randomNumber,
    randomNumberStream
  });


  // Enable server reflection
  const protobuf_descriptor_path = path.join(
    process.env['NODE_ENV'] === 'development' ? '' : 'dist',
    'gen',
    'grpc',
    'protoset.bin',
  );
  try {
    console.debug(`loading protobuf descriptor from '${protobuf_descriptor_path}'`);
    server.add(
      ServerReflectionService,
      ServerReflection(fs.readFileSync(protobuf_descriptor_path), [RandomNumberServiceDefinition.fullName]),
    );
    console.log(`Server reflection enabled`);
  } catch (err) {
    console.log(err, `Unable to load protobuf descriptor, server reflection will be disabled`);
  }

  await server.listen(`0.0.0.0:${port}`);
  console.log(`Server is running & listening on port ${port}`);
};

const shutdown = async (signal: string) => {
  console.log(`${signal} received: shutting down server`);
  terminatorMiddleware.terminate();
  await server.shutdown();
  console.log('Server closed');
  process.exit(0);
};

if (process.env.NODE_ENV != 'test') startup(process.env.PORT);

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
