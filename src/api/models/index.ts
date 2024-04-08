import { MongoClient } from 'mongodb';
import config, { currentTime } from '../../common/config';
import { BettingConfig } from '../../common/constants';

const client = new MongoClient(config.mongodbURL);
const db = client.db(config.dbName);

console.log(config.mongodbURL);
export const DUsers = db.collection<SchemaUser>('users');
export const DGame = db.collection<SchemaGame>('game');
export const DHistories = db.collection<SchemaHistory>('histories');

export const DEFAULT_GAMEID = 1;

const lastIds = {
    lastHistoryId: 0,
    lastUserId: 0
}

export const connect = async () => {
    try {
        await client.connect();
        await DUsers.createIndex({ name: 1 }, { unique: true, name: 'users-name' });
        await DHistories.createIndex({ name: 1 }, { unique: false, name: 'logs-name' });
        await DHistories.createIndex({ date: 1 }, { unique: false, name: 'logs-date' });

        const d = await DHistories.aggregate([{ $group: { _id: null, max: { $max: "$_id" } } }]).toArray();
        lastIds.lastHistoryId = d?.[0]?.max || 0
        const d1 = await DUsers.aggregate([{ $group: { _id: null, max: { $max: "$_id" } } }]).toArray();
        lastIds.lastUserId = d1?.[0]?.max || 0
        return true;
    } catch (error) {
        console.log('mongodb-initialization', error)
        return error;
    }
}

export const getBettingAmounts = async () => {
    try {
        const d = await DGame.findOne({ _id: DEFAULT_GAMEID })
        const minBetAmount = d?.minBetAmount || BettingConfig.BETTING_MIN;
        const maxBetAmount = d?.maxBetAmount || BettingConfig.BETTING_MAX;
        return { minBetAmount, maxBetAmount }
    } catch (error) {
        console.log('addHistory', error)
        return { minBetAmount: BettingConfig.BETTING_MIN, maxBetAmount: BettingConfig.BETTING_MAX }
    }

}

export const addHistory = async (userId: number, betAmount: number, cashoutAt: number, cashouted: boolean) => {
    try {
        await DHistories.insertOne({
            _id: ++lastIds.lastHistoryId,
            userId,
            betAmount,
            cashoutAt,
            cashouted,
            date: currentTime()
        })
        return true
    } catch (error) {
        console.log('addHistory', error)
        return false
    }
}

export const addUser = async (name: string, userId: string, img: string, currency: string) => {
    try {
        const now = currentTime()
        await DUsers.insertOne({
            _id: ++lastIds.lastUserId,
            name,
            img,
            userId,
            currency,
            updated: now,
            created: now
        })
        return true
    } catch (error) {
        console.log('addUser', error)
        return false
    }
}

export const updateUserBalance = async (name: string, balance: number) => {
    try {
        await DUsers.updateOne({ name }, { $set: { balance } })
        return true
    } catch (error) {
        console.log('updateUserBalance', error)
        return false
    }
}