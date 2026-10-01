import type { CreateTestRunInput,TestRun } from '../types'
import { ApiClientError,apiRequest } from './apiClient'

export interface TestRunsService {
  getTestRuns():Promise<TestRun[]>
  getTestRunById(id:string):Promise<TestRun|null>
  createTestRun(input:CreateTestRunInput):Promise<TestRun>
  completeTestRun(id:string):Promise<TestRun>
  updateTestRunNotes(id:string,notes:string):Promise<TestRun>
}

export const testRunsService:TestRunsService={
  getTestRuns:()=>apiRequest<TestRun[]>('test-runs'),
  getTestRunById:async(id)=>{try{return await apiRequest<TestRun>(`test-runs/${encodeURIComponent(id)}`)}catch(error){if(error instanceof ApiClientError&&error.status===404)return null;throw error}},
  createTestRun:(input)=>apiRequest<TestRun>('test-runs',{method:'POST',body:input}),
  completeTestRun:(id)=>apiRequest<TestRun>(`test-runs/${encodeURIComponent(id)}/complete`,{method:'PATCH'}),
  updateTestRunNotes:(id,notes)=>apiRequest<TestRun>(`test-runs/${encodeURIComponent(id)}/notes`,{method:'PATCH',body:{notes}}),
}
