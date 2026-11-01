-- =====================================================================
-- Casa Atleta — starting content for Jhumka City Run
-- Run once AFTER schema.sql. Everything here can be edited later in /admin.
-- Unconfirmed details are left empty so the website shows "To be announced".
-- =====================================================================

with ev as (
  insert into events (slug, code_prefix, name, tagline, description, venue)
  values (
    'jhumka-city-run', 'JCR', 'Jhumka City Run',
    'One city. One community. One starting line.',
    'A celebration of running, fitness and community in Bareilly.',
    'Bareilly, Uttar Pradesh'
  )
  on conflict (slug) do update set name = excluded.name
  returning id
)
insert into races (event_id, code, name, positioning, audience, distance_label, is_kids, sort)
select ev.id, r.code, r.name, r.positioning, r.audience, r.distance_label, r.is_kids, r.sort
from ev, (values
  ('5K',  '5K',                'Start your running journey',          'Beginners and recreational runners',              '5 km',    false, 1),
  ('10K', '10K',               'Push your limits',                    'Regular runners and people building endurance',  '10 km',   false, 2),
  ('21K', '21K Half Marathon', 'Take on the half-marathon challenge', 'Experienced, prepared runners',                  '21.1 km', false, 3),
  ('KID', 'Kids Run',          'Little legs, big finish',             'Children, registered by a parent or guardian',    null,      true,  4)
) as r(code, name, positioning, audience, distance_label, is_kids, sort)
on conflict (event_id, code) do nothing;

insert into faqs (event_id, question, answer, sort)
select e.id, f.q, f.a, f.sort from events e, (values
  ('Can beginners take part?', 'Yes. The 5K is designed for first-time and recreational runners, and you can walk-run at your own pace. Cut-off times will be published once confirmed.', 1),
  ('What is the difference between the 5K, 10K and 21K?', 'The 5K is a welcoming entry point for beginners. The 10K suits regular runners building endurance. The 21K is a half marathon for experienced runners who have trained for the distance.', 2),
  ('Can my children take part?', 'Yes — the Kids Run is designed for young athletes. The distance, age groups and parent/guardian consent requirements will be announced with registration.', 3),
  ('What is included in my registration?', 'Race-kit details such as the T-shirt, bib, timing and medal will be announced before registrations open.', 4),
  ('Is there an age limit?', 'Age eligibility for each distance will be published with registration. The 21K Half Marathon may have additional rules.', 5),
  ('How and where do I collect my bib?', 'Bib collection dates, the venue and the ID you need to bring will be shared by email and on this page.', 6),
  ('Will there be timing chips and results?', 'Timing arrangements will be confirmed before race day. If chip timing is used, results will be published on this page.', 7),
  ('Can I cancel or transfer my entry?', 'Please see the cancellation, transfer and refund policy, which will be published before registrations open.', 8),
  ('What happens if the event is postponed?', 'Our postponement policy will be published with the event terms and conditions.', 9),
  ('Will there be water and medical support?', 'Hydration stations, medical support and emergency arrangements will be detailed on this page once confirmed.', 10)
) as f(q, a, sort)
where e.slug = 'jhumka-city-run'
  and not exists (select 1 from faqs where event_id = e.id);

insert into announcements (event_id, title, body)
select id, 'Registrations opening soon', 'Get notified the moment entries open for all four races.'
from events where slug = 'jhumka-city-run'
  and not exists (select 1 from announcements);
