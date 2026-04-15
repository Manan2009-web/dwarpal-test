const ExcelJS = require('exceljs');
const { getLatestApprovedBy, getLatestFacultyApprover, isLateReturn } = require('./reportService');

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
      maxLength = Math.max(maxLength, Math.min(value.length + 2, 46));
    });
    column.width = maxLength;
  });
}

function statusTone(value) {
  const status = String(value || '').toLowerCase();
  if (status.includes('approved')) return 'approved';
  if (status.includes('rejected')) return 'rejected';
  if (status.includes('pending') || status.includes('forwarded')) return 'pending';
  if (status.includes('checked_out')) return 'out';
  if (status.includes('completed') || status.includes('returned')) return 'returned';
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

function addRowsSheet(workbook, name, headers, rows) {
  const sheet = workbook.addWorksheet(safeSheetName(name));
  sheet.addRow(headers);
  applyHeaderStyle(sheet.getRow(1));

  rows.forEach((row) => {
    const values = headers.map((header) => row[header] ?? '');
    const addedRow = sheet.addRow(values);
    headers.forEach((header, index) => {
      if (/status/i.test(header)) {
        colorStatusCell(addedRow.getCell(index + 1));
      }

      if (/date|time|created|updated|generated/i.test(header)) {
        const cell = addedRow.getCell(index + 1);
        if (cell.value instanceof Date) {
          cell.numFmt = 'dd-mmm-yyyy hh:mm';
        }
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

function toStudentSummaryRows(dataset) {
  return dataset.studentSummaries.map((item, index) => ({
    'Sr No': index + 1,
    'Student Name': item.name,
    'Enrollment No': item.enrollmentNo,
    Department: item.department,
    Semester: item.semester,
    'Division/Class': item.division,
    Contact: item.phone,
    'Total Gatepasses': item.totalGatepasses,
    'Approved Count': item.approvedCount,
    'Rejected Count': item.rejectedCount,
    'Pending Count': item.pendingCount,
    'Out Count': item.outCount,
    'Returned Count': item.returnedCount,
    'Late Return Count': item.lateReturnCount,
    'Total Leave Requests': item.totalLeaveRequests,
    'Total Load Adjustments': item.totalLoadAdjustments,
    'Last Gatepass Date': formatDate(item.lastGatepassDate),
    'Most Common Reason': item.mostCommonReason,
    'Coordinator/Class Incharge': item.coordinatorName
  }));
}

function toGatepassDetailRows(dataset) {
  return dataset.gatepasses.map((item, index) => ({
    'Sr No': index + 1,
    'Gatepass ID': item.gatepassId || item.passNumber,
    'Student Name': item.applicantSnapshot?.fullName || item.createdBy?.fullName || '',
    'Enrollment No': item.applicantSnapshot?.enrollmentNo || item.createdBy?.enrollmentNo || item.applicantSnapshot?.employeeId || '',
    Department: item.applicantSnapshot?.department || item.routingSnapshot?.department || '',
    Semester: item.applicantSnapshot?.semester || item.routingSnapshot?.semester || '',
    Division: item.applicantSnapshot?.division || '',
    Date: formatDate(item.outDate),
    'Out Time': item.outTime || '',
    'Return Time': item.expectedReturnTime || '',
    'Actual Return Time': formatDate(item.securityAction?.checkedInAt),
    Reason: item.reason || '',
    Destination: item.destination || '',
    'Vehicle Number': item.vehicleNumber || '',
    Status: item.status || '',
    'Approved By': getLatestApprovedBy(item),
    'Approval Level': item.currentApprovalLevel || '',
    'Rejection Reason': item.rejectionReason || '',
    'Created At': formatDate(item.createdAt),
    'Updated At': formatDate(item.updatedAt)
  }));
}

function describeScope(scope) {
  if (!scope) return '';
  const assigned = Array.isArray(scope.assignedClasses)
    ? scope.assignedClasses.map((item) => [item.department, item.semester ? `Sem ${item.semester}` : '', item.division].filter(Boolean).join(' ')).join('; ')
    : '';
  return assigned || [scope.department, scope.semester ? `Sem ${scope.semester}` : '', scope.division].filter(Boolean).join(' ');
}

function toFacultySummaryRows(dataset) {
  return dataset.facultySummaries.map((item, index) => ({
    'Sr No': index + 1,
    'Faculty Name': item.name,
    'Employee ID': item.employeeId,
    Department: item.department,
    Role: item.role,
    'Is Coordinator': item.isCoordinator ? 'Yes' : 'No',
    'Assigned Class/Scope': describeScope(item.assignedScope),
    'Total Gatepasses': item.totalGatepasses,
    'Approved Count': item.approvedCount,
    'Rejected Count': item.rejectedCount,
    'Pending Count': item.pendingCount,
    'Leave Requests Count': item.leaveRequestsCount,
    'Load Adjustment Count': item.loadAdjustmentCount,
    'Last Request Date': formatDate(item.lastRequestDate)
  }));
}

function toFacultyDetailRows(dataset) {
  return dataset.facultyLeaves.map((item, index) => ({
    'Sr No': index + 1,
    'Request ID': item.requestNumber,
    'Faculty Name': item.facultyDetails?.name || item.createdBy?.fullName || '',
    'Employee ID': item.facultyDetails?.employeeId || item.createdBy?.employeeId || '',
    Department: item.facultyDetails?.department || item.createdBy?.department || '',
    'Request Type': 'Faculty Leave / Workload Adjustment',
    Date: formatDate(item.leaveDetails?.leaveFrom || item.shortLeave?.leaveDate),
    Time: item.shortLeave?.requestedFrom && item.shortLeave?.requestedTo ? `${item.shortLeave.requestedFrom} - ${item.shortLeave.requestedTo}` : '',
    Reason: item.leaveDetails?.reason || item.shortLeave?.reason || '',
    'Leave Type': item.leaveDetails?.leaveType || '',
    'Adjustment Details': (item.workloadAdjustments || [])
      .map((adjustment) => `${adjustment.date ? new Date(adjustment.date).toISOString().slice(0, 10) : ''} ${adjustment.time || ''} ${adjustment.subjectOrCourseCode || ''} ${adjustment.classOrSemester || ''} -> ${adjustment.adjustedFacultyName || ''}`)
      .join('; '),
    Status: item.overallStatus || '',
    'Approved By': getLatestFacultyApprover(item),
    'Rejection Reason': item.rejectionReason || '',
    'Created At': formatDate(item.createdAt)
  }));
}

function toDepartmentRows(dataset) {
  return dataset.departmentAnalytics.map((item) => ({
    Department: item.department,
    'Total Students': item.totalStudents,
    'Total Faculty': item.totalFaculty,
    'Total Gatepasses': item.totalGatepasses,
    'Total Approved': item.totalApproved,
    'Total Rejected': item.totalRejected,
    'Total Pending': item.totalPending,
    'Total Out': item.totalOut,
    'Total Returned': item.totalReturned,
    'Avg Gatepasses per Student': Number(item.avgGatepassesPerStudent.toFixed(2)),
    'Avg Gatepasses per Faculty': Number(item.avgGatepassesPerFaculty.toFixed(2))
  }));
}

function toMonthlyRows(dataset) {
  return dataset.monthlyTrend.map((item) => ({
    Month: item.month,
    'Student Gatepasses': item.studentGatepasses,
    'Faculty Gatepasses': item.facultyGatepasses,
    'Leave Requests': item.leaveRequests,
    'Load Adjustments': item.loadAdjustments,
    Approved: item.approved,
    Rejected: item.rejected,
    Pending: item.pending
  }));
}

function getGatepassesForSummary(summary, dataset) {
  if (summary.user?._id) {
    const id = String(summary.user._id);
    return dataset.gatepasses.filter((item) => String(item.createdBy?._id || item.createdBy) === id);
  }

  return dataset.gatepasses.filter((item) => item.applicantSnapshot?.enrollmentNo === summary.enrollmentNo);
}

function getFacultyRequestsForSummary(summary, dataset) {
  if (summary.user?._id) {
    const id = String(summary.user._id);
    return {
      gatepasses: dataset.gatepasses.filter((item) => String(item.createdBy?._id || item.createdBy) === id),
      leaves: dataset.facultyLeaves.filter((item) => String(item.createdBy?._id || item.createdBy) === id)
    };
  }

  return {
    gatepasses: dataset.gatepasses.filter((item) => item.applicantSnapshot?.employeeId === summary.employeeId),
    leaves: dataset.facultyLeaves.filter((item) => item.facultyDetails?.employeeId === summary.employeeId)
  };
}

function addIndividualStudentSheet(workbook, summary, dataset, index = 0) {
  const baseName = summary.enrollmentNo || summary.name || `Student ${index + 1}`;
  const sheet = workbook.addWorksheet(safeSheetName(baseName, `Student ${index + 1}`));
  sheet.mergeCells('A1:H1');
  sheet.getCell('A1').value = `DwarPal Student History - ${summary.name}`;
  sheet.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF173449' } };
  sheet.addRow([]);
  sheet.addRow(['Name', summary.name, 'Enrollment', summary.enrollmentNo, 'Department', summary.department, 'Semester', summary.semester]);
  sheet.addRow(['Total Gatepasses', summary.totalGatepasses, 'Approved', summary.approvedCount, 'Rejected', summary.rejectedCount, 'Late Returns', summary.lateReturnCount]);
  sheet.addRow([]);
  const monthStartRow = sheet.rowCount + 1;
  sheet.addRow(['Month', 'Gatepasses', 'Approved', 'Rejected', 'Pending']);
  applyHeaderStyle(sheet.getRow(monthStartRow));
  const gatepasses = getGatepassesForSummary(summary, dataset);
  const monthly = new Map();
  gatepasses.forEach((gatepass) => {
    const date = gatepass.outDate ? new Date(gatepass.outDate) : new Date(gatepass.createdAt || Date.now());
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly.has(month)) {
      monthly.set(month, { month, total: 0, approved: 0, rejected: 0, pending: 0 });
    }
    const item = monthly.get(month);
    item.total += 1;
    if (String(gatepass.status || '').includes('approved')) item.approved += 1;
    if (String(gatepass.status || '').includes('rejected')) item.rejected += 1;
    if (String(gatepass.status || '').includes('pending') || String(gatepass.status || '').includes('forwarded')) item.pending += 1;
  });
  Array.from(monthly.values()).forEach((item) => sheet.addRow([item.month, item.total, item.approved, item.rejected, item.pending]));
  sheet.addRow([]);
  const detailStartRow = sheet.rowCount + 1;
  const detailHeaders = ['Gatepass ID', 'Date', 'Out Time', 'Actual Return Time', 'Reason', 'Vehicle Number', 'Status', 'Approved By'];
  sheet.addRow(detailHeaders);
  applyHeaderStyle(sheet.getRow(detailStartRow));
  gatepasses.forEach((gatepass) => {
    const row = sheet.addRow([
      gatepass.gatepassId || gatepass.passNumber,
      formatDate(gatepass.outDate),
      gatepass.outTime || '',
      formatDate(gatepass.securityAction?.checkedInAt),
      gatepass.reason || '',
      gatepass.vehicleNumber || '',
      gatepass.status || '',
      getLatestApprovedBy(gatepass)
    ]);
    colorStatusCell(row.getCell(7));
  });
  styleWorksheet(sheet);
}

function addIndividualFacultySheet(workbook, summary, dataset, index = 0) {
  const baseName = summary.employeeId || summary.name || `Faculty ${index + 1}`;
  const sheet = workbook.addWorksheet(safeSheetName(baseName, `Faculty ${index + 1}`));
  const { gatepasses, leaves } = getFacultyRequestsForSummary(summary, dataset);
  sheet.mergeCells('A1:H1');
  sheet.getCell('A1').value = `DwarPal Faculty History - ${summary.name}`;
  sheet.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF173449' } };
  sheet.addRow([]);
  sheet.addRow(['Name', summary.name, 'Employee ID', summary.employeeId, 'Department', summary.department, 'Role', summary.role]);
  sheet.addRow(['Gatepasses', gatepasses.length, 'Leave Requests', leaves.length, 'Load Adjustments', summary.loadAdjustmentCount, 'Coordinator', summary.isCoordinator ? 'Yes' : 'No']);
  sheet.addRow([]);
  const detailStartRow = sheet.rowCount + 1;
  const headers = ['Request ID', 'Request Type', 'Date', 'Reason', 'Status', 'Approved By', 'Rejection Reason'];
  sheet.addRow(headers);
  applyHeaderStyle(sheet.getRow(detailStartRow));
  gatepasses.forEach((gatepass) => {
    const row = sheet.addRow([
      gatepass.gatepassId || gatepass.passNumber,
      'Gatepass',
      formatDate(gatepass.outDate),
      gatepass.reason || '',
      gatepass.status || '',
      getLatestApprovedBy(gatepass),
      gatepass.rejectionReason || ''
    ]);
    colorStatusCell(row.getCell(5));
  });
  leaves.forEach((request) => {
    const row = sheet.addRow([
      request.requestNumber,
      request.leaveDetails?.leaveType || 'Leave',
      formatDate(request.leaveDetails?.leaveFrom || request.shortLeave?.leaveDate),
      request.leaveDetails?.reason || request.shortLeave?.reason || '',
      request.overallStatus || '',
      getLatestFacultyApprover(request),
      request.rejectionReason || ''
    ]);
    colorStatusCell(row.getCell(5));
  });
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
  const summary = dataset.dashboardSummary;
  const mode = dataset.filters.exportMode;

  if (mode === 'per_student' || dataset.filters.includeSeparateStudentSheets) {
    const summaries = dataset.studentSummaries.filter((item) => item.totalGatepasses > 0 || item.user);
    (summaries.length ? summaries : dataset.studentSummaries).forEach((item, index) => addIndividualStudentSheet(workbook, item, dataset, index));
  } else if (mode === 'individual' && dataset.filters.studentId) {
    const match = dataset.studentSummaries.find((item) => String(item.user?._id || '') === String(dataset.filters.studentId));
    addIndividualStudentSheet(workbook, match || dataset.studentSummaries[0] || { name: 'Student', totalGatepasses: 0 }, dataset);
  } else if (mode === 'individual' && dataset.filters.facultyId) {
    const match = dataset.facultySummaries.find((item) => String(item.user?._id || '') === String(dataset.filters.facultyId));
    addIndividualFacultySheet(workbook, match || dataset.facultySummaries[0] || { name: 'Faculty', totalGatepasses: 0 }, dataset);
  } else {
    addKeyValueSheet(workbook, 'Dashboard Summary', 'DwarPal Dashboard Summary', [
      ['Total Gatepasses', summary.totalGatepasses],
      ['Total Approved', summary.totalApproved],
      ['Total Rejected', summary.totalRejected],
      ['Total Pending', summary.totalPending],
      ['Total Out', summary.totalOut],
      ['Total Returned', summary.totalReturned],
      ['Total Late Returns', summary.totalLateReturns],
      ['Total Faculty Requests', summary.totalFacultyRequests],
      ['Total Student Requests', summary.totalStudentRequests],
      ['Total Leave Requests', summary.totalLeaveRequests],
      ['Total Load Adjustments', summary.totalLoadAdjustments],
      ['Date Range Used', summary.dateRangeUsed],
      ['Generated By', summary.generatedBy],
      ['Generated At', formatDate(summary.generatedAt)]
    ]);

    addRowsSheet(workbook, 'Student Summary', Object.keys(toStudentSummaryRows(dataset)[0] || {
      'Sr No': '',
      'Student Name': '',
      'Enrollment No': '',
      Department: '',
      Semester: '',
      'Division/Class': '',
      Contact: '',
      'Total Gatepasses': '',
      'Approved Count': '',
      'Rejected Count': '',
      'Pending Count': '',
      'Out Count': '',
      'Returned Count': '',
      'Late Return Count': '',
      'Total Leave Requests': '',
      'Total Load Adjustments': '',
      'Last Gatepass Date': '',
      'Most Common Reason': '',
      'Coordinator/Class Incharge': ''
    }), toStudentSummaryRows(dataset));
    addRowsSheet(workbook, 'Student Gatepass Details', Object.keys(toGatepassDetailRows(dataset)[0] || {
      'Sr No': '',
      'Gatepass ID': '',
      'Student Name': '',
      'Enrollment No': '',
      Department: '',
      Semester: '',
      Division: '',
      Date: '',
      'Out Time': '',
      'Return Time': '',
      'Actual Return Time': '',
      Reason: '',
      Destination: '',
      'Vehicle Number': '',
      Status: '',
      'Approved By': '',
      'Approval Level': '',
      'Rejection Reason': '',
      'Created At': '',
      'Updated At': ''
    }), toGatepassDetailRows(dataset));
    addRowsSheet(workbook, 'Faculty Summary', Object.keys(toFacultySummaryRows(dataset)[0] || {
      'Sr No': '',
      'Faculty Name': '',
      'Employee ID': '',
      Department: '',
      Role: '',
      'Is Coordinator': '',
      'Assigned Class/Scope': '',
      'Total Gatepasses': '',
      'Approved Count': '',
      'Rejected Count': '',
      'Pending Count': '',
      'Leave Requests Count': '',
      'Load Adjustment Count': '',
      'Last Request Date': ''
    }), toFacultySummaryRows(dataset));
    addRowsSheet(workbook, 'Faculty Details Leave Load', Object.keys(toFacultyDetailRows(dataset)[0] || {
      'Sr No': '',
      'Request ID': '',
      'Faculty Name': '',
      'Employee ID': '',
      Department: '',
      'Request Type': '',
      Date: '',
      Time: '',
      Reason: '',
      'Leave Type': '',
      'Adjustment Details': '',
      Status: '',
      'Approved By': '',
      'Rejection Reason': '',
      'Created At': ''
    }), toFacultyDetailRows(dataset));
    addRowsSheet(workbook, 'Department Analytics', Object.keys(toDepartmentRows(dataset)[0] || {
      Department: '',
      'Total Students': '',
      'Total Faculty': '',
      'Total Gatepasses': '',
      'Total Approved': '',
      'Total Rejected': '',
      'Total Pending': '',
      'Total Out': '',
      'Total Returned': '',
      'Avg Gatepasses per Student': '',
      'Avg Gatepasses per Faculty': ''
    }), toDepartmentRows(dataset));
    addRowsSheet(workbook, 'Monthly Trend', Object.keys(toMonthlyRows(dataset)[0] || {
      Month: '',
      'Student Gatepasses': '',
      'Faculty Gatepasses': '',
      'Leave Requests': '',
      'Load Adjustments': '',
      Approved: '',
      Rejected: '',
      Pending: ''
    }), toMonthlyRows(dataset));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

module.exports = {
  generateExcelBuffer,
  safeSheetName
};
