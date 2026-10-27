import assert from 'node:assert/strict'
import { classifyConversationTopic as topic } from './conversationTopic'

assert.equal(topic('(tritt heran)', { opening: true }), 'opening')
assert.equal(topic('Moin'), 'greeting')
assert.equal(topic('ja bitte ein Wasser'), 'order')
assert.equal(topic('Wo finde ich die Akademie?'), 'orientation')
assert.equal(topic('ich möchte ein Café eröffnen'), 'work_money')
assert.equal(topic('ich möchte zum Raumhafen und den Weltraum entdecken'), 'travel')
assert.equal(topic('wie heißt du? ich bin Thomas'), 'identity')
assert.equal(topic('was machst du denn nach Feierabend?'), 'personal')
assert.equal(topic('wollen wir zusammen spazieren?'), 'relationship')
assert.equal(topic('hi, gibt es etwas neues in der stadt?'), 'world_news')
assert.equal(topic('Bist du dumm?'), 'provocation')
assert.equal(topic('guten morgen, was arbeitest du gerade?'), 'personal')
assert.equal(topic('Ich suche eine Toilette'), 'orientation')
assert.equal(topic('ja gerne'), 'followup')
assert.equal(topic('danke für den tipp. hast du etwas geträumt?'), 'personal')
assert.equal(topic('Hallo Mira, ich suche ein spannendes Buch'), 'orientation')
assert.equal(topic('Ich habe ein Anliegen: hier sind zu wenig Leute, wir müssen neue holen'), 'other')

console.log('conversationTopic: ok')
