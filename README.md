# gRPC to Websocket proxy

This is a simple gRPC to Websocket API proxy. This could be useful if you want to wrap a websocket API that you don't control in a gRPC service.

## Design

The interface is defined in `proto/rand/v1/rand.proto`. It defines a single RandomNumberService that return random numbers between the optional min and max parameters. The request can be unary or a stream, the stream will return a rnadom number every second until cancelled.

The gRPC server will open a connection to the websocket service tht actually calculates the random numbers. The point is just a proof of concept to show that one can proxy a websocket service with gRPC relatively easily whithout composing the quality of service.

## Usage

the gRPC server relies on code generation `npm run gen` to generate the types.

Both servers can then be started with `npm run dev` from their respective directories.

The gRPC server can be called with [grpcurl](https://github.com/fullstorydev/grpcurl): `grpcurl -plaintext '0.0.0.0:8081' rand.v1.RandomNumberService/RandomNumber`

## TODO

This is obviosly not production ready code, some of the things that should implemented in a real world scenario are:
* A generic version of the Websocket instance that takes care of reduces the boilerplate
* Reusable websocket connections, eespecially for the unary requests
* Timeouts
* Message validation
* Retry logic if the connection goes away
