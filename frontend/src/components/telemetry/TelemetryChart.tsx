import { CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts'
import { useServiceData } from '../../hooks/useServiceData'
import { telemetryService } from '../../services'
import { ResourceState } from '../common/ResourceState'

const axisTick={fontFamily:'Inter, sans-serif',fontSize:10,fill:'var(--chart-axis)'}
const tooltipStyle={fontFamily:'Inter, sans-serif',fontSize:12,borderColor:'var(--shell-line)',borderRadius:8,background:'var(--shell-panel)',color:'var(--shell-ink)',boxShadow:'0 4px 14px rgb(15 23 42 / 0.12)'}

export function TelemetryChart({compact=false}:{compact?:boolean}){
  const resource=useServiceData(telemetryService.getTelemetryChart)
  if(resource.status!=='success'||!resource.data)return <ResourceState status={resource.status} error={resource.error} loadingLabel="Loading telemetry chart…" emptyLabel="No API telemetry is available."/>

  return <div className={`chart-box ${compact?'chart-box-compact':''}`} role="img" aria-label="Recorded turbidity readings before and after filtration; hardware provenance is not verified">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={resource.data} margin={{top:4,right:8,left:-20,bottom:0}}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false}/>
        <XAxis dataKey="time" tickFormatter={(value:string)=>new Date(value).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Manila'})} tick={axisTick} tickMargin={8} minTickGap={18} axisLine={false} tickLine={false}/>
        <YAxis domain={[0,'auto']} tick={axisTick} width={38} axisLine={false} tickLine={false}/>
        <Tooltip contentStyle={tooltipStyle} cursor={{stroke:'var(--chart-grid)',strokeDasharray:'3 3'}}/>
        <Legend verticalAlign="top" align="right" iconType="circle" iconSize={7} wrapperStyle={{fontFamily:'Inter, sans-serif',fontSize:11,color:'var(--chart-axis)',paddingBottom:8}}/>
        <Line type="monotone" name="Before filtration" dataKey="before" stroke="var(--chart-before)" strokeWidth={2} dot={false} activeDot={{r:4}} isAnimationActive={false}/>
        <Line type="monotone" name="After filtration" dataKey="after" stroke="var(--chart-after)" strokeWidth={2.5} dot={false} activeDot={{r:4}} isAnimationActive={false}/>
      </LineChart>
    </ResponsiveContainer>
  </div>
}

export function TelemetrySparkline({label}:{label:string}){
  const resource=useServiceData(telemetryService.getTelemetryChart)
  return <div className="telemetry-sparkline" role="img" aria-label={label}>
    {resource.status==='success'&&resource.data&&<ResponsiveContainer width="100%" height="100%">
      <LineChart data={resource.data} margin={{top:4,right:0,left:0,bottom:3}}>
        <Line type="monotone" dataKey="before" stroke="var(--chart-before)" strokeWidth={1.8} dot={false} isAnimationActive={false}/>
        <Line type="monotone" dataKey="after" stroke="var(--chart-after)" strokeWidth={2.2} dot={false} isAnimationActive={false}/>
      </LineChart>
    </ResponsiveContainer>}
  </div>
}
