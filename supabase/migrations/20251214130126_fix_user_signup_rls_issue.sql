/*
  # إصلاح مشكلة RLS عند تسجيل مستخدم جديد

  المشكلة: عند تسجيل مستخدم جديد، الـ trigger يحاول إدراج سجل في جدول users
  لكن RLS policies تمنع الإدراج لأن المستخدم الجديد لم يكن authenticated بعد.

  الحل: تحديث دالة create_user_on_signup لتجاوز RLS عند الإدراج
*/

-- حذف الـ trigger والدالة القديمة
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS create_user_on_signup();

-- إنشاء دالة جديدة مع تعطيل RLS أثناء الإدراج
CREATE OR REPLACE FUNCTION create_user_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        id,
        email,
        full_name,
        employee_id,
        role,
        is_active
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_metadata->>'full_name', 'مستخدم جديد'),
        COALESCE(NEW.raw_user_metadata->>'employee_id', 'EMP-' || NEW.id),
        COALESCE(NEW.raw_app_metadata->>'role', 'user'),
        true
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- إنشاء trigger جديد
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_user_on_signup();

-- إضافة سياسة RLS للسماح للـ service role بالإدراج
CREATE POLICY "Service role can insert users"
  ON users
  FOR INSERT
  TO service_role
  WITH CHECK (true);
