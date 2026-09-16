import app from './src/app'
import env from './src/config/env'

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}/api/v1`)
})
