export const getPaginationMeta = (page: number, count: number, limit: number) => {
	const total = Math.ceil(count / limit);
	if (page > total) page = total;
	if (page < 1) page = 1;
	let start = (page - 3) <= 0 ? 1 : (page - 3);
	let last = (start + 5) > total ? total : (start + 5);
	if (last - start < 5) start = (last - 5) <= 0 ? 1 : (last - 5);
	return {page, start, last, total, limit};
}