import { languageProfileFromRows, selectConversationLanguage } from './languagePersistence'

let failures = 0
const check = (ok:boolean,label:string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const profile = languageProfileFromRows('lan', [
  { language_code: 'de', proficiency: 0.62, is_native: false, production: 0.55 },
  { language_code: 'vi', proficiency: 0.95, is_native: true, production: 0.94 },
])
check(profile?.primaryLanguageCode === 'vi', 'single explicit native language becomes primary')
check(profile?.languages.length === 2, 'multiple languages remain in profile')

const shared = selectConversationLanguage(profile, 'de')
check(shared.originalLanguageCode === 'de', 'shared player/NPC language is preferred over translation')
check(!shared.translatedForPlayer, 'shared language needs no translation')

const translated = selectConversationLanguage(profile, 'fr')
check(translated.originalLanguageCode === 'vi', 'without shared language the primary language is kept')
check(translated.translatedForPlayer, 'different player language is marked as translated')

const multilingualUnknownPrimary = languageProfileFromRows('yusuf', [
  { language_code: 'de', proficiency: 0.65, is_native: false },
  { language_code: 'tr', proficiency: 0.65, is_native: false },
  { language_code: 'ar', proficiency: 0.65, is_native: false },
])
check(multilingualUnknownPrimary?.primaryLanguageCode === null, 'no primary language is invented when biography only proves several spoken languages')
check(selectConversationLanguage(multilingualUnknownPrimary, 'de').originalLanguageCode === 'de', 'shared German can still be selected without declaring it primary')

const none = selectConversationLanguage(null, 'de')
check(none.originalLanguageCode === null, 'missing language data stays unknown')
check(!none.translatedForPlayer, 'missing data does not invent translation')

if (failures) throw new Error(String(failures) + ' language persistence test(s) failed')
console.log('Language persistence v0.1: tests passed; inferred_languages=0')
