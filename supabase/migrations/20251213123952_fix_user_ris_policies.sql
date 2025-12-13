/*
  # إصلاح سياسات RLS لجدول users
  
  تعديل سياسة الإدراج للسماح للمستخدمين الجدد بإنشاء حساباتهم الخاصة
*/

-- حذف السياسة القديمة للإدراج
DROP POLICY IF EXISTS "Only admins can insert users" ON users;

-- إنشاء سياسة جديدة تسمح للمستخدمين بإنشاء حساباتهم الخاصة
CREATE POLICY "Users can create their own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- إضافة سياسة للسماح للمديرين بإنشاء مستخدمين جدد
CREATE POLICY "Admins can insert any user"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
