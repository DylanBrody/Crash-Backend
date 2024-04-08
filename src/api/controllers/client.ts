import { Request, Response } from 'express';
import { DEFAULT_GAMEID, DGame, DHistories, DUsers, getBettingAmounts, addUser } from '../models';
import axios from 'axios';
import config from '../../common/config';

if (config.isEnvFound.error) {
    throw new Error("Cannot find .env file.");
}
let num = 0;

const makeTestUser = async () => {
    const user = await DUsers.findOne({ "userId": "1" });
    if (!user) {
        await addUser("test-user", "1", "", "INR")
    } 
    const user1 = await DUsers.findOne({ "userId": "1" });
    return {
        status: true,
        data: {
            userId: user1?.userId,
            userName: "test-user",
            avatar: "",
            balance: 500000,
            currency: "INR",
        }
    };
}

const generateOrderNo = (  ) => {
    let curTime = Date.now();
    num++;
    if(num === 10000) {
        num = 0;
    }
    let number = String( num ).padStart(4, '0');
    return `${ curTime }${ number }`;
}

const timeHistory = async (res: any, req: any, t: number) => {
    try {
        let nowDate_ = Date.now();
        let nowDate = Math.round(nowDate_ / 1000)
        let oneDay = 60 * 60 * 24 * t;
        const result = await DHistories.find({ cashouted: true, date: { $gte: (nowDate - oneDay), $lt: nowDate } }).sort({ cashoutAt: -1 }).limit(20).toArray()
        res.json({ status: true, data: result });
    } catch (error) {
        console.log('myInfo', error)
        res.json({ status: false });
    }
}

export const getUserInfo = async (token: string) => {
    try {
        const resData = await axios.post(config.getBalanceUrl, {
            gameCode: 'Crash',
            // token: testToken
            token
        })
        const _data = resData.data.data;
        if (!resData.data.success) {
            return await makeTestUser();
        }

        const userData = await DUsers.findOne({ "userId": _data.userId });
        if(!userData) {
            await addUser(_data.userName, _data.userId, _data.avatar, _data.currency)
            console.log('add-user', _data.userId, _data.userBalance)
        }

        return {
            status: true,
            data: {
                userId: _data.userId,
                userName: _data.userName,
                avatar: _data.avatar,
                balance: _data.userBalance,
                currency: _data.currency,
            }
        };

    } catch (err) {
        console.log(err);
        return await makeTestUser();
    }
}

export const bet = async (betAmount: number, token: string) => {
    try {
        // const orderNo = Date.now() + Math.floor(Math.random() * 1000);
        let orderNo = generateOrderNo();
        // console.log(orderNo)
        const resData = await axios.post(config.betUrl, {
            gameCode: 'Crash',
            orderNo,
            amount: betAmount,
            // token: testToken
            token
        })
        const _data = resData.data.data;
        if (!resData.data.success) {
            return {
                status: false,
                message: "Service Exception"
            };
        }

        return {
            status: true,
            orderNo: _data.orderNo,
            balance: _data.amount
        };

    } catch (err) {
        return {
            status: false,
            message: "Exception"
        };
    }
}

export const settle = async (orderNo: number, balance: number, token: string) => {
    try {
        const resData = await axios.post(config.settleUrl, {
            gameCode: 'Crash',
            orderNo,
            amount: balance,
            // token: testToken
            token
        })
        const _data = resData.data.data;
        if (!resData.data.success) {
            return {
                status: false,
                message: "Service Exception"
            };
        }

        return {
            status: true,
            balance: _data.amount,
            orderNo: _data.orderNo
        };

    } catch (err) {
        return {
            status: false,
            message: "Exception"
        };
    }
}

export const cancelBet = async (orderNo: number, balance: number, token: string) => {
    try {
        const resData = await axios.post(config.cancelUrl, {
            gameCode: 'Crash',
            orderNo,
            amount: balance,
            // token: testToken
            token
        })
        const _data = resData.data.data;
        if (!resData.data.success) {
            return {
                status: false,
                message: "Service Exception"
            };
        }

        return {
            status: true,
            balance: _data.amount,
            orderNo: _data.orderNo
        };

    } catch (err) {
        return {
            status: false,
            message: "Exception"
        };
    }
}

export const getGameInfo = async (req: Request, res: Response) => {
    try {
        const data = await getBettingAmounts();
        res.json({ status: true, data });
    } catch (error) {
        console.log("getGameInfo", error)
        res.send({ status: false });
    }
}

export const updateGameInfo = async (req: Request, res: Response) => {
    try {
        const { min, max } = req.body as { min: number, max: number }
        const minBetAmount = Number(min)
        const maxBetAmount = Number(max)
        if (isNaN(minBetAmount) || isNaN(maxBetAmount)) return res.status(404).send("invalid paramters")
        await DGame.updateOne({ _id: DEFAULT_GAMEID }, { $set: { minBetAmount, maxBetAmount } }, { upsert: true });
        res.json({ status: true });
    } catch (error) {
        console.log("updateGameInfo", error)
        res.json({ status: false });
    }
}

export const myInfo = async (req: Request, res: Response) => {
    try {
        let { id } = req.body as { id: number };
        if (!id) return res.status(404).send("invalid paramters")
        const data = await DHistories.find({ userId: id }).sort({ date: -1 }).limit(20).toArray();
        res.json({ status: true, data });
    } catch (error) {
        console.log('myInfo', error)
        res.json({ status: false });
    }
}

export const dayHistory = (req: Request, res: Response) => {
    timeHistory(res, req, 1);
}

export const monthHistory = async (req: Request, res: Response) => {
    timeHistory(res, req, 30);
}

export const yearHistory = async (req: Request, res: Response) => {
    timeHistory(res, req, 365);
}