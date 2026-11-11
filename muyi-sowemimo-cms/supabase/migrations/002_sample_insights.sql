-- MOCK CONTENT: placeholder briefings so Insights is populated on day one. Edit or delete in the admin.
insert into posts (slug, title, category, excerpt, body, is_published, published_at) values
('what-inbound-investors-should-ask-before-entering-nigeria', 'What inbound investors should ask before entering Nigeria', 'Cross-border',
 'Five questions that decide whether a Nigerian venture is structured to last.',
 E'Placeholder briefing for demonstration.\n\n## 1. Which vehicle fits the activity?\nThe choice of vehicle drives licensing, taxation and the exit.\n\n## 2. Who holds the permits?\nSector permits are often issued to a specific entity; confirm before signing.\n\n## 3. How will profits move?\nRepatriation depends on documentation from day one.', true, now() - interval '5 days'),
('mining-and-energy-permitting-what-changes-for-operators', 'Mining and energy permitting: what changes for operators', 'Energy & Mining',
 'A plain-language read-out of recent regulatory movement.',
 E'Placeholder briefing for demonstration.\n\n## What changed\nSummarise the development here.\n\n## What it means\nExplain the practical consequence for operators and investors.', true, now() - interval '14 days'),
('estate-planning-for-diaspora-families-with-nigerian-assets', 'Estate planning for diaspora families with Nigerian assets', 'Private Client',
 'Why a will written abroad may not be enough for property held in Nigeria.',
 E'Placeholder briefing for demonstration.\n\n## The problem\nAssets in two jurisdictions need two coordinated plans.\n\n## A practical starting point\nList assets, confirm title, and align the will with local formalities.', true, now() - interval '30 days')
on conflict (slug) do nothing;
