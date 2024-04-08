import * as socketIo from 'socket.io';
import { Server } from 'http';
import { prcTimeout } from 'precision-timeout-interval';
import * as isaac from 'isaac';
import { getTime } from '../utils/math';
import { addHistory } from '../api/models';
import { DEFAULT_USER, BettingConfig, GameState, GameTime, SALT } from '../common/constants';
import { getUserInfo, bet, settle, cancelBet } from '../api/controllers/client';
import { UserType, historyType, preHandType, gameStateType } from '../common/interfaces/bridgeData';

class SocketServer {

    private _io: SocketIO.Server;
    private _sockets: SocketIO.Socket [];
    private _users: { [key: string]: UserType };
    private _history: historyType [];
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

    constructor(server: Server, option: object) {
        this._startTime = Date.now();
        this._previousHand = this._users;
        this._gameState = GameState.BET;
        this._cashoutAmount = 0;
        this._totalBetAmount = 0;
        this._target = -1;
        this._realRTP = -1;
        this._countNo = 0;
        this._roundId = 0;
        this._io = socketIo(server, option);
        //this.gameRun();
        this.listen();
    }

    private listen(): void {

        this._io;

        if (this._io) {
            console.log('Running Socket Server is listening.');
        }
    }

    private generateRoundID = () => {
        let curTime = new Date();
        this._roundId++;
        if(this._roundId > 6000 ) {
            this._roundId = 0;
        }
        return curTime.getFullYear().toString() +  (curTime.getMonth() + 1).toString() + curTime.getMonth().toString() + String( this._roundId ).padStart(4, '0');
    }

    private gameRun = async () => {
        prcTimeout(20, ()=>{ this.gameRun() });
    
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
                        gameState: this._gameState,
                        time: time
                    } as gameStateType);
                }
                break;
                case GameState.READY:
                    if(this._target == -1) {
                        this._countNo++;
                        if(this._countNo > 10000000) {
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
                            gameState: this._gameState,
                            time: time
                        } as gameStateType);
                    }
                break;
            case GameState.PLAYING:
                var currentTime = (Date.now() - this._startTime) / 1000;
                this._currentNum = 1 + 0.06 * currentTime + Math.pow((0.06 * currentTime), 2) - Math.pow((0.04 * currentTime), 3) + Math.pow((0.04 * currentTime), 4)
                for (const k in this._users) {
                    const i = this._users[k];
                    if (i.f.target>=1.01 && i.f.betted && !i.f.cashouted && this._target>=i.f.target && this._currentNum>=i.f.target) {
                        console.log( "aaa", i.f.target>=1.01 && i.f.betted && !i.f.cashouted && this._target>=i.f.target && this._currentNum>=i.f.target );
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
                    if (i.s.target>=1.01 && i.s.betted && !i.s.cashouted && this._target>=i.s.target && this._currentNum>=i.s.target) {
                        console.log( "bbb", i.f.target>=1.01 && i.f.betted && !i.f.cashouted && this._target>=i.f.target && this._currentNum>=i.f.target );
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
                if(this._currentNum > Math.floor(Math.random() * 51) + 250 && this.getRealRTP() > BettingConfig.RTP) {
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
                        gameState: this._gameState,
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
                    let newhistory : historyType = {
                        betid: betid,
                        history: this._target
                    }
                    this._history.unshift( newhistory );
                    this._io.emit("history", this._history.slice(0, 500));
                    const time = Date.now() - this._startTime;
                    this._io.emit('gameState', {
                        currentNum: this._currentNum,
                        currentSecondNum: this._currentSecondNum,
                        gameState: this._gameState,
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
        if(this._totalBetAmount == 0) return this._realRTP;
        if(this._realRTP > -1) return Math.round((this._realRTP + this._cashoutAmount / this._totalBetAmount * 100) / 2 * 100) / 100;
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

    get instance(): SocketIO.Server {
        return this._io;
    }
}

export default SocketServer;