import { ResourceState } from '../common/ResourceState'
import { useServiceData } from '../../hooks/useServiceData'
import { telemetryService } from '../../services'
import type { SensorStage } from '../../types'
import { formatSensorValue } from '../../utils/formatters'
import { StatusBadge } from '../common/StatusBadge'
export function SensorGrid({stage}:{stage:SensorStage}) { const resource=useServiceData(telemetryService.getLatestTelemetry); if(resource.status!=='success'||!resource.data)return <ResourceState status={resource.status} error={resource.error} loadingLabel="Loading readings…" emptyLabel="No readings available."/>; const readings=resource.data.filter((reading)=>reading.stage===stage); return <div className="sensor-grid">{readings.map((reading)=><div className="sensor-card" key={`${stage}-${reading.parameter}`}><div className="flex items-start justify-between gap-2"><div><div className="eyebrow text-muted">{reading.label}</div><div className="mt-2"><span className="metric-value">{formatSensorValue(reading.parameter,reading.value)}</span> <span className="mono text-[10px] text-muted">{reading.unit}</span></div></div><StatusBadge tone="Available">Reading Available</StatusBadge></div><div className="mt-2 text-[11px] text-muted">No sensor fault</div></div>)}</div> }
