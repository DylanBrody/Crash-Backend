export interface UserType {
    userId: number
    userName: string
    balance: number
    currency: string
    avatar: string
    token: string
    orderNo: number
    socketId: string
    f: {
        auto: boolean
        betted: boolean
        cashouted: boolean
        betAmount: number
        cashAmount: number
        target: number
    }
    s: {
        auto: boolean
        betted: boolean
        cashouted: boolean
        betAmount: number
        cashAmount: number
        target: number
    }
}

export interface preHandType {
    img: string
    userName: string
    betted: boolean
    cashouted: boolean
    betAmount: number
    cashAmount: number
    target: number
}

export interface historyType {
    betid : string
    history: number
}

export interface gameStateType {
    currentNum: number
    currentSecondNum: number
    gameState: string
    time: number
}