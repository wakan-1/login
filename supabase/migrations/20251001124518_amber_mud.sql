/*
  # إصلاح سياسات RLS لحل مشكلة التكرار اللانهائي

  1. حذف السياسات القديمة
  2. إنشاء سياسات جديدة بدون تكرار
  3. إضافة المستخدم المدير
*/

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Users can read own data and admins can read all" ON users;
DROP POLICY IF EXISTS "Users can update own data and admins can update all" ON users;
DROP POLICY IF EXISTS "Only admins can insert users" ON users;
DROP POLICY IF EXISTS "Only admins can delete users" ON users;

-- إنشاء سياسات جديدة مبسطة
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'admin@company.com'
    )
  );

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can update all users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'admin@company.com'
    )
  );

CREATE POLICY "Admins can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'admin@company.com'
    )
  );

CREATE POLICY "Admins can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'admin@company.com'
    )
  );

-- إضافة المستخدم المدير
INSERT INTO users (
  id,
  email,
  full_name,
  employee_id,
  role,
  is_active
) VALUES (
  'd701e110-eb7d-48fe-b964-f97ace75b0be',
  'admin@company.com',
  'مدير النظام',
  'ADMIN001',
  'admin',
  true
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  employee_id = EXCLUDED.employee_id,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;