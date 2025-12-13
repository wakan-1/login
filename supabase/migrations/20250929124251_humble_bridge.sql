/*
  # إنشاء المستخدم المدير الأول

  1. إنشاء دالة لإنشاء المدير الأول
    - تتحقق من عدم وجود مديرين آخرين
    - تنشئ حساب المدير في auth.users
    - تضيف بيانات المدير في جدول users

  2. الأمان
    - الدالة محمية ويمكن تشغيلها مرة واحدة فقط
*/

-- دالة لإنشاء المدير الأول
CREATE OR REPLACE FUNCTION create_first_admin(
  admin_email text,
  admin_password text,
  admin_name text,
  admin_employee_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  admin_count integer;
BEGIN
  -- التحقق من عدم وجود مديرين آخرين
  SELECT COUNT(*) INTO admin_count FROM users WHERE role = 'admin';
  
  IF admin_count > 0 THEN
    RETURN json_build_object('success', false, 'message', 'يوجد مدير مسبقاً في النظام');
  END IF;

  -- التحقق من عدم وجود البريد الإلكتروني مسبقاً
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
    RETURN json_build_object('success', false, 'message', 'البريد الإلكتروني موجود مسبقاً');
  END IF;

  -- التحقق من عدم وجود رقم الموظف مسبقاً
  IF EXISTS (SELECT 1 FROM users WHERE employee_id = admin_employee_id) THEN
    RETURN json_build_object('success', false, 'message', 'رقم الموظف موجود مسبقاً');
  END IF;

  -- إنشاء المستخدم في auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    admin_email,
    crypt(admin_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    json_build_object('full_name', admin_name, 'employee_id', admin_employee_id, 'role', 'admin'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- إضافة بيانات المدير في جدول users
  INSERT INTO users (
    id,
    email,
    full_name,
    employee_id,
    role,
    is_active
  ) VALUES (
    new_user_id,
    admin_email,
    admin_name,
    admin_employee_id,
    'admin',
    true
  );

  RETURN json_build_object(
    'success', true, 
    'message', 'تم إنشاء حساب المدير بنجاح',
    'user_id', new_user_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'message', 'خطأ في إنشاء حساب المدير: ' || SQLERRM
    );
END;
$$;

-- استدعاء الدالة لإنشاء المدير الأول
-- يمكنك تغيير البيانات حسب الحاجة
SELECT create_first_admin(
  'admin@company.com',
  'Admin123!',
  'مدير النظام',
  'ADMIN001'
);