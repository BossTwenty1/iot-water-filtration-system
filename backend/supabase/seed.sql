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

insert into public.devices (device_identifier, name, is_simulated, controller_name, connection_state, wifi_state, fail_safe_state)
values ('SIM-DEV-001', 'Simulated Filtration Unit', true, 'ESP32 DevKit V1', 'Pending Hardware Integration', 'Not Configured', 'Pending Hardware Integration')
on conflict (device_identifier) do nothing;

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
where d.device_identifier = 'SIM-DEV-001'
on conflict do nothing;
