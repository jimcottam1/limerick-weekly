# The Limerick Weekly - Category Pages

## 📚 Overview

Your weekly digest now includes **dedicated section pages** for different news categories, just like a real newspaper!

---

## 🎯 Available Sections

### ⚽ **Sport**
- GAA (hurling, football)
- Munster Rugby
- Soccer
- Local sports teams
- Match results & fixtures

### 💼 **Business**
- Local economy
- Job opportunities
- New developments
- Business openings/closures
- Investment news

### 🏘️ **Local News**
- Community stories
- Council news
- Resident concerns
- Neighborhood updates
- Local initiatives

### 🎭 **Events & Culture**
- Festivals
- Concerts
- Theatre
- Arts & exhibitions
- Cultural events

### 🏛️ **Politics**
- Local TDs
- Council decisions
- Policy changes
- Elections
- Political debates

---

## 🚀 How to Generate

### Generate Everything (Recommended)
```bash
npm run weekly
```

**What it does:**
1. Scrapes latest news
2. Generates main digest
3. Generates all 5 category pages

**Output:** 6 HTML files total
- `limerick-weekly-2025-11-16.html` (main digest)
- `sport-2025-11-16.html`
- `business-2025-11-16.html`
- `local-2025-11-16.html`
- `events-2025-11-16.html`
- `politics-2025-11-16.html`

### Generate Just Category Pages
```bash
npm run categories
```

Uses existing articles in Redis to generate just the category pages.

---

## 📊 What's In Each Category Page

### 1. **Category Header**
- Large icon (⚽, 💼, 🏘️, etc.)
- Section title
- Description
- Date range

### 2. **Navigation Bar**
Links to all other sections:
- Home (main digest)
- Sport
- Business
- Local
- Events
- Politics

### 3. **Section Overview**
AI-generated 2-3 paragraph summary of the week's news in this category

### 4. **Key Highlights**
Bullet points of the most important items

### 5. **Quote of the Section**
Best quote from articles in this category

### 6. **Top Stories**
Up to 8 stories ranked by importance:
- Compelling headline
- Source & date
- 2-3 sentence summary
- "Why it matters" explanation
- Link to original article

---

## 🎨 Design Features

### Color-Coded Sections
Each category has its own color scheme:
- **Sport**: Green (#28a745)
- **Business**: Blue (#007bff)
- **Local**: Purple (#6f42c1)
- **Events**: Orange (#fd7e14)
- **Politics**: Red (#dc3545)

### Responsive Design
- Desktop: Full layout
- Tablet: Optimized columns
- Mobile: Stacked, touch-friendly

### Professional Styling
- Clean typography
- Easy navigation
- Print-friendly
- Hover effects on links

---

## 🔄 How Articles Are Categorized

### Automatic Keyword Filtering

**Sport** - Matches articles containing:
- GAA, hurling, rugby, Munster
- football, sport, match
- final, championship

**Business** - Matches articles containing:
- business, economy, jobs
- development, investment
- company, enterprise

**Local** - Matches articles containing:
- Limerick, community, local
- council, residents
- neighbourhood

**Events** - Matches articles containing:
- event, festival, concert
- culture, arts, music
- theatre, exhibition

**Politics** - Matches articles containing:
- politics, government, TD
- council, election, policy
- minister

### AI Enhancement
After filtering, AI analyzes each category to:
- Select top stories
- Write compelling headlines
- Identify key themes
- Extract quotes
- Write section overview

---

## 📈 Latest Generation Stats

```
✅ Total Articles: 73
✅ Sport: 12 articles → 5 stories
✅ Business: 4 articles → 2 stories
✅ Local: 7 articles → 4 stories
✅ Events: 3 articles → 1 story
✅ Politics: 8 articles → 3 stories
```

**Total Pages Generated:** 6
**Generation Time:** ~2 minutes
**AI Calls:** 6 (1 per section + main)

---

## 🎯 Customization

### Add More Categories

Edit `scripts/generate-categories.js`:

```javascript
const CATEGORIES = {
    // ... existing categories ...

    health: {
        title: 'Health',
        icon: '🏥',
        color: '#17a2b8',
        description: 'Health news and medical updates',
        keywords: ['health', 'hospital', 'medical', 'doctor', 'NHS']
    }
};
```

### Change Keywords

Adjust what articles appear in each section:

```javascript
sport: {
    // ... other config ...
    keywords: ['GAA', 'rugby', 'soccer', 'UL Bohemians', 'Shannon RFC']
}
```

### Modify Story Count

Change how many stories appear per section (line 159):

```javascript
// Select up to 10 most interesting stories
const prompt = `... Select up to 10 most interesting stories...`;
```

---

## 📱 Navigation Flow

### User Journey:

1. **Reads main digest** (limerick-weekly-*.html)
   - Sees top 10 overall stories
   - Clicks on "⚽ Sport" in navigation

2. **Opens Sport section** (sport-*.html)
   - Reads sport-specific stories
   - Sees quote from local player/coach
   - Clicks "💼 Business" to switch section

3. **Opens Business section** (business-*.html)
   - Reads business news
   - Can return to "Home" or explore other sections

**All pages are interconnected!**

---

## 🌐 Sharing Options

### Email Newsletter
Send all 6 HTML files:
- Main digest as email body
- Category pages as attachments
- Or link to hosted versions

### Web Hosting
Upload to web server:
```
yoursite.com/limerick-weekly-2025-11-16.html  (landing page)
yoursite.com/sport-2025-11-16.html
yoursite.com/business-2025-11-16.html
... etc
```

### PDF Package
Convert all pages to PDFs:
- Print each HTML to PDF
- Combine into single document
- Or distribute individually

---

## 🔧 Workflow Examples

### Weekly Publication (Full)
```bash
# Every Friday evening
npm run weekly

# Result: 6 HTML pages ready to share
ls output/
```

### Update Just One Section
```bash
# Scrape fresh articles
npm run scrape

# Regenerate categories only
npm run categories

# Result: New category pages with latest articles
```

### Regenerate With Different Style
```bash
# Edit generate-categories.js (change colors, layout, etc.)

# Regenerate without re-scraping
npm run categories
```

---

## 📊 Sample Output

### From Latest Run:

**Main Digest:**
- 10 top stories across all categories
- Weekly overview
- Trends
- Quote of the week
- Navigation to 5 sections

**Sport Section:**
- 5 GAA, rugby, and sports stories
- Quote from local coach
- Highlights: Match results, upcoming fixtures
- Beautiful green color scheme

**Business Section:**
- 2 business stories
- Economic overview
- Highlights: New jobs, developments
- Professional blue styling

**Local Section:**
- 4 community stories
- Local council news
- Purple branding

**Events Section:**
- 1 cultural event
- Arts & entertainment news
- Orange accents

**Politics Section:**
- 3 political stories
- Policy updates
- Red color scheme

---

## 🎨 Visual Design

### Main Digest (Home)
```
┌─────────────────────────────┐
│   THE LIMERICK WEEKLY      │
│   November 9-16, 2025      │
├─────────────────────────────┤
│ ⚽Sport│💼Business│🏘️Local │
│ 🎭Events│🏛️Politics        │
├─────────────────────────────┤
│   This Week in Limerick    │
│   (Overview section)       │
├─────────────────────────────┤
│   Top 10 Stories           │
│   #1 Story...              │
│   #2 Story...              │
└─────────────────────────────┘
```

### Category Page (e.g., Sport)
```
┌─────────────────────────────┐
│   THE LIMERICK WEEKLY      │
├─────────────────────────────┤
│ Home│💼Business│🏘️Local    │
│ 🎭Events│🏛️Politics         │
├─────────────────────────────┤
│         ⚽                  │
│        SPORT               │
│  Limerick sports news      │
├─────────────────────────────┤
│   This Week in Sport       │
│   (Section overview)       │
├─────────────────────────────┤
│   📌 Key Highlights        │
├─────────────────────────────┤
│   💬 Quote of Section      │
├─────────────────────────────┤
│   Top Stories              │
│   #1 Story...              │
│   #2 Story...              │
└─────────────────────────────┘
```

---

## 💡 Best Practices

### 1. **Generate Weekly**
Run every Friday evening for weekend readers

### 2. **Review Categories**
Check that articles are categorized correctly

### 3. **Archive All Pages**
Save complete sets (all 6 files) for each week

### 4. **Consistent Naming**
Files auto-named by date: `category-2025-11-16.html`

### 5. **Navigation Works Locally**
All links work when files are in same folder

### 6. **Upload Together**
Keep all 6 files in same directory for navigation to work

---

## 🆘 Troubleshooting

### "No articles found for category"
**Cause:** Not enough articles match keywords
**Solution:**
- Run `npm run scrape` to get more articles
- Adjust keywords in `generate-categories.js`

### "Category page missing"
**Cause:** No articles matched that category
**Solution:** Normal! Not every category will have articles every week

### "Navigation links broken"
**Cause:** Files in different folders
**Solution:** Keep all HTML files in same `output/` directory

### "Want to skip a category"
**Solution:** Comment out in `CATEGORIES` object in `generate-categories.js`

---

## 📦 What You Get

### One Command (`npm run weekly`):

✅ **1 Main Digest** - Overall top 10 stories
✅ **5 Category Pages** - Deep dives into each section
✅ **Interconnected Navigation** - Easy browsing
✅ **Professional Design** - Color-coded, responsive
✅ **AI-Curated Content** - Smart selection & summaries

### Total Value:
- 6 professional HTML pages
- 15-20 analyzed stories
- 6 AI-generated overviews
- Navigation between all sections
- Print-ready formatting
- Mobile-responsive design

**All in under 2 minutes!**

---

## 🎉 You Now Have:

✅ A complete multi-section newspaper
✅ Just like Irish Times or Limerick Leader online
✅ Sport, Business, Local, Events, Politics sections
✅ AI-curated and beautifully designed
✅ Ready to share with your community

---

## 🚀 Next Level Features (Future)

Ideas for enhancement:
- [ ] Archive page listing all past weeks
- [ ] Search across all categories
- [ ] Filter by date range
- [ ] Email delivery with category selection
- [ ] Social media auto-posting per category
- [ ] Reader comments per section
- [ ] Most-read stories tracker
- [ ] Category subscription (e.g., Sport-only emails)

---

**You now have a professional, multi-section news publication for Limerick!** 📰

Run `npm run weekly` every Friday and you'll have a complete newspaper ready to publish.
