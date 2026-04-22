const ExcelJS = require('exceljs');
const {
  buildCombinedOverviewRows,
  buildDetailedActivityRows,
  buildFacultyOverviewRows,
  buildStudentOverviewRows,
  buildUserExportSections
} = require('./reportService');

const STATUS_FILLS = {
  approved: 'D8F3DC',
  rejected: 'F8D7DA',
  pending: 'FFF3CD',
  out: 'DDEBFF',
  returned: 'E2E3E5'
};

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date;
}

function stringify(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function safeSheetName(value, fallback = 'Sheet') {
  const cleaned = String(value || fallback)
    .replace(/[:\\/?*[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31);

  return cleaned || fallback;
}

function applyHeaderStyle(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F5A80' }
  };
  row.alignment = { vertical: 'middle', wrapText: true };
}

function styleWorksheet(sheet) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E6EC' } },
        left: { style: 'thin', color: { argb: 'FFE0E6EC' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E6EC' } },
        right: { style: 'thin', color: { argb: 'FFE0E6EC' } }
      };
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  sheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value instanceof Date ? '00/00/0000 00:00' : stringify(cell.value);
      maxLength = Math.max(maxLength, Math.min(value.length + 2, 44));
    });
    column.width = maxLength;
  });

  if (sheet.rowCount > 1 && sheet.columnCount > 1) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount }
    };
  }
}

function statusTone(value) {
  const status = String(value || '').toLowerCase();
  if (status.includes('approved')) return 'approved';
  if (status.includes('rejected')) return 'rejected';
  if (status.includes('pending') || status.includes('forwarded')) return 'pending';
  if (status.includes('out')) return 'out';
  if (status.includes('returned') || status.includes('completed')) return 'returned';
  return '';
}

function colorStatusCell(cell) {
  const tone = statusTone(cell.value);
  if (!tone) {
    return;
  }

  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${STATUS_FILLS[tone]}` }
  };
  cell.font = { bold: true, color: { argb: 'FF173449' } };
}

function addRowsSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(safeSheetName(name));
  sheet.addRow(columns.map((column) => column.header));
  applyHeaderStyle(sheet.getRow(1));

  rows.forEach((row) => {
    const addedRow = sheet.addRow(columns.map((column) => row[column.key] ?? ''));

    columns.forEach((column, index) => {
      const cell = addedRow.getCell(index + 1);

      if (column.type === 'date' && cell.value instanceof Date) {
        cell.numFmt = 'dd-mmm-yyyy hh:mm';
      }

      if (column.status) {
        colorStatusCell(cell);
      }
    });
  });

  if (!rows.length) {
    sheet.addRow(['No records found for the selected filters.']);
  }

  styleWorksheet(sheet);
  return sheet;
}

function addKeyValueSheet(workbook, name, title, entries) {
  const sheet = workbook.addWorksheet(safeSheetName(name));
  sheet.mergeCells('A1:B1');
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF173449' } };
  sheet.getCell('A1').alignment = { vertical: 'middle' };
  sheet.addRow([]);
  sheet.addRow(['Metric', 'Value']);
  applyHeaderStyle(sheet.getRow(3));

  entries.forEach(([label, value]) => {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };

    if (row.getCell(2).value instanceof Date) {
      row.getCell(2).numFmt = 'dd-mmm-yyyy hh:mm';
    }
  });

  styleWorksheet(sheet);
  sheet.views = [{ state: 'frozen', ySplit: 3 }];
  return sheet;
}

function describeScope(scope) {
  if (!scope) return '';
  const assigned = Array.isArray(scope.assignedClasses)
    ? scope.assignedClasses
        .map((item) => [item.department, item.semester ? `Sem ${item.semester}` : '', item.division].filter(Boolean).join(' '))
        .join('; ')
    : '';
  return assigned || [scope.department, scope.semester ? `Sem ${scope.semester}` : '', scope.division].filter(Boolean).join(' ');
}

function toStudentRows(dataset) {
  return buildStudentOverviewRows(dataset).map((item, index) => ({
    srNo: index + 1,
    fullName: item.name,
    enrollmentNo: item.primaryId,
    department: item.department,
    program: item.program,
    semester: item.semester,
    phone: item.phone,
    email: item.email,
    totalGatepasses: item.totalGatepasses,
    approvedCount: item.approvedCount,
    rejectedCount: item.rejectedCount,
    pendingCount: item.pendingCount,
    outCount: item.outCount,
    returnedCount: item.returnedCount,
    lastActivityAt: formatDate(item.lastActivityAt)
  }));
}

function toFacultyRows(dataset) {
  return buildFacultyOverviewRows(dataset).map((item, index) => ({
    srNo: index + 1,
    fullName: item.name,
    employeeId: item.primaryId,
    department: item.department,
    roleType: item.roleType,
    coordinator: item.isCoordinator ? 'Yes' : 'No',
    phone: item.phone,
    email: item.email,
    totalRequests: item.totalRequests,
    totalGatepasses: item.totalGatepasses,
    leaveRequestsCount: item.leaveRequestsCount,
    approvedCount: item.approvedCount,
    rejectedCount: item.rejectedCount,
    pendingCount: item.pendingCount,
    outCount: item.outCount,
    returnedCount: item.returnedCount,
    loadAdjustmentCount: item.loadAdjustmentCount,
    lastActivityAt: formatDate(item.lastActivityAt)
  }));
}

function toMixedRows(dataset) {
  return buildCombinedOverviewRows(dataset).map((item, index) => ({
    srNo: index + 1,
    userType: item.userType,
    roleType: item.roleType,
    fullName: item.name,
    primaryId: item.primaryId,
    department: item.department,
    program: item.program,
    semester: item.semester,
    phone: item.phone,
    email: item.email,
    totalRequests: item.totalRequests,
    approvedCount: item.approvedCount,
    rejectedCount: item.rejectedCount,
    pendingCount: item.pendingCount,
    outCount: item.outCount,
    returnedCount: item.returnedCount,
    lastActivityAt: formatDate(item.lastActivityAt)
  }));
}

function toDetailedRows(dataset) {
  return buildDetailedActivityRows(dataset).map((item, index) => ({
    srNo: index + 1,
    requestType: item.requestType,
    userType: item.userType,
    fullName: item.name,
    primaryId: item.primaryId,
    department: item.department,
    program: item.program,
    semester: item.semester,
    phone: item.phone,
    email: item.email,
    gatepassId: item.gatepassId,
    gatepassDate: formatDate(item.gatepassDate),
    outTime: item.outTime,
    returnTime: item.returnTime,
    actualReturnTime: formatDate(item.actualReturnTime),
    reason: item.reason,
    destination: item.destination,
    vehicleNumber: item.vehicleNumber,
    approvalStatus: item.approvalStatus,
    actionBy: item.actionBy,
    rejectionReason: item.rejectionReason,
    currentWorkflowStage: item.currentWorkflowStage,
    createdAt: formatDate(item.createdAt),
    updatedAt: formatDate(item.updatedAt)
  }));
}

function addUserSectionSheet(workbook, section, index = 0) {
  const sheet = workbook.addWorksheet(safeSheetName(section.primaryId || section.name, `Record ${index + 1}`));
  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = `DwarPal Detailed Record - ${section.name}`;
  sheet.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF173449' } };
  sheet.addRow([]);
  sheet.addRow(['User Type', section.userType, 'Role Type', section.roleType, 'Primary ID', section.primaryId]);
  sheet.addRow(['Department', section.department, 'Program', section.program, 'Semester', section.semester]);
  sheet.addRow(['Phone', section.phone, 'Email', section.email, 'Coordinator', section.isCoordinator ? 'Yes' : 'No']);
  sheet.addRow(['Total Requests', section.totalRequests, 'Approved', section.approvedCount, 'Rejected', section.rejectedCount]);
  sheet.addRow(['Pending', section.pendingCount, 'Out', section.outCount, 'Returned', section.returnedCount]);
  if (section.assignedScope) {
    sheet.addRow(['Assigned Scope', describeScope(section.assignedScope)]);
  }
  sheet.addRow([]);

  const detailHeaders = [
    'Request Type',
    'Gatepass ID',
    'Date',
    'Out Time',
    'Return Time',
    'Actual Return Time',
    'Reason',
    'Destination',
    'Vehicle Number',
    'Status',
    'Actioned By',
    'Rejection Reason',
    'Workflow Stage',
    'Created At',
    'Updated At'
  ];
  const headerRowIndex = sheet.rowCount + 1;
  sheet.addRow(detailHeaders);
  applyHeaderStyle(sheet.getRow(headerRowIndex));

  section.details.forEach((detail) => {
    const row = sheet.addRow([
      detail.requestType,
      detail.gatepassId,
      formatDate(detail.gatepassDate),
      detail.outTime,
      detail.returnTime,
      formatDate(detail.actualReturnTime),
      detail.reason,
      detail.destination,
      detail.vehicleNumber,
      detail.approvalStatus,
      detail.actionBy,
      detail.rejectionReason,
      detail.currentWorkflowStage,
      formatDate(detail.createdAt),
      formatDate(detail.updatedAt)
    ]);
    colorStatusCell(row.getCell(10));
  });

  if (!section.details.length) {
    sheet.addRow(['No detailed records found for this user.']);
  }

  styleWorksheet(sheet);
}

function createWorkbook(dataset) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DwarPal';
  workbook.lastModifiedBy = dataset.actor?.name || 'DwarPal';
  workbook.created = dataset.generatedAt;
  workbook.modified = dataset.generatedAt;
  workbook.properties.date1904 = false;
  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook;
}

async function generateExcelBuffer(dataset) {
  const workbook = createWorkbook(dataset);
  const summaryEntries = [
    ['Report Type', dataset.filters.reportType],
    ['Record Partition', dataset.filters.recordPartition],
    ['Export Scope', dataset.filters.exportScope],
    ['Detail Level', dataset.filters.detailLevel],
    ['Department', dataset.publicFilters.department || 'All'],
    ['Program', dataset.publicFilters.program || 'All'],
    ['Semester', dataset.publicFilters.semester || 'All'],
    ['Status', dataset.publicFilters.status || 'All'],
    ['User Records', dataset.userRecordCount],
    ['Detailed Records', dataset.recordCount],
    ['Total Approved', dataset.dashboardSummary.totalApproved],
    ['Total Rejected', dataset.dashboardSummary.totalRejected],
    ['Total Pending', dataset.dashboardSummary.totalPending],
    ['Total Out', dataset.dashboardSummary.totalOut],
    ['Total Returned', dataset.dashboardSummary.totalReturned],
    ['Generated By', dataset.actor?.name || 'Admin'],
    ['Generated At', formatDate(dataset.generatedAt)]
  ];

  const studentRows = toStudentRows(dataset);
  const facultyRows = toFacultyRows(dataset);
  const mixedRows = toMixedRows(dataset);
  const detailedRows = toDetailedRows(dataset);
  const addSummarySheets = dataset.filters.detailLevel !== 'detailed_only';
  const addDetailSheets = dataset.filters.detailLevel !== 'summary_only';

  if (addSummarySheets) {
    addKeyValueSheet(workbook, 'Export Summary', 'DwarPal Export Summary', summaryEntries);
  }

  if (addSummarySheets && studentRows.length && dataset.filters.recordPartition !== 'faculty') {
    addRowsSheet(
      workbook,
      'Student Overview',
      [
        { header: 'Sr No', key: 'srNo' },
        { header: 'Full Name', key: 'fullName' },
        { header: 'Enrollment Number', key: 'enrollmentNo' },
        { header: 'Department', key: 'department' },
        { header: 'Program', key: 'program' },
        { header: 'Semester', key: 'semester' },
        { header: 'Phone', key: 'phone' },
        { header: 'Email', key: 'email' },
        { header: 'Total Gatepasses', key: 'totalGatepasses' },
        { header: 'Approved', key: 'approvedCount' },
        { header: 'Rejected', key: 'rejectedCount' },
        { header: 'Pending', key: 'pendingCount' },
        { header: 'Out', key: 'outCount' },
        { header: 'Returned', key: 'returnedCount' },
        { header: 'Last Activity', key: 'lastActivityAt', type: 'date' }
      ],
      studentRows
    );
  }

  if (addSummarySheets && facultyRows.length && dataset.filters.recordPartition !== 'students') {
    addRowsSheet(
      workbook,
      'Faculty Overview',
      [
        { header: 'Sr No', key: 'srNo' },
        { header: 'Full Name', key: 'fullName' },
        { header: 'Employee ID', key: 'employeeId' },
        { header: 'Department', key: 'department' },
        { header: 'Role Type', key: 'roleType' },
        { header: 'Coordinator', key: 'coordinator' },
        { header: 'Phone', key: 'phone' },
        { header: 'Email', key: 'email' },
        { header: 'Total Requests', key: 'totalRequests' },
        { header: 'Total Gatepasses', key: 'totalGatepasses' },
        { header: 'Leave Requests', key: 'leaveRequestsCount' },
        { header: 'Approved', key: 'approvedCount' },
        { header: 'Rejected', key: 'rejectedCount' },
        { header: 'Pending', key: 'pendingCount' },
        { header: 'Out', key: 'outCount' },
        { header: 'Returned', key: 'returnedCount' },
        { header: 'Load Adjustments', key: 'loadAdjustmentCount' },
        { header: 'Last Activity', key: 'lastActivityAt', type: 'date' }
      ],
      facultyRows
    );
  }

  if (addSummarySheets && mixedRows.length && dataset.filters.recordPartition === 'mixed') {
    addRowsSheet(
      workbook,
      'Mixed Overview',
      [
        { header: 'Sr No', key: 'srNo' },
        { header: 'User Type', key: 'userType' },
        { header: 'Role Type', key: 'roleType' },
        { header: 'Full Name', key: 'fullName' },
        { header: 'Primary ID', key: 'primaryId' },
        { header: 'Department', key: 'department' },
        { header: 'Program', key: 'program' },
        { header: 'Semester', key: 'semester' },
        { header: 'Phone', key: 'phone' },
        { header: 'Email', key: 'email' },
        { header: 'Total Requests', key: 'totalRequests' },
        { header: 'Approved', key: 'approvedCount' },
        { header: 'Rejected', key: 'rejectedCount' },
        { header: 'Pending', key: 'pendingCount' },
        { header: 'Out', key: 'outCount' },
        { header: 'Returned', key: 'returnedCount' },
        { header: 'Last Activity', key: 'lastActivityAt', type: 'date' }
      ],
      mixedRows
    );
  }

  if (addDetailSheets) {
    addRowsSheet(
      workbook,
      'Detailed Gatepass Records',
      [
        { header: 'Sr No', key: 'srNo' },
        { header: 'Request Type', key: 'requestType' },
        { header: 'User Type', key: 'userType' },
        { header: 'Full Name', key: 'fullName' },
        { header: 'Primary ID', key: 'primaryId' },
        { header: 'Department', key: 'department' },
        { header: 'Program', key: 'program' },
        { header: 'Semester', key: 'semester' },
        { header: 'Phone', key: 'phone' },
        { header: 'Email', key: 'email' },
        { header: 'Gatepass ID', key: 'gatepassId' },
        { header: 'Gatepass Date', key: 'gatepassDate', type: 'date' },
        { header: 'Out Time', key: 'outTime' },
        { header: 'Return Time', key: 'returnTime' },
        { header: 'Actual Return Time', key: 'actualReturnTime', type: 'date' },
        { header: 'Reason', key: 'reason' },
        { header: 'Destination', key: 'destination' },
        { header: 'Vehicle Number', key: 'vehicleNumber' },
        { header: 'Approval Status', key: 'approvalStatus', status: true },
        { header: 'Approved / Rejected By', key: 'actionBy' },
        { header: 'Rejection Reason', key: 'rejectionReason' },
        { header: 'Current Workflow Stage', key: 'currentWorkflowStage' },
        { header: 'Created At', key: 'createdAt', type: 'date' },
        { header: 'Updated At', key: 'updatedAt', type: 'date' }
      ],
      detailedRows
    );
  }

  if (dataset.filters.includeSeparateStudentSheets || dataset.filters.exportScope === 'selected') {
    buildUserExportSections(dataset)
      .slice(0, dataset.filters.includeSeparateStudentSheets ? 20 : 8)
      .forEach((section, index) => addUserSectionSheet(workbook, section, index));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

module.exports = {
  generateExcelBuffer,
  safeSheetName
};
