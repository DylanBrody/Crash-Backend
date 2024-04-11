import { Socket as SocketT} from 'socket.io';
import { historyType, UserType } from "./interfaces/bridgeData";
import { GameState } from './constants';
interface Global {
    //base
    _roundId: number;
    _countNo: number;
    _realRTP: number;
    _totalBetAmount: number;
    //common
    _sockets: SocketT [];
    _history: historyType[];
    _users: { [key: string]: UserType },
    _cashoutAmount: number;
    _currentNum: number;
    _currentSecondNum: number;
    _gameState: string;
    _target: number;
}

export const global = {
    //base
    _roundId: 0,
    _countNo: 0,
    _realRTP: -1,
    _totalBetAmount: 0,
    //common
    _sockets: [],
    _history: [],
    _users: {},
    _cashoutAmount: 0,
    _currentNum: 0,
    _currentSecondNum: 0,
    _gameState: GameState.BET,
    _target: -1,
} as Global;