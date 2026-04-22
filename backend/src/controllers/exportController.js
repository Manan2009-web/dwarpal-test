const ExportHistory = require('../models/ExportHistory');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { buildExportFileName, parseReportFilters, publicFilterSummary } = require('../utils/reportFilters');
const { fetchReportDataset, getExportOptions, getExportRecords, getReportPreview } = require('../services/reportService');
const { generateExcelBuffer } = require('../services/excelExportService');
const { generatePdfBuffer } = require('../services/pdfExportService');
const { getAdminAccessProfile, hasPermission, normalizeReportType } = require('../utils/adminScope');

function actorSnapshot(user) {
  return {
    id: String(user?._id || user?.id || ''),
    name: user?.fullName || user?.name || '',
    email: user?.email || '',
    role: user?.role || '',
    department: user?.department || '',
    employeeId: user?.employeeId || '',
    enrollmentNo: user?.enrollmentNo || ''
  };
}

async function createHistoryRecord(req, format, filters, fileName) {
  return ExportHistory.create({
    reportType: filters.reportType,
    exportFormat: format,
    filters: publicFilterSummary(filters),
    scope: getAdminAccessProfile(req.user),
    generatedBy: req.user._id,
    generatedBySnapshot: actorSnapshot(req.user),
    fileName,
    status: 'generating',
    generatedAt: new Date()
  });
}

async function markHistorySuccess(history, recordCount, fileName) {
  history.status = 'success';
  history.recordCount = recordCount;
  history.fileName = fileName;
  history.completedAt = new Date();
  await history.save();
}

async function markHistoryFailure(history, error) {
  if (!history) {
    return;
  }

  history.status = 'failed';
  history.errorMessage = error?.message || 'Export failed';
  history.completedAt = new Date();
  await history.save().catch(() => {});
}

const getOptions = asyncHandler(async (req, res) => {
  const options = await getExportOptions(req.user, req.query);
  return sendSuccess(res, {
    message: 'Export options fetched successfully',
    data: options
  });
});

const getPreview = asyncHandler(async (req, res) => {
  const preview = await getReportPreview(req.user, req.method === 'GET' ? req.query : req.body);
  return sendSuccess(res, {
    message: 'Export preview generated successfully',
    data: preview
  });
});

const getRecords = asyncHandler(async (req, res) => {
  const result = await getExportRecords(req.user, req.method === 'GET' ? req.query : req.body);
  return sendSuccess(res, {
    message: 'Export records fetched successfully',
    data: {
      access: result.access,
      filters: result.filters,
      rows: result.rows,
      totals: result.totals,
      summary: result.summary
    },
    meta: result.meta
  });
});

async function sendExport(req, res, format) {
  const filters = parseReportFilters(req.body || {});
  const generatedAt = new Date();
  let fileName = buildExportFileName({ reportType: filters.reportType, format, filters, generatedAt });
  const history = await createHistoryRecord(req, format, filters, fileName);

  try {
    const dataset = await fetchReportDataset(req.user, req.body || {});
    fileName = buildExportFileName({ reportType: dataset.filters.reportType, format, filters: dataset.filters, generatedAt });
    const buffer = format === 'pdf' ? await generatePdfBuffer(dataset) : await generateExcelBuffer(dataset);
    await markHistorySuccess(history, dataset.recordCount, fileName);

    res.setHeader(
      'Content-Type',
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (error) {
    await markHistoryFailure(history, error);
    throw error;
  }
}

const exportExcel = asyncHandler(async (req, res) => {
  return sendExport(req, res, 'excel');
});

const exportPdf = asyncHandler(async (req, res) => {
  return sendExport(req, res, 'pdf');
});

const getHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const role = String(req.user?.role || '').toLowerCase();
  const canViewAll =
    role === 'principal' ||
    role === 'cao' ||
    hasPermission(req.user, 'export:history:all') ||
    hasPermission(req.user, 'admin:history');
  const filter = canViewAll ? {} : { generatedBy: req.user._id };
  const reportType = normalizeReportType(req.query.reportType || '');

  if (req.query.format) {
    filter.exportFormat = String(req.query.format).trim().toLowerCase();
  }

  if (reportType && reportType !== 'all_gatepasses') {
    filter.reportType = reportType;
  }

  const [history, total] = await Promise.all([
    ExportHistory.find(filter)
      .populate('generatedBy', 'fullName role email department employeeId enrollmentNo')
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ExportHistory.countDocuments(filter)
  ]);

  return sendSuccess(res, {
    message: 'Export history fetched successfully',
    data: history,
    meta: buildPaginationMeta(total, page, limit)
  });
});

module.exports = {
  exportExcel,
  exportPdf,
  getHistory,
  getOptions,
  getRecords,
  getPreview
};
