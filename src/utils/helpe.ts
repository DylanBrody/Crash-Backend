import { global } from '../common/gameStateGlobalVariables'
import { GameState } from '../common/constants';

export const getPaginationMeta = (page: number, count: number, limit: number) => {
	const total = Math.ceil(count / limit);
	if (page > total) page = total;
	if (page < 1) page = 1;
	let start = (page - 3) <= 0 ? 1 : (page - 3);
	let last = (start + 5) > total ? total : (start + 5);
	if (last - start < 5) start = (last - 5) <= 0 ? 1 : (last - 5);
	return {page, start, last, total, limit};
}

export const generateRoundID = () => {
	let curTime = new Date();	
	global._roundId++;
	if (global._roundId > 6000) {
		global._roundId = 0;
	}
	return curTime.getFullYear().toString() + (curTime.getMonth() + 1).toString() + curTime.getMonth().toString() + String(global._roundId).padStart(4, '0');
}

export const getRealRTP = () => {
	if (global._totalBetAmount == 0) return global._realRTP;
	if (global._realRTP > -1) return Math.round((global._realRTP + global._cashoutAmount / global._totalBetAmount * 100) / 2 * 100) / 100;
	else return Math.round(global._cashoutAmount / global._totalBetAmount * 10000) / 100;
}

