import { Server as SocketServerT, Socket as SocketT} from 'socket.io';
import { Server as HttpServerType } from 'http';
import { prcTimeout } from 'precision-timeout-interval';
import * as isaac from 'isaac';
import { getTime } from '../utils/math';
import { addHistory } from '../api/models';
import { DEFAULT_USER, BettingConfig, GameState, GameTime, SALT } from '../common/constants';
import { getUserInfo, bet, settle, cancelBet } from '../api/controllers/client';
import { UserType, historyType, preHandType, gameStateType } from '../common/interfaces/bridgeData';

class SocketServer {

    private _io: SocketServerT;
    private _sockets: SocketT [] = [];
    private _users: { [key: string]: UserType } = {};
    private _history: historyType[] = [];
    private _startTime: number;
    private _previousHand: { [key: string]: UserType };
    private _gameState: string;
    private _nextState: string;
    private _gameTime: number;
    private _currentNum: number;
    private _currentSecondNum: number;
    private _target: number;
    private _cashoutAmount: number;
    private _totalBetAmount: number;
    private _realRTP: number;
    private _countNo: number;
    private _roundId: number;

    constructor(server: HttpServerType, option: object) {
        this._startTime = Date.now();
        this._previousHand = this._users;
        this._gameState = GameState.BET;
        this._nextState = GameState.READY;
        this._cashoutAmount = 0;
        this._totalBetAmount = 0;
        this._target = -1;
        this._realRTP = -1;
        this._countNo = 0;
        this._roundId = 0;
        this._io = new SocketServerT(server, option);
        this.listen();
        this.gameRun();
    }

    private listen(): void {

        this._io.on("connection", async (socket: any) => {
            this._sockets.push(socket);
            // console.log("after connection, event? ", socket.request._events)
            socket.on('disconnect', async () => {
                console.log("hello disconnect")
                const checkIndex = this._sockets.findIndex((s) => (
                    s.id === socket.id
                ))
                
                if (checkIndex > -1) {
                    console.log("orderNo is", this._users[socket.id].orderNo)
                    if (this._users[socket.id].orderNo > 0) {
                        let betAmount = 0;
                        if (this._users[socket.id].f.betted && !this._users[socket.id].f.cashouted) betAmount += this._users[socket.id].f.betAmount;
                        if (this._users[socket.id].s.betted && !this._users[socket.id].s.cashouted) betAmount += this._users[socket.id].s.betAmount;
                        if (betAmount > 0) {
                            cancelBet(this._users[socket.id].orderNo, betAmount, this._users[socket.id].token);
                        }
                    }
                    this._sockets.splice(checkIndex, 1);
                    delete this._users[socket.id];
                }
            });
            socket.on('enterRoom', async (props: any) => {
                const { token } = props;
                console.log("Hello enterroom")
                socket.emit('getBetLimits', { max: BettingConfig.BETTING_MAX, min: BettingConfig.BETTING_MIN });
                this._users[socket.id] = {
                    ...DEFAULT_USER,
                    balance: 50000,
                    socketId: socket.id
                }
                // if (token !== null && token !== undefined) {
                //     let tokenSplit = token.split('&');
                //     const userInfo = await getUserInfo(tokenSplit[0]);
                //     if (userInfo.status) {
                //         this._users[socket.id] = {
                //             ...DEFAULT_USER,
                //             userId: userInfo.data.userId,
                //             userName: userInfo.data.userName,
                //             balance: userInfo.data.balance,
                //             // insert currency
                //             currency: userInfo.data.currency,
                //             avatar: userInfo.data.avatar,
                //             token: tokenSplit[0],
                //             socketId: socket.id
                //         }
                //         socket.emit('myInfo', this._users[socket.id]);
                //         this._io.emit('history', this._history);
                //         const time = Date.now() - this._startTime;
                //         this._io.emit('gameState', {
                //             currentNum: this._currentNum,
                //             currentSecondNum: this._currentSecondNum,
                //             GameState: this._gameState,
                //             time: time
                //         } as gameStateType);
                //     } else {
                //         socket.emit("deny", { message: "Unregistered User" });
                //     }
                // } else {
                //     this._users[socket.id] = {
                //         ...DEFAULT_USER,
                //         balance: 50000,
                //         socketId: socket.id
                //     }
                //     console.log(this._users[socket.id])
                // }
            });
            socket.on('playBet', async (data: any) => {
                console.log("playbet")
                const { betAmount, target, type, auto } = data;
                if (this._gameState === GameState.BET) {
                    let u = this._users[socket.id];

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

                                    this._totalBetAmount += betAmount;
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
            socket.on('cashOut', async (data: any) => {
                console.log("cashout")
                const { type, endTarget } = data;
                let u = this._users[socket.id];
                let player;
                if (type === 'f')
                    player = u.f
                else if (type === 's')
                    player = u.s
                if (!!u) {
                    console.log("u is", u);
                    if (this._gameState === GameState.PLAYING) {
                        console.log("GameState is", this._gameState);
                        if (!player?.cashouted && player?.betted) {
                            console.log("3 is", !player.cashouted, "&&", player.betted, !player.cashouted && player.betted);
                            if (endTarget <= this._currentSecondNum) {
                                console.log("4 is", endTarget, this._currentSecondNum);
                                settle(u.orderNo, endTarget * player.betAmount, u.token);
                                player.cashouted = true;
                                player.cashAmount = endTarget * player.betAmount;
                                player.betted = false;
                                player.target = endTarget;
                                u.balance += endTarget * player.betAmount;
                                u.orderNo = 0;
                                this._cashoutAmount += endTarget * player.betAmount;
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
        });

        if (this._io) {
            console.log('Running Socket Server is listening.');
        }
    }

    private generateRoundID = () => {
        let curTime = new Date();
        this._roundId++;
        if (this._roundId > 6000) {
            this._roundId = 0;
        }
        return curTime.getFullYear().toString() + (curTime.getMonth() + 1).toString() + curTime.getMonth().toString() + String(this._roundId).padStart(4, '0');
    }

    private gameRun = async () => {
        prcTimeout(20, () => { this.gameRun() });

        switch (this._gameState) {
            case GameState.BET:
                if (Date.now() - this._startTime > GameTime.BETINGTIME) {
                    this._currentNum = 1;
                    this._gameState = GameState.READY;
                    this._nextState = GameState.PLAYING;
                    this._startTime = Date.now();
                    const time = Date.now() - this._startTime;
                    this._io.emit('gameState', {
                        currentNum: this._currentNum,
                        currentSecondNum: this._currentSecondNum,
                        GameState: this._gameState,
                        time: time
                    } as gameStateType);
                }
                break;
            case GameState.READY:
                if (this._target == -1) {
                    this._countNo++;
                    if (this._countNo > 10000000) {
                        isaac.reset();
                        isaac.seed(SALT);
                        this._countNo = 0;
                    }

                    let X = isaac.random();
                    X = parseFloat(X.toPrecision(9));
                    X = BettingConfig.RTP / (1 - X);
                    this._target = Math.max(1, Math.floor(X) / 100);
                    this._target = Math.min(999.99, Math.floor(X) / 100);
                }
                if (Date.now() - this._startTime > GameTime.READYTIME) {
                    this._gameState = GameState.PLAYING;
                    this._startTime = Date.now();
                    const time = Date.now() - this._startTime;
                    this._gameTime = getTime(this._target);
                    this._io.emit('gameState', {
                        currentNum: this._currentNum,
                        currentSecondNum: this._currentSecondNum,
                        GameState: this._gameState,
                        time: time
                    } as gameStateType);
                }
                break;
            case GameState.PLAYING:
                var currentTime = (Date.now() - this._startTime) / 1000;
                this._currentNum = 1 + 0.06 * currentTime + Math.pow((0.06 * currentTime), 2) - Math.pow((0.04 * currentTime), 3) + Math.pow((0.04 * currentTime), 4)
                for (const k in this._users) {
                    const i = this._users[k];
                    if (i.f.target >= 1.01 && i.f.betted && !i.f.cashouted && this._target >= i.f.target && this._currentNum >= i.f.target) {
                        console.log("aaa", i.f.target >= 1.01 && i.f.betted && !i.f.cashouted && this._target >= i.f.target && this._currentNum >= i.f.target);
                        settle(i.orderNo, i.f.target * i.f.betAmount, i.token);
                        i.f.cashouted = true;
                        i.f.cashAmount = i.f.target * i.f.betAmount;
                        i.f.betted = false;
                        i.balance += i.f.target * i.f.betAmount;
                        i.orderNo = 0;
                        this._cashoutAmount += i.f.target * i.f.betAmount;
                        this._io.emit("finishGame", i);
                        this._io.emit("success", `Successfully CashOuted ${Number(i.f.cashAmount).toFixed(2)}`);
                    }
                    if (i.s.target >= 1.01 && i.s.betted && !i.s.cashouted && this._target >= i.s.target && this._currentNum >= i.s.target) {
                        console.log("bbb", i.f.target >= 1.01 && i.f.betted && !i.f.cashouted && this._target >= i.f.target && this._currentNum >= i.f.target);
                        settle(i.orderNo, i.s.target * i.s.betAmount, i.token);
                        i.s.cashouted = true;
                        i.s.cashAmount = i.s.target * i.s.betAmount;
                        i.s.betted = false;
                        i.balance += i.s.target * i.s.betAmount;
                        i.orderNo = 0;
                        this._cashoutAmount += i.s.target * i.s.betAmount;
                        this._io.emit("finishGame", i);
                        this._io.emit("success", `Successfully CashOuted ${Number(i.s.cashAmount).toFixed(2)}`);
                    }
                }
                if (this._currentNum > Math.floor(Math.random() * 51) + 250 && this.getRealRTP() > BettingConfig.RTP) {
                    this._target = Math.round(this._currentNum * 100) / 100;
                    this._gameTime = getTime(this._target);
                }
                this._currentSecondNum = this._currentNum;
                if (currentTime > this._gameTime) {
                    this.sendPreviousHand();
                    this._currentSecondNum = 0;
                    this._currentNum = this._target;
                    this._gameState = GameState.GAMEEND;
                    this._nextState = GameState.BET;
                    this._startTime = Date.now();
                    for (const k in this._users) {
                        const i = this._users[k];
                        let fBetted = i.f.betted;
                        if (i.f.betted || i.f.cashouted) {
                            addHistory(i.userId, i.f.betAmount, i.f.target, i.f.cashouted)
                        }
                        i.f.betted = false;
                        i.f.cashouted = false;
                        i.f.betAmount = 0;
                        i.f.cashAmount = 0;
                        let sBetted = i.s.betted;
                        if (i.s.betted || i.s.cashouted) {
                            addHistory(i.userId, i.s.betAmount, i.s.target, i.s.cashouted)
                        }
                        i.s.betted = false;
                        i.s.cashouted = false;
                        i.s.betAmount = 0;
                        i.s.cashAmount = 0;
                        this._sockets.map((socket) => {
                            if (socket.id === i.socketId && (fBetted || sBetted)) {
                                console.log("ccc");
                                socket.emit("finishGame", i);
                            }
                        })
                    }

                    const time = Date.now() - this._startTime;
                    this._io.emit('gameState', {
                        currentNum: this._currentNum,
                        currentSecondNum: this._currentSecondNum,
                        GameState: this._gameState,
                        time: time
                    } as gameStateType);
                }
                break;
            case GameState.GAMEEND:
                if (Date.now() - this._startTime > GameTime.GAMEENDTIME) {
                    let i = 0;
                    let interval = setInterval(() => {
                        i++;
                        if (i > 19)
                            clearInterval(interval);
                    }, 100)
                    this._startTime = Date.now();
                    this._gameState = GameState.BET;
                    this._nextState = GameState.READY;
                    let betid = this.generateRoundID();
                    let newhistory: historyType = {
                        betid: betid,
                        history: this._target
                    }
                    this._history.unshift(newhistory);
                    this._io.emit("history", this._history.slice(0, 500));
                    const time = Date.now() - this._startTime;
                    this._io.emit('gameState', {
                        currentNum: this._currentNum,
                        currentSecondNum: this._currentSecondNum,
                        GameState: this._gameState,
                        time: time
                    } as gameStateType);
                    this._target = -1;
                    this._realRTP = this.getRealRTP();
                    this._cashoutAmount = 0;
                    this._totalBetAmount = 0;
                }
                break;
        }
    }

    private getRealRTP(): number {
        if (this._totalBetAmount == 0) return this._realRTP;
        if (this._realRTP > -1) return Math.round((this._realRTP + this._cashoutAmount / this._totalBetAmount * 100) / 2 * 100) / 100;
        else return Math.round(this._cashoutAmount / this._totalBetAmount * 10000) / 100;
    }

    private sendPreviousHand(): void {
        let myPreHand = [] as preHandType[];
        for (let i in this._previousHand) {
            let u = this._previousHand[i];
            if (u.f.betted || u.f.cashouted) {
                myPreHand.push({
                    img: u.avatar,
                    userName: u.userName,
                    betted: u.f.betted,
                    cashouted: u.f.cashouted,
                    betAmount: u.f.betAmount,
                    cashAmount: u.f.cashAmount,
                    target: u.f.target,
                });
            }
            if (u.s.betted || u.s.cashouted) {
                myPreHand.push({
                    img: u.avatar,
                    userName: u.userName,
                    betted: u.s.betted,
                    cashouted: u.s.cashouted,
                    betAmount: u.s.betAmount,
                    cashAmount: u.s.cashAmount,
                    target: u.s.target,
                });
            }
        }
        this._io.emit("previousHand", myPreHand);
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

export default SocketServer;