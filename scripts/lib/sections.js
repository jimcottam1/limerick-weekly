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

/** The section name if it's one of ours (ignoring case and spacing), otherwise null. */
function normaliseSection(value) {
    const v = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\band\b/, '&');
    return SECTIONS.find(s => s.toLowerCase() === v) || null;
}

module.exports = { SECTIONS, GUIDE, normaliseSection };
