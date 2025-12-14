/*
  # إضافة trigger تلقائي لإنشاء المستخدمين
  
  عند تسجيل مستخدم جديد في auth.users يتم إنشاء سجل تلقائي في جدول users
  هذا يضمن أن كل مستخدم له سجل في جدول users
*/

-- دالة لإنشاء مستخدم جديد في جدول users عند التسجيل
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- حذف الـ trigger إذا كان موجوداً
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- إنشاء trigger لتنفيذ الدالة عند إنشاء مستخدم جديد
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_user_on_signup();