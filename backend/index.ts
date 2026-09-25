import app from './src/app'
import env from './src/config/env'
import { startDeviceWatchdog } from './src/lib/deviceWatchdog'
import { startRetentionJob } from './src/lib/retentionJob'

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}/api/v1`)
})

startDeviceWatchdog()
startRetentionJob()
