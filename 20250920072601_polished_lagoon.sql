/*
  # إنشاء نظام تسجيل الحضور والانصراف

  1. الجداول الجديدة
    - `users` - بيانات المستخدمين
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `full_name` (text)
      - `employee_id` (text, unique)
      - `role` (text) - 'user' أو 'admin'
      - `is_active` (boolean)
      - `created_at` (timestamp)
    
    - `attendance_records` - سجل الحضور والانصراف
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `check_in` (timestamptz)
      - `check_out` (timestamptz)
      - `check_in_location` (jsonb) - {lat, lng, address}
      - `check_out_location` (jsonb)
      - `total_hours` (numeric)
      - `date` (date)
      - `created_at` (timestamp)

    - `office_locations` - مواقع المكاتب المسموحة
      - `id` (uuid, primary key)
      - `name` (text)
      - `latitude` (numeric)
      - `longitude` (numeric)
      - `radius` (integer) - بالأمتار
      - `is_active` (boolean)

  2. الأمان
    - تفعيل RLS على جميع الجداول
    - سياسات للمستخدمين والإدارة
*/

-- إنشاء جدول المستخدمين
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  employee_id text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- إنشاء جدول سجل الحضور
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in timestamptz,
  check_out timestamptz,
  check_in_location jsonb,
  check_out_location jsonb,
  total_hours numeric,
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- إنشاء جدول مواقع المكاتب
CREATE TABLE IF NOT EXISTS office_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  radius integer DEFAULT 50,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- تفعيل الأمان على مستوى الصفوف
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_locations ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان للمستخدمين
CREATE POLICY "المستخدمون يمكنهم عرض بياناتهم الشخصية"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "الإدارة تستطيع عرض جميع المستخدمين"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id::text = auth.uid()::text 
      AND u.role = 'admin'
    )
  );

CREATE POLICY "الإدارة تستطيع إدارة المستخدمين"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id::text = auth.uid()::text 
      AND u.role = 'admin'
    )
  );

-- سياسات الأمان لسجل الحضور
CREATE POLICY "المستخدمون يمكنهم عرض سجل حضورهم"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "المستخدمون يمكنهم إضافة سجل حضورهم"
  ON attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "المستخدمون يمكنهم تحديث سجل حضورهم"
  ON attendance_records FOR UPDATE
  TO authenticated
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "الإدارة تستطيع عرض جميع السجلات"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id::text = auth.uid()::text 
      AND u.role = 'admin'
    )
  );

-- سياسات الأمان لمواقع المكاتب
CREATE POLICY "الجميع يمكنهم عرض المواقع النشطة"
  ON office_locations FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "الإدارة تستطيع إدارة المواقع"
  ON office_locations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id::text = auth.uid()::text 
      AND u.role = 'admin'
    )
  );

-- إدراج موقع مكتب افتراضي (الرياض)
INSERT INTO office_locations (name, latitude, longitude, radius, is_active)
VALUES ('المكتب الرئيسي', 24.7136, 46.6753, 50, true)
ON CONFLICT DO NOTHING;

-- إنشاء دالة لحساب ساعات العمل
CREATE OR REPLACE FUNCTION calculate_work_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.check_out IS NOT NULL AND NEW.check_in IS NOT NULL THEN
    NEW.total_hours = EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600.0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء مشغل لحساب ساعات العمل تلقائياً
CREATE OR REPLACE TRIGGER calculate_hours_trigger
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_work_hours();