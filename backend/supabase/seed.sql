-- Local development seed data. Applied automatically by `supabase db reset`.
-- Keep this obviously synthetic — never a stand-in for real project data,
-- per backend/docs/DATABASE.md's data integrity principles.

insert into public.app_settings (id, system_name, device_display_name, timezone, date_format, time_format, notifications)
values (
    1,
    'AquaSense Research Console',
    'ESP32 Filtration Unit (Simulated)',
    'Asia/Manila',
    'YYYY-MM-DD',
    '24h',
    '{"offline": true, "sensor": true, "noFlow": true, "waterQuality": true, "pump": false, "uvc": false, "maintenance": true}'::jsonb
)
on conflict (id) do nothing;

insert into public.data_retention_policy (id, retention_days, config)
values (1, null, '{}'::jsonb)
on conflict (id) do nothing;

insert into public.devices (device_identifier, name, is_simulated, controller_name, connection_state, wifi_state, fail_safe_state, config)
values 
    ('ESP32-DEV-001', 'ESP32 Physical Filtration Unit', false, 'ESP32 DevKit V1', 'Pending Hardware Integration', 'Not Configured', 'Local Control Active', '{"microcontroller": "ESP32 DevKit V1", "firmware_version": "0.1.0-dev", "topology": "Dual-stage pre/post filtration with local fail-safe"}'::jsonb),
    ('SIM-DEV-001', 'Simulated Filtration Unit', true, 'ESP32 DevKit V1', 'Pending Hardware Integration', 'Not Configured', 'Pending Hardware Integration', '{}'::jsonb)
on conflict (device_identifier) do update set
    name = excluded.name,
    is_simulated = excluded.is_simulated,
    controller_name = excluded.controller_name,
    config = excluded.config;

insert into public.sensors (device_id, category, position, unit)
select d.id, s.category, s.position, s.unit
from public.devices d
cross join (
    values
        ('ph', 'pre_filtration', 'pH'),
        ('ph', 'post_filtration', 'pH'),
        ('turbidity', 'pre_filtration', 'NTU'),
        ('turbidity', 'post_filtration', 'NTU'),
        ('tds', 'pre_filtration', 'ppm'),
        ('tds', 'post_filtration', 'ppm'),
        ('temperature', 'pre_filtration', '°C'),
        ('temperature', 'post_filtration', '°C'),
        ('flow_rate', 'pre_filtration', 'L/min'),
        ('flow_rate', 'post_filtration', 'L/min')
) as s(category, position, unit)
where d.device_identifier in ('ESP32-DEV-001', 'SIM-DEV-001')
on conflict do nothing;

-- Baseline maintenance component reminders for physical equipment
insert into public.maintenance_reminders (component, label, due_date, status)
values
    ('Booster Pump', 'Inspect booster pump diaphragm, pressure, and electrical connections', current_date + interval '30 days', 'Pending'),
    ('UV-C Sterilizer', 'Inspect UV-C quartz sleeve clarity and lamp operation', current_date + interval '45 days', 'Pending'),
    ('Ultrafiltration Membrane', 'Inspect hollow fiber UF membrane module and perform rinse', current_date + interval '60 days', 'Pending'),
    ('Pre-Filter Cartridge', 'Inspect sediment and carbon pre-filter cartridges for particulate clogging', current_date + interval '14 days', 'Pending'),
    ('Sensor Array Probes', 'Clean and inspect pH, turbidity, TDS, and temperature sensor probes', current_date + interval '7 days', 'Pending')
on conflict do nothing;

-- Provisional water-quality alert thresholds for development and testing.
-- Tagged provisional: true per AGENTS.md — not final adviser-approved limits.
insert into public.thresholds (parameter, stage, config)
values
    ('pH', 'after', '{"min": 6.5, "max": 8.5, "severity": "Warning", "provisional": true}'::jsonb),
    ('turbidity', 'after', '{"max": 1.0, "severity": "Warning", "provisional": true}'::jsonb),
    ('turbidity', 'before', '{"max": 10.0, "severity": "Warning", "provisional": true}'::jsonb),
    ('TDS', 'after', '{"max": 300, "severity": "Warning", "provisional": true}'::jsonb),
    ('temperature', 'after', '{"min": 15.0, "max": 35.0, "severity": "Information", "provisional": true}'::jsonb)
on conflict (parameter, stage) do nothing;

