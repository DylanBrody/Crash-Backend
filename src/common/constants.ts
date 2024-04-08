export enum BettingConfig {
    BETTING_MIN = 10,
    BETTING_MAX = 100000,
    RTP = 96,
    COMBOLIMIT = 10
}

export enum SocketOnEvent {
    CONNECTION = 'connection',
    DISCONNECT = 'disconnect',
    ENTER_ROOM = 'enterRoom',
    PLAY_BET = 'playBet',
    CASH_OUT = 'cashOut'
};

export enum SocketEmitEvent {
    GETBETLIMITS = 'getBetLimits',
    MYINFO = 'myInfo',
    HISTORY = 'history',
    GAMESTATE = 'gameState',
    DENY = 'deny',
    MYBETSTATE = 'myBetState',
    ERROR = 'error'
};

export enum GameState {
    READY = 'READY',
    BET = 'BET',
    PLAYING = 'PLAYING',
    GAMEEND = 'GAMEEND'
}

export enum GameTime {
    READYTIME = 1000,
    BETINGTIME = 5000,
    GAMEENDTIME = 3000
}

export const DEFAULT_USER = {
    userId: 0,
    userName: 'test',
    balance: 0,
    currency: 'INR',
    avatar: '',
    token: '',
    orderNo: 0,
    socketId: '',
    f: {
        auto: false,
        betted: false,
        cashouted: false,
        betAmount: 0,
        cashAmount: 0,
        target: 0,
    },
    s: {
        auto: false,
        betted: false,
        cashouted: false,
        betAmount: 0,
        cashAmount: 0,
        target: 0,
    }
}

export const SALT = process.env.SALT || '8788abc782ab7f51c089190af7c89e5a795ca48b904129ad62f0a2';