function getPagination(query, options = {}) {
  const defaultLimit = options.defaultLimit || 10;
  const maxLimit = options.maxLimit || 100;

  const page = Math.max(Number(query.page) || 1, 1);
  const requestedLimit = Math.max(Number(query.limit) || defaultLimit, 1);
  const limit = Math.min(requestedLimit, maxLimit);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip
  };
}

function buildPaginationMeta(total, page, limit) {
  const lastUpdated = new Date().toISOString();
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return {
    total,
    totalRecords: total,
    page,
    currentPage: page,
    limit,
    totalPages,
    lastUpdated
  };
}

function buildMeta(overrides = {}) {
  return {
    lastUpdated: new Date().toISOString(),
    ...overrides
  };
}

function getSortOptions(
  query,
  {
    allowedFields = ['updatedAt', 'createdAt'],
    defaultSortBy = 'updatedAt',
    defaultOrder = 'desc'
  } = {}
) {
  const requestedField = query.sortBy && allowedFields.includes(query.sortBy) ? query.sortBy : defaultSortBy;
  const requestedOrder = query.order === 'asc' ? 1 : query.order === 'desc' ? -1 : defaultOrder === 'asc' ? 1 : -1;

  return {
    [requestedField]: requestedOrder,
    _id: requestedOrder
  };
}

module.exports = {
  buildMeta,
  buildPaginationMeta,
  getPagination,
  getSortOptions
};
