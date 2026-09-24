import { testRunsMock } from '../data/mock/recordsMock'
import type { CreateTestRunInput,TestRun } from '../types'
import { clone } from './mockStore'

let testRuns=clone(testRunsMock)

export interface TestRunsService {
  getTestRuns():Promise<TestRun[]>
  getTestRunById(id:string):Promise<TestRun|null>
  createTestRun(input:CreateTestRunInput):Promise<TestRun>
  completeTestRun(id:string):Promise<TestRun>
  updateTestRunNotes(id:string,notes:string):Promise<TestRun>
}

const requireRun=(id:string)=>{const run=testRuns.find((item)=>item.id===id);if(!run)throw new Error('Test run was not found.');return run}

export const testRunsService:TestRunsService={
  getTestRuns:async()=>clone(testRuns),
  getTestRunById:async(id)=>{const run=testRuns.find((item)=>item.id===id);return run?clone(run):null},
  createTestRun:async(input)=>{const run:TestRun={id:`RUN-2026-${String(testRuns.length+1).padStart(3,'0')}`,startedAt:new Date().toISOString(),duration:'00m 00s',processedVolume:0,status:'In Progress',telemetryCount:0,alertCount:0,validationStatus:'Pending',notes:input.notes?.trim()||input.sampleInformation?.trim()||'Research session created.'};testRuns=[run,...testRuns];return clone(run)},
  completeTestRun:async(id)=>{const run=requireRun(id);run.status='Completed';run.endedAt=new Date().toISOString();return clone(run)},
  updateTestRunNotes:async(id,notes)=>{const run=requireRun(id);run.notes=notes;return clone(run)},
}
