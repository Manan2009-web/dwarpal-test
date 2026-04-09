import {
  BellRing,
  CheckCircle2,
  Clock3,
  Forward,
  ScanLine,
  Send,
  Undo2,
  XCircle,
} from 'lucide-react'

const STATUS_META = {
  submitted: {
    label: 'Submitted',
    toastTone: 'info',
    surfaceTone: 'current',
    icon: Send,
  },
  pending: {
    label: 'Pending',
    toastTone: 'warning',
    surfaceTone: 'current',
    icon: Clock3,
  },
  forwarded: {
    label: 'Forwarded',
    toastTone: 'info',
    surfaceTone: 'info',
    icon: Forward,
  },
  approved: {
    label: 'Approved',
    toastTone: 'success',
    surfaceTone: 'success',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    toastTone: 'error',
    surfaceTone: 'danger',
    icon: XCircle,
  },
  out: {
    label: 'Out',
    toastTone: 'info',
    surfaceTone: 'info',
    icon: ScanLine,
  },
  returned: {
    label: 'Returned',
    toastTone: 'success',
    surfaceTone: 'success',
    icon: Undo2,
  },
  cancelled: {
    label: 'Cancelled',
    toastTone: 'warning',
    surfaceTone: 'danger',
    icon: XCircle,
  },
  info: {
    label: 'Info',
    toastTone: 'info',
    surfaceTone: 'info',
    icon: BellRing,
  },
}

export function getNotificationPresentation(notificationOrStatus) {
  const status =
    typeof notificationOrStatus === 'string'
      ? notificationOrStatus
      : notificationOrStatus?.status || notificationOrStatus?.metadata?.status || 'info'

  return STATUS_META[String(status || 'info').trim().toLowerCase()] || STATUS_META.info
}

export function getNotificationDisplayStatus(notificationOrStatus) {
  return getNotificationPresentation(notificationOrStatus).label
}

export function getNotificationSurfaceTone(notification) {
  return getNotificationPresentation(notification).surfaceTone
}

export function getNotificationToastTone(notification) {
  return getNotificationPresentation(notification).toastTone
}

export function getNotificationIcon(notification) {
  return getNotificationPresentation(notification).icon
}

export function getNotificationKicker(notification) {
  if (notification?.recordType === 'faculty_leave') {
    return 'Faculty Gatepass'
  }

  if (notification?.recordType === 'gatepass') {
    return 'Student Gatepass'
  }

  return 'DwarPal'
}

export function formatNotificationTimestamp(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
