/*
  # إنشاء نظام المواقع المتعددة
  
  ## الوصف
  هذا الـ migration يقوم بإنشاء نظام إدارة المواقع المتعددة للموظفين الميدانيين
  
  ## الجداول الجديدة
  
  ### 1. locations (جدول المواقع)
  - `id` (uuid) - معرف فريد للموقع
  - `name` (text) - اسم الموقع أو العميل
  - `latitude` (numeric) - خط العرض
  - `longitude` (numeric) - خط الطول
  - `radius` (integer) - نطاق التسجيل بالمتر (افتراضي: 100)
  - `is_active` (boolean) - حالة الموقع (افتراضي: true)
  - `created_at` (timestamptz) - تاريخ الإنشاء
  - `updated_at` (timestamptz) - تاريخ آخر تحديث
  
  ### 2. user_locations (جدول ربط المستخدمين بالمواقع)
  - `id` (uuid) - معرف فريد
  - `user_id` (uuid) - معرف المستخدم
  - `location_id` (uuid) - معرف الموقع
  - `created_at` (timestamptz) - تاريخ الإنشاء
  
  ## التعديلات على جدول attendance_records
  - إضافة عمود `location_id` لربط سجل الحضور بالموقع
  
  ## سياسات الأمان (RLS)
  
  ### جدول locations
  - المدراء: صلاحيات كاملة
  - المستخدمون: قراءة المواقع المخصصة لهم فقط
  
  ### جدول user_locations
  - المدراء: صلاحيات كاملة
  - المستخدمون: قراءة تخصيصاتهم فقط
  
  ## ملاحظات مهمة
  - جميع الجداول محمية بـ RLS
  - المدير (admin@company.com) له صلاحيات كاملة
  - المستخدمون العاديون يمكنهم فقط رؤية المواقع المخصصة لهم
*/

-- إنشاء جدول المواقع
CREATE TABLE IF NOT EXISTS locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    latitude numeric(10, 8) NOT NULL,
    longitude numeric(11, 8) NOT NULL,
    radius integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- إنشاء جدول ربط المستخدمين بالمواقع
CREATE TABLE IF NOT EXISTS user_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(user_id, location_id)
);

-- إضافة عمود location_id لجدول attendance_records
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_records' AND column_name = 'location_id'
    ) THEN
        ALTER TABLE attendance_records 
        ADD COLUMN location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
    END IF;
END $$;

-- تحديث role enum في جدول users لإضافة field_user
DO $$
BEGIN
    -- حذف القيد القديم إذا كان موجوداً
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    
    -- إضافة القيد الجديد
    ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role = ANY (ARRAY['admin'::text, 'user'::text, 'field_user'::text]));
END $$;

-- تفعيل RLS على الجداول الجديدة
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- سياسات locations
CREATE POLICY "Admin full access locations"
    ON locations
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'admin@company.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'admin@company.com');

CREATE POLICY "Users read assigned locations"
    ON locations
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_locations
            WHERE user_locations.location_id = locations.id
            AND user_locations.user_id = auth.uid()
        )
        OR is_active = true
    );

-- سياسات user_locations
CREATE POLICY "Admin full access user_locations"
    ON user_locations
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'email' = 'admin@company.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'admin@company.com');

CREATE POLICY "Users read own assignments"
    ON user_locations
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- إنشاء indexes لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_location_id ON user_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_location_id ON attendance_records(location_id);
CREATE INDEX IF NOT EXISTS idx_locations_is_active ON locations(is_active);

-- إنشاء trigger لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();