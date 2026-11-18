-- Migration: Add unique index on sensor_readings (sensor_id, measured_at) for idempotent ingestion

-- Clean up any existing duplicate sensor readings on (sensor_id, measured_at)
delete from public.sensor_readings a
using public.sensor_readings b
where a.id > b.id
  and a.sensor_id = b.sensor_id
  and a.measured_at = b.measured_at;

create unique index if not exists sensor_readings_sensor_id_measured_at_idx
on public.sensor_readings (sensor_id, measured_at);
