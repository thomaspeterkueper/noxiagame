import { parseFeedbackReceiptLimit as parse } from './feedbackReceiptQuery'
const assert = (condition: boolean, message: string) => { if (!condition) throw Error(message) }
assert(parse(null) === 20, 'default limit')
assert(parse('1') === 1 && parse('50') === 50, 'accepted bounds')
for (const invalid of ['', '0', '51', '100', '-1', '1.5', '01', ' 2', '2 ', 'NaN', 'Infinity', '2e1', '1&owner=other']) {
  assert(parse(invalid) === null, 'invalid limit rejected: ' + invalid)
}
console.log('Feedback receipt query limits passed')
