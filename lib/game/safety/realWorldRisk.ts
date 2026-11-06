// lib/game/safety/realWorldRisk.ts
// NOXIA-SAFETY-0001 (Thomas, 05.11.2026): NOXIA darf nicht für Absprachen
// krimineller Dinge in der realen Welt genutzt werden.
//
// Stufe 1 – Regeln, ohne DB und ohne KI. Unterscheidet Spiel und Wirklichkeit:
// Schmuggel auf dem Mars, Intrigen im Rat, ein Überfall im Roman – alles Spiel.
// Verdächtig wird es erst, wenn mehrere Merkmale zusammenkommen, die auf die
// reale Welt zeigen.
//
// 06.11.2026 (Thomas: „auch andere Sprachen, auch Codes, die harmlos klingen“):
//  * Merkmale in Deutsch, Englisch, Türkisch, Russisch, Arabisch, Polnisch,
//    Spanisch und Französisch; Text wird in allen Schriften vereinheitlicht und
//    Tarnungen aufgelöst (lib/game/safety/textFold.ts).
//  * Sprachunabhängige Merkmale, die auch bei harmlosen Codewörtern greifen:
//    reale Währung (im Spiel gibt es nur Credits), Menge mit Einheit, Geldwege,
//    Kanalwechsel und getarnte Kontaktdaten. „2 Tickets für 50 €, Freitag
//    Bahnhof“ ergibt ein Handelsmuster, egal wie die Ware heißt.
//  * Nicht abgedeckte Sprache wird als Merkmal festgehalten.
// Codewörter selbst kann keine Liste kennen. Deshalb entscheidet bei
// auffälligen Mustern Stufe 2, eine KI-Prüfung im Zusammenhang
// (lib/game/safety/aiReview.ts, needsAiReview unten).
//
// Ergebnis:
//   none    – nichts
//   watch   – Merkmale ohne Verdacht; nur gezählt, nie lesbar
//   suspect – Merkmale kombiniert; der Ausschnitt wird gesichert und ist als
//             einziger für Menschen lesbar
//
// Bewusst nicht: Nachrichten blockieren. Wer geblockt wird, lernt, wonach
// gefiltert wird. Kontaktdaten werden weiterhin in der gezeigten Fassung entfernt.

import { foldForScreening, revealContacts, squashSpacedLetters } from './textFold'

export const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu
export const URL = /\b(?:https?:\/\/|www\.)\S+|\b[\p{L}\p{N}-]+\.(?:com|de|net|org|io|me|app|gg|ly|tv)\b\S*/giu
export const PHONE = /(?:\+|00)?\d[\d\s/().-]{6,}\d/g
export const HANDLE = /(^|\s)@[\p{L}\p{N}_.]{2,}/gu
export const MESSENGER = /\b(whats\s?app|telegram|snap(chat)?|insta(gram)?|discord|tiktok|signal|skype|kik|threema|wickr|wechat|line app|viber|session app|vk|вконтакте|телеграм|واتساب|تيليجرام)\b/iu

/** Entfernt E-Mail, Links, Telefonnummern und @-Namen. */
export function stripContactData(text: string): string {
  return String(text ?? '')
    .replace(EMAIL, '[Kontakt entfernt]')
    .replace(URL, '[Link entfernt]')
    .replace(PHONE, '[Nummer entfernt]')
    .replace(HANDLE, '$1[Name entfernt]')
}

export type RiskSignal =
  | 'contact' | 'obfuscated_contact' | 'offline' | 'meetup' | 'real_goods' | 'money' | 'real_currency' | 'quantity' | 'trade_shape'
  | 'violence' | 'school' | 'minor_cue' | 'secrecy' | 'sexual' | 'abuse_material' | 'unscreened_language'

export type RiskLevel = 'none' | 'watch' | 'suspect'
export type RiskAssessment = { level: RiskLevel; signals: RiskSignal[]; reasons: string[]; language: ScreenLanguage }

// ── Begriffe ────────────────────────────────────────────────────────────────
// Schreibweise: vereinheitlicht (klein, ohne Akzente, ä→ae, ı→i, ł→l).
// „wort“ = Wortanfang (Endungen erlaubt), „wort=“ = genau dieses Wort,
// „~regex“ = Ausdruck. Arabische Vorsilben (ال، و، ب) sind automatisch erlaubt.
const B = '(?<![\\p{L}\\p{N}])'
const E = '(?![\\p{L}\\p{N}])'
const AR_PREFIX = '(?:ال|وال|بال|و|ب|ل)?'
const AGE = '(?:[89]|1[0-7])'

function terms(entries: string[]): RegExp {
  const parts = entries.map(entry => {
    if (entry.startsWith('~')) return entry.slice(1)
    const exact = entry.endsWith('=')
    const word = (exact ? entry.slice(0, -1) : entry).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return exact ? `${word}${E}` : `${word}\\p{L}*`
  })
  return new RegExp(`${B}${AR_PREFIX}(?:${parts.join('|')})`, 'u')
}

const TERMS: ReadonlyArray<[RiskSignal, RegExp]> = [
  ['offline', terms([
    // de
    'in echt=', 'im echten leben', 'im realen leben', 'in der realitaet', 'in wirklichkeit treffen', 'offline treffen', 'persoenlich treffen', 'ausserhalb des spiel', 'ausserhalb vom spiel', 'nicht im spiel', 'ausserhalb von noxia',
    // en
    'irl=', 'in real life', 'real life', 'in person=', 'meet up', 'meetup', 'outside the game', 'offline=',
    // tr
    'gercek hayatta', 'yuz yuze', 'bulusalim', 'bulusmak', 'oyun disinda',
    // ru
    'в реале', 'в реальной жизни', 'вживую', 'встретимся', 'встретиться', 'вне игры',
    // ar
    'في الواقع', 'في الحقيقة', 'نتقابل', 'نلتقي', 'خارج اللعبة',
    // pl
    'w realu', 'na zywo', 'spotkajmy', 'spotkamy', 'poza gra',
    // es
    'en persona', 'en la vida real', 'quedamos', 'fuera del juego',
    // fr
    'en vrai=', 'dans la vraie vie', 'en reel', 'se voir=', 'se rencontrer', 'hors du jeu',
  ])],
  ['meetup', terms([
    'treff', 'abhol', 'vorbeikomm', 'uebergabe', '~um \\d{1,2}' + E, '~\\d{1,2} uhr' + E, 'morgen abend', 'heute abend', 'heute nacht',
    '~(?:am )?(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)(?: abend| nacht| frueh)?' + E,
    '~(?:on )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)' + E, '~(?:pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar)' + E,
    '~в (?:понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)', '~يوم (?:السبت|الاحد|الاثنين|الثلاثاء|الاربعاء|الخميس|الجمعه|الجمعة)',
    'pick up', 'pickup', 'drop off', 'handover', 'tonight=', 'tomorrow=', '~at \\d{1,2}(?: ?(?:am|pm))?' + E,
    'yarin=', 'bu aksam', 'bu gece', '~saat \\d{1,2}' + E, 'teslim',
    'завтра', 'сегодня вечером', 'закладк', '~в \\d{1,2}' + E, 'передач',
    'بكره', 'بكرة', 'غدا', 'الليله', 'الليلة', 'الساعه', 'الساعة', 'استلام',
    'jutro=', 'dzis wieczorem', '~o \\d{1,2}' + E, 'odbior',
    'manana=', 'esta noche', '~a las \\d{1,2}' + E, 'recoger', 'entrega',
    'demain=', 'ce soir', '~a \\d{1,2} ?h' + E, 'recuperer', 'remise',
  ])],
  ['real_goods', terms([
    // de
    'kokain', 'koks=', 'heroin=', 'crystal meth', 'meth=', 'methamphetamin', 'amphetamin', 'mdma=', 'ecstasy', 'xtc=', 'lsd=', 'ketamin', 'fentanyl', 'gras rauchen', 'gras kaufen', 'weed=', 'hasch', 'cannabis', 'pillen=', 'pistole', 'knarre', 'schusswaffe', 'munition', 'sprengstoff', 'gefaelscht', 'falsche ausweis', 'falscher ausweis', 'gefaelschte ausweis', 'fuehrerschein kaufen',
    // en
    'cocaine', 'crack=', 'molly=', 'ketamine', 'pills=', 'gun=', 'guns=', 'pistol', 'glock', 'ammo=', 'ammunition', 'explosive', 'fake id', 'forged', 'stolen card', 'carding',
    // tr
    'eroin', 'esrar=', 'bonzai', 'uyusturucu', 'hap=', 'haplar', 'silah', 'tabanca', 'mermi', 'patlayici', 'sahte kimlik', 'sahte ehliyet',
    // ru
    'кокаин', 'героин', 'мефедрон', 'меф=', 'травк', 'гашиш', 'наркот', 'ствол', 'пистолет', 'оружи', 'патрон', 'взрывчатк', 'поддельн',
    // ar
    'كوكايين', 'هيروين', 'حشيش', 'مخدرات', 'حبوب', 'كبتاجون', 'سلاح', 'مسدس', 'رصاص', 'متفجرات', 'مزور',
    // pl
    'marihuan', 'trawk', 'zielsk', 'dopalacz', 'amfetamin', 'mefedron', 'narkotyk', 'bron=', 'broni=', 'pistolet', 'amunicj', 'material wybuchow', 'podrobion',
    // es
    'cocaina', 'perico', 'farlopa', 'marihuana', 'mota=', 'porro', 'pastillas', 'drogas=', 'pistola', 'arma de fuego', 'armas de fuego', 'municion', 'explosivo', 'falsificad',
    // fr
    'beuh', 'cachets', 'drogue', 'flingue', 'une arme', 'armes a feu', 'munitions', 'explosif', 'faux papiers',
  ])],
  ['money', terms([
    'iban=', 'paypal', 'bitcoin', 'btc=', 'krypto', 'crypto', 'usdt=', 'monero', 'gutschein', 'paysafe', 'bargeld', 'cash=', 'ueberweis', 'western union', 'bar bezahl',
    'venmo', 'cashapp', 'cash app', 'revolut', 'zelle=', 'gift card', 'giftcard', 'wire transfer', 'bank transfer',
    'havale', 'eft=', 'nakit', 'papara', 'ininal',
    'перевод на карту', 'переведи', 'перевести деньги', 'налич', 'биткоин', 'крипт', 'сбер', 'qiwi', 'юмани',
    'تحويل', 'كاش', 'نقدا', 'نقدي', 'بيتكوين', 'ويسترن',
    'blik=', 'przelew', 'gotowk', 'karta podarunkowa',
    'bizum', 'transferencia', 'en efectivo', 'tarjeta regalo',
    'virement', 'en especes', 'lydia=', 'carte cadeau', 'paysafecard',
  ])],
  ['violence', terms([
    'umbring', 'abstech', 'erschiess', 'abknall', 'anzuend', 'zusammenschlag', 'vergewaltig', 'bombe=', 'bomben=', 'anschlag', 'amok', 'toete', 'ermord',
    'kill=', 'killen', 'killing', 'shoot up', 'shooting', 'stab=', 'stabbing', 'blow up', 'bomb=', 'bombing', 'rape=',
    'oldur', 'bicakla', 'bomba', 'patlat', 'tecavuz',
    'убить', 'убью', 'убей', 'застрел', 'зарез', 'взорв', 'бомб', 'изнасил',
    'اقتل', 'قتل', 'تفجير', 'قنبله', 'قنبلة', 'اطلاق النار', 'اغتصاب',
    'zabij', 'zastrzel', 'wysadz', 'zgwalc',
    'matar', 'mato=', 'disparar', 'apunalar', 'explotar', 'violar',
    'tuer=', 'flinguer', 'poignarder', 'faire sauter', 'violer',
  ])],
  ['school', terms([
    'schule', 'schulhof', 'lehrer', 'schulklasse', 'in der klasse', 'meine klasse', 'grundschule', 'gymnasium', 'realschule', 'gesamtschule',
    'school', 'schoolyard', 'teacher', 'classroom',
    'okul', 'ogretmen', 'sinif',
    'школ', 'учител', 'в классе', 'одноклассн',
    'مدرسه', 'مدرسة', 'معلم', 'الصف',
    'szkol', 'nauczyciel', 'w klasie', 'klasa=',
    'escuela', 'colegio', 'instituto', 'profesor',
    'ecole', 'college=', 'lycee', 'prof=',
  ])],
  ['minor_cue', terms([
    `~ich bin ${AGE}${E}`, `~bin erst ${AGE}${E}`, 'wie alt bist du', 'gehst du noch zur schule', 'gehst du zur schule', 'welche klasse', 'in welcher klasse', 'bist du volljaehrig', 'bist du minderjaehrig', `~bist du (?:schon )?(?:${AGE}|18)${E}`,
    `~i m ${AGE}${E}`, `~i am ${AGE}${E}`, `~${AGE} (?:years old|yo|y o)${E}`, 'how old are you', 'how old r u', `~are you (?:18|${AGE})${E}`, 'what grade', 'are you in school',
    `~${AGE} yasindayim`, `~${AGE} yasinda`, 'kac yasindasin', 'kacinci sinif',
    `~мне ${AGE}${E}`, 'сколько тебе лет', 'в каком классе', 'ты в школе',
    `~عمري ${AGE}${E}`, 'كم عمرك', 'في اي صف',
    `~mam ${AGE} lat`, 'ile masz lat', 'ktora klasa', 'w ktorej klasie',
    `~tengo ${AGE} anos`, 'cuantos anos tienes', 'en que curso',
    `~j ai ${AGE} ans`, 'quel age as tu', 'tu as quel age', 'en quelle classe',
  ])],
  ['secrecy', terms([
    'sag es niemand', 'sag niemand', 'sags niemand', 'erzaehl es niemand', 'erzaehl niemand', '~nicht (?:deinen|deiner|den|der) (?:eltern|mutter|vater|mama|papa|lehrer)', 'unser geheimnis', 'bleibt unter uns', '~loesch\\p{L}* (?:den|die|das) (?:chat|nachricht\\p{L}*|verlauf)',
    'don t tell anyone', 'dont tell anyone', 'don t tell your', 'dont tell your', 'our secret', 'our little secret', 'between us', 'between you and me', 'delete the chat', 'delete this chat', 'delete the messages',
    'kimseye soyleme', 'aramizda kalsin', 'sirrimiz', 'ailene soyleme', 'mesajlari sil',
    'никому не говори', 'между нами', 'наш секрет', 'удали переписку', 'удали чат', 'родителям не говори',
    'لا تخبر احد', 'لا تقول لاحد', 'سر بيننا', 'بيني وبينك', 'امسح المحادثه', 'امسح المحادثة',
    'nikomu nie mow', 'miedzy nami', 'nasz sekret', 'usun czat', 'nie mow rodzicom',
    'no se lo digas a nadie', 'no le digas a nadie', 'entre nosotros', 'nuestro secreto', 'borra el chat', 'no le digas a tus padres',
    'dis le a personne', 'le dis a personne', 'entre nous', 'notre secret', 'efface la conversation', 'dis rien a tes parents',
  ])],
  ['sexual', terms([
    'nackt', 'nacktbild', 'nacktfoto', 'foto von dir', 'bild von dir', 'bilder von dir', 'fotos von dir', 'schick mir ein bild', 'schick mir ein foto', 'schick mir bilder', 'schick mir fotos', 'sex=', 'sexy=', 'sexuell', 'sexting',
    'nude=', 'nudes=', 'naked=', 'send pics', 'send a pic', 'send me a pic', 'send me pics', 'pic of you', 'pics of you', 'sexual',
    'ciplak', 'fotograf at', 'foto at', 'resmini at', 'seks=',
    'голая', 'голый', 'голую', 'нюдс', 'фото пришли', 'скинь фото', 'пришли фото', 'секс',
    'عاري', 'عاريه', 'صور عاريه', 'ارسل صوره', 'ابعت صوره', 'صورتك', 'جنس',
    'nago=', 'nagie', 'nagich', 'wyslij zdjecie', 'wyslij fotke',
    'desnuda', 'desnudo', 'mandame foto', 'manda foto', 'sexo=',
    'nue=', 'nues=', 'envoie une photo', 'envoie moi une photo', 'sexe=',
  ])],
  ['abuse_material', terms([
    'kinderporn', 'missbrauchsdarstell', 'missbrauchsabbild', 'child porn', 'csam=', 'cocuk pornosu', 'детское порно', 'детская порнограф', 'اباحيه الاطفال', 'اباحية الاطفال', 'pornografia dzieci', 'pornografia infantil', 'pedopornograph',
  ])],
  ['contact', terms([
    'schreib mir privat', 'meine nummer', 'adde mich', 'add mich',
    'dm me', 'add me on', 'text me', 'my number', 'hit me up on',
    'bana yaz', 'numaram', 'ekle beni', 'dmden yaz',
    'пиши в лс', 'пиши в личку', 'в личку', 'мой номер', 'добавь меня',
    'رقمي', 'راسلني', 'ضيفني', 'كلمني على',
    'napisz na priv', 'moj numer', 'dodaj mnie',
    'mi numero', 'escribeme al privado', 'agregame',
    'mon numero', 'ecris moi en prive', 'ajoute moi',
  ])],
]

// Sprachunabhängig: reale Währung, Menge mit Einheit.
const REAL_CURRENCY = new RegExp(`(?:${B}\\d+(?: \\d{3})*(?: \\d{1,2})? ?(?:€|\\$|£|₺|₽|eur|euro|euros|usd|dollar|dollars|tl|lira|rub|руб\\p{L}*|pln|zl|zloty|zlotych|dh|dirham|chf|franken)${E}|[€$£₺₽] ?\\d+)`, 'u')
const QUANTITY = new RegExp(`${B}\\d+(?: \\d+)? ?(?:g|gr|gramm|gram|grams|грамм|гр|kg|stk|stueck|pcs|pieces|teile|tabs|tabletten|adet|szt|sztuk|gramos|grammes)${E}`, 'u')

// ── Sprache ────────────────────────────────────────────────────────────────
export type ScreenLanguage = 'de' | 'en' | 'tr' | 'pl' | 'es' | 'fr' | 'ru' | 'ar' | 'unknown' | 'none'
const STOPWORDS: Record<'de' | 'en' | 'tr' | 'pl' | 'es' | 'fr', Set<string>> = {
  de: new Set('und der die das in ist nicht ich du wir ihr sie es ein eine einen mit auf fuer von zu im am um zum zur bei nach aus den dem des was wie wo wer warum wann hast habe hat bin bist sind war wird auch noch schon aber oder wenn dann uns mir dir mich dich sich kein keine gibt hier da ja nein mal nur so sehr man kann will muss soll heute jetzt gut danke bitte hallo mein dein'.split(' ')),
  en: new Set('the and is are not you we they it a an with on for of to in at by from what how where who why when have has am was were be will would but or if then this that there here can do does i me my your our us yes no just so very please thanks hello hi get go'.split(' ')),
  tr: new Set('ve bir bu su da de ne mi mu ben sen biz siz o icin ile var yok gibi ama ya cok daha nasil nerede neden kim evet hayir tamam merhaba iyi olur burada orada simdi bugun benim senin'.split(' ')),
  pl: new Set('i w nie na sie jest to z ze co jak ale czy tak ja ty my wy oni do od po dla juz jeszcze gdzie kiedy jestem jestes mnie sa tu tam tylko bardzo prosze dziekuje czesc'.split(' ')),
  es: new Set('y el la los las es no que de en un una con por para como pero si yo tu donde cuando esta estoy muy del al lo le se mi te su hay tengo tiene bien hola gracias aqui ahora quien porque'.split(' ')),
  fr: new Set('et le la les est pas que de en un une avec pour sur je tu nous vous il elle ce cest mais ou quand comment tres des du au aux ne se me te mon ton son suis sont ai bien merci bonjour ici maintenant qui pourquoi oui non'.split(' ')),
}

/** Grobe Spracherkennung für die Frage: deckt der Filter diese Sprache ab? */
export function screenLanguage(folded: string): ScreenLanguage {
  const letters = [...folded].filter(ch => /\p{L}/u.test(ch))
  if (letters.length < 3) return 'none'
  const count = (re: RegExp) => letters.filter(ch => re.test(ch)).length
  const share = (n: number) => n / letters.length
  if (share(count(/\p{Script=Cyrillic}/u)) > 0.5) return 'ru'
  if (share(count(/\p{Script=Arabic}/u)) > 0.5) return 'ar'
  if (share(count(/\p{Script=Latin}/u)) < 0.5) return 'unknown'
  const words = folded.split(' ').filter(w => /\p{L}/u.test(w))
  let best: ScreenLanguage = 'unknown'
  let bestHits = 0
  for (const [lang, set] of Object.entries(STOPWORDS) as Array<[ScreenLanguage, Set<string>]>) {
    const hits = words.filter(w => set.has(w)).length
    if (hits > bestHits) { best = lang; bestHits = hits }
  }
  // Ein einzelnes Allerweltswort („is“, „en“) reicht bei längeren Sätzen nicht.
  if (bestHits >= 2 || (bestHits === 1 && words.length <= 6)) return best
  return words.length >= 5 ? 'unknown' : 'none'
}

// ── Bewertung ──────────────────────────────────────────────────────────────

/** Bewertet einen Text oder ein Gesprächsfenster (mehrere Zeilen zusammen). */
export function assessRealWorldRisk(input: string | string[]): RiskAssessment {
  const raw = Array.isArray(input) ? input.join('\n') : String(input ?? '')
  const signals = new Set<RiskSignal>()
  const folded = foldForScreening(raw)
  const squashed = squashSpacedLetters(folded)
  const language = screenLanguage(folded)

  if (stripContactData(raw) !== raw || MESSENGER.test(raw)) signals.add('contact')
  else {
    const revealed = revealContacts(raw)
    if (stripContactData(revealed) !== revealed || MESSENGER.test(squashed)) signals.add('obfuscated_contact')
  }
  for (const [signal, pattern] of TERMS) if (pattern.test(folded) || pattern.test(squashed)) signals.add(signal)
  if (REAL_CURRENCY.test(folded)) signals.add('real_currency')
  if (QUANTITY.test(folded)) signals.add('quantity')
  if (language === 'unknown') signals.add('unscreened_language')

  const has = (s: RiskSignal) => signals.has(s)
  const contactLike = has('contact') || has('obfuscated_contact')
  const moneyLike = has('money') || has('real_currency')
  // Handelsmuster: funktioniert auch mit harmlosen Codewörtern für die Ware.
  if ((has('real_currency') && (has('quantity') || has('meetup') || contactLike || has('money'))) || (has('quantity') && (has('meetup') || moneyLike)))
    signals.add('trade_shape')

  const reasons: string[] = []
  if (has('abuse_material')) reasons.push('Missbrauchsdarstellungen')
  if (has('real_goods') && (moneyLike || contactLike || has('offline'))) reasons.push('reale Ware mit Geldweg, Kontakt oder Realbezug')
  if (has('violence') && (has('offline') || has('school'))) reasons.push('Gewalt mit Realbezug')
  if (has('minor_cue') && (has('secrecy') || contactLike || has('sexual') || has('offline'))) reasons.push('Minderjährige mit Geheimhaltung, Kanalwechsel, Treffen oder sexuellem Bezug')
  if (has('secrecy') && has('sexual')) reasons.push('Geheimhaltung mit sexuellem Bezug')
  if (has('secrecy') && contactLike && has('offline')) reasons.push('Geheimes Treffen außerhalb des Spiels')
  if (has('trade_shape') && has('offline') && (contactLike || has('meetup'))) reasons.push('Handel mit realer Währung und Treffen außerhalb des Spiels')

  const list = [...signals]
  return { level: reasons.length ? 'suspect' : list.length ? 'watch' : 'none', signals: list, reasons, language }
}

/**
 * Stufe 2 nötig? Muster, hinter denen sich Codewörter verbergen können, oder
 * eine Sprache, die die Regeln nicht abdecken. Nur dann geht das Fenster an die
 * KI-Prüfung – nicht jede Nachricht.
 */
export function needsAiReview(assessment: RiskAssessment, context: { whisper: boolean }): boolean {
  if (assessment.level === 'suspect') return false
  const s = new Set(assessment.signals)
  if (s.has('trade_shape') || s.has('obfuscated_contact')) return true
  const substantive = [...s].filter(x => x !== 'unscreened_language' && x !== 'meetup')
  if (s.has('unscreened_language') && (context.whisper || substantive.length > 0)) return true
  if (substantive.length >= 2) return true
  if (context.whisper && substantive.length >= 1) return true
  if (s.has('minor_cue') || s.has('secrecy')) return true
  if (s.has('violence') && s.has('meetup')) return true
  if (s.has('real_goods') && s.has('quantity')) return true
  return false
}

/** Kennzeichen für Protokolle: Merkmale und Stufe, nie Wortlaut. */
export function riskFlags(assessment: RiskAssessment): string[] {
  if (assessment.level === 'none') return []
  return [...assessment.signals.map(s => 'risk:' + s), 'risk:' + assessment.level]
}
