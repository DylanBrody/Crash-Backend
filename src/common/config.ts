import * as dotenv from 'dotenv';
import { resolve } from 'path';

// environment file error should crash whole process
const ENV_FILE_PATH = resolve(".env.development");
const envFound = dotenv.config({ path: ENV_FILE_PATH });
if (envFound.error) {
    throw new Error("Cannot find .env file.");
}

const dbUser = process.env.DB_USER || 'app';
const dbPwd = process.env.DB_PWD || '5uikrEmaEblyTmfa';
const dbHost = process.env.DB_HOST || 'mongo.db.testing.internal';
const dbPort = process.env.DB_PORT || 27017;

export default {
    // express server port
    serverPort: parseInt(process.env.PORT || "5002", 10),
    //mongodb server URL & db_Name
    mongodbURL : process.env.NODE_ENV === 'development'?'mongodb://127.0.0.1:27017':`mongodb://${dbUser}:${dbPwd}@${dbHost}:${dbPort}`,
    dbName : process.env.DB_NAME || 'crash',
    isEnvFound: envFound,
    getBalanceUrl : process.env.GET_BALANCE_URL || 'https://api.testing.dream22.xyz/iGaming/igaming/balance',
    betUrl : process.env.BET_URL || 'https://api.testing.dream22.xyz/iGaming/igaming/bet',
    cancelUrl : process.env.ORDER_URL || 'https://api.testing.dream22.xyz/iGaming/igaming/cancel',
    settleUrl : process.env.REFUND_URL || 'https://api.testing.dream22.xyz/iGaming/igaming/settle'
}

export const currentTime = () => Math.round(new Date().getTime());