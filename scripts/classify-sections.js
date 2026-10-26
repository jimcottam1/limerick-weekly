require('dotenv').config();
const store = require('./lib/store');
const { generate } = require('./lib/gemini');
const { SECTIONS, GUIDE, normaliseSection } = require('./lib/sections');

// Stories rewritten before Gemini chose sections (or where its answer wasn't recognised) get one
// short call each to pick a section. New stories get theirs during the rewrite, so this is a catch-up.
const MAX_PER_RUN = parseInt(process.env.MAX_SECTION_CLASSIFICATIONS || '60');

async function classify(article) {
    const prompt = `Which section of a Limerick local news site does this story belong in?

HEADLINE: ${article.headline}
SUMMARY: ${article.summary || article.subheadline || ''}
STORY: ${(article.story || '').slice(0, 1200)}

${GUIDE}

Respond with ONLY the section name, exactly as written: ${SECTIONS.join(', ')}`;
    return normaliseSection((await generate(prompt)).replace(/["*.]/g, ''));
}

async function classifySections() {
    console.log('🗂️  Choosing sections\n');
    console.log('='.repeat(50));

    const pending = store.listRewritten()
        .filter(([, a]) => !a.skipped && a.headline && !a.section)
        .slice(0, MAX_PER_RUN);
    console.log(`\n${pending.length} stories without a section\n`);

    let done = 0;
    for (const [id, article] of pending) {
        try {
            const section = await classify(article);
            if (!section) {
                console.log(`   ? No valid section for: ${article.headline.slice(0, 60)}`);
                continue;
            }
            store.setRewritten(id, { ...article, section });
            done++;
            console.log(`   ${section.padEnd(15)} ${article.headline.slice(0, 60)}`);
        } catch (error) {
            console.error(`   ✗ ${article.headline.slice(0, 60)}: ${error.message}`);
        }
    }

    store.save();
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Sections chosen: ${done} of ${pending.length}`);
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
