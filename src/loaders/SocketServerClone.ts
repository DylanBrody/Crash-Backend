import { Server as SocketServerT } from 'socket.io';
import { Server as HttpServerType } from 'http';
import GameStateManager from '../game/GameStateManager';
import GameEventHandler from '../game/GameEventHandler';

class SocketServerClone {

    private _io: SocketServerT;
    private _gameStateManager: GameStateManager;
    private _gameEventHandler: GameEventHandler;

    constructor(server: HttpServerType, option: object) {
        this._io = new SocketServerT(server, option);
        this._gameStateManager = new GameStateManager(this._io);  
        this._gameEventHandler = new GameEventHandler(this._io);
        this.listen();
        this.gameRun();
    }

    private listen(): void {
        this._gameEventHandler.listen();
    }

    private gameRun = async () => {    
        this._gameStateManager.gameRun(); 
    }    

    public close(): void {
        this._io.on('end', (socket: any) => {
            socket.disconnect(0);
            console.info(new Date(), "[SocketServer]: Disconnect");
        })
    }

    get instance(): SocketServerT {
        return this._io;
    }
}

export default SocketServerClone;