// Arabic messages for Supabase Auth errors, matched on the stable error code first.
export function authErrorMessage(err: { message: string; code?: string }): string {
  switch (err.code) {
    case 'invalid_credentials':
      return 'الإيميل أو كلمة السر غير صحيحة.';
    case 'email_not_confirmed':
      return 'لازم تأكد الإيميل الأول من الرسالة اللي وصلتك.';
    case 'user_already_exists':
    case 'email_exists':
      return 'الإيميل ده مسجّل قبل كده. سجّل دخول بدل إنشاء حساب.';
    case 'email_address_invalid':
      return 'الإيميل ده مش مقبول. اتأكد إنه مكتوب صح.';
    case 'over_email_send_rate_limit':
      return 'الموقع بعت إيميلات كتير في الساعة دي ووصل للحد المسموح. جرّب تاني بعد ساعة.';
    case 'over_request_rate_limit':
      return 'محاولات كتير ورا بعض. استنى دقايق وجرّب تاني.';
    case 'weak_password':
      return 'كلمة السر ضعيفة. استخدم 6 حروف على الأقل وخليها صعبة التخمين.';
    case 'same_password':
      return 'كلمة السر الجديدة لازم تكون مختلفة عن القديمة.';
    case 'otp_expired':
      return 'الرابط انتهت صلاحيته. اطلب رابط جديد.';
  }
  const m = err.message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'الإيميل أو كلمة السر غير صحيحة.';
  if (m.includes('email not confirmed')) return 'لازم تأكد الإيميل الأول من الرسالة اللي وصلتك.';
  if (m.includes('already registered')) return 'الإيميل ده مسجّل قبل كده. سجّل دخول بدل إنشاء حساب.';
  if (m.includes('email rate limit')) return 'الموقع بعت إيميلات كتير في الساعة دي ووصل للحد المسموح. جرّب تاني بعد ساعة.';
  if (m.includes('rate limit')) return 'محاولات كتير ورا بعض. استنى دقايق وجرّب تاني.';
  if (m.includes('password')) return 'كلمة السر لازم تكون 6 حروف على الأقل.';
  return err.message;
}
