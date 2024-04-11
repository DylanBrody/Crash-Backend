import ExpressServer from './ExpressServer';
import SocketServer from './SocketServer';
import SocketServerClone from './SocketServerClone';
import { connect } from '../api/models';
export default () => {
    connect().then(async loaded => {
        if (loaded) {
            // start express
            const expressServer = new ExpressServer();
            const expressInstance = expressServer.server;
    
            //option setting
            const option = {
                cors: {
                    origin: "*",
                    methods: ["GET", "POST"]
                },
                path: "/crash/socket.io",
                transports: ['websocket']
            };
    
            // start socket 
            // const socketServer = new SocketServer(expressInstance, option);
            const socketServer = new SocketServerClone(expressInstance, option);
            const socketInstance = socketServer.instance;
            expressServer.initSocket(socketInstance);
    
            process.on('SIGINT', () => {
                // Handle CTRL+C
                expressServer.close();
                socketServer.close();
            }).on('SIGTERM', () => {
                // Handle termination signals
                expressServer.close();
                socketServer.close();
            });   
        } else {
            console.log('Connection to MongoDB failed', loaded);
        }
    });
}