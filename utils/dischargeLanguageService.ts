// ==================== DISCHARGE LANGUAGE SERVICE ====================
// All 22 Scheduled Languages of India (8th Schedule of Constitution)
// State-of-the-art multilingual discharge advice system

export type ScheduledLanguage =
  | 'english'
  | 'assamese'
  | 'bengali'
  | 'bodo'
  | 'dogri'
  | 'gujarati'
  | 'hindi'
  | 'kannada'
  | 'kashmiri'
  | 'konkani'
  | 'maithili'
  | 'malayalam'
  | 'manipuri'
  | 'marathi'
  | 'nepali'
  | 'odia'
  | 'punjabi'
  | 'sanskrit'
  | 'santali'
  | 'sindhi'
  | 'tamil'
  | 'telugu'
  | 'urdu';

export interface LanguageOption {
  code: ScheduledLanguage;
  name: string;
  nativeName: string;
  script: string;
  region: string; // Primary region where spoken
}

// All 22 Scheduled Languages + English (23 total)
export const SCHEDULED_LANGUAGES: LanguageOption[] = [
  { code: 'english', name: 'English', nativeName: 'English', script: 'Latin', region: 'Pan-India' },
  { code: 'assamese', name: 'Assamese', nativeName: 'অসমীয়া', script: 'Assamese', region: 'Assam' },
  { code: 'bengali', name: 'Bengali', nativeName: 'বাংলা', script: 'Bengali', region: 'West Bengal, Tripura' },
  { code: 'bodo', name: 'Bodo', nativeName: 'बड़ो', script: 'Devanagari', region: 'Assam (Bodoland)' },
  { code: 'dogri', name: 'Dogri', nativeName: 'डोगरी', script: 'Devanagari', region: 'Jammu & Kashmir' },
  { code: 'gujarati', name: 'Gujarati', nativeName: 'ગુજરાતી', script: 'Gujarati', region: 'Gujarat' },
  { code: 'hindi', name: 'Hindi', nativeName: 'हिन्दी', script: 'Devanagari', region: 'North India' },
  { code: 'kannada', name: 'Kannada', nativeName: 'ಕನ್ನಡ', script: 'Kannada', region: 'Karnataka' },
  { code: 'kashmiri', name: 'Kashmiri', nativeName: 'کٲشُر', script: 'Perso-Arabic', region: 'Kashmir' },
  { code: 'konkani', name: 'Konkani', nativeName: 'कोंकणी', script: 'Devanagari', region: 'Goa, Karnataka' },
  { code: 'maithili', name: 'Maithili', nativeName: 'मैथिली', script: 'Devanagari', region: 'Bihar' },
  { code: 'malayalam', name: 'Malayalam', nativeName: 'മലയാളം', script: 'Malayalam', region: 'Kerala' },
  { code: 'manipuri', name: 'Manipuri (Meitei)', nativeName: 'মৈতৈলোন্', script: 'Meitei Mayek', region: 'Manipur' },
  { code: 'marathi', name: 'Marathi', nativeName: 'मराठी', script: 'Devanagari', region: 'Maharashtra' },
  { code: 'nepali', name: 'Nepali', nativeName: 'नेपाली', script: 'Devanagari', region: 'Sikkim, West Bengal' },
  { code: 'odia', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', script: 'Odia', region: 'Odisha' },
  { code: 'punjabi', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', script: 'Gurmukhi', region: 'Punjab' },
  { code: 'sanskrit', name: 'Sanskrit', nativeName: 'संस्कृतम्', script: 'Devanagari', region: 'Classical' },
  { code: 'santali', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', script: 'Ol Chiki', region: 'Jharkhand, Odisha' },
  { code: 'sindhi', name: 'Sindhi', nativeName: 'سنڌي', script: 'Perso-Arabic', region: 'Gujarat, Maharashtra' },
  { code: 'tamil', name: 'Tamil', nativeName: 'தமிழ்', script: 'Tamil', region: 'Tamil Nadu' },
  { code: 'telugu', name: 'Telugu', nativeName: 'తెలుగు', script: 'Telugu', region: 'Andhra Pradesh, Telangana' },
  { code: 'urdu', name: 'Urdu', nativeName: 'اردو', script: 'Perso-Arabic', region: 'North India' },
];

// For backward compatibility
export type IndianLanguage = ScheduledLanguage;
export const INDIAN_LANGUAGES = SCHEDULED_LANGUAGES;

// ==================== CORE DISCHARGE ADVICE PROMPTS ====================
// These are the key topics that AI will generate advice for

export const DISCHARGE_ADVICE_TOPICS = [
  {
    id: 'breastfeeding',
    title: 'Breastfeeding',
    englishAdvice: 'Feed your baby only breast milk every 2-3 hours. Do not give water, honey, or any other food.',
  },
  {
    id: 'warmth',
    title: 'Keeping Baby Warm',
    englishAdvice: 'Keep your baby warm with skin-to-skin contact (Kangaroo care). Hold baby against your chest daily.',
  },
  {
    id: 'hygiene',
    title: 'Hygiene',
    englishAdvice: 'Always wash your hands with soap before touching baby. Keep the umbilical cord clean and dry.',
  },
  {
    id: 'vaccination',
    title: 'Vaccination',
    englishAdvice: 'Complete all vaccinations on schedule. Do not miss any vaccination date.',
  },
  {
    id: 'followup',
    title: 'Follow-up Visits',
    englishAdvice: 'Bring your baby for all follow-up visits as advised by the doctor. Do not skip any appointment.',
  },
  {
    id: 'medication',
    title: 'Medicines',
    englishAdvice: 'Give all medicines exactly as prescribed. Complete the full course even if baby seems better.',
  },
  {
    id: 'sleep',
    title: 'Safe Sleep',
    englishAdvice: 'Always put baby to sleep on their back. Use firm mattress, no pillows or soft toys in bed.',
  },
  {
    id: 'skincare',
    title: 'Skin Care',
    englishAdvice: 'Keep baby clean and dry. Change diapers frequently. Do not apply kajal or any powder.',
  },
  {
    id: 'danger',
    title: 'Watch for Danger Signs',
    englishAdvice: 'Bring baby to hospital immediately if you notice any danger sign. Do not wait or try home remedies.',
  },
  {
    id: 'emergency',
    title: 'Emergency Contact',
    englishAdvice: 'Save hospital emergency number in your phone. Call immediately if you are worried about baby.',
  },
];

export const DANGER_SIGNS_TOPICS = [
  { id: 'breathing', english: 'Difficulty breathing or fast breathing' },
  { id: 'feeding', english: 'Not feeding well or refusing to feed' },
  { id: 'fever', english: 'Fever (body feels hot) or body feels very cold' },
  { id: 'jaundice', english: 'Yellow color of skin or eyes increasing' },
  { id: 'lethargy', english: 'Very sleepy, difficult to wake up for feeds' },
  { id: 'convulsion', english: 'Fits, jerky movements, or body becoming stiff' },
  { id: 'umbilicus', english: 'Redness, swelling, or bad smell from umbilicus' },
  { id: 'vomiting', english: 'Repeated vomiting or vomiting green fluid' },
  { id: 'bleeding', english: 'Any bleeding from any part of body' },
  { id: 'noUrine', english: 'No urine for more than 8 hours' },
];

// ==================== AI PROMPT GENERATOR ====================

export function generateDischargeAdvicePrompt(
  language: ScheduledLanguage,
  diagnosis: string,
  isNICU: boolean
): string {
  const langInfo = SCHEDULED_LANGUAGES.find(l => l.code === language);
  const langName = langInfo?.name || 'Hindi';
  const nativeName = langInfo?.nativeName || 'हिन्दी';

  return `You are a neonatologist creating discharge advice for parents of a newborn baby.

PATIENT CONTEXT:
- Unit: ${isNICU ? 'NICU/SNCU (Premature or sick newborn)' : 'PICU (Older child)'}
- Diagnosis: ${diagnosis || 'General newborn care'}

TASK: Generate 10 discharge advice items in BILINGUAL format (English + ${langName}).

FORMAT FOR EACH ADVICE:
[English instruction]
[${nativeName} translation]

IMPORTANT GUIDELINES:
1. Use SIMPLE, CLEAR language that any parent can understand
2. Use IMPERATIVE/COMMAND form (e.g., "Feed baby...", "Keep baby warm...")
3. Be SPECIFIC and ACTIONABLE (not vague)
4. The ${langName} translation must be in ${langInfo?.script || 'native'} script
5. Make it culturally appropriate for Indian families
6. Each advice should be 1-2 sentences maximum
7. Focus on HOME CARE instructions, not hospital care

GENERATE EXACTLY 10 ADVICE ITEMS covering these topics:
1. Breastfeeding/Feeding
2. Keeping Baby Warm (Kangaroo care)
3. Hygiene and Handwashing
4. Vaccination schedule
5. Follow-up visits
6. Giving medicines properly
7. Safe sleeping position
8. Skin and umbilical cord care
9. Recognizing danger signs
10. Emergency contact

OUTPUT FORMAT (JSON array):
[
  {
    "english": "Feed your baby only breast milk every 2-3 hours. Do not give water or honey.",
    "regional": "${nativeName} translation here in ${langInfo?.script} script"
  },
  ...
]

Generate the advice now:`;
}

export function generateDangerSignsPrompt(
  language: ScheduledLanguage
): string {
  const langInfo = SCHEDULED_LANGUAGES.find(l => l.code === language);
  const langName = langInfo?.name || 'Hindi';
  const nativeName = langInfo?.nativeName || 'हिन्दी';

  return `You are a neonatologist creating a list of DANGER SIGNS for parents to watch for in their newborn baby.

TASK: Generate 10 danger signs in BILINGUAL format (English + ${langName}).

FORMAT FOR EACH SIGN:
[English description] / [${nativeName} translation]

IMPORTANT GUIDELINES:
1. Use SIMPLE, CLEAR language any parent can understand
2. Be SPECIFIC about what to look for
3. The ${langName} translation must be in ${langInfo?.script || 'native'} script
4. Keep each sign short (one phrase)

GENERATE EXACTLY 10 DANGER SIGNS:
1. Breathing difficulty
2. Feeding problems
3. Fever or cold body
4. Jaundice (yellow skin)
5. Extreme sleepiness
6. Convulsions/fits
7. Umbilical infection
8. Vomiting
9. Bleeding
10. No urine output

OUTPUT FORMAT (JSON array):
[
  {
    "english": "Fast or difficult breathing",
    "regional": "${nativeName} translation in ${langInfo?.script} script"
  },
  ...
]

Generate the danger signs now:`;
}

// ==================== FOLLOW-UP ADVICE PROMPT ====================

export function generateFollowUpAdvicePrompt(
  language: ScheduledLanguage,
  diagnosis: string,
  isNICU: boolean
): string {
  const langInfo = SCHEDULED_LANGUAGES.find(l => l.code === language);
  const langName = langInfo?.name || 'Hindi';
  const nativeName = langInfo?.nativeName || 'हिन्दी';

  return `You are a neonatologist creating follow-up visit schedule and advice for parents.

PATIENT CONTEXT:
- Unit: ${isNICU ? 'NICU/SNCU (Premature or sick newborn)' : 'PICU'}
- Diagnosis: ${diagnosis || 'General care'}

TASK: Generate follow-up schedule and advice in BILINGUAL format (English + ${langName}).

INCLUDE:
1. First follow-up visit timing
2. Regular follow-up schedule
3. Vaccination schedule reminders
4. Growth monitoring (weight check)
5. Developmental milestones to watch
6. Any special follow-up based on diagnosis

OUTPUT FORMAT (JSON):
{
  "schedule": [
    {
      "when": "3 days after discharge",
      "english": "First follow-up visit for weight check and general examination",
      "regional": "${nativeName} translation"
    },
    ...
  ],
  "reminders": [
    {
      "english": "Bring all previous medical records",
      "regional": "${nativeName} translation"
    },
    ...
  ]
}

Generate the follow-up advice now:`;
}
