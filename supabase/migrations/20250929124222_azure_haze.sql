/*
  # إنشاء جدول المستخدمين

  1. الجداول الجديدة
    - `users`
      - `id` (uuid, primary key) - مرتبط بـ auth.users
      - `email` (text, unique) - البريد الإلكتروني
      - `full_name` (text) - الاسم الكامل
      - `employee_id` (text, unique) - رقم الموظف
      - `role` (text) - نوع المستخدم (admin/user)
      - `is_active` (boolean) - حالة النشاط
      - `created_at` (timestamp) - تاريخ الإنشاء
      - `updated_at` (timestamp) - تاريخ التحديث

  2. الأمان
    - تفعيل RLS على جدول `users`
    - إضافة سياسات للقراءة والتحديث
*/

-- إنشاء جدول المستخدمين
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  employee_id text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- تفعيل Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- سياسة للقراءة - المستخدمون يمكنهم قراءة بياناتهم الخاصة والمديرون يمكنهم قراءة جميع البيانات
CREATE POLICY "Users can read own data and admins can read all"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- سياسة للتحديث - المستخدمون يمكنهم تحديث بياناتهم الخاصة والمديرون يمكنهم تحديث جميع البيانات
CREATE POLICY "Users can update own data and admins can update all"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- سياسة للإدراج - المديرون فقط يمكنهم إضافة مستخدمين جدد
CREATE POLICY "Only admins can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- سياسة للحذف - المديرون فقط يمكنهم حذف المستخدمين
CREATE POLICY "Only admins can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- إنشاء فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- إنشاء trigger لتحديث updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();