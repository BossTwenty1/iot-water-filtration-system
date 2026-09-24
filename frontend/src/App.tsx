import { lazy,Suspense } from 'react'
import { Navigate,Route,Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'

const DashboardPage=lazy(()=>import('./pages/DashboardPage').then((module)=>({default:module.DashboardPage})))
const HistoryPage=lazy(()=>import('./pages/HistoryPage').then((module)=>({default:module.HistoryPage})))
const AlertsPage=lazy(()=>import('./pages/AlertsPage').then((module)=>({default:module.AlertsPage})))
const TestRunsPage=lazy(()=>import('./pages/TestRunsPage').then((module)=>({default:module.TestRunsPage})))
const CalibrationPage=lazy(()=>import('./pages/CalibrationPage').then((module)=>({default:module.CalibrationPage})))
const LaboratoryValidationPage=lazy(()=>import('./pages/LaboratoryValidationPage').then((module)=>({default:module.LaboratoryValidationPage})))
const MaintenancePage=lazy(()=>import('./pages/MaintenancePage').then((module)=>({default:module.MaintenancePage})))
const SettingsPage=lazy(()=>import('./pages/SettingsPage').then((module)=>({default:module.SettingsPage})))

function PageLoading() { return <div className="panel p-6 text-sm text-muted" role="status">Loading research console…</div> }

export default function App() {
  return <Suspense fallback={<PageLoading/>}><Routes><Route element={<AppLayout/>}><Route index element={<Navigate to="/dashboard" replace/>}/><Route path="dashboard" element={<DashboardPage/>}/><Route path="history" element={<HistoryPage/>}/><Route path="alerts" element={<AlertsPage/>}/><Route path="test-runs" element={<TestRunsPage/>}/><Route path="calibration" element={<CalibrationPage/>}/><Route path="laboratory-validation" element={<LaboratoryValidationPage/>}/><Route path="maintenance" element={<MaintenancePage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="*" element={<Navigate to="/dashboard" replace/>}/></Route></Routes></Suspense>
}
