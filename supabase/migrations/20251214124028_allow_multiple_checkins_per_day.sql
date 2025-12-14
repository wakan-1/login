/*
  # السماح بتسجيل حضور متعدد في مواقع مختلفة

  تعديل جدول attendance_records للسماح بتسجيل حضور متكرر في نفس اليوم لكن في مواقع مختلفة.
  
  ## التغييرات
  - حذف القيد UNIQUE القديم (user_id, date)
  - إضافة قيد UNIQUE جديد (user_id, date, location_id)
  - هذا يسمح بتسجيل حضور متعدد في مواقع مختلفة في نفس اليوم
  - لكن يمنع تسجيل حضور مكرر في نفس الموقع في نفس اليوم
*/

-- حذف القيد القديم
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_user_id_date_key;

-- إضافة قيد جديد يأخذ في الاعتبار الموقع
ALTER TABLE attendance_records 
ADD CONSTRAINT attendance_records_user_location_date_key 
UNIQUE(user_id, date, location_id);
