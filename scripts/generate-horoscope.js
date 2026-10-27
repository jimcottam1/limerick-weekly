require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { generate } = require('./lib/gemini');

// A daily horoscope for the "Stars" box: playful, Limerick-flavoured and always positive. One Gemini
// call writes all twelve signs; later runs on the same day reuse it.
const OUT = path.join(__dirname, '..', 'data', 'horoscope.json');

const SIGNS = [
    ['aries', 'Aries', '♈', '21 Mar – 19 Apr'],
    ['taurus', 'Taurus', '♉', '20 Apr – 20 May'],
    ['gemini', 'Gemini', '♊', '21 May – 20 Jun'],
    ['cancer', 'Cancer', '♋', '21 Jun – 22 Jul'],
    ['leo', 'Leo', '♌', '23 Jul – 22 Aug'],
    ['virgo', 'Virgo', '♍', '23 Aug – 22 Sep'],
    ['libra', 'Libra', '♎', '23 Sep – 22 Oct'],
    ['scorpio', 'Scorpio', '♏', '23 Oct – 21 Nov'],
    ['sagittarius', 'Sagittarius', '♐', '22 Nov – 21 Dec'],
    ['capricorn', 'Capricorn', '♑', '22 Dec – 19 Jan'],
    ['aquarius', 'Aquarius', '♒', '20 Jan – 18 Feb'],
    ['pisces', 'Pisces', '♓', '19 Feb – 20 Mar']
];

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Dublin' }); // YYYY-MM-DD

function readExisting() {
    try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { return null; }
}

async function generateHoroscope() {
    console.log('✨ Daily horoscope\n');
    const date = today();
    const existing = readExisting();
    if (existing?.date === date) {
        console.log('✓ Already written for today');
        return;
    }

    const dayName = new Date().toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Dublin' });
    const prompt = `Write today's horoscope (${dayName}) for "The 061", a light-hearted Limerick local news site.

STYLE:
- Playful and warm, with a Limerick twist: weave in a local place, landmark or bit of Limerick life where it fits
  (e.g. the Milk Market, King John's Castle, People's Park, Thomond Park, the Shannon, the Treaty Stone,
  O'Connell Street, the Hunt Museum, UL, Castletroy, Adare, Kilmallock, Ballyhoura, the Granary)
- ALWAYS positive and encouraging. No warnings, bad luck, gloom or "be careful" readings
- No health, money, legal or relationship-breakup advice; no real named people; no stereotypes
- 1-2 sentences per sign, under 35 words
- Use a different place or reference for each sign; don't repeat the same joke

RESPOND IN JSON, one entry per sign, in this order: ${SIGNS.map(s => s[1]).join(', ')}
{"signs": [{"sign": "Aries", "reading": "..."}, ...]}

Return ONLY valid JSON.`;

    const text = await generate(prompt);
    const json = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
    const byName = new Map((json.signs || []).map(s => [String(s.sign).toLowerCase(), String(s.reading || '').trim()]));

    const signs = SIGNS.map(([id, name, symbol, dates]) => ({ id, name, symbol, dates, reading: byName.get(id) || '' }));
    const missing = signs.filter(s => !s.reading).map(s => s.name);
    if (missing.length) throw new Error(`No reading for ${missing.join(', ')}`);

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ date, generatedAt: new Date().toISOString(), signs }, null, 2));
    console.log(`✓ Wrote ${signs.length} signs for ${date}`);
}

if (require.main === module) {
    generateHoroscope()
        .then(() => process.exit(0))
        // A failed horoscope shouldn't stop the paper: yesterday's stays up until the next run
        .catch(error => { console.error(`✗ Horoscope: ${error.message}`); process.exit(0); });
}

module.exports = { generateHoroscope };
