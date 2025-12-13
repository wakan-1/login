/*
  # إنشاء المستخدم المدير

  1. إنشاء المستخدم المدير في جدول users
    - البريد: admin@company.com
    - الاسم: مدير النظام
    - رقم الموظف: ADMIN001
    - النوع: admin
    - الحالة: نشط

  2. ملاحظات
    - يتم إنشاء المستخدم بـ ID ثابت للمدير
    - كلمة المرور يجب تعيينها في Supabase Auth منفصلاً
*/

-- إنشاء المستخدم المدير في جدول users
INSERT INTO users (
  id,
  email,
  full_name,
  employee_id,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'admin@company.com',
  'مدير النظام',
  'ADMIN001',
  'admin',
  true,
  now(),
  now()
) ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  employee_id = EXCLUDED.employee_id,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = now();