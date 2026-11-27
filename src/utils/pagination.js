export function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const sortOrder = String(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const sortBy = typeof query.sortBy === 'string' ? query.sortBy.replace(/[^a-zA-Z0-9_]/g, '') : 'created_at';
  return { page, limit, offset, search, sortBy, sortOrder };
}

export function paginatedResponse(rows, total, { page, limit }) {
  const totalNum = Number(total) || 0;
  return {
    data: rows,
    meta: {
      page,
      limit,
      total: totalNum,
      totalPages: Math.max(1, Math.ceil(totalNum / limit))
    }
  };
}
