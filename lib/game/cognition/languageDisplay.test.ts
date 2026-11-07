import { languageDisplayName, translatedLanguageLabel } from './languageDisplay'

let failures=0
const check=(ok:boolean,label:string)=>{if(!ok){failures++;console.error('FAIL: '+label)}}
check(languageDisplayName('tr')==='Türkisch','Turkish code has German label')
check(languageDisplayName('x-marsianisch')==='Marsianisch','private Mars language has canonical label')
check(translatedLanguageLabel('vi',true)==='Vietnamesisch · automatisch übersetzt','translated speech is marked')
check(translatedLanguageLabel(null,true)===null,'unknown language stays unlabelled')
if(failures)throw new Error(String(failures)+' language display test(s) failed')
console.log('Language display v0.1: tests passed')
