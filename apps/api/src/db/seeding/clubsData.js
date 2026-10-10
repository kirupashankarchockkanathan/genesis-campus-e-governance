// Club directory supplied by the team (campus club list). Descriptions are short summaries;
// clubs edit their own About page after launch. The OSI creates clubs and assigns Leaders (D5).
const t = 'Technology';
const c = 'Cultural';

export const CLUB_DIRECTORY = [
  // Technical & Engineering
  {
    name: 'Google Developer Student Clubs (GDSC)',
    category: t,
    description: 'Focusing on software engineering and developer ecosystems.',
  },
  {
    name: 'Intel IoT Club',
    category: t,
    description:
      'Provides hands-on industrial exposure in AI, ML, and IoT using official Intel developer tools.',
  },
  {
    name: 'The Init Club',
    category: t,
    description: 'A tech and information media club that actively accepts first-year students.',
  },
  {
    name: 'TECH{KNOW}LOGY Club',
    category: t,
    description: 'A long-standing Microsoft campus club emphasizing team projects and Microsoft tech stacks.',
  },
  {
    name: 'Tensor AI',
    category: t,
    description: 'A specialized group dedicated to deep learning and artificial intelligence.',
  },
  {
    name: 'Amrita CodeChef Chapter',
    category: t,
    description: 'A competitive programming and problem-solving club.',
  },
  { name: 'Hut Labs', category: t, description: 'Focused on building competitive robotics.' },
  {
    name: 'IETE - SF Amrita Telecommunications',
    category: t,
    description: 'The professional student forum for telecommunications and engineering.',
  },
  {
    name: 'SUPRA SAE INDIA & BAJA SAE INDIA',
    category: t,
    description: 'Specialized mechanical engineering clubs building on-road racing and off-road vehicles.',
  },
  {
    name: 'ASTHA Club',
    category: t,
    description:
      'The Amrita Science and Technology Action Forum helping change student perceptions about core sciences.',
  },
  {
    name: 'ASTRA',
    category: t,
    description: 'The campus astronomy club coordinating space tech talks and night sky observations.',
  },

  // Cultural & Fine Arts
  {
    name: 'Raagasudha',
    category: c,
    description: 'The official western music club covering vocals, instrumentation, and beatboxing.',
  },
  {
    name: 'Arya Club',
    category: c,
    description: 'Dedicated to promoting Indian culture, heritage, and self-development programs.',
  },
  { name: 'Natyasudha', category: c, description: 'The traditional and contemporary dance group.' },
  { name: 'Kalakriti', category: 'Arts', description: 'Fine arts and creative craft forum.' },
  { name: 'Anathem', category: c, description: 'Performing arts and campus engagement club.' },
  {
    name: 'Srishti Club & Tamil Siragu',
    category: c,
    description:
      'Cultural and language wings conducting awareness and traditional programs like the Kashi Tamil Sangamam.',
  },

  // Business & Entrepreneurship
  {
    name: 'The ELITE Club Amrita',
    category: 'Business',
    description: 'A platform designed to simulate real entrepreneurial scenarios and ventures.',
  },
  {
    name: 'Amrita Center for Entrepreneurship (ACE)',
    category: 'Business',
    description: 'Supporting startup formulation and business development ideas.',
  },
  {
    name: 'INNOVAC',
    category: 'Business',
    description: 'Mentored by business school faculty to advance management workflows and academic goals.',
  },
  {
    name: 'Young Indians (Yi) Club',
    category: 'Business',
    description: 'A global leadership movement targeting young professional skill-building.',
  },

  // Media, Literature & Social Responsibility
  {
    name: 'Amrita Students Debating Society (ASDS)',
    category: 'Literature',
    description: 'The prominent speaking and debate chamber managed alongside CIR.',
  },
  { name: 'Mindscape', category: 'Literature', description: 'A literary and creative thinking hub.' },
  { name: 'Amrita Talkies', category: 'Arts', description: 'The film and media appreciation club.' },
  {
    name: 'Shutter Com / Amrita Photography Club',
    category: 'Arts',
    description: 'The visual capture crew covering major campus events and media productions.',
  },
  {
    name: 'Student Energy',
    category: 'Social impact',
    description:
      "The university's global chapter focused on planet conservation and sustainability initiatives.",
  },
];

// The sample members (one per club role) are created in this club.
export const SAMPLE_CLUB_NAME = 'Hut Labs';
