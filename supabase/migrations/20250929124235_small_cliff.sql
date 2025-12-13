/*
  # إنشاء جدول سجلات الحضور

  1. الجداول الجديدة
    - `attendance_records`
      - `id` (uuid, primary key) - المعرف الفريد
      - `user_id` (uuid, foreign key) - معرف المستخدم
      - `date` (date) - تاريخ الحضور
      - `check_in` (timestamptz) - وقت الحضور
      - `check_out` (timestamptz) - وقت الانصراف
      - `check_in_location` (jsonb) - موقع الحضور
      - `check_out_location` (jsonb) - موقع الانصراف
      - `total_hours` (numeric) - إجمالي الساعات
      - `notes` (text) - ملاحظات
      - `created_at` (timestamp) - تاريخ الإنشاء
      - `updated_at` (timestamp) - تاريخ التحديث

  2. الأمان
    - تفعيل RLS على جدول `attendance_records`
    - إضافة سياسات للقراءة والكتابة
*/

-- إنشاء جدول سجلات الحضور
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamptz,
  check_out timestamptz,
  check_in_location jsonb,
  check_out_location jsonb,
  total_hours numeric(5,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- التأكد من عدم وجود أكثر من سجل واحد لكل مستخدم في اليوم الواحد
  UNIQUE(user_id, date)
);

-- تفعيل Row Level Security
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- سياسة للقراءة - المستخدمون يمكنهم قراءة سجلاتهم الخاصة والمديرون يمكنهم قراءة جميع السجلات
CREATE POLICY "Users can read own records and admins can read all"
  ON attendance_records
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- سياسة للإدراج - المستخدمون يمكنهم إضافة سجلاتهم الخاصة
CREATE POLICY "Users can insert own records"
  ON attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- سياسة للتحديث - المستخدمون يمكنهم تحديث سجلاتهم الخاصة والمديرون يمكنهم تحديث جميع السجلات
CREATE POLICY "Users can update own records and admins can update all"
  ON attendance_records
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- سياسة للحذف - المديرون فقط يمكنهم حذف السجلات
CREATE POLICY "Only admins can delete records"
  ON attendance_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_records(user_id, date);

-- إنشاء trigger لتحديث updated_at
DROP TRIGGER IF EXISTS update_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER update_attendance_records_updated_at
    BEFORE UPDATE ON attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- دالة لحساب إجمالي الساعات تلقائياً
CREATE OR REPLACE FUNCTION calculate_total_hours()
RETURNS TRIGGER AS $$
BEGIN
    -- حساب إجمالي الساعات إذا كان هناك وقت حضور وانصراف
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
        NEW.total_hours = EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600.0;
    ELSE
        NEW.total_hours = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- إنشاء trigger لحساب إجمالي الساعات
DROP TRIGGER IF EXISTS calculate_attendance_hours ON attendance_records;
CREATE TRIGGER calculate_attendance_hours
    BEFORE INSERT OR UPDATE ON attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION calculate_total_hours();