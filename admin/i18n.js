// Admin panel language layer (Arabic is the source language, English is a translation overlay).
// How it works: the UI is written in Arabic. When the language is English, a MutationObserver
// translates every Arabic text node and placeholder/title/aria-label it sees, using:
//   1) an exact match in DICT (after trimming and collapsing spaces),
//   2) PATTERNS (regex) for sentences with numbers inside,
//   3) the same lookup after stripping leading/trailing emoji/punctuation,
//   4) word-run by word-run, but only if every Arabic run in the string is known
//      (so we never show half-Arabic, half-English sentences, and names/regions stay as typed).
// To add a string: add `'النص العربي': 'English text',` to DICT (the key is the Arabic text
// exactly as it shows on screen, without surrounding emoji). Switching language reloads the page.

const KEY = 'fsa-lang';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
export const lang = lsGet(KEY) === 'en' ? 'en' : 'ar';
export const isEn = lang === 'en';
// tr('عربي', 'English') for strings written directly in code
export const tr = (ar, en) => (isEn ? en : ar);

export function setLang(l, view) {
  lsSet(KEY, l);
  try { if (view) sessionStorage.setItem('fsa-view', view); } catch (_) {}
  location.reload();
}

const DICT = {
  // ---- navigation / pages ----
  'لوحة المؤشرات': 'Dashboard', 'ماستر كي': 'Master key', 'الماستر كي': 'Master key', 'الشركاء': 'Partners', 'المناديب': 'Couriers',
  'طلبات السحب': 'Withdrawals', 'المحادثات': 'Chats', 'رسالة جماعية': 'Broadcast', 'الشركات والبونص': 'Companies & bonus',
  'الوظائف': 'Jobs', 'الوظايف': 'Jobs', 'مؤشرات التلاعب': 'Fraud signals', 'فريق الإدارة': 'Admin team', 'الإعدادات': 'Settings',
  'الأخطاء': 'Errors', 'سجل التغييرات': 'Audit log', 'لوحة الإدارة': 'Admin panel', 'Full Speed — لوحة الإدارة': 'Full Speed — Admin',
  'الشركاء (الفريلانسرز': 'Partners (freelancers', 'الشركاء (الفريلانسرز)': 'Partners (freelancers)',
  'مؤشرات التلاعب والجودة': 'Fraud & quality signals', 'الشركات وقواعد البونص': 'Companies & bonus rules',
  'سجل التغييرات والأخطاء': 'Audit log & errors', 'الرسايل الجماعية': 'Broadcasts', 'إعدادات التطبيق': 'App settings',
  // ---- auth / account ----
  'الإيميل': 'Email', 'كلمة المرور': 'Password', 'دخول': 'Sign in', 'خروج': 'Sign out', 'مفيش صلاحية إدارة': 'No admin access',
  'الحساب': 'Account', 'مش مضاف لفريق الإدارة أو موقوف. اطلب من المالك يضيفك': 'is not on the admin team or is disabled. Ask the owner to add you',
  'تغيير كلمة المرور': 'Change password', 'كلمة المرور الجديدة (8 على الأقل': 'New password (8+ characters', 'كلمة المرور الجديدة (8 على الأقل)': 'New password (8+ characters)',
  'حروف/أرقام على الأقل': 'characters minimum', '8 حروف/أرقام على الأقل': 'At least 8 characters', 'تم تغيير كلمة المرور': 'Password changed',
  'المالك': 'Owner', 'مدير': 'Admin', 'مالية': 'Finance', 'توظيف': 'Recruiter', 'مشاهدة فقط': 'Viewer', 'صلاحيات مخصّصة': 'custom permissions',
  'المالك • صلاحيات مخصّصة': 'Owner • custom permissions',
  // ---- daily report / push ----
  'التقرير اليومي على الموبايل': 'Daily report on mobile', 'مقفول من المتصفح': 'Blocked by the browser', 'مفعّل ✓': 'On ✓', 'مش مفعّل': 'Off',
  'فعّل': 'Turn on', 'إيقاف': 'Turn off', 'بيوصلك كل يوم حوالي الساعة 9 الصبح': 'Arrives every day around 9 AM',
  'بيوصلك كل يوم حوالي الساعة 9 الصبح.': 'Arrives every day around 9 AM.',
  'التقرير اليومي اتقفل': 'Daily report turned off', 'التقرير اليومي اتفعّل 🔔 هيوصلك كل يوم الصبح': 'Daily report on 🔔 — every morning',
  'المتصفح ده مش بيدعم الإشعارات': 'This browser does not support notifications', 'ضيف الموقع للشاشة الرئيسية الأول (آيفون': 'Add the site to your home screen first (iPhone',
  'الإشعارات مقفولة — افتحها من إعدادات المتصفح.': 'Notifications are blocked — enable them in browser settings.',
  // ---- generic actions ----
  'حفظ': 'Save', 'إلغاء': 'Cancel', 'تأكيد': 'Confirm', 'تعديل': 'Edit', 'حذف': 'Delete', 'رفض': 'Reject', 'رجوع': 'Back', 'إرسال': 'Send',
  'إضافة': 'Add', 'تطبيق': 'Apply', 'نسخ': 'Copy', 'طباعة': 'Print', 'تصدير': 'Export', 'اختار': 'Choose', 'اختار...': 'Choose...', 'نقل': 'Move',
  'السابق': 'Previous', 'التالي': 'Next', 'الملف': 'Profile', 'تفصيل': 'Details', 'جاري': 'Working', 'جاري...': 'Working...', 'تم': 'Done', 'تم ✅': 'Done ✅',
  'تم الحفظ': 'Saved', 'اتحفظ': 'Saved', 'اتحفظت': 'Saved', 'اتحفظت ✅': 'Saved ✅', 'تم الإلغاء': 'Cancelled', 'تمت الإضافة': 'Added', 'تمت الإضافة ✅': 'Added ✅',
  'استرجاع': 'Restore', 'معاينة': 'Preview', 'ابعت': 'Send', 'Excel تصدير': 'Export Excel', 'تصدير Excel': 'Export Excel', 'رفع صورة': 'Upload image',
  'إلغاء التحديد': 'Clear selection', 'تم تحديد': 'Selected', 'تطبيق الحالة': 'Apply status', 'تحديث': 'Refresh',
  'لا توجد بيانات': 'No data', 'لا توجد شركات': 'No companies', 'جاري العد': 'Counting', 'جاري العد…': 'Counting…', 'الكل': 'All', 'كمان': 'more',
  'حصل خطأ غير متوقع': 'Something went wrong', 'اكتب مبلغ صحيح.': 'Enter a valid amount.', 'اكتب مبلغ صحيح': 'Enter a valid amount',
  'راجع البيانات المكتوبة.': 'Check the entered data.', 'لازم تكتب السبب.': 'A reason is required.', 'لازم تكتب السبب': 'A reason is required',
  'صلاحيتك لا تسمح بالإجراء ده.': 'You do not have permission for this.', 'مفيش اتصال بالإنترنت. حاول تاني.': 'No internet connection. Try again.',
  'بيانات الدخول غير صحيحة.': 'Wrong email or password.', 'كلمة المرور قصيرة.': 'Password is too short.',
  'كلمة المرور لازم 6 حروف/أرقام على الأقل.': 'Password must be at least 6 characters.',
  'صفحة': 'Page', 'سجل': 'records', 'نتيجة': 'results', 'يوم': 'days', 'ساعة': 'hours',
  // ---- columns / fields ----
  'التاريخ': 'Date', 'الاسم': 'Name', 'الموبايل': 'Mobile', 'المحافظة': 'Governorate', 'المنطقة': 'Area', 'الحالة': 'Status', 'الرصيد': 'Balance',
  'الكود': 'Code', 'المندوب': 'Courier', 'الشركة': 'Company', 'الشريك': 'Partner', 'الورق': 'Papers', 'الأيام': 'Days', 'البونص': 'Bonus',
  'الشركة / الوظيفة': 'Company / job', 'المبلغ': 'Amount', 'الطريقة': 'Method', 'التحويل على': 'Pay to', 'رقم الطلب': 'Request #',
  'النوع': 'Type', 'البيان': 'Description', 'الوقت': 'Time', 'المستخدم': 'User', 'العملية': 'Action', 'التغيير': 'Change', 'الحدث': 'Event',
  'الصلاحية': 'Role', 'الصلاحيات': 'Permissions', 'الدور': 'Role', 'النسبة': 'Rate', 'العنوان': 'Title', 'الرسالة': 'Message', 'التفاصيل': 'Details',
  'المسمى الوظيفي': 'Job title', 'السن': 'Age', 'نوع الدوام': 'Work type', 'المركبة': 'Vehicle', 'التسعيرة للمندوب': 'Courier pricing',
  'التسعيرة / البونص': 'Pricing / bonus', 'نص البونص للشريك': 'Bonus text for partners', 'تاريخ الانتهاء': 'End date', 'الانتهاء': 'Ends',
  'الورق المطلوب': 'Required papers', 'المتقدمين': 'Applicants', 'اسم الشركة': 'Company name', 'اللوجو': 'Logo', 'المكان': 'Location',
  'الإيميل (اختياري)': 'Email (optional)', 'كود الإحالة': 'Referral code', 'موبايل الشريك': 'Partner mobile', 'موبايل المندوب': 'Courier mobile',
  'اسم المندوب': 'Courier name', 'تاريخ الورق': 'Papers date', 'بداية الشغل': 'Start date', 'آخر يوم شغل': 'Last working day', 'أول يوم شغل': 'First working day',
  'تاريخ استكمال الورق': 'Papers completed on', 'بيانات التحويل': 'Payout details', 'العدد (14 يوم': 'Count (14 days', 'المستوى': 'Level', 'اللون': 'Colour',
  'أيقونة': 'Icon', 'شكله': 'Look', 'اسم المستوى': 'Level name', 'من كام شغال': 'From hired count', 'النشاط': 'Activity', 'ملاحظة': 'Note',
  'ملاحظات': 'Notes', 'ملاحظة (اختياري': 'Note (optional', 'ملاحظة (اختياري)': 'Note (optional)', 'رابط (اختياري': 'Link (optional', 'رابط (اختياري)': 'Link (optional)',
  'السجل': 'History', 'الفلوس': 'Money', 'الرسايل': 'Messages', 'المحادثة': 'Chat', 'مين يستلم؟': 'Who receives it?',
  // ---- statuses ----
  'مفعّل': 'Active', 'قيد المراجعة': 'Under review', 'معلّق': 'On hold', 'موقوف': 'Disabled', 'تحت المراجعة': 'Under review', 'مرشح جديد': 'New candidate',
  'تم التعيين / شغال': 'Hired / working', 'اتعيّن / شغال': 'Hired / working', 'موقوف مؤقتاً': 'Paused', 'مرفوض': 'Rejected', 'تم التحويل': 'Paid',
  'متجمّد': 'Frozen', 'نشطة': 'Active', 'متوقفة': 'Paused', 'مقفول': 'Closed', 'مفتوح': 'Open', 'ملغي': 'Cancelled', 'لم يبدأ': 'Not started',
  'مرشح جديد — من غير ورق': 'New — no papers', 'مرشح جديد — خلّص الورق': 'New — papers done', 'موقوف / مرفوض': 'Paused / rejected',
  'جديد من غير ورق': 'New, no papers', 'خلّص الورق': 'Papers done', 'اتعيّن': 'Hired', 'شغالين': 'working', 'مستنيين': 'waiting',
  'منتهية / مكتملة': 'Ended / full', 'نشطة وظاهرة للشركاء': 'Active and visible to partners', 'انتظار': 'Waiting', 'في السلة': 'In trash',
  // ---- filters ----
  'كل الحالات': 'All statuses', 'كل المحافظات': 'All governorates', 'كل الشركات': 'All companies', 'كل الاستحقاقات': 'All bonuses', 'كل الأنواع': 'All types',
  'كل المستويات': 'All levels', 'كل المستخدمين': 'All users', 'كل الشركاء المفعّلين': 'All active partners', 'الكل (عدا السلة': 'All (except trash',
  'الكل (عدا السلة)': 'All (except trash)', 'النهارده بس': 'Today only', 'بدون شركة': 'No company', 'بدون شركة مطابقة': 'No matching company', 'بدون بونص': 'No bonus',
  'بحث بالاسم، الموبايل، الإيميل، المنطقة': 'Search name, mobile, email, area', 'بحث: المندوب، الكود، موبايل، الشريك': 'Search courier, code, mobile, partner',
  'بحث: وظيفة، منطقة، تسعيرة': 'Search job, area, pricing', 'بحث بالشريك أو الموبايل': 'Search partner or mobile', 'بحث باسم الشريك': 'Search partner name',
  'بحث في المحتوى': 'Search content', 'دوّر على الشريك': 'Find a partner', 'بالاسم، الموبايل، كود الإحالة، أو المنطقة…': 'Name, mobile, referral code, or area…',
  'بالاسم، الموبايل، كود الإحالة، أو المنطقة': 'Name, mobile, referral code, or area', 'دوّر على المنطقة': 'Search area', 'جدول': 'Table', 'لوحة المراحل': 'Stage board',
  'طريقة العرض': 'View', 'تقرير مالي': 'Finance report', 'تحديث جماعي': 'Bulk update', 'تحديث جماعي لـ': 'Bulk update for', 'رفض جماعي': 'Bulk reject',
  'تغيير حالة جماعي': 'Bulk status change',
  // ---- dashboard ----
  'إجمالي الشركاء': 'Total partners', 'إجمالي الترشيحات': 'Total nominations', 'اتعيّنوا': 'Hired', 'مناديب اتعيّنوا': 'Couriers hired', 'شغالين دلوقتي': 'Working now',
  'البونص المستحق': 'Bonus earned', 'إجمالي البونص المستحق': 'Total bonus earned', 'إجمالي البونص المستحق للشركاء': 'Total bonus earned by partners',
  'طلبات سحب منتظرة': 'Pending withdrawals', 'طلبات سحب': 'Withdrawal requests', 'وظائف نشطة': 'Active jobs', 'ترشيحات مستنية مراجعة': 'Nominations awaiting review',
  'ترشيحات متأخرة': 'Late nominations', 'ترشيحات متأخرة +48 ساعة': 'Nominations late 48h+', 'نسبة التعيين': 'Hire rate', 'رحلة المندوب': 'Courier journey',
  'كل مرحلة': 'each stage', 'أعلى الشركاء أرباحاً': 'Top partners by earnings', 'المناديب الشغالين حسب الشركة': 'Working couriers by company',
  'أرصدة متاحة لم تُسحب': 'Balances not withdrawn', 'عدد الترشيحات': 'Nominations', 'خلّصوا الورق': 'Papers done', 'بدأوا شغل': 'Started work', 'بدأوا': 'Started',
  'مستني من': 'waiting since', 'مفيش ترشيحات مستنية مراجعة أكتر من 48 ساعة': 'No nominations waiting more than 48 hours',
  'كل الترشيحات اتراجعت في وقتها': 'All nominations were reviewed on time', 'استخدام التطبيق — آخر 14 يوم': 'App usage — last 14 days',
  'أجهزة فتحت التطبيق يومياً': 'Devices that opened the app daily', 'أجهزة فتحت التطبيق كل يوم': 'Devices that opened the app each day',
  'أرقام مجمّعة بدون أي بيانات شخصية': 'Aggregated numbers, no personal data', 'لسه مفيش بيانات استخدام': 'No usage data yet',
  'عدد المناديب اللي وصلوها من إجمالي الترشيحات (المرفوضين مش محسوبين في المراحل': 'Couriers reaching each stage out of all nominations (rejected not counted in stages',
  'من أكتر من 48 ساعة. التأخير بيخلّي الشركاء يزهقوا': 'for over 48 hours. Delays frustrate partners',
  'وعدّى عليها أكتر من 48 ساعة — الشريك مستني رد': 'and more than 48 hours passed — the partner is waiting',
  'عرض الكل في المناديب': 'See all in couriers', 'اتقبلوا بعد المراجعة': 'Accepted after review', 'مندوب شغال': 'working couriers',
  // ---- partners ----
  'شريك': 'partner', 'مسجّل': 'Joined', 'رجوع للشركاء': 'Back to partners', 'شوف التطبيق بعينه': 'View their app', 'بيفتح تطبيق الشريك للقراءة بس': 'Opens the partner app read-only',
  'كشف حساب شهري': 'Monthly statement', 'رسالة': 'Message', 'تجميد الأرباح': 'Freeze earnings', 'فك التجميد': 'Unfreeze', 'إجمالي الأرباح': 'Total earnings', 'اتصرف': 'Paid out',
  'الرصيد المتاح': 'Available balance', 'لسه مرشّحش حد': 'No nominations yet', 'سجل الأرباح': 'Earnings history', 'تسوية يدوية': 'Manual adjustment', 'السحوبات': 'Withdrawals',
  'آخر الرسايل': 'Latest messages', 'افتح المحادثة': 'Open chat', 'مفيش رسايل لسه': 'No messages yet', 'ملاحظات داخلية (مش بتظهر للشريك': 'Internal notes (not shown to the partner',
  'ملاحظات داخلية (مش بتظهر للشريك)': 'Internal notes (not shown to the partner)', 'حفظ الملاحظات': 'Save notes', 'مفيش تغييرات مسجّلة': 'No recorded changes',
  'بونص ورق': 'Papers bonus', 'تسوية': 'Adjustment', 'إلغاء بند أرباح': 'Cancel earnings entry', 'سبب الإلغاء': 'Cancellation reason', 'سبب التسوية': 'Adjustment reason',
  'المبلغ (موجب = إضافة، سالب = خصم)': 'Amount (positive = add, negative = deduct)', 'السبب (هيظهر للشريك)': 'Reason (shown to the partner)', 'السبب (هيظهر للشريك': 'Reason (shown to the partner',
  'السحب والترشيح موقوفين — السبب:': 'Withdrawals and nominations are paused — reason:', 'السحب والترشيح موقوفين — السبب': 'Withdrawals and nominations are paused — reason',
  'سبب التجميد (هيظهر للشريك) — السحب والترشيح هيتوقفوا': 'Freeze reason (shown to the partner) — withdrawals and nominations will stop',
  'هيرجع يقدر يسحب ويرشّح عادي، وهيوصله إشعار بكده': 'They can withdraw and nominate again, and will be notified', 'اتفك التجميد': 'Unfrozen', 'الحساب اتجمّد': 'Account frozen',
  'تغيير الموبايل': 'Change mobile', 'تغيير رقم الموبايل': 'Change mobile number', 'الرقم الجديد (هيبقى هو اسم الدخول': 'New number (becomes the login',
  'الرقم الجديد (هيبقى هو اسم الدخول)': 'New number (becomes the login)', 'تم تغيير الموبايل': 'Mobile changed', 'تم تغيير الموبايل ✅': 'Mobile changed ✅',
  'كلمة مرور جديدة للشريك': 'New password for the partner', 'كلمة مرور مبدئية': 'Initial password', 'الموبايل (اسم الدخول': 'Mobile (login', 'الموبايل (اسم الدخول)': 'Mobile (login)',
  'إيقاف الأكونت': 'Disable account', 'بيقفل الدخول ويخرّجه من كل الأجهزة': 'Blocks login and signs out of all devices', 'إيقاف مؤقت': 'Pause',
  'مفيش حذف للحسابات — لإيقاف حساب غيّر الحالة لـ': 'Accounts are never deleted — to stop an account change status to', 'صفوف مكررة (قديمة': 'Duplicate rows (legacy', 'صفوف مكررة (قديمة)': 'Duplicate rows (legacy)',
  'تخش بيه على تطبيق أي شريك وتشوف كل حاجة بعينه': 'Open any partner\'s app and see exactly what they see', 'عرض بس': 'view only',
  '، مفيش أي حاجة بتتغيّر، والشريك مش بيحس بحاجة': ', nothing changes and the partner is not notified', 'مفيش أي حاجة بتتغيّر، والشريك مش بيحس بحاجة.': 'nothing changes and the partner is not notified.',
  'خش بيه': 'Open as', 'مفيش شريك بالبحث ده': 'No partner matches this search', 'الصفحة دي للمالك بس.': 'This page is for the owner only.', 'الصفحة دي للمالك بس': 'This page is for the owner only',
  'كمان — ضيّق البحث': 'more — narrow the search', 'شريك إجمالي — اكتب للبحث': 'partners total — type to search', 'هيتغير': 'Will change', 'شريك لحالة': 'partners to status',
  'كشف آلي من لوحة الإدارة': 'Auto statement from the admin panel', 'رصيد أول الشهر': 'Opening balance', 'الإجمالي ورصيد آخر الشهر': 'Total and closing balance',
  'مفيش حركات في الشهر ده': 'No activity this month', 'الشهر': 'Month', 'أرباح': 'Earnings', 'خصم': 'Deduction', 'سحب': 'Withdrawal', 'كسب': 'Earned', 'رصيد الشريك': 'Partner balance',
  'الأرباح الملغية وطلبات السحب المرفوضة مش محسوبة. السحوبات محسوبة بتاريخ الطلب (المدفوعة وقيد المراجعة': 'Cancelled earnings and rejected withdrawals are excluded. Withdrawals use the request date (paid and under review',
  'الإيميل ده مستخدم لشريك تاني': 'This email belongs to another partner', 'كود الإحالة ده مستخدم لشريك تاني': 'This referral code belongs to another partner',
  'حرف إنجليزي أو رقم': 'English letters or digits', 'الإيميل غير صحيح.': 'Invalid email.', 'الإيميل غير صحيح': 'Invalid email',
  'رقم المندوب هو نفس رقم الشريك — يعني الشريك سجّل نفسه كمندوب عشان ياخد البونص': 'The courier number equals the partner number — the partner nominated themselves for the bonus',
  'شريك رشّح نفسه': 'Self-nominating partner', 'ترشيح النفس': 'Self-nomination',
  // ---- couriers ----
  'مندوب': 'courier', 'الورق ✍': 'Papers', 'ورق': 'Papers', 'ورق المندوب': 'Courier papers', 'تعديل المندوب': 'Edit courier', 'تعديل المناديب': 'Edit couriers', 'عرض المناديب': 'Show couriers',
  'نقل لـ': 'Move to', 'نقل المندوب لمرحلة تانية': 'Move courier to another stage', 'تعيين المندوب': 'Hire courier', 'رفض المندوب': 'Reject courier',
  'رفض المندوب هيلغي أي بونص اتحسب للشريك عليه. متأكد؟': 'Rejecting will cancel any bonus earned on this courier. Are you sure?', 'سبب الرفض': 'Rejection reason',
  'الشريك لسه مرفعش ورق للمندوب ده': 'The partner has not uploaded papers for this courier yet', 'الروابط صالحة لدقيقة واحدة لكل فتحة': 'Links are valid for one minute each',
  'شيل تاريخ الورق؟': 'Remove the papers date?', 'النقل هنا هيشيل التاريخ ده': 'Moving here removes this date', 'متسجّل إنه خلّص الورق يوم': 'Recorded as papers done on',
  'إعادة حساب البونص': 'Recalculate bonus', 'تمت إعادة الحساب': 'Recalculated', 'البونص بيتحسب تلقائي. اللي اتكسب مش بيتشال لو المندوب اتوقف، وبيتلغي بس لو اتغير لـ': 'Bonus is automatic. Earned bonus stays if the courier pauses and is only cancelled if changed to',
  'مندوب هيلغي البونص بتاعهم': 'couriers — their bonus will be cancelled', 'اسحب الكارت هنا': 'Drop the card here', 'اسحب مندوب هنا': 'Drop a courier here',
  'عرض الكل': 'Show all', 'ج.م بعد': 'EGP after',
  // ---- withdrawals ----
  'تأكيد التحويل': 'Confirm payment', 'تم تحويل': 'Paid', 'إرجاع للمراجعة': 'Back to review', 'سبب الإرجاع': 'Reason for returning', 'تصدير للتحويل': 'Export for payout',
  'بيصدّر الطلبات اللي ظاهرة حسب الفلتر': 'Exports the requests shown by the current filter', 'مفيش طلبات في الفلتر الحالي': 'No requests match this filter',
  'قبل التحويل: اتأكد إن رقم المحفظة/الحساب يخص الشريك نفسه. لو الرقم مختلف عن موبايل الشريك هيظهر تحذير': 'Before paying: make sure the wallet/account belongs to the partner. A warning shows if it differs from their mobile',
  'رقم مختلف عن موبايل الشريك': 'Number differs from partner mobile', 'اتصرف فعلاً': 'Actually paid', 'تم تصدير': 'Exported',
  // ---- chat / broadcast ----
  'رسالة جديدة': 'New message', 'رسالة جديدة لشريك': 'New message to a partner', 'اكتب ردك': 'Write a reply', 'اكتب ردك…': 'Write a reply…',
  'لسه مفيش محادثات. الشركاء يقدروا يبعتوا من تطبيقهم، أو ابدأ انت برسالة جديدة': 'No chats yet. Partners can message from their app, or start a new message',
  'مفيش رسايل لسه — ابدأ انت': 'No messages yet — start one', 'آخر 10 رسايل': 'Last 10 messages', 'لسه مفيش رسايل اتبعتت': 'No broadcasts sent yet', 'اتبعتت لـ': 'Sent to',
  'تأكيد الإرسال': 'Confirm sending', 'مينفعش ترجع فيها بعد الإرسال': 'This cannot be undone after sending', 'استنى لحد ما العدد يظهر': 'Wait until the count appears',
  'مفيش شركاء في الشريحة دي': 'No partners in this segment', 'مثلاً: بونص زيادة الأسبوع ده': 'e.g. Extra bonus this week', 'اكتب التفاصيل اللي الشريك محتاج يعرفها': 'Write what partners need to know',
  'بتروح للشركاء المفعّلين بس. الوظايف الجديدة ليها إشعار تلقائي منفصل (من صفحة الإعدادات': 'Goes to active partners only. New jobs have their own automatic notification (from Settings',
  'بتوصل إشعار جوه التطبيق، وعلى الموبايل للي مفعّل الإشعارات': 'Shows in the app, and on phones with notifications on', 'لما يدوس على الإشعار يفتح': 'Tapping the notification opens',
  'مرشّحوش حد من أسبوع': 'No nominations for a week', 'مرشّحوش حد من أسبوعين': 'No nominations for 2 weeks', 'مرشّحوش حد من شهر': 'No nominations for a month',
  'مرشّحوش حد من شهرين': 'No nominations for 2 months', 'مرشّحوش من': 'No nominations since', 'ترشيحات حالتها': 'Nominations with status', 'ترشيح حالته': 'Nomination status',
  'فتح التطبيق': 'Open the app', 'فتح صفحة الرئيسية': 'Open home', 'فتح صفحة الوظايف': 'Open jobs', 'فتح صفحة مناديبي': 'Open my couriers', 'فتح صفحة المحفظة': 'Open wallet',
  'فتح صفحة حسابي': 'Open my account', 'فتح صفحة المحادثة': 'Open chat', 'فتح صفحة التسجيل': 'Open sign-up page', 'الرئيسية': 'Home', 'مناديبي': 'My couriers', 'المحفظة': 'Wallet', 'حسابي': 'My account',
  'صفحة التسجيل': 'Sign-up page', 'صفحة المحادثة في تطبيق الشريك': 'Chat page in the partner app',
  // ---- companies / jobs ----
  'شركة': 'company', 'وظيفة': 'job', 'الشركة دي موجودة': 'This company already exists', 'الشركة مفعّلة (بتظهر في الترشيح': 'Company active (shown when nominating',
  'الشركة مفعّلة (بتظهر في الترشيح)': 'Company active (shown when nominating)', 'البونص الكامل': 'Full bonus', 'بعد كام يوم': 'After how many days', 'قواعد البونص': 'Bonus rules',
  'بونص استكمال الورق': 'Papers completion bonus', 'شريحة': 'Tier', 'قاعدة بونص': 'Bonus rule', 'أعلى شريحة': 'highest tier', 'الشريك بياخد مبلغ': 'The partner gets the amount of the',
  'لازم شريحة واحدة على الأقل.': 'At least one tier is required.', 'في شريحتين بنفس عدد الأيام': 'Two tiers have the same number of days',
  'هيتعمل تلقائي: ورق 100، 7 أيام 200، 15 يوم 500، والبونص الكامل. تقدر تعدلهم بعد الحفظ.': 'Created automatically: papers 100, 7 days 200, 15 days 500, then the full bonus. You can edit them after saving.',
  'أو الصق رابط https://...': 'or paste a https://... link', 'أو الصق رابط': 'or paste a link', 'تم رفع اللوجو ✅ — دوس حفظ': 'Logo uploaded ✅ — press Save',
  'الصورة لازم تكون PNG أو JPG أو WEBP أو': 'The image must be PNG, JPG, WEBP or', 'الصورة أكبر من 1 ميجا': 'Image is larger than 1 MB', 'الصورة مش مقروءة': 'The image could not be read',
  'مينفعش تتحذف: فيه مناديب مرشحين عليها': 'Cannot delete: couriers are nominated on it', 'مش هتقدر ترجع الوظيفة دي': 'You cannot restore this job',
  'الوظيفة هتختفي من عند الشركاء. تقدر ترجعها': 'The job will be hidden from partners. You can restore it', 'نقل للسلة': 'Move to trash', 'اتنقلت للسلة': 'Moved to trash',
  'السلة': 'Trash', 'حذف نهائي': 'Delete permanently', 'اتحذفت': 'Deleted', 'تم نشر الوظيفة': 'Job published', 'نشر وظيفة جديدة': 'Post a new job', 'نشر': 'Publish',
  'موتوسيكل': 'Motorcycle', 'سيارة': 'Car', 'دراجة / اسكوتر': 'Bicycle / scooter', 'تروسيكل': 'Tricycle', 'مترجل (بدون مركبة': 'On foot (no vehicle', 'مترجل (بدون مركبة)': 'On foot (no vehicle)',
  'دوام كامل': 'Full-time', 'بارت تايم': 'Part-time', 'شفتات متغيرة': 'Rotating shifts', 'عمل حر': 'Freelance', 'من 21 لـ': 'From 21 to', 'من 21 لـ 40': 'From 21 to 40',
  'شهادة ميلاد': 'Birth certificate', 'رخصة قيادة': 'Driving licence', 'رخصة مركبة': 'Vehicle licence', 'فيش جنائي': 'Criminal record', 'شهادة جيش': 'Military certificate', 'بطاقة سارية': 'Valid ID',
  'العدد المطلوب (فاضي = مفتوح)': 'Required count (empty = open)', 'العدد المطلوب (فاضي': 'Required count (empty', 'يتملي من الشركة لو فاضي': 'Filled from the company if empty',
  'مكان الوظيفة على الخريطة': 'Job location on the map', 'مفيش مكان': 'No location', 'مكان دقيق (دبوس': 'Exact (pin', 'مكان دقيق (دبوس)': 'Exact (pin)',
  'مكان تقريبي (المنطقة': 'Approximate (area', 'مكان تقريبي (المنطقة)': 'Approximate (area)', 'مكان تقريبي (المحافظة': 'Approximate (governorate', 'مكان تقريبي (المحافظة)': 'Approximate (governorate)',
  'دوّر على المنطقة 🔎': 'Search area 🔎', 'شيل المكان': 'Remove location', 'دوس على الخريطة عشان تحط دبوس، وتقدر تسحبه.': 'Click the map to drop a pin; you can drag it.',
  'دوس على الخريطة عشان تحط دبوس، وتقدر تسحبه': 'Click the map to drop a pin; you can drag it', 'بنحمّل الخريطة': 'Loading map', 'بنحمّل الخريطة…': 'Loading map…',
  'مقدرناش نحمّل الخريطة — جرّب تاني': 'Could not load the map — try again', 'اكتب المنطقة الأول': 'Type the area first', 'بندوّر': 'Searching', 'بندوّر…': 'Searching…',
  'ملقيناش المنطقة دي — حط الدبوس بإيدك': 'Area not found — drop the pin by hand', 'مقدرناش ندوّر دلوقتي': 'Cannot search right now',
  'الوظيفة دي اتقفلت.': 'This job is closed.', 'الوظيفة دي اكتمل عددها.': 'This job is full.', 'اختار شركة.': 'Choose a company.', 'اختار شركة': 'Choose a company',
  // ---- fraud ----
  'علامات تستاهل مراجعة — مش اتهام': 'Signals worth reviewing — not accusations', 'ترشيحات كتير في يوم واحد': 'Many nominations in one day', 'ترشيحات بكميات غريبة': 'Unusual nomination volumes',
  'مناديب بيسيبوا بسرعة': 'Couriers quitting fast', 'مناديب بيسيبوا الشغل بسرعة': 'Couriers quitting work fast', 'سابوا في أقل من 7 أيام': 'Left within 7 days',
  'شريك رشّح 10 مناديب أو أكتر في نفس اليوم خلال آخر 30 يوم — ممكن يكون نشاط حقيقي أو أرقام وهمية': 'Partner nominated 10+ couriers on one day in the last 30 days — could be real or fake numbers',
  'شريك عنده 3 مناديب أو أكتر بدأوا شغل وسابوه في أقل من 7 أيام — ممكن مناديب بتدخل عشان الورق بس': 'Partner with 3+ couriers who left within 7 days — may be couriers joining just for the papers bonus',
  'ترشيحات من غير نت': 'Offline nominations', 'مرة • آخر مرة': 'times • last',
  // ---- staff ----
  'إضافة عضو': 'Add member', 'إضافة عضو للإدارة': 'Add admin member', 'كل حاجة': 'Everything', 'تفصيل الصلاحيات': 'Permission details', 'صلاحيات': 'Permissions',
  'عرض كل الصفحات': 'View all pages', 'الشركاء والمحادثات والتجميد': 'Partners, chats & freezing', 'طلبات السحب ': 'Withdrawals', 'الرسايل الجماعية ': 'Broadcasts',
  'رجّعها لافتراضي الدور': 'Reset to role default', 'إدارة الفريق والرجوع عن التعديلات للمالك بس': 'Team management and reverting edits are owner-only',
  'بيخليك تختار صلاحيات معينة لكل عضو بدل الافتراضي بتاع دوره': 'Choose specific permissions per member instead of their role default',
  'اختار صلاحية واحدة على الأقل (أو اقفل الحساب من عمود': 'Pick at least one permission (or disable the account from the column',
  'اتحفظت الصلاحيات ✅ — هتسري من أول ما العضو يفتح اللوحة': 'Permissions saved ✅ — they apply when the member next opens the panel',
  'ابعت كلمة المرور للعضو بنفسك واطلب منه يغيرها أول ما يدخل': 'Send the password to the member yourself and ask them to change it on first login',
  'كل حاجة ما عدا الفريق والرجوع عن التعديلات • مالية': 'Everything except team and reverting edits • Finance', 'كل حاجة • مدير': 'Everything • Admin',
  'عرض + السحوبات • توظيف': 'View + withdrawals • Recruiter', 'عرض + المناديب والوظائف • مشاهدة فقط': 'View + couriers and jobs • Viewer',
  'لازم يفضل مالك واحد مفعّل على الأقل.': 'At least one active owner is required.', 'المالك ليه كل الصلاحيات دايماً.': 'The owner always has every permission.',
  'الإيميل ده عليه حساب تاني. استخدم إيميل مختلف أو امسح الحساب من': 'This email has another account. Use a different email or remove the account from',
  'مينفعش تغيير الإيميل ده.': 'This email cannot be changed.', 'التسجيل المباشر مقفول. اطلب من المالك يضيفك.': 'Direct sign-up is closed. Ask the owner to add you.',
  'الإيميل ده مسجل لحساب تاني.': 'This email is registered to another account.',
  // ---- audit / errors ----
  'آخر 500 عملية': 'Last 500 actions', 'آخر 200 خطأ': 'Last 200 errors', 'مفيش أخطاء': 'No errors', 'في آخر 24 ساعة': 'in the last 24 hours',
  'الرجوع عن التعديل': 'Revert edit', 'رجّع القيم اللي قبل التعديل ده': 'Restore the values before this edit', 'هيرجع للقيم اللي كانت قبل التعديل ده': 'Will restore the values from before this edit',
  'اترجع ✅ — والرجوع نفسه اتسجّل في السجل': 'Reverted ✅ — the revert itself is logged', 'مفيش فرق يترجع': 'Nothing to revert', 'رجّع': 'Revert',
  'السجل ده اتعدّل تاني بعد التعديل ده — مينفعش ترجّعه أوتوماتيك.': 'This record changed again after this edit — it cannot be reverted automatically.',
  'الرجوع متاح للتعديلات بس (مش الإضافة أو المسح).': 'Only edits can be reverted (not inserts or deletes).', 'الرجوع مش متاح للنوع ده من البيانات (فلوس أو صلاحيات).': 'Revert is not available for this data (money or permissions).',
  'آخر تعديل': 'Last edit', 'إضافة ': 'Insert', 'السبب (مثلاً: تصحيح تاريخ غلط': 'Reason (e.g. fixing a wrong date', 'السبب (مثلاً: تصحيح تاريخ غلط)': 'Reason (e.g. fixing a wrong date)',
  'سبب الإيقاف (هيتسجل في السجل': 'Reason (will be logged', 'سبب الإيقاف (هيتسجل في السجل)': 'Reason (will be logged)',
  // ---- settings ----
  'بانر إعلان للشركاء': 'Announcement banner for partners', 'البانر ظاهر في التطبيق': 'Banner visible in the app', 'نص الإعلان': 'Announcement text', 'حفظ الإعلان': 'Save announcement',
  'اكتب نص الإعلان الأول': 'Write the announcement first', 'معلومة (أزرق': 'Info (blue', 'معلومة (أزرق)': 'Info (blue)', 'خبر حلو (أخضر': 'Good news (green', 'خبر حلو (أخضر)': 'Good news (green)',
  'تنبيه (برتقالي': 'Warning (orange', 'تنبيه (برتقالي)': 'Warning (orange)', 'الرابط ممكن يكون صفحة في التطبيق': 'The link can be an app page', 'أو لينك خارجي يبدأ بـ': 'or an external link starting with',
  'الرابط لازم يكون اسم صفحة أو لينك يبدأ بـ': 'The link must be a page name or a link starting with',
  'مثلاً: السحوبات هتتحوّل يوم الخميس بدل الأربع': 'e.g. Payouts move to Thursday instead of Wednesday', 'مثلاً: السحوبات هتتحوّل يوم الخميس بدل الأربعاء': 'e.g. Payouts move to Thursday instead of Wednesday',
  'التغيير بيظهر في تطبيق الشركاء فوراً وبيتسجّل في سجل التغييرات': 'Changes appear in the partner app right away and are logged',
  'مميزات التطبيق': 'App features', 'حفظ المميزات': 'Save features', 'المحادثة مع الإدارة': 'Chat with admin', 'تسجيل المناديب بلينك الشريك': 'Courier sign-up via partner link',
  'صفحة التسجيل العامة واللينك': 'Public sign-up page and link', 'صور الستوري للوظايف': 'Story images for jobs', 'زرار عمل صورة ستوري للوظيفة': 'Button to make a story image for a job',
  'الدخول بالبصمة': 'Fingerprint login', 'تفعيل ودخول بالبصمة / الوش': 'Set up and log in with fingerprint / face', 'اقتراح تفعيل الإشعارات': 'Prompt to enable notifications',
  'الكارت اللي بيطلب من الشريك يفعّل الإشعارات': 'The card asking partners to enable notifications', 'خريطة الوظايف': 'Jobs map', 'عرض الوظايف على الخريطة وأقرب وظيفة': 'Jobs on a map and the nearest job',
  'إعلان الوظايف الجديدة': 'New job announcement', 'أي وظيفة جديدة توصل إشعار لكل الشركاء': 'Every new job notifies all partners', 'شركاء نفس المحافظة بس': 'Partners in the same governorate only',
  'الإشعار يروح للشركاء اللي في محافظة الوظيفة': 'The notification goes to partners in the job\'s governorate', 'مفيش إشعار تلقائي للوظايف الجديدة': 'No automatic notification for new jobs',
  'مستويات الشركاء': 'Partner levels', 'حفظ المستويات': 'Save levels', 'مستوى جديد': 'New level', 'حذف المستوى': 'Delete level',
  'المستوى بيتحدد بعدد المناديب الشغالين (اتعيّنوا). أول مستوى لازم يبدأ من': 'The level depends on the number of hired couriers. The first level must start at',
  'أول مستوى لازم يبدأ من': 'The first level must start at', 'كل مستوى لازم يكون ليه اسم': 'Every level needs a name', 'مينفعش مستويين يبدأوا من نفس العدد': 'Two levels cannot start at the same count',
  'مبتدئ': 'Beginner', 'برونزي': 'Bronze', 'فضي': 'Silver', 'ذهبي': 'Gold', 'ماسي': 'Diamond', 'آخر تعديل:': 'Last edited:',
  'الميزة دي مقفولة دلوقتي من الإدارة.': 'This feature is currently turned off by admin.',
  // ---- added from QA pass ----
  'ترشيحات': 'Nominations', 'الترشيحات': 'Nominations', 'مراجعة': 'Review', 'مراجعة ترشيحات': 'Nominations review',
  'كل مرحلة = عدد المناديب اللي وصلوها من إجمالي الترشيحات (المرفوضين مش محسوبين في المراحل).': 'Each stage = couriers who reached it out of all nominations (rejected are not counted in stages).',
  'ترشيحات حالتها "تحت المراجعة" وعدّى عليها أكتر من 48 ساعة — الشريك مستني رد.': 'Nominations "under review" for more than 48 hours — the partner is waiting for an answer.',
  'تفعيل': 'Activate', 'خروج من الأجهزة': 'Sign out devices', 'آخر دخول': 'Last sign-in', 'تحكم': 'Control', 'إيقاف، باسوورد، أجهزة': 'Disable, password, devices',
  'بونص ورق بس': 'Papers bonus only', 'ليه أي بونص': 'Has any bonus', 'كل الشركاء': 'All partners', 'العواميد': 'Columns', 'الشريك المرشّح': 'Nominating partner',
  'اختار العواميد اللي تظهر': 'Choose the visible columns', 'افتح ملف الشريك': 'Open partner profile', 'نشر وظيفة': 'Post job', 'الوظيفة': 'Job',
  'السحوبات هتتحول يوم الخميس': 'Payouts move to Thursday', 'من كام مندوب شغال': 'From how many working couriers',

  // ---- install / iOS ----
  'على الآيفون: من زرار المشاركة اختار': 'On iPhone: from the Share button choose', 'إضافة إلى الشاشة الرئيسية': 'Add to Home Screen', 'وافتح لوحة الإدارة من هناك': 'and open the admin panel from there',
  'على الآيفون: من زرار المشاركة اختار "إضافة إلى الشاشة الرئيسية" وافتح لوحة الإدارة من هناك.': 'On iPhone: tap Share, choose "Add to Home Screen" and open the admin panel from there.',
  // ---- governorates (shown in filters and tables) ----
  'القاهرة': 'Cairo', 'الجيزة': 'Giza', 'الإسكندرية': 'Alexandria', 'القليوبية': 'Qalyubia', 'الشرقية': 'Sharqia', 'الدقهلية': 'Dakahlia', 'الغربية': 'Gharbia',
  'المنوفية': 'Monufia', 'البحيرة': 'Beheira', 'كفر الشيخ': 'Kafr El Sheikh', 'دمياط': 'Damietta', 'بورسعيد': 'Port Said', 'الإسماعيلية': 'Ismailia', 'السويس': 'Suez',
  'الفيوم': 'Faiyum', 'بني سويف': 'Beni Suef', 'المنيا': 'Minya', 'أسيوط': 'Asyut', 'سوهاج': 'Sohag', 'قنا': 'Qena', 'الأقصر': 'Luxor', 'أسوان': 'Aswan',
  'البحر الأحمر': 'Red Sea', 'الوادي الجديد': 'New Valley', 'مطروح': 'Matrouh', 'شمال سيناء': 'North Sinai', 'جنوب سيناء': 'South Sinai', 'بدون منطقة': 'No area',
  // ---- shared error messages ----
  'المندوب ده (نفس رقم الموبايل) متسجل قبل كده.': 'This courier (same mobile) is already registered.', 'حسابك لسه مش متفعل. الإدارة هتراجعه وتفعله.': 'Your account is not active yet.',
  'المبلغ أكبر من رصيدك المتاح.': 'The amount exceeds the available balance.', 'وصلت للحد اليومي للترشيحات. حاول بكرة.': 'Daily nomination limit reached. Try tomorrow.',
  'رقم الموبايل ده مسجل قبل كده. سجّل دخول.': 'This mobile is already registered.', 'الطلب ده اتقرر قبل كده. التعديل للمالك بس.': 'This request was already decided. Only the owner can change it.',
  'تغيير الموبايل من زرار "تغيير الموبايل" بس.': 'Change the mobile only via "Change mobile".', 'الموبايل أو الإيميل مسجل قبل كده.': 'Mobile or email already registered.',
  'الحساب ده متجمّد مؤقتاً — السحب والترشيح موقوفين. كلّم الإدارة.': 'This account is temporarily frozen — withdrawals and nominations are paused.',
};

// sentences with numbers / names inside
const PATTERNS = [
  [/^صفحة (\d+) من (\d+) • (\d+) سجل$/, 'Page $1 of $2 • $3 records'],
  [/^(\d+) نتيجة$/, '$1 results'],
  [/^(\d+) شريك إجمالي — اكتب للبحث$/, '$1 partners total — type to search'],
  [/^\+(\d+) كمان — ضيّق البحث$/, '+$1 more — narrow the search'],
  [/^\+(\d+) كمان — ضيّق بالبحث أو الشركة$/, '+$1 more — narrow by search or company'],
  [/^شغالين (\d+) • مستنيين (\d+) • مرفوض (\d+)$/, 'working $1 • waiting $2 • rejected $3'],
  [/^قيد المراجعة (.+)$/, 'under review $1'],
  [/^(\d+) يوم$/, '$1 days'], [/^بعد (\d+) يوم$/, 'after $1 days'], [/^بونص (\d+) يوم$/, '$1-day bonus'],
  [/^من (\d+) يوم$/, '$1 days ago'], [/^من (\d+) ساعة$/, '$1 hours ago'], [/^من (\d+) يوم من غير ورق$/, '$1 days without papers'],
  [/^من (\d+) ترشيح \((\d+)%\)$/, 'of $1 nominations ($2%)'],
  [/^(.+) أو https:\/\/…$/, '$1 or https://…'],
  [/^و(\d+) كمان…$/, 'and $1 more…'],
  [/^(.+) \((\d+)\)$/, (m, a, n) => { const t = DICT[a]; return t ? `${t} (${n})` : m; }],
  [/^تم تحديد (\d+)$/, '$1 selected'], [/^(\d+) مندوب$/, '$1 couriers'], [/^(\d+) شريك$/, '$1 partners'], [/^(\d+) وظيفة$/, '$1 jobs'],
  [/^اتبعتت لـ (\d+) شريك ✅$/, 'Sent to $1 partners ✅'], [/^ابعت لـ (\d+) شريك$/, 'Send to $1 partners'],
  [/^هيتغير (\d+) شريك لحالة "(.+)"\.?$/, '$1 partners will change to "$2".'],
];

const AR = /[؀-ۿ]/;
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const NOTAR_EDGE = /^([^؀-ۿ]*)([\s\S]*?)([^؀-ۿ؟]*)$/;
const RUN = /[؀-ۿ](?:[؀-ۿ‌ـ]|\s(?=[؀-ۿ]))*/g;

function lookup(s) {
  if (DICT[s] != null) return DICT[s];
  for (const [re, rep] of PATTERNS) if (re.test(s)) return s.replace(re, rep);
  return null;
}
const cache = new Map();
export function translate(text) {
  if (!text || !AR.test(text)) return text;
  if (cache.has(text)) return cache.get(text);
  let out = null;
  const n = norm(text).replace(/ج\.م/g, 'EGP');
  out = lookup(n);
  if (out == null) {
    const m = n.match(NOTAR_EDGE);
    if (m && m[2]) { const core = lookup(m[2]); if (core != null) out = m[1] + core + m[3]; }
  }
  if (out == null) {
    let ok = true;
    const r = n.replace(RUN, (w) => { const t = lookup(w); if (t == null) { ok = false; return w; } return t; });
    if (ok) out = r;
  }
  if (out != null) {
    // keep the original leading/trailing whitespace so inline layout does not shift
    const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
    out = lead + out + trail;
  } else out = text;
  if (cache.size < 5000) cache.set(text, out);
  return out;
}

const ATTRS = ['placeholder', 'title', 'aria-label'];
const done = new WeakMap();
function walk(root) {
  if (root.nodeType === 3) { tText(root); return; }
  if (root.nodeType !== 1) return;
  if (root.closest && root.closest('[data-noi18n]')) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = root;
  while (n) {
    if (n.nodeType === 3) tText(n);
    else if (n.nodeType === 1) {
      if (n.hasAttribute('data-noi18n') || n.tagName === 'SCRIPT' || n.tagName === 'STYLE') { n = skip(tw); continue; }
      for (const a of ATTRS) { const v = n.getAttribute(a); if (v && AR.test(v)) { const t = translate(v); if (t !== v) n.setAttribute(a, t); } }
      if (n.tagName === 'INPUT' && (n.type === 'button' || n.type === 'submit') && AR.test(n.value)) n.value = translate(n.value);
    }
    n = tw.nextNode();
  }
}
function skip(tw) { // move past the current element's subtree
  let n = tw.currentNode;
  while (n && !n.nextSibling) { n = n.parentNode; if (!n || n === tw.root) return null; }
  if (!n) return null;
  tw.currentNode = n.nextSibling; return tw.currentNode;
}
function tText(node) {
  const v = node.nodeValue;
  if (!v || !AR.test(v) || done.get(node) === v) return;
  const p = node.parentNode;
  if (p && (p.closest?.('[data-noi18n]') || p.tagName === 'TEXTAREA')) return;
  const t = translate(v);
  done.set(node, t);
  if (t !== v) node.nodeValue = t;
}

export function initI18n() {
  const html = document.documentElement;
  html.lang = lang; html.dir = isEn ? 'ltr' : 'rtl';
  if (!isEn) return;
  window.__i18nMissing = () => missing();
  document.title = translate(document.title);
  const run = () => walk(document.body);
  run();
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') tText(m.target);
      else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); if (v && AR.test(v)) m.target.setAttribute(m.attributeName, translate(v)); }
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// list of Arabic strings still visible in English mode (used by QA to find gaps)
export function missing() {
  const out = new Set();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = tw.nextNode())) { if (AR.test(n.nodeValue) && !n.parentNode.closest('textarea,[data-noi18n]')) out.add(norm(n.nodeValue)); }
  document.querySelectorAll('[placeholder],[title],[aria-label]').forEach((e) => ATTRS.forEach((a) => { const v = e.getAttribute(a); if (v && AR.test(v)) out.add(norm(v)); }));
  return [...out];
}
