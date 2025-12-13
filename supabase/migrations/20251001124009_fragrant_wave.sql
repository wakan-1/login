/*
  # إصلاح المستخدم المدير

  1. حذف المستخدم المدير إذا كان موجود
  2. إنشاء المستخدم المدير من جديد
  3. التأكد من الصلاحيات
*/

-- حذف المستخدم المدير إذا كان موجود
DELETE FROM public.users WHERE email = 'admin@company.com';

-- إنشاء المستخدم المدير
INSERT INTO public.users (
  id,
  email,
  full_name,
  employee_id,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  'd701e110-eb7d-48fe-b964-f97ace75b0be',
  'admin@company.com',
  'مدير النظام',
  'ADMIN001',
  'admin',
  true,
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  employee_id = EXCLUDED.employee_id,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = now();