/*
  # إصلاح سياسات الأمان لإنشاء المستخدمين

  1. التغييرات
    - إضافة سياسة للسماح للمستخدمين الجدد بإنشاء ملفاتهم الشخصية
    - إصلاح سياسة الإدراج للمستخدمين
    - إضافة سياسة للسماح بالتحديث الذاتي

  2. الأمان
    - المستخدمون يمكنهم إنشاء ملفاتهم الشخصية فقط
    - الإدارة تستطيع إنشاء وتعديل جميع المستخدمين
*/

-- حذف السياسات القديمة إذا كانت موجودة
DROP POLICY IF EXISTS "المستخدمون يمكنهم عرض بياناتهم الشخصية" ON users;
DROP POLICY IF EXISTS "الإدارة تستطيع عرض جميع المستخدمين" ON users;
DROP POLICY IF EXISTS "الإدارة تستطيع إدارة المستخدمين" ON users;

-- سياسة عرض البيانات الشخصية
CREATE POLICY "users_select_own" ON users
  FOR SELECT TO authenticated
  USING (auth.uid()::text = id::text);

-- سياسة عرض جميع المستخدمين للإدارة
CREATE POLICY "admin_select_all_users" ON users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id::text = auth.uid()::text 
      AND u.role = 'admin'
    )
  );

-- سياسة إنشاء الملف الشخصي للمستخدم الجديد
CREATE POLICY "users_insert_own" ON users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = id::text);

-- سياسة إنشاء مستخدمين جدد للإدارة
CREATE POLICY "admin_insert_users" ON users
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id::text = auth.uid()::text 
      AND u.role = 'admin'
    )
  );

-- سياسة تحديث البيانات الشخصية
CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- سياسة تحديث المستخدمين للإدارة
CREATE POLICY "admin_update_users" ON users
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id::text = auth.uid()::text 
      AND u.role = 'admin'
    )
  );

-- سياسة حذف المستخدمين للإدارة فقط
CREATE POLICY "admin_delete_users" ON users
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id::text = auth.uid()::text 
      AND u.role = 'admin'
    )
  );