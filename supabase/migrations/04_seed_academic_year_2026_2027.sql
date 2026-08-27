-- ==============================================================================
-- MIGRATION: Clean up test IDs and Pre-Seed 2026/2027 Academic Year Sundays
-- Start Date: 30. 8. 26 (August 30, 2026) -> End Date: 29. 8. 27 (August 29, 2027)
-- ==============================================================================

-- 1. Remove obsolete test IDs with millisecond timestamps
DELETE FROM public.nedelje_services WHERE id LIKE 's_ay2627_%';

-- 2. Insert all 53 Sundays for Academic Year 2026/2027 with status 'ready'
INSERT INTO public.nedelje_services (id, date, service_date, title, theme_sl, theme_en, status)
VALUES
  ('s-2026-08-30', '30. 8. 26', '30. 8. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-09-06', '6. 9. 26', '6. 9. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-09-13', '13. 9. 26', '13. 9. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-09-20', '20. 9. 26', '20. 9. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-09-27', '27. 9. 26', '27. 9. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-10-04', '4. 10. 26', '4. 10. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-10-11', '11. 10. 26', '11. 10. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-10-18', '18. 10. 26', '18. 10. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-10-25', '25. 10. 26', '25. 10. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-11-01', '1. 11. 26', '1. 11. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-11-08', '8. 11. 26', '8. 11. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-11-15', '15. 11. 26', '15. 11. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-11-22', '22. 11. 26', '22. 11. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-11-29', '29. 11. 26', '29. 11. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-12-06', '6. 12. 26', '6. 12. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-12-13', '13. 12. 26', '13. 12. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-12-20', '20. 12. 26', '20. 12. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2026-12-27', '27. 12. 26', '27. 12. 26', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-01-03', '3. 1. 27', '3. 1. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-01-10', '10. 1. 27', '10. 1. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-01-17', '17. 1. 27', '17. 1. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-01-24', '24. 1. 27', '24. 1. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-01-31', '31. 1. 27', '31. 1. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-02-07', '7. 2. 27', '7. 2. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-02-14', '14. 2. 27', '14. 2. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-02-21', '21. 2. 27', '21. 2. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-02-28', '28. 2. 27', '28. 2. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-03-07', '7. 3. 27', '7. 3. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-03-14', '14. 3. 27', '14. 3. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-03-21', '21. 3. 27', '21. 3. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-03-28', '28. 3. 27', '28. 3. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-04-04', '4. 4. 27', '4. 4. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-04-11', '11. 4. 27', '11. 4. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-04-18', '18. 4. 27', '18. 4. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-04-25', '25. 4. 27', '25. 4. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-05-02', '2. 5. 27', '2. 5. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-05-09', '9. 5. 27', '9. 5. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-05-16', '16. 5. 27', '16. 5. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-05-23', '23. 5. 27', '23. 5. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-05-30', '30. 5. 27', '30. 5. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-06-06', '6. 6. 27', '6. 6. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-06-13', '13. 6. 27', '13. 6. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-06-20', '20. 6. 27', '20. 6. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-06-27', '27. 6. 27', '27. 6. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-07-04', '4. 7. 27', '4. 7. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-07-11', '11. 7. 27', '11. 7. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-07-18', '18. 7. 27', '18. 7. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-07-25', '25. 7. 27', '25. 7. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-08-01', '1. 8. 27', '1. 8. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-08-08', '8. 8. 27', '8. 8. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-08-15', '15. 8. 27', '15. 8. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-08-22', '22. 8. 27', '22. 8. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready'),
  ('s-2027-08-29', '29. 8. 27', '29. 8. 27', 'Nedeljsko bogoslužje', 'Nedeljsko bogoslužje', 'Sunday Service', 'ready')
ON CONFLICT (id) DO UPDATE SET
  date = EXCLUDED.date,
  service_date = EXCLUDED.service_date,
  status = EXCLUDED.status,
  updated_at = NOW();
