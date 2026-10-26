require('dotenv').config();
const store = require('./lib/store');
const { generate } = require('./lib/gemini');
const { SECTIONS, GUIDE, RATING_GUIDE, normaliseSection, toRating } = require('./lib/sections');

// Stories rewritten before Gemini chose sections and ratings (or where its answer wasn't usable) get one
// short call each for their section, importance and positivity. New stories get these during the
// rewrite, so this is a catch-up.
const MAX_PER_RUN = parseInt(process.env.MAX_SECTION_CLASSIFICATIONS || '60');

const needsWork = a => !a.skipped && a.headline && (!a.section || !a.importance || !a.positivity);

async function classify(article) {
    const prompt = `Classify this story from a Limerick local news site.

HEADLINE: ${article.headline}
SUMMARY: ${article.summary || article.subheadline || ''}
STORY: ${(article.story || '').slice(0, 1200)}

${GUIDE}

${RATING_GUIDE}

Respond with ONLY JSON: {"section": "<one of: ${SECTIONS.join(', ')}>", "importance": <1-5>, "positivity": <1-5>}`;
    const text = await generate(prompt);
    const json = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
    return {
        section: normaliseSection(json.section),
        importance: toRating(json.importance),
        positivity: toRating(json.positivity)
    };
}

async function classifySections() {
    console.log('🗂️  Choosing sections and ratings\n');
    console.log('='.repeat(50));

    const pending = store.listRewritten().filter(([, a]) => needsWork(a)).slice(0, MAX_PER_RUN);
    console.log(`\n${pending.length} stories missing a section or rating\n`);

    let done = 0;
    for (const [id, article] of pending) {
        try {
            const result = await classify(article);
            // Keep anything already set; only fill the gaps
            const updated = {
                ...article,
                section: article.section || result.section || undefined,
                importance: article.importance || result.importance || undefined,
                positivity: article.positivity || result.positivity || undefined
            };
            store.setRewritten(id, updated);
            if (!needsWork(updated)) done++;
            console.log(`   ${String(updated.section || '?').padEnd(15)} i${updated.importance ?? '?'} p${updated.positivity ?? '?'}  ${article.headline.slice(0, 55)}`);
        } catch (error) {
            console.error(`   ✗ ${article.headline.slice(0, 60)}: ${error.message}`);
        }
    }

    store.save();
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Fully classified: ${done} of ${pending.length}`);
    console.log('='.repeat(50));
}

if (require.main === module) {
    classifySections()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('\n❌ Error:', error);
            process.exit(1);
        });
}

module.exports = { classifySections };
