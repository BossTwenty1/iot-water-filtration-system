import type { CalibrationRecord, LaboratoryValidationRecord, MaintenanceRecord, MaintenanceReminder, SystemAlert, TestRun, UserRecord } from '../../types'

export const alertsMock: SystemAlert[] = [
  { id: 'ALT-2026-014', timestamp: '2026-09-30T14:33:10+08:00', severity: 'Warning', source: 'Post-Filtration Turbidity Sensor', title: 'Sensor Connection Warning', message: 'Sensor reading temporarily unavailable. Waiting for the next valid reading.', testRunId: 'RUN-2026-001', status: 'Active' },
  { id: 'ALT-2026-013', timestamp: '2026-09-30T14:28:45+08:00', severity: 'Warning', source: 'Pre-Filtration Flow Sensor', title: 'No Flow Detected', message: 'No water flow was recorded during the active test run. Operator inspection is recommended.', testRunId: 'RUN-2026-001', status: 'Acknowledged' },
  { id: 'ALT-2026-012', timestamp: '2026-09-30T14:15:08+08:00', severity: 'Information', source: 'ESP32-001', title: 'ESP32 Connection Restored', message: 'Device telemetry connection is available.', testRunId: 'RUN-2026-001', status: 'Resolved' },
  { id: 'ALT-2026-011', timestamp: '2026-09-30T14:15:00+08:00', severity: 'Information', source: 'Filtration System', title: 'Filter Maintenance Reminder', message: 'Maintenance reminder recorded for operator review.', status: 'Active' },
  { id: 'ALT-2026-010', timestamp: '2026-09-30T14:12:30+08:00', severity: 'Warning', source: 'ESP32-001', title: 'Data Stale', message: 'Telemetry freshness could not be confirmed during the recorded interval.', testRunId: 'RUN-2026-001', status: 'Resolved' },
]

export const testRunsMock: TestRun[] = [
  { id: 'RUN-2026-001', startedAt: '2026-09-30T14:05:10+08:00', duration: '28m 30s', processedVolume: 0.72, status: 'In Progress', telemetryCount: 254, alertCount: 2, validationStatus: 'Pending', notes: 'Pre- and post-filtration readings are monitored throughout this session.' },
  { id: 'RUN-2026-000', startedAt: '2026-09-30T13:15:00+08:00', endedAt: '2026-09-30T14:00:00+08:00', duration: '45m 00s', processedVolume: 1.8, status: 'Completed', telemetryCount: 548, alertCount: 0, validationStatus: 'Available', notes: 'Research session completed.' },
  { id: 'RUN-2026-099', startedAt: '2026-09-29T16:20:00+08:00', endedAt: '2026-09-29T16:50:12+08:00', duration: '30m 12s', processedVolume: 1.25, status: 'Completed', telemetryCount: 362, alertCount: 1, validationStatus: 'Available', notes: 'Comparison session completed.' },
  { id: 'RUN-2026-098', startedAt: '2026-09-29T11:00:00+08:00', endedAt: '2026-09-29T12:00:00+08:00', duration: '60m 00s', processedVolume: 2.4, status: 'Completed', telemetryCount: 720, alertCount: 0, validationStatus: 'Available', notes: 'Duration review completed.' },
  { id: 'RUN-2026-097', startedAt: '2026-09-28T14:10:00+08:00', endedAt: '2026-09-28T14:18:14+08:00', duration: '08m 14s', processedVolume: 0.18, status: 'Cancelled', telemetryCount: 98, alertCount: 1, validationStatus: 'Pending', notes: 'Session record ended by the researcher.' },
]

export const calibrationMock: CalibrationRecord[] = [
  { id: 'CAL-2026-004', date: '2026-09-30T09:15:22+08:00', parameter: 'TDS', stage: 'after', model: 'DFRobot TDS', referenceValue: 300, sensorReading: 306, unit: 'ppm', status: 'Record Available', notes: 'Approved procedures remain a research-team responsibility.' },
  { id: 'CAL-2026-003', date: '2026-09-29T16:30:00+08:00', parameter: 'TDS', stage: 'before', model: 'DFRobot TDS', referenceValue: 300, sensorReading: 306, unit: 'ppm', status: 'Record Available', notes: 'Sensor and reference comparison recorded.' },
  { id: 'CAL-2026-002', date: '2026-09-27T11:20:00+08:00', parameter: 'turbidity', stage: 'before', model: 'Pending Confirmation', referenceValue: 10, sensorReading: 11.45, unit: 'NTU', status: 'Review Needed', notes: 'Turbidity sensor model and procedure are pending confirmation.' },
  { id: 'CAL-2026-001', date: '2026-09-29T10:05:00+08:00', parameter: 'pH', stage: 'before', model: 'PH-4502C', referenceValue: 7, sensorReading: 7.15, unit: 'pH', status: 'Record Available', notes: 'Sensor and reference comparison recorded.' },
  { id: 'CAL-2026-005', date: '2026-09-28T14:40:00+08:00', parameter: 'temperature', stage: 'after', model: 'DS18B20', referenceValue: 25, sensorReading: 25.3, unit: '°C', status: 'Record Available', notes: 'Sensor and reference comparison recorded.' },
]

export const laboratoryValidationMock: LaboratoryValidationRecord[] = [
  { id: 'VAL-2026-001', date: '2026-09-12T11:45:00+08:00', testRunId: 'RUN-2026-001', sampleId: 'SMP-2026-004', stage: 'after', parameter: 'turbidity', referenceResult: 0.7, sensorReading: 0.72, unit: 'NTU', status: 'Available', conclusion: 'No laboratory/reference conclusion has been recorded.', notes: 'External reference comparison recorded.' },
  { id: 'VAL-2026-002', date: '2026-09-12T11:40:00+08:00', testRunId: 'RUN-2026-001', sampleId: 'SMP-2026-003', stage: 'before', parameter: 'turbidity', referenceResult: 9.5, sensorReading: 9.4, unit: 'NTU', status: 'Available', notes: 'External reference comparison recorded.' },
  { id: 'VAL-2026-003', date: '2026-09-12T11:45:00+08:00', testRunId: 'RUN-2026-001', sampleId: 'SMP-2026-002', stage: 'after', parameter: 'TDS', referenceResult: 180, sensorReading: 181, unit: 'ppm', status: 'Available', notes: 'External reference comparison recorded.' },
  { id: 'VAL-2026-004', date: '2026-09-12T11:40:00+08:00', testRunId: 'RUN-2026-001', sampleId: 'SMP-2026-001', stage: 'before', parameter: 'TDS', referenceResult: 300, sensorReading: 302, unit: 'ppm', status: 'Available', notes: 'External reference comparison recorded.' },
  { id: 'VAL-2026-005', date: '2026-09-11T15:20:00+08:00', testRunId: 'RUN-2026-000', sampleId: 'SMP-2026-005', stage: 'after', parameter: 'pH', sensorReading: 7.05, unit: 'pH', status: 'Pending', notes: 'External reference result is pending.' },
]

export const maintenanceMock: MaintenanceRecord[] = [
  { id: 'MNT-2026-005', date: '2026-09-14T11:20:00+08:00', component: 'After-Filtration Sensors', type: 'Inspection', description: 'Physical sensor inspection record created.', status: 'Completed', performedBy: 'Researcher / Admin', notes: 'No replacement parts recorded.' },
  { id: 'MNT-2026-004', date: '2026-09-13T16:45:00+08:00', component: 'Booster Pump', type: 'Inspection', description: 'Booster pump inspection record created after a recorded system warning.', status: 'Review Needed', performedBy: 'Researcher / Admin', notes: 'Follow-up inspection may be recorded if required.' },
  { id: 'MNT-2026-003', date: '2026-09-12T14:00:00+08:00', component: 'Ultrafiltration Unit', type: 'Inspection', description: 'Ultrafiltration unit maintenance review recorded.', status: 'Completed', performedBy: 'Researcher / Admin', notes: 'Maintenance review recorded.' },
  { id: 'MNT-2026-002', date: '2026-09-11T09:30:00+08:00', component: 'ESP32 Controller', type: 'Inspection', description: 'Controller enclosure and connection inspection recorded.', status: 'Completed', performedBy: 'Researcher / Admin', notes: 'Controller inspection recorded.' },
  { id: 'MNT-2026-001', date: '2026-09-10T10:15:00+08:00', component: 'UV-C Unit', type: 'Inspection', description: 'UV-C unit inspection record created.', status: 'Completed', performedBy: 'Researcher / Admin', notes: 'Runtime integration remains pending.' },
]

export const maintenanceReminders: MaintenanceReminder[] = [
  { id: 'REM-001', component: 'Booster Pump', label: 'Pump Inspection', dueDate: '2026-09-16', status: 'Due' },
  { id: 'REM-002', component: 'Ultrafiltration Unit', label: 'Filter Maintenance Review', dueDate: '2026-09-18', status: 'Upcoming' },
  { id: 'REM-003', component: 'UV-C Unit', label: 'UV-C Review', dueDate: '2026-09-20', status: 'Upcoming' },
  { id: 'REM-004', component: 'Sensor Suite', label: 'Sensor Inspection', dueDate: '2026-09-22', status: 'Upcoming' },
]

export const usersMock: UserRecord[] = [
  { id: 'USR-001', name: 'Administrator', email: 'administrator', role: 'Administrator', status: 'Active' },
  { id: 'USR-002', name: 'Researcher', email: 'researcher', role: 'Researcher', status: 'Active' },
  { id: 'USR-003', name: 'Viewer', email: 'viewer', role: 'Viewer', status: 'Active' },
]
