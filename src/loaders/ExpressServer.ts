import * as express from 'express';
import * as bodyParser from "body-parser";
import * as socketIo from 'socket.io';
import config from "../common/config";
import cors = require('cors');
import errorHandler from "../responses/ErrorHandler";
import routes from '../api/routes';
import routeNotFound from '../api/middlewares/RouteNotFound';

import { Server, createServer } from 'http';


class ExpressServer {
    public static readonly PORT: number = 5002;

    private _app: express.Application;
    private _server: Server;
    private _port: number;

    public constructor() {
        this.listen();
    }

    private listen(): void {
        // initialize express instances 
        this._app = express();
        // only accept content type application/json
        this._app.use(express.urlencoded());
        this._app.use(bodyParser.json({ type: "application/json" }));
        this._app.use(bodyParser.raw({ type: "application/vnd.custom-type" }));
        this._app.use(bodyParser.text({ type: "text/html" }));
        this._app.use(cors({ origin: "*" }));

        this._app.use('/crash/api', routes);
        this._app.use('*', routeNotFound);
        this._app.use(errorHandler);

        // start nodejs server
        this._port = config.serverPort || ExpressServer.PORT;
        this._server = createServer(this._app);
        this._server.listen({port: this._port, host: '0.0.0.0'}, () => {
            console.log('Running Express Server on port %s', this._port);
            console.log("server successfully updated");
        })

    }

    public close(): void {
        this._server.close((err) => {
            if (err) throw Error();
            console.info(new Date(), '[ExpressServer]: Stopped');
        });
    }

    public initSocket(socket: socketIo.Server): void {
        this._app.set('io', socket);
    }

    get server(): Server { return this._server; }
}

export default ExpressServer; 
