// The paper's sections, and how Gemini is told to choose between them.
// Section names must match SECTION_ORDER in public/index.html.

const SECTIONS = ['News', 'Sport', 'Council', 'Business', 'Arts & Culture', 'Courts'];

const GUIDE = `SECTIONS (choose exactly one):
- News: general news - incidents, emergencies, health, education, transport, weather, community events, people, deaths and funerals
- Sport: sport of any kind - GAA, hurling, football, rugby, soccer, racing, athletics, results and players
- Council: local government and politics - council decisions and meetings, planning applications, housing schemes, TDs and councillors
- Business: companies, jobs, investment, the economy, property market, business awards and the Chamber
- Arts & Culture: arts, music, film, theatre, festivals, books, heritage, entertainment, pageants and celebrity
- Courts: court cases, trials, charges and sentencing`;

// How the front page picks its lead and Top stories (see public/index.html, which blends the two)
const RATING_GUIDE = `IMPORTANCE (1-5): how much the story matters to people in Limerick
- 5: major - deaths or serious injuries, major crime, severe weather, big decisions affecting many people (hospital, housing, large investment or job losses), county team finals and results
- 4: significant - court verdicts, council decisions, new businesses and jobs, club championship finals, public health
- 3: standard local news
- 2: minor - community events, small awards, previews, features
- 1: trivial - notices and promotional items

POSITIVITY (1-5): how uplifting the story is for readers
- 1: distressing - death, serious harm, violent crime
- 2: negative - conviction, closure, loss, disruption
- 3: neutral or mixed
- 4: positive - progress, investment, a win, a new service
- 5: good news - achievement, celebration, kindness, community success`;

const toRating = value => {
    const n = Math.round(Number(value));
    return n >= 1 && n <= 5 ? n : null;
};

/** The section name if it's one of ours (ignoring case and spacing), otherwise null. */
function normaliseSection(value) {
    const v = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\band\b/, '&');
    return SECTIONS.find(s => s.toLowerCase() === v) || null;
}

module.exports = { SECTIONS, GUIDE, RATING_GUIDE, normaliseSection, toRating };
