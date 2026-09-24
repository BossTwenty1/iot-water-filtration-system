import { lazy,Suspense,useEffect } from 'react'
import { Navigate,Outlet,Route,Routes,useLocation } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { restoreSession } from './services/apiClient'

const DashboardPage=lazy(()=>import('./pages/DashboardPage').then((module)=>({default:module.DashboardPage})))
const HistoryPage=lazy(()=>import('./pages/HistoryPage').then((module)=>({default:module.HistoryPage})))
const AlertsPage=lazy(()=>import('./pages/AlertsPage').then((module)=>({default:module.AlertsPage})))
const TestRunsPage=lazy(()=>import('./pages/TestRunsPage').then((module)=>({default:module.TestRunsPage})))
const CalibrationPage=lazy(()=>import('./pages/CalibrationPage').then((module)=>({default:module.CalibrationPage})))
const LaboratoryValidationPage=lazy(()=>import('./pages/LaboratoryValidationPage').then((module)=>({default:module.LaboratoryValidationPage})))
const MaintenancePage=lazy(()=>import('./pages/MaintenancePage').then((module)=>({default:module.MaintenancePage})))
const SettingsPage=lazy(()=>import('./pages/SettingsPage').then((module)=>({default:module.SettingsPage})))

function PageLoading() { return <div className="panel p-6 text-sm text-muted" role="status">Loading research console…</div> }

function RequireAuth(){
  const auth=useAuth()
  const location=useLocation()
  if(auth.status==='loading')return <PageLoading/>
  if(auth.status==='unauthenticated')return <Navigate to="/login" replace state={{from:`${location.pathname}${location.search}${location.hash}`}}/>
  return <Outlet/>
}

export default function App() {
  useEffect(()=>{void restoreSession()},[])
  return <Suspense fallback={<PageLoading/>}><Routes><Route path="login" element={<LoginPage/>}/><Route element={<RequireAuth/>}><Route element={<AppLayout/>}><Route index element={<Navigate to="/dashboard" replace/>}/><Route path="dashboard" element={<DashboardPage/>}/><Route path="history" element={<HistoryPage/>}/><Route path="alerts" element={<AlertsPage/>}/><Route path="test-runs" element={<TestRunsPage/>}/><Route path="calibration" element={<CalibrationPage/>}/><Route path="laboratory-validation" element={<LaboratoryValidationPage/>}/><Route path="maintenance" element={<MaintenancePage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="*" element={<Navigate to="/dashboard" replace/>}/></Route></Route></Routes></Suspense>
}
