import ExpressServer from './ExpressServer';
import SocketServer from './SocketServer';

export default () => {
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
    const socketServer = new SocketServer(expressInstance, option);
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
}