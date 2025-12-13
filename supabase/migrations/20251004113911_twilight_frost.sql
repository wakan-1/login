/*
  # إصلاح صلاحيات المستخدم المدير

  1. حذف السياسات الحالية
  2. إنشاء سياسات جديدة تسمح للمدير بالوصول
  3. إضافة المستخدم المدير مباشرة
  4. إنشاء سياسات مبسطة وآمنة

  ## التغييرات
  - حذف جميع السياسات القديمة
  - إنشاء سياسات جديدة تعتمد على البريد الإلكتروني
  - إضافة المستخدم المدير بالـ ID الصحيح
*/

-- حذف السياسات الحالية
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- إدراج المستخدم المدير مباشرة (تجاهل الأخطاء إذا كان موجود)
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

-- إنشاء سياسات جديدة مبسطة
CREATE POLICY "Admin full access"
    ON users
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'admin@company.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'admin@company.com');

CREATE POLICY "Users read own data"
    ON users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users update own data"
    ON users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- إصلاح سياسات جدول attendance_records أيضاً
DROP POLICY IF EXISTS "Users can read own records and admins can read all" ON attendance_records;
DROP POLICY IF EXISTS "Users can insert own records" ON attendance_records;
DROP POLICY IF EXISTS "Users can update own records and admins can update all" ON attendance_records;
DROP POLICY IF EXISTS "Only admins can delete records" ON attendance_records;

CREATE POLICY "Admin full access attendance"
    ON attendance_records
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'admin@company.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'admin@company.com');

CREATE POLICY "Users own attendance records"
    ON attendance_records
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());