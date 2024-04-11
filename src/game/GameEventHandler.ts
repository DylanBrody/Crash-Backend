import { Server as SocketServerT, Socket as SocketT } from 'socket.io';
import { DEFAULT_USER, BettingConfig, GameState } from '../common/constants';
import { getUserInfo, bet, settle, cancelBet } from '../api/controllers/client';
import { gameStateType } from '../common/interfaces/bridgeData';
import { global } from '../common/GameStateGlobalVariables';

class GameEventHandler {

    private _io: SocketServerT;
    private _startTime: number;

    constructor(io: SocketServerT) {
        this._io = io;
        this._startTime = Date.now();
    }

    public listen(): void {
        this._io.on("connection", async (socket: SocketT) => {
            global._sockets.push(socket);
            this.registerDisconnectionEvent(socket);            
            this.registerEnterRoomEvent(socket);            
            this.registerPlayBetEvent(socket);
            this.registerCashOutEvent(socket);
        });
        if (this._io) {
            console.log('Running Socket Server is listening.');
        }
    }
    
    private registerDisconnectionEvent = async (socket: SocketT) => {
        socket.on('disconnect', async () => {
            console.log("hello disconnect")
            const checkIndex = global._sockets.findIndex((s) => (
                s.id === socket.id
            ))
            
            if (checkIndex > -1) {
                console.log("orderNo is", global._users[socket.id].orderNo)
                if (global._users[socket.id].orderNo > 0) {
                    let betAmount = 0;
                    if (global._users[socket.id].f.betted && !global._users[socket.id].f.cashouted) betAmount += global._users[socket.id].f.betAmount;
                    if (global._users[socket.id].s.betted && !global._users[socket.id].s.cashouted) betAmount += global._users[socket.id].s.betAmount;
                    if (betAmount > 0) {
                        cancelBet(global._users[socket.id].orderNo, betAmount, global._users[socket.id].token);
                    }
                }
                global._sockets.splice(checkIndex, 1);
                delete global._users[socket.id];
            }
        });
    }

    private registerEnterRoomEvent = async(socket: SocketT) => {
        socket.on('enterRoom', async (props: any) => {
            const { token } = props;
            console.log("Hello enterroom")
            socket.emit('getBetLimits', { max: BettingConfig.BETTING_MAX, min: BettingConfig.BETTING_MIN });
            if (token !== null && token !== undefined) {
                let tokenSplit = token.split('&');
                const userInfo = await getUserInfo(tokenSplit[0]);
                if (userInfo.status) {
                    global._users[socket.id] = {
                        ...DEFAULT_USER,
                        userId: userInfo.data.userId,
                        userName: userInfo.data.userName,
                        balance: userInfo.data.balance,
                        // insert currency
                        currency: userInfo.data.currency,
                        avatar: userInfo.data.avatar,
                        token: tokenSplit[0],
                        socketId: socket.id
                    }
                    socket.emit('myInfo', global._users[socket.id]);
                    this._io.emit('history', global._history);
                    const time = Date.now() - this._startTime;
                    this._io.emit('gameState', {
                        currentNum: global._currentNum,
                        currentSecondNum: global._currentSecondNum,
                        GameState: global._gameState,
                        time: time
                    } as gameStateType);
                } else {
                    socket.emit("deny", { message: "Unregistered User" });
                }
            } else {
                global._users[socket.id] = {
                    ...DEFAULT_USER,
                    balance: 50000,
                    socketId: socket.id
                }
            }
        });
    }

    private registerPlayBetEvent = async (socket: SocketT) => {
        socket.on('playBet', async (data: any) => {
            console.log("playbet")
            const { betAmount, target, type, auto } = data;
            if (global._gameState === GameState.BET) {
                let u = global._users[socket.id];

                if (!!u) {
                    if (betAmount >= BettingConfig.BETTING_MIN && betAmount <= BettingConfig.BETTING_MAX) {
                        if (u.balance - betAmount >= 0) {
                            const betRes = await bet(betAmount, u.token);
                            if (betRes.status) {
                                if (type === 'f') {
                                    u.f.betAmount = betAmount;
                                    u.f.betted = true;
                                    u.f.auto = auto;
                                    u.f.target = target;
                                } else if (type === 's') {
                                    u.s.betAmount = betAmount;
                                    u.s.betted = true;
                                    u.s.auto = auto;
                                    u.s.target = target;
                                }
                                u.balance = betRes.balance;
                                u.orderNo = betRes.orderNo;

                                global._totalBetAmount += betAmount;
                                socket.emit("myBetState", { user: u, type });
                            } else {
                                socket.emit('error', { message: betRes.message, index: type });
                            }
                        } else {
                            socket.emit('error', { message: "Your balance is not enough", index: type });
                        }
                    }
                } else {
                    socket.emit('error', { message: "Undefined User", index: type });
                }
            } else {
                socket.emit('error', { message: "You can't bet. Try again at next round!", index: type });
            }
        });
    }

    private registerCashOutEvent = (socket: SocketT) => {
        socket.on('cashOut', async (data: any) => {
            console.log("cashout")
            const { type, endTarget } = data;
            let u = global._users[socket.id];
            let player;
            if (type === 'f')
                player = u.f
            else if (type === 's')
                player = u.s
            if (!!u) {
                console.log("u is", u);
                if (global._gameState === GameState.PLAYING) {
                    console.log("GameState is", global._gameState);
                    if (!player?.cashouted && player?.betted) {
                        console.log("3 is", !player.cashouted, "&&", player.betted, !player.cashouted && player.betted);
                        if (endTarget <= global._currentSecondNum) {
                            console.log("4 is", endTarget, global._currentSecondNum);
                            settle(u.orderNo, endTarget * player.betAmount, u.token);
                            player.cashouted = true;
                            player.cashAmount = endTarget * player.betAmount;
                            player.betted = false;
                            player.target = endTarget;
                            u.balance += endTarget * player.betAmount;
                            u.orderNo = 0;
                            global._cashoutAmount += endTarget * player.betAmount;
                            socket.emit("finishGame", u);
                            socket.emit("success", `Successfully CashOuted ${Number(player.cashAmount).toFixed(2)}`);
                        } else {
                            socket.emit("error", { message: "You can't cash out!", index: type });
                        }
                    }
                } else
                    socket.emit('error', { message: "You can't cash out!", index: type });
            } else
                socket.emit('error', { message: 'Undefined User', index: type });
        });
    }
}

export default GameEventHandler;