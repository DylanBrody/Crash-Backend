import { Server as SocketServerT } from 'socket.io';
import { prcTimeout } from 'precision-timeout-interval';
import * as isaac from 'isaac';
import { getTime } from '../utils/math';
import { addHistory } from '../api/models';
import { BettingConfig, GameState, GameTime, SALT } from '../common/constants';
import { settle } from '../api/controllers/client';
import { UserType, historyType, preHandType, gameStateType } from '../common/interfaces/bridgeData';
import { generateRoundID, getRealRTP } from '../utils/helpe';
import { global } from '../common/GameStateGlobalVariables';


class GameStateManager {

    private _io: SocketServerT;
    private _startTime: number;
    private _previousHand: { [key: string]: UserType };
    private _gameTime: number;
    private _countNo: number;

    constructor(io: SocketServerT) {
        this._io = io;
        this._startTime = Date.now();
        this._previousHand = global._users;
        this._countNo = 0;
    }

    public gameRun = async () => {
        prcTimeout(20, () => { this.gameRun() });
        switch (global._gameState) {
            case GameState.BET:
                this.transitionToReadyState();
                break;
            case GameState.READY:
                if (global._target == -1) {
                    this.generateTargetNumber();
                }
                if (Date.now() - this._startTime > GameTime.READYTIME) {
                    this.transitionToPlayingState();
                }
                break;
            case GameState.PLAYING:
                this.updatePlayingState();
                break;
            case GameState.GAMEEND:
                if (Date.now() - this._startTime > GameTime.GAMEENDTIME) {
                    this.transitionToBetState();
                }
                break;
        }
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

    private transitionToReadyState(): void {
        if (Date.now() - this._startTime > GameTime.BETINGTIME) {
            global._currentNum = 1;
            global._gameState = GameState.READY;
            this._startTime = Date.now();
            const time = Date.now() - this._startTime;
            this._io.emit('gameState', {
                currentNum: global._currentNum,
                currentSecondNum: global._currentSecondNum,
                GameState: global._gameState,
                time: time
            } as gameStateType);
        }
    }

    private transitionToPlayingState(): void {
        global._gameState = GameState.PLAYING;
        this._startTime = Date.now();
        const time = Date.now() - this._startTime;
        this._gameTime = getTime(global._target);
        this._io.emit('gameState', {
            currentNum: global._currentNum,
            currentSecondNum: global._currentSecondNum,
            GameState: global._gameState,
            time: time
        } as gameStateType);
    }

    private updatePlayingState(): void {
        var currentTime = (Date.now() - this._startTime) / 1000;
        global._currentNum = 1 + 0.06 * currentTime + Math.pow((0.06 * currentTime), 2) - Math.pow((0.04 * currentTime), 3) + Math.pow((0.04 * currentTime), 4)
        for (const k in global._users) {
            const i = global._users[k];
            if (i.f.target >= 1.01 && i.f.betted && !i.f.cashouted && global._target >= i.f.target && global._currentNum >= i.f.target) {
                console.log("aaa", i.f.target >= 1.01 && i.f.betted && !i.f.cashouted && global._target >= i.f.target && global._currentNum >= i.f.target);
                settle(i.orderNo, i.f.target * i.f.betAmount, i.token);
                i.f.cashouted = true;
                i.f.cashAmount = i.f.target * i.f.betAmount;
                i.f.betted = false;
                i.balance += i.f.target * i.f.betAmount;
                i.orderNo = 0;
                global._cashoutAmount += i.f.target * i.f.betAmount;
                this._io.emit("finishGame", i);
                this._io.emit("success", `Successfully CashOuted ${Number(i.f.cashAmount).toFixed(2)}`);
            }
            if (i.s.target >= 1.01 && i.s.betted && !i.s.cashouted && global._target >= i.s.target && global._currentNum >= i.s.target) {
                console.log("bbb", i.f.target >= 1.01 && i.f.betted && !i.f.cashouted && global._target >= i.f.target && global._currentNum >= i.f.target);
                settle(i.orderNo, i.s.target * i.s.betAmount, i.token);
                i.s.cashouted = true;
                i.s.cashAmount = i.s.target * i.s.betAmount;
                i.s.betted = false;
                i.balance += i.s.target * i.s.betAmount;
                i.orderNo = 0;
                global._cashoutAmount += i.s.target * i.s.betAmount;
                this._io.emit("finishGame", i);
                this._io.emit("success", `Successfully CashOuted ${Number(i.s.cashAmount).toFixed(2)}`);
            }
        }
        if (global._currentNum > Math.floor(Math.random() * 51) + 250 && getRealRTP() > BettingConfig.RTP) {
            global._target = Math.round(global._currentNum * 100) / 100;
            this._gameTime = getTime(global._target);
        }
        global._currentSecondNum = global._currentNum;
        if (currentTime > this._gameTime) {
            this.sendPreviousHand();
            global._currentSecondNum = 0;
            global._currentNum = global._target;
            global._gameState = GameState.GAMEEND;
            this._startTime = Date.now();
            for (const k in global._users) {
                const i = global._users[k];
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
                global._sockets.map((socket) => {
                    if (socket.id === i.socketId && (fBetted || sBetted)) {
                        socket.emit("finishGame", i);
                    }
                })
            }

            const time = Date.now() - this._startTime;
            this._io.emit('gameState', {
                currentNum: global._currentNum,
                currentSecondNum: global._currentSecondNum,
                GameState: global._gameState,
                time: time
            } as gameStateType);
        }
    }

    private generateTargetNumber(): void {
        this._countNo++;
        if (this._countNo > 10000000) {
            isaac.reset();
            isaac.seed(SALT);
            this._countNo = 0;
        }

        let X = isaac.random();
        X = parseFloat(X.toPrecision(9));
        X = BettingConfig.RTP / (1 - X);
        global._target = Math.max(1, Math.floor(X) / 100);
        global._target = Math.min(999.99, Math.floor(X) / 100);
    }

    private transitionToBetState(): void {
        let i = 0;
        let interval = setInterval(() => {
            i++;
            if (i > 19)
                clearInterval(interval);
        }, 100)
        this._startTime = Date.now();
        global._gameState = GameState.BET;
        let betid = generateRoundID();
        let newhistory: historyType = {
            betid: betid,
            history: global._target
        }
        global._history.unshift(newhistory);
        this._io.emit("history", global._history.slice(0, 500));
        const time = Date.now() - this._startTime;
        this._io.emit('gameState', {
            currentNum: global._currentNum,
            currentSecondNum: global._currentSecondNum,
            GameState: global._gameState,
            time: time
        } as gameStateType);
        global._target = -1;
        global._realRTP = getRealRTP();
        global._cashoutAmount = 0;
        global._totalBetAmount = 0;
    }
}

export default GameStateManager;