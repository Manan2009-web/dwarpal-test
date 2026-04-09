const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getDashboardSummary } = require('../services/dashboardService');
const { buildMeta } = require('../utils/pagination');

const getSummary = asyncHandler(async (req, res) => {
  const summary = await getDashboardSummary(req.user);
  return sendSuccess(res, {
    message: 'Dashboard summary fetched successfully',
    data: summary,
    meta: buildMeta({
      since: req.query.since || null
    })
  });
});

module.exports = {
  getSummary
};
