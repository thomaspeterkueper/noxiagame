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
check(profile?.primaryLanguageCode === 'vi', 'native language becomes default original language')
check(profile?.languages.length === 2, 'multiple languages remain in profile')

const translated = selectConversationLanguage(profile, 'de')
check(translated.originalLanguageCode === 'vi', 'conversation keeps NPC original language')
check(translated.translatedForPlayer, 'different player language is marked as translated')

const none = selectConversationLanguage(null, 'de')
check(none.originalLanguageCode === null, 'missing language data stays unknown')
check(!none.translatedForPlayer, 'missing data does not invent translation')

if (failures) throw new Error(String(failures) + ' language persistence test(s) failed')
console.log('Language persistence v0.1: tests passed; inferred_languages=0')
