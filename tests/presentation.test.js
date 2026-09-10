import test from 'node:test';
import assert from 'node:assert/strict';
import {counterBadges,learningDetails} from '../src/presentation.js';
test('counter badges expose color-independent labels and distinguish total from daily new cards',()=>{
 const html=counterBadges({new:45,newToday:5,due:4});
 assert.match(html,/aria-label="5 нових на сьогодні"/);assert.match(html,/aria-label="4 до повторення"/);assert.match(html,/Ще не вчили: 45/);
});
test('definitions and relationships are escaped; missing antonyms are not invented',()=>{
 const html=learningDetails({definitionDe:'<script>bad</script>',synonyms:[{de:'<b>word</b>',note:'"context"'}],antonyms:[]});
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.match(html,/Немає природного антоніма/);assert.match(html,/lang="de"/);
 assert.equal(learningDetails({}), '');
});
