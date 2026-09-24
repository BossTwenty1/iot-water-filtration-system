import express from 'express'
import authRoutes from './auth.routes'
import dashboardRoutes from './dashboard.routes'
import telemetryRoutes from './telemetry.routes'
import alertsRoutes from './alerts.routes'
import testRunsRoutes from './testRuns.routes'
import calibrationRoutes from './calibration.routes'
import labValidationRoutes from './labValidation.routes'
import maintenanceRoutes from './maintenance.routes'
import devicesRoutes from './devices.routes'
import usersRoutes from './users.routes'
import realtimeRoutes from './realtime.routes'
import settingsRoutes from './settings.routes'
import exportRoutes from './export.routes'

const router = express.Router()

router.use('/auth', authRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/telemetry', telemetryRoutes)
router.use('/alerts', alertsRoutes)
router.use('/test-runs', testRunsRoutes)
router.use('/calibration', calibrationRoutes)
router.use('/laboratory-validation', labValidationRoutes)
router.use('/maintenance', maintenanceRoutes)
router.use('/devices', devicesRoutes)
router.use('/users', usersRoutes)
router.use('/realtime', realtimeRoutes)
router.use('/export', exportRoutes)
// Settings routes mount several top-level resources (/settings, /thresholds,
// /notifications/providers, /data-retention) rather than one prefix — see
// docs/plans/API ROUTES PLAN.md §9.
router.use('/', settingsRoutes)

export default router
