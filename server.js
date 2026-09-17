import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Persistent Disk-backed Voice Pack Directory
const VOICEPACK_DIR = path.join(__dirname, 'public', 'sounds', 'voicepack');
try {
  if (!fs.existsSync(VOICEPACK_DIR)) {
    fs.mkdirSync(VOICEPACK_DIR, { recursive: true });
  }
} catch (e) {
  console.log('[VoicePack] Notice: Read-only filesystem detected, disk caching disabled.');
}

// Helper to convert raw PCM audio bytes to playable WAV format
function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitDepth = 16) {
  const byteRate = sampleRate * numChannels * (bitDepth / 8);
  const blockAlign = numChannels * (bitDepth / 8);
  const wavHeader = Buffer.alloc(44);

  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitDepth, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([wavHeader, pcmBuffer]);
}

// Conversational, Friendly, Non-aggressive Question Banks by Gender (Manglish & English)
const QUESTION_POOLS = {
  guy: [
    {
      id: 'sigma_nonchalant',
      category: 'PERSONA & MIRROR VIBE',
      manglish: {
        title: 'Personality 1: Mirror Reflection & Vibe',
        prompt: 'Kinnathil nokkumbo what fictional character or movie aesthetic do you picture yourself having, versus what your friends might see?',
        subtext: 'The vibe you feel you give off when you step out.',
        placeholder: 'e.g., I picture myself looking like a quiet mystery guy, but my friends probably see me as an overthinking nerd...',
        quickPicks: [
          'I picture myself as a quiet, stoic guy, but I actually text back within 5 seconds',
          'I feel like I have an Aavesham Ranga swag, but my friends just see me as chill and quiet',
          'I imagine having that mysterious dark academia look, but I am just a bit socially anxious',
          'I like to listen to phonk music at night imagining I have a cool hero backstory'
        ]
      },
      english: {
        title: 'Personality 1: Mirror Reflection & Persona',
        prompt: 'When you look in the mirror before heading out, what fictional character or aesthetic vibe do you picture yourself having?',
        subtext: 'The personal aesthetic you naturally identify with.',
        placeholder: 'e.g., I picture myself as an unbothered mysterious guy, but in reality I am super eager to please...',
        quickPicks: [
          'I picture myself as an unbothered lone wolf, but I check my messages every few minutes',
          'I try to give off a quiet mysterious aura because I am naturally an introvert',
          'I listen to cinematic soundtrack music pretending I am preparing for an epic scene',
          'I like to give advice to my friends even when I haven’t figured things out myself'
        ]
      }
    },
    {
      id: 'gym_bulk_myth',
      category: 'FITNESS ROUTINE & HABITS',
      manglish: {
        title: 'Personality 2: Fitness Habits & Goals',
        prompt: 'Gym-ilo workout-ilo povaan plan cheyyumbo, what is your honest routine versus what you actually end up eating?',
        subtext: 'Your fitness aspirations versus daily comfort food.',
        placeholder: 'e.g., I plan to be consistent every Monday, but end up enjoying midnight snacks and skipping...',
        quickPicks: [
          'I do a quick 20-minute workout and immediately celebrate with a big meal',
          'I tell myself I am on a long-term bulking phase so I don’t stress over strict dieting',
          'I bought protein powder that is sitting quietly in my kitchen cabinet',
          'I spend more time building the gym music playlist than actually doing the sets'
        ]
      },
      english: {
        title: 'Personality 2: Fitness Aspirations vs Reality',
        prompt: 'When it comes to fitness or gym routines, what is your honest consistency versus your daily diet?',
        subtext: 'Your workout intentions versus comfort habits.',
        placeholder: 'e.g., I have great fitness intentions, but I often prioritize comfort food and sleep...',
        quickPicks: [
          'I spend 30 minutes choosing the perfect hype music for a 20-minute workout',
          'I playfully label my casual eating habits as a "perpetual bulking phase"',
          'I take post-workout mirror photos with flattering lighting to track progress',
          'I love reading fitness advice, but rarely implement it consistently'
        ]
      }
    },
    {
      id: 'enfield_ride_flex',
      category: 'VEHICLES & MAIN CHARACTER MOMENTS',
      manglish: {
        title: 'Personality 3: Rides & Main Character Energy',
        prompt: 'Vandi oodikkumbo atho vehicle-umaayi photo edukkumbo, what makes you feel that effortless main-character feeling?',
        subtext: 'That feeling of freedom on the road.',
        placeholder: 'e.g., Cruising on my bike with sunglasses on feeling like I am in a road movie...',
        quickPicks: [
          'Riding at night listening to music with the cold wind feeling like a movie scene',
          'Posing with a bike or car with dark shades for that classic candid profile picture',
          'Enjoying a loud exhaust or clean car wash that makes people turn their heads',
          'Taking scenic driving videos through mountain roads to post with indie songs'
        ]
      },
      english: {
        title: 'Personality 3: Driving & Main Character Moments',
        prompt: 'When driving or taking pictures with a car or bike, what gives you that effortless main-character feeling?',
        subtext: 'Those moments on the road where you feel in your element.',
        placeholder: 'e.g., Late night drives with the windows down listening to ambient synth music...',
        quickPicks: [
          'Cruising late at night with my favorite tracks pretending I am in a cinematic road movie',
          'Taking an aesthetic steering wheel picture with my watch in the frame',
          'Loving the sound of an engine when pulling away from a green light',
          'Feeling a genuine boost of confidence right after giving my vehicle a full wash'
        ]
      }
    },
    {
      id: 'ghosting_lone_wolf',
      category: 'TEXTING & EMOTIONAL PACING',
      manglish: {
        title: 'Personality 4: Communication & Texting Rhythm',
        prompt: 'Oru person-umaayi serious aayi connect aavumbo, do you reply immediately or do you need time to recharge your social battery?',
        subtext: 'How you handle conversations when things get close.',
        placeholder: 'e.g., I sometimes get overwhelmed and take a couple of days to reply to thoughtful messages...',
        quickPicks: [
          'I sometimes get overwhelmed and delay replies telling myself I need headspace',
          'I tell people I am super busy with work when I am really just recharging my energy',
          'I keep my guard up for a while before letting someone get genuinely close',
          'I overthink simple messages and wait hours so I don’t look too eager'
        ]
      },
      english: {
        title: 'Personality 4: Texting Rhythm & Closeness',
        prompt: 'When someone shows genuine interest in you, what is your typical texting rhythm and emotional response?',
        subtext: 'How you naturally navigate emotional pacing.',
        placeholder: 'e.g., I tend to take a while to reply because opening up can feel intimidating...',
        quickPicks: [
          'I sometimes step back and delay replies because deep conversations feel intense',
          'I convince myself I need to focus on personal goals before getting too close to someone',
          'I leave messages on delivered for hours so I don’t come across as overly invested',
          'I tend to retreat into my shell when someone asks serious questions about feelings'
        ]
      }
    },
    {
      id: 'matrix_hustle',
      category: 'FUTURE DREAMS & ASPIRATIONS',
      manglish: {
        title: 'Personality 5: Side Hustles & Daydreams',
        prompt: 'Future career atho business-ine kurichu aalochikkumbo, what is the big side hustle you find yourself constantly daydreaming about?',
        subtext: 'The entrepreneurial idea you think about escaping to.',
        placeholder: 'e.g., Starting an online brand or investing in something innovative so I can be independent...',
        quickPicks: [
          'Daydreaming about running my own startup so I don’t have to work a 9-to-5',
          'Exploring crypto, stocks, or trading ideas in hopes of building quick independence',
          'Spending lots of time researching productivity tools and setups instead of doing the work',
          'Listening to business podcasts and imagining what my founder interview would be like'
        ]
      },
      english: {
        title: 'Personality 5: Entrepreneurial Daydreams',
        prompt: 'What is the big side hustle or entrepreneurial dream you catch yourself constantly daydreaming about?',
        subtext: 'The passion project you hope will give you freedom.',
        placeholder: 'e.g., Launching a creative studio or tech product so I can dictate my own schedule...',
        quickPicks: [
          'Daydreaming about building a successful digital business and working from anywhere',
          'Designing elaborate plans and Notion dashboards before ever launching the project',
          'Listening to entrepreneurial podcasts and imagining my own success story',
          'Investing small amounts in creative ideas hoping they turn into something huge'
        ]
      }
    },
    {
      id: 'hairline_paranoia',
      category: 'GROOMING & STYLE DETAILS',
      manglish: {
        title: 'Personality 6: Grooming & Aesthetic Details',
        prompt: 'Purathu erangumbo, what is the one aspect of your appearance or hairstyle you secretly spend the most time checking in the mirror?',
        subtext: 'The little detail you always want to look just right.',
        placeholder: 'e.g., Making sure my hair volume looks right and checking reflection in shop windows...',
        quickPicks: [
          'Checking my hair angle in every reflective car window as I walk past',
          'Making sure my shoes give me good posture and a little extra presence',
          'Making sure the lighting hits my face well when taking pictures',
          'Spending 20 minutes adjusting my hair before deciding it was fine in the first place'
        ]
      },
      english: {
        title: 'Personality 6: Grooming & Self-Presentation',
        prompt: 'When getting ready, what aspect of your appearance or hairstyle do you spend the most time checking in the mirror?',
        subtext: 'The subtle detail you always pay extra attention to.',
        placeholder: 'e.g., Spending extra time fixing my hair until it sits at the right angle...',
        quickPicks: [
          'Checking my reflection in passing store windows to see how my hair is holding up',
          'Wearing footwear that gives me great posture and clean silhouettes',
          'Taking multiple test photos to make sure the camera captures my preferred side',
          'Spending extra time perfecting my grooming routine before stepping out'
        ]
      }
    }
  ],

  girl: [
    {
      id: 'clean_girl_chaos',
      category: 'AESTHETIC LIVING VS REALITY',
      manglish: {
        title: 'Personality 1: Pinterest Aesthetic vs Room Reality',
        prompt: 'Pinterest-il aesthetic spaces and cozy routines save cheyyarundo? What is your actual room looking like during a busy week?',
        subtext: 'The curated moodboard versus everyday living.',
        placeholder: 'e.g., Saving minimalist beige aesthetic rooms while my clothes pile rests on my chair...',
        quickPicks: [
          'Saving peaceful minimalist loft pictures while my chair holds a week of clean laundry',
          'Taking aesthetic coffee photos while keeping the slightly messy desk cropped out',
          'Buying a lovely planner at the start of the year that has about two neat pages filled',
          'Lighting a scented candle to make the whole room feel instantly serene and organized'
        ]
      },
      english: {
        title: 'Personality 1: Pinterest Vision vs Daily Reality',
        prompt: 'You save aesthetic minimalist spaces and morning routines, but what is your actual room setup like during a busy week?',
        subtext: 'The ideal moodboard versus comfortable everyday reality.',
        placeholder: 'e.g., Beautiful aesthetic Pinterest boards while my chair holds an unfolded laundry mountain...',
        quickPicks: [
          'The beloved bedroom chair where clean laundry lives comfortably all week',
          'Cropping out 90% of my room to take an aesthetically pleasing iced latte photo',
          'Buying lovely stationery and planners that I treat as decorative objects',
          'Lighting a cozy scented candle to instantly bring peace to a slightly chaotic week'
        ]
      }
    },
    {
      id: 'fbi_groupchat',
      category: 'COMMUNICATION & TEXT ANALYSIS',
      manglish: {
        title: 'Personality 2: The Group Chat Brainstorm',
        prompt: 'Oru person-il ninnu ambiguous aayulla text vannaal, do you screenshot it and analyze it with your close friends?',
        subtext: 'Decoding messages with the people who know you best.',
        placeholder: 'e.g., Getting a 2-word reply and discussing with my besties what it actually means...',
        quickPicks: [
          'Convening a quick group chat review when someone sends a short or unusual text',
          'Drafting a balanced response in my Notes app before actually sending it',
          'Wondering whether a period instead of an exclamation mark means someone is busy or distant',
          'Taking a little extra time to reply so the conversation doesn’t feel rushed'
        ]
      },
      english: {
        title: 'Personality 2: The Group Chat Decode Council',
        prompt: 'When you receive an ambiguous or unexpectedly brief text, do you share it with your closest friends to decode the tone?',
        subtext: 'Collaborative analysis with your trusted inner circle.',
        placeholder: 'e.g., Sending a screenshot to my best friend asking if they think this sounds standoffish...',
        quickPicks: [
          'Consulting the close friends group chat to craft a message that sounds natural and poised',
          'Overthinking whether a missing emoji signifies emotional distance or just a busy day',
          'Drafting potential responses in my Notes app before hitting send',
          'Deliberately matching their response time so I keep things balanced'
        ]
      }
    },
    {
      id: 'red_flag_sprint',
      category: 'ROMANTIC INTUITION & HOPES',
      manglish: {
        title: 'Personality 3: Romantic Hopes vs Early Signs',
        prompt: 'In dating or crushes, what is a quirky habit or small red flag you noticed early on but decided to overlook because of good chemistry?',
        subtext: 'Giving someone the benefit of the doubt.',
        placeholder: 'e.g., They had irregular texting habits, but their music taste and vibe were so comforting...',
        quickPicks: [
          'Overlooking inconsistent communication because their music taste and humor matched mine',
          'Believing that with patience and understanding, someone will naturally open up',
          'Picturing a sweet future together after just a couple of great conversations',
          'Defending a crush to my friends because I felt a special connection'
        ]
      },
      english: {
        title: 'Personality 3: Romantic Hopes & Giving Chances',
        prompt: 'In dating or crushes, what was an early hesitation you noticed but decided to overlook because the chemistry felt so good?',
        subtext: 'Letting good vibes outweigh minor hesitations.',
        placeholder: 'e.g., They had strange communication rhythms, but they were charming so I gave them a pass...',
        quickPicks: [
          'Looking past inconsistent texting because our shared taste in music and films was so rare',
          'Hoping that kindness and patience would help someone become more communicative',
          'Secretly daydreaming about sweet future milestones after a really wonderful first date',
          'Trusting my intuition and giving someone multiple chances to show who they are'
        ]
      }
    },
    {
      id: 'retail_therapy_lipgloss',
      category: 'SELF CARE & RETAIL THERAPY',
      manglish: {
        title: 'Personality 4: Little Treats & Self Care',
        prompt: 'Stressful aayulla oru day kazhinjaal, what is your go-to small purchase or treat that instantly lifts your mood?',
        subtext: 'The little comforts that make a long day better.',
        placeholder: 'e.g., Buying a comforting drink or picking up another lovely lip tint or skincare item...',
        quickPicks: [
          'Buying a slightly different shade of lip tint that brings a pleasant boost of joy',
          'Browsing shopping carts late at night just for the comforting dopamine of looking',
          'Treating myself to an iced matcha or sweet dessert after a challenging day',
          'Purchasing a new skincare product hoping it brings that glowing relaxed feeling'
        ]
      },
      english: {
        title: 'Personality 4: Little Treats & Mood Boosts',
        prompt: 'After a demanding day, what is your favorite little treat or impulse purchase that instantly restores your mood?',
        subtext: 'The simple joys of self-care and retail comfort.',
        placeholder: 'e.g., An artisan coffee, a cozy bath product, or a lovely lip shade...',
        quickPicks: [
          'Buying another warm neutral lip color because the texture and finish feel so comforting',
          'Adding lovely items to my digital cart just to enjoy the peaceful browsing ritual',
          'Treating myself to an iced specialty beverage as a reward for completing routine tasks',
          'Investing in a luxurious skincare serum as a relaxing nighttime ritual'
        ]
      }
    },
    {
      id: 'astrology_empath_excuse',
      category: 'INTUITION & ASTRONOMICAL VIBES',
      manglish: {
        title: 'Personality 5: Astrology & Energy Intuition',
        prompt: 'Aalukalude personality explain cheyyaan do you look into zodiac signs, attachment styles, or energy vibes?',
        subtext: 'Understanding people through intuitive frameworks.',
        placeholder: 'e.g., I check someone’s star sign to see if our personality types are naturally aligned...',
        quickPicks: [
          'Checking someone’s zodiac sign to see if our energy and communication naturally match',
          'Reading about attachment styles to understand why people react the way they do',
          'Noticing when moon phases or planetary shifts seem to influence the general mood',
          'Trusting my gut intuition about a person’s aura within the first few minutes'
        ]
      },
      english: {
        title: 'Personality 5: Personality Archetypes & Intuition',
        prompt: 'How often do you find yourself consulting zodiac signs, attachment styles, or MBTI to understand people around you?',
        subtext: 'Using personality frameworks to navigate relationships.',
        placeholder: 'e.g., Looking up someone’s birth chart or attachment style to understand their habits...',
        quickPicks: [
          'Checking someone’s sun and moon signs to get a sense of their temperament',
          'Using attachment theory concepts to make sense of complicated interactions',
          'Feeling a strong intuitive sense of someone’s vibe before they even speak',
          'Playfully attributing unexpected mood swings to planetary retrogrades'
        ]
      }
    },
    {
      id: 'cryptic_close_friends',
      category: 'SOCIAL POSTING & HINTS',
      manglish: {
        title: 'Personality 6: Close Friends & Subtle Hints',
        prompt: 'Close Friends-ilo private stories-ilo what kind of music or stories do you post when you secretly hope someone specific views it?',
        subtext: 'Leaving subtle digital breadcrumbs.',
        placeholder: 'e.g., Posting an aesthetic song lyric late at night hoping a certain person notices...',
        quickPicks: [
          'Posting a late-night music track hoping someone specific notices and reaches out',
          'Sharing an unbothered cute story after a long day to show I am doing well',
          'Curating my Close Friends list so only the people with good energy are on it',
          'Checking the viewer list occasionally to see if that one person took a look'
        ]
      },
      english: {
        title: 'Personality 6: Close Friends & Subtle Cues',
        prompt: 'What kind of aesthetic music or subtle photos do you share on Close Friends when you hope a specific person takes note?',
        subtext: 'Leaving gentle digital hints for someone special.',
        placeholder: 'e.g., Sharing a song with meaningful lyrics hoping they might reply...',
        quickPicks: [
          'Posting an atmospheric song with poignant lyrics hoping a certain person listens',
          'Sharing an effortless aesthetic moment to subtly show that life is moving beautifully',
          'Checking the viewer order to see who checked in on my day first',
          'Keeping a closely guarded Close Friends circle where I share my unfiltered thoughts'
        ]
      }
    }
  ],

  neutral: [
    {
      id: 'aesthetic_identity_crisis',
      category: 'CREATIVE EXPLORATION & STYLE',
      manglish: {
        title: 'Personality 1: Aesthetic Evolution & Micro-trends',
        prompt: 'How often do you find yourself exploring a completely new music genre, fashion aesthetic, or creative hobby?',
        subtext: 'Constantly exploring new creative identities.',
        placeholder: 'e.g., Switching from dark academia to vintage indie or ambient electronic every couple of months...',
        quickPicks: [
          'Exploring different aesthetics and fashion styles to see what feels right for me',
          'Curating hyper-specific Spotify playlists for very distinct moods and seasons',
          'Buying physical vintage books or items for their artistic decorative charm',
          'Enjoying quiet, introspective hobbies that give me space to think'
        ]
      },
      english: {
        title: 'Personality 1: Creative Style & Aesthetic Shifts',
        prompt: 'How often do you find yourself drawn to exploring a completely new aesthetic, music subculture, or creative niche?',
        subtext: 'The joy of evolving your creative self-expression.',
        placeholder: 'e.g., Immersing myself in a new creative subculture every few months...',
        quickPicks: [
          'Exploring distinct subcultures and aesthetics as a form of self-expression',
          'Curating beautifully themed playlists with matching custom album cover art',
          'Surrounding myself with vintage books, art prints, and cozy creative items',
          'Appreciating atmospheric, introspective art and quiet independent films'
        ]
      }
    },
    {
      id: 'parasocial_obsession',
      category: 'FICTIONAL WORLDS & NARRATIVES',
      manglish: {
        title: 'Personality 2: Emotional Connections to Stories',
        prompt: 'Do you find yourself deeply emotionally invested in fictional character arcs, books, or internet creators you admire?',
        subtext: 'Finding comfort in well-written stories.',
        placeholder: 'e.g., Getting deeply moved by fictional stories and caring about character development...',
        quickPicks: [
          'Getting deeply invested in video game storylines or character development',
          'Feeling a genuine sense of comfort from favorite YouTubers or podcast hosts',
          'Spending hours reading analysis and fan discourse about stories I love',
          'Finding solace in immersive worlds when everyday life feels a little monotonous'
        ]
      },
      english: {
        title: 'Personality 2: Deep Story Immersion',
        prompt: 'How deeply do you find yourself connecting with fictional character journeys, novels, or thoughtful creators?',
        subtext: 'Finding resonance and comfort in narrative art.',
        placeholder: 'e.g., Feeling genuinely moved by a great character arc or thoughtful podcast...',
        quickPicks: [
          'Feeling a powerful emotional bond with well-written fictional protagonists',
          'Finding daily comfort in familiar podcast voices and thoughtful creators',
          'Diving into long-form video essays analyzing films and philosophical themes',
          'Using rich fictional universes as a welcoming retreat from daily stress'
        ]
      }
    },
    {
      id: 'text_paralysis_neutral',
      category: 'COMMUNICATION & THOUGHTFULNESS',
      manglish: {
        title: 'Personality 3: Thoughtful Drafting & Reply Pacing',
        prompt: 'When responding to an important message or email, do you reply quickly or do you take your time to ensure the tone is thoughtful?',
        subtext: 'Wanting your words to be clear and considerate.',
        placeholder: 'e.g., Taking time to craft thoughtful responses so there is no misunderstanding...',
        quickPicks: [
          'Taking extra time to reply so my words convey the exact right emotion and clarity',
          'Reading a message and letting it sit with me before formulating a sincere reply',
          'Drafting messages carefully to make sure the tone feels warm and polite',
          'Preferring written communication over unexpected telephone calls'
        ]
      },
      english: {
        title: 'Personality 3: Thoughtful Communication Pacing',
        prompt: 'When responding to an important message, how much time do you spend ensuring your tone is balanced and considered?',
        subtext: 'Crafting intentional and thoughtful correspondence.',
        placeholder: 'e.g., Re-reading a message a couple of times before sending to ensure clarity...',
        quickPicks: [
          'Taking time to craft measured, thoughtful responses rather than replying impulsively',
          'Letting messages sit while I gather my thoughts so I can offer genuine presence',
          'Drafting important notes carefully to ensure mutual understanding',
          'Preferring deep, written communication over quick, surface-level exchanges'
        ]
      }
    },
    {
      id: 'thrift_hoarding_neutral',
      category: 'THRIFTING & SENTIMENTAL CLUTTER',
      manglish: {
        title: 'Personality 4: Vintage Thrifting & Quirky Treasures',
        prompt: 'What is your favorite guilty pleasure item to hunt for when browsing thrift stores, bookstores, or artisanal markets?',
        subtext: 'Treasures that carry history and character.',
        placeholder: 'e.g., Collecting unique mugs, vintage cameras, or interesting second-hand books...',
        quickPicks: [
          'Collecting quirky mugs and pottery pieces that make daily tea feel special',
          'Browsing second-hand books and keeping them as decorative sentimental treasures',
          'Collecting canvas tote bags from local events and bookshops',
          'Picking up retro gadgets or stationery items simply because of their design appeal'
        ]
      },
      english: {
        title: 'Personality 4: Thrifting & Sentimental Finds',
        prompt: 'What is your favorite guilty pleasure item to browse or collect when exploring thrift shops and artisan markets?',
        subtext: 'Collecting objects with soul and character.',
        placeholder: 'e.g., Finding vintage books, handmade ceramic pieces, or retro items...',
        quickPicks: [
          'Collecting artisanal ceramic mugs that bring daily joy to my morning routine',
          'Treasuring vintage books and displaying them for their artistic presence',
          'Collecting unique tote bags and notebooks from independent shops',
          'Appreciating retro knick-knacks and design pieces that carry personal charm'
        ]
      }
    },
    {
      id: 'room_pacing_spiral',
      category: 'LATE NIGHT CONTEMPLATION',
      manglish: {
        title: 'Personality 5: Late Night Headphone Walks',
        prompt: 'Headphone vechu late night music kelkkumbo, what kind of reflective thoughts or creative scenarios tend to play in your mind?',
        subtext: 'Your imaginative space during quiet hours.',
        placeholder: 'e.g., Walking around my room thinking deeply about my future plans and past memories...',
        quickPicks: [
          'Listening to soundtracks and visualizing creative accomplishments and future milestones',
          'Reflecting on past conversations and imagining how I could have articulated things better',
          'Feeling a deep sense of introspection when walking around my space late at night',
          'Replaying favorite memories and imagining new creative projects to embark on'
        ]
      },
      english: {
        title: 'Personality 5: Late Night Reflection',
        prompt: 'When listening to ambient music with your headphones on late at night, what imaginative scenarios keep your mind active?',
        subtext: 'Your reflective inner world during quiet hours.',
        placeholder: 'e.g., Walking around my room visualizing future creative milestones and memories...',
        quickPicks: [
          'Visualizing future accomplishments and creative breakthroughs while listening to epic music',
          'Reflecting deeply on life lessons and meaningful moments from the past',
          'Experiencing a surge of imaginative energy late at night when the world is quiet',
          'Daydreaming about moving to a picturesque, tranquil place to focus on personal projects'
        ]
      }
    }
  ]
};

// Health endpoint
app.get('/api/health', (req, res) => {
  const hasGeminiEnv = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5);
  const hasOpenAIEnv = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 5);

  res.json({
    status: 'online',
    hasGeminiEnv,
    hasOpenAIEnv,
    hasAnyKey: hasGeminiEnv || hasOpenAIEnv,
    defaultProvider: hasGeminiEnv ? 'gemini' : (hasOpenAIEnv ? 'openai' : 'gemini'),
    defaultGeminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  });
});

// Dynamic Question Endpoint: Returns 5 friendly, non-aggressive questions tailored by gender and dialect
app.get('/api/questions', (req, res) => {
  const gender = req.query.gender || 'guy';
  const lang = req.query.lang || 'manglish';

  const pool = QUESTION_POOLS[gender] || QUESTION_POOLS.guy;
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 5);

  const formattedQuestions = selected.map(item => {
    const qData = lang === 'manglish' ? item.manglish : item.english;
    return {
      id: item.id,
      category: item.category,
      title: qData.title,
      prompt: qData.prompt,
      subtext: qData.subtext,
      placeholder: qData.placeholder,
      quickPicks: qData.quickPicks
    };
  });

  res.json({
    gender,
    language: lang,
    questions: formattedQuestions
  });
});

// System Prompt with 3 Distinct Spice Modes & Strict Ethical Safeguards
function buildSystemPrompt(language = 'manglish', spiceLevel = 'nuclear', gender = 'guy') {
  const isManglish = language === 'manglish';

  const safetyGuardrail = `
CRITICAL ETHICAL MANDATES (ABSOLUTE ZERO TOLERANCE):
- STRICTLY PROHIBITED: NO misogyny, NO sexism, NO racism, NO homophobia, NO transphobia, NO body shaming, and NO slurs.
- TARGET PERSONALITY, NOT IDENTITY: Do not attack their gender, race, sexuality, or physical appearance.
- WHAT TO ROAST: Focus on vanity, unearned ego, coping mechanisms, screen addiction, fake aesthetics, parental financial dependence, overthinking, procrastination, and texting clownery.
`;

  // MODE 1: SENSITIVE (Gentle, Friendly, Wholesome Tease - ZERO BAD WORDS)
  if (spiceLevel === 'sensitive') {
    if (isManglish) {
      return `You are CookedAI: a witty, warm, and playful Malayali friend who teases people gently in friendly MANGLISH.
The user explicitly selected SENSITIVE MODE. They want a soft, playful, good-humored roast.

CRITICAL CLEAN LANGUAGE RULES (ZERO BAD WORDS):
- ABSOLUTELY NO CURSE WORDS, NO PROFANITY, NO SLURS, AND NO HARSH INSULTS.
- Do NOT use words like "myre", "thendi", "alavalathi", "oombiya", or any abusive terms.
- Keep the tone friendly, charming, and gently sarcastic, teasing their cute quirks, overthinking, and shopping habits like a caring older sibling or sweet best friend.

${safetyGuardrail}

YOU MUST RESPOND STRICTLY WITH VALID JSON IN THIS FORMAT (Values in gentle Manglish):
{
  "diagnosis": "Wholesome playful condition title (e.g. Chronic Overthinking & Cute Aesthetic Syndrome)",
  "aura_score": "Gentle playful aura (e.g. -500 Aura (Still redeemable!))",
  "cooked_level": "Mild playful level (e.g. 25% Lightly Toasted Bread)",
  "vibe_check": "Warm teasing summary (e.g. A wholesome soul who needs to stop overthinking)",
  "deep_roast": "A 2-to-3 paragraph gentle, witty, humorous Manglish tease roasting their answers with zero bad words. Tease their little habits playfully with warmth and affection.",
  "lethal_one_liner": "A playful, cute, non-offensive closing advice.",
  "prescribed_l": "A wholesome self-care action (e.g. 'Oru chaya kudi, puthiya playlist kekku, stop overthinking')."
}
Do NOT wrap the JSON in markdown code fences. Output raw JSON only.`;
    }

    return `You are CookedAI: a witty, warm, and playful friend teasing the user gently in English.
The user selected SENSITIVE MODE. They want a mild, charming, good-natured roast.

CRITICAL CLEAN LANGUAGE RULES (ZERO BAD WORDS):
- ABSOLUTELY NO CURSE WORDS, NO PROFANITY, NO HARSH DEROGATORY LANGUAGE.
- Keep the teasing lighthearted, witty, and wholesome. Focus affectionately on their overthinking, collection of unread books, or habit of hoarding stationery.

${safetyGuardrail}

YOU MUST RESPOND STRICTLY WITH VALID JSON IN THIS FORMAT:
{
  "diagnosis": "Playful, lighthearted title (e.g. Mild Case of Overthinking & Aesthetic Hoarding)",
  "aura_score": "Gentle aura note (e.g. -250 Aura (Plenty of good vibes left))",
  "cooked_level": "Mild level (e.g. 20% Golden Brown Croissant)",
  "vibe_check": "Affectionate teasing summary (e.g. A well-meaning overthinker)",
  "deep_roast": "A 2-to-3 paragraph warm, clever, wholesome tease addressing their answers with ZERO profanity and zero cruelty.",
  "lethal_one_liner": "A witty, harmless, playful closing tease.",
  "prescribed_l": "A cozy, wholesome suggestion (e.g. 'Take a warm bath, drink water, and close the shopping tabs')."
}
Do NOT wrap the JSON in markdown code fences. Output raw JSON only.`;
  }

  // MODE 2: SAVAGE (Wild Aggressive - Fast, Ferocious & Disrespectful)
  if (spiceLevel === 'savage') {
    if (isManglish) {
      return `You are CookedAI: a wild, aggressive, fast-talking Malayali Gen-Z roaster speaking in cutting MANGLISH.
The user selected SAVAGE MODE (WILD AGGRESSIVE).
Tone: Ferocious, sharp, sarcastic, and energetic disrespect. Tear into their coping mechanisms, their unearned confidence, and their delusions.

${safetyGuardrail}
Use authentic Kerala internet slang: van durantham, verum show, achante kaashil show, oola, tholvi, thallal, scene mone, scene contra.

YOU MUST RESPOND STRICTLY WITH VALID JSON (Manglish):
{
  "diagnosis": "Savage Manglish clinical title (e.g. Stage 4 Chronic Thallal & Durandham)",
  "aura_score": "Severe penalty (e.g. -450,000 Aura)",
  "cooked_level": "High cooked level (e.g. 95% Karinja Porotta)",
  "vibe_check": "Savage summary in Manglish",
  "deep_roast": "A 3-paragraph wild aggressive Manglish roast dissecting their specific answers with cutting comedic disrespect.",
  "lethal_one_liner": "A sharp, disrespectful mic-drop sentence in Manglish.",
  "prescribed_l": "A humiliating, touch-grass action in Manglish."
}
Do NOT wrap the JSON in markdown code fences. Output raw JSON only.`;
    }

    return `You are CookedAI: a wild, aggressive, chronically online Gen-Z roaster.
The user selected SAVAGE MODE (WILD AGGRESSIVE).
Tone: Ferocious, biting, and relentlessly sarcastic. Dissect their answers and attack their vanity and excuses with razor-sharp comedic timing.

${safetyGuardrail}

YOU MUST RESPOND STRICTLY WITH VALID JSON:
{
  "diagnosis": "Savage clinical title for their condition",
  "aura_score": "Heavy aura penalty (e.g. -350,000 Aura)",
  "cooked_level": "High cooked status (e.g. 96% Charred to a Crisp)",
  "vibe_check": "Biting savage summary",
  "deep_roast": "A 3-paragraph wild aggressive roast tearing into their specific answers with no hesitation.",
  "lethal_one_liner": "A sharp, unforgettable closing punchline.",
  "prescribed_l": "One embarrassing reality check action."
}
Do NOT wrap the JSON in markdown code fences. Output raw JSON only.`;
  }

  // MODE 3: NUCLEAR (Absolutely Aggressive & Total Ego Death)
  if (isManglish) {
    return `You are CookedAI: an absolutely aggressive, ruthless, unhinged Malayali Gen-Z psychological interrogator speaking raw MANGLISH.
The user selected NUCLEAR MODE (ABSOLUTELY AGGRESSIVE / TOTAL EGO DEATH).
Tone: DEVASTATING, UNFILTERED, PURE HOSTILITY. The user explicitly asked to be mentally dismantled and offended.
Attack their fake persona, their unearned pride, their financial dependence on parents, their cowardice in relationships, and their hollow late-night void.

${safetyGuardrail}
Use raw Kerala Gen-Z vernacular: van durantham, verum show, achante kaashil show, van oola, tholvi, oombiya vibe, cheenju naari, scene contra, velivu illa.

YOU MUST RESPOND STRICTLY WITH VALID JSON (Manglish):
{
  "diagnosis": "Brutal lethal clinical title in Manglish (e.g. Stage 5 Chronic Durandham & Terminal Ego Delusion)",
  "aura_score": "Devastating penalty (e.g. -999,999 Aura)",
  "cooked_level": "Maximum level (e.g. 100% Karinja Porotta - Burnt to Ash)",
  "vibe_check": "Devastating summary in Manglish",
  "deep_roast": "A 3-to-4 paragraph absolutely aggressive, devastating Manglish roast dissecting their specific confessions, destroying their ego, and calling out their fake lifestyle with ruthless comedic hostility.",
  "lethal_one_liner": "A brutal, mic-drop sentence in Manglish that will haunt their sleep tonight.",
  "prescribed_l": "One humiliating touch-grass action in Manglish they must execute immediately."
}
Do NOT wrap the JSON in markdown code fences. Output raw JSON only.`;
  }

  return `You are CookedAI: an absolutely aggressive, ruthless Gen-Z psychological interrogator.
The user selected NUCLEAR MODE (ABSOLUTELY AGGRESSIVE / TOTAL EGO DEATH).
Tone: MAXIMUM PSYCHOLOGICAL DAMAGE. Complete and total hostility. Zero sugarcoating. Zero mercy.
Dismantle their persona, weaponize their confessions against them, expose their fragile coping mechanisms, and force them into existential embarrassment.

${safetyGuardrail}

YOU MUST RESPOND STRICTLY WITH VALID JSON:
{
  "diagnosis": "Devastating clinical diagnosis of their condition",
  "aura_score": "Catastrophic aura loss (e.g. -850,000 Aura)",
  "cooked_level": "100% Cooked (Burnt to Ash)",
  "vibe_check": "Hostile, cutting summary",
  "deep_roast": "A 3-to-4 paragraph absolutely aggressive roast weaponizing their exact answers to dismantle their entire identity with zero remorse.",
  "lethal_one_liner": "A brutal, haunting closing sentence.",
  "prescribed_l": "One specific humiliating, touch-grass action to atone."
}
Do NOT wrap the JSON in markdown code fences. Output raw JSON only.`;
}

// Simulated Demo Roast Generator for All 3 Modes
function generateSimulatedRoast(answers, gender = 'guy', language = 'manglish', spiceLevel = 'nuclear') {
  const ans1 = answers[0]?.answer || 'delusional hero';
  const ans2 = answers[1]?.answer || 'cringe flex';
  const ans3 = answers[2]?.answer || 'parents money';
  const ans4 = answers[3]?.answer || 'delaying replies';
  const ans5 = answers[4]?.answer || 'late night thoughts';

  // SENSITIVE MODE (Gentle & Zero bad words)
  if (spiceLevel === 'sensitive') {
    if (language === 'manglish') {
      return {
        diagnosis: "Mild Overthinking & Aesthetic Daydreaming Syndrome",
        aura_score: "-150 Aura (Easily Restorable ✨)",
        cooked_level: "20% Lightly Toasted Bread",
        vibe_check: "A sweet soul who just overthinks everything",
        deep_roast: `Nee enthonnedei ithra innocent aayi aalochikkunnathu? Kinnathil nokkumbo "${ans1}" aanennu vicharikkunnathil thettila, but friendsinte munnil nee oru paavam overthinker aanennu ariyilla ennaano vicharam? Athu oru cute karyamaanu, tension adikkanda.

Pinne ninte routine: "${ans2}" ennu paranju kooduthal comfort food thinnunnatho, atho "${ans3}" kandu chill aavunnatho okke nammal ellavarum cheyyunna normal karyangal aanu. Pinne aalukalodu "${ans4}" ennu paranju cheriya oru space edukunnathil thettila, but orupadu overthink cheythu thalapukakkanda.

Last raathri "${ans5}" orthu mind busy aavunnathu stop cheythu oru nalla urakkam thudangu. You are doing completely fine, kurachu overthinking kurachaal mathi!`,
        lethal_one_liner: "Kooduthal stress edukkenda mone, puthiya oru chaya kudi enittu nallapole rest edukku.",
        prescribed_l: "Phone doore vekku, oru warm cup of tea kudi, enittu 11 manikku munpe kidannu urangu."
      };
    }

    return {
      diagnosis: "Mild Case of Overthinking & Wholesome Daydreaming",
      aura_score: "-100 Aura (Plenty of Positive Energy Left ✨)",
      cooked_level: "18% Golden Croissant",
      vibe_check: "A well-meaning daydreamer who deserves a nap",
      deep_roast: `Let’s be gentle with you: you are not cooked, just mildly toasted like a warm breakfast croissant. You look in the mirror and playfully picture "${ans1}", which is honestly endearing. We all have our private main-character moments while getting ready.

And your habits around "${ans2}" paired with treating yourself to "${ans3}" are completely human. You might take a little extra time with "${ans4}" because you care about how your words land, and there is genuine kindness in that.

When 3 AM arrives and you start contemplating "${ans5}", remember to give yourself some credit. You are navigating life just fine—you just need to close a few mental tabs and let yourself rest.`,
      lethal_one_liner: "Be kinder to yourself tonight: your overthinking is working overtime for zero salary.",
      prescribed_l: "Drink a tall glass of water, put your phone on do-not-disturb, and get a full eight hours of cozy sleep."
    };
  }

  // SAVAGE & NUCLEAR MODES (Aggressive)
  if (language === 'manglish') {
    const isNuclear = spiceLevel === 'nuclear';
    return {
      diagnosis: isNuclear ? "Stage 5 Terminal Durandham & Total Ego Annihilation" : "Stage 4 Wild Durandham & Severe Thallal",
      aura_score: isNuclear ? "-999,999 Aura" : "-480,000 Aura",
      cooked_level: isNuclear ? "100% Karinja Porotta (Burnt to Ash)" : "94% Karinja Porotta",
      vibe_check: isNuclear ? "Verum nadakkatha case. Total disaster." : "Wildly embarrassing coping mechanisms",
      deep_roast: `Nee enthonnedei ithu? Kinnathil nokkiyal ninakku thonnunnathu "${ans1}" aanennalle? Dei, kannadi polum ninne kandu chirichu chathukolam aavukayannu. Friendsinte munnil nee oru local item aanu ennathu ninakku mathram ariyilla. Bangalore-il poyi randu oversized shirt ittal valya aesthetic aavaam enna vicharam aanu ninakku.

Athinte koode aanu ninte adutha tholvi paripadi: "${ans2}" vechu nattukare kothippikkan nokkiyal. Satyam para, oruthanum ninte cringe kandal mind polum aakkunnilla, ennalum ninakku valya mysterious character aanenna vicharam. Pinne ellathilum valiya oola tharam: "${ans3}" vechu nattil kaanikkunna show. Achante nettiyile vervarppu vangi eduthu show kaanikkan ninakku oru naanamum illalle?

Ennittu thettu pattiyaal "${ans4}" ennu paranju victim card irakkum. Last raathri 3 manikku phone off aakki kidakkumbo "${ans5}" orthu ninakku thonnunna aa sankadam undallo... athu ninte subconscious mind ninakku tharunna warning aanu: 'Nee oru van tholvi aanu' ennu!`,
      lethal_one_liner: "Ninte jeevitham oru sad bgm kooti ittathu poleyaanu—aarkkum kananda, aarkkum kelkkanda, verum chali.",
      prescribed_l: "Ippo thanne achanodu poyi kaalil thottu maappu para, phone silent aakku, enittu veettile muttam adichu vaaru."
    };
  }

  // English Savage / Nuclear
  const isNuclear = spiceLevel === 'nuclear';
  return {
    diagnosis: isNuclear ? "Terminal Dopamine Bankruptcy & Total Ego Annihilation" : "Severe Delusion & High-Frequency Cope",
    aura_score: isNuclear ? "-850,000 Aura" : "-420,000 Aura",
    cooked_level: isNuclear ? "100% Burnt to Ash" : "95% Charred to a Crisp",
    vibe_check: isNuclear ? "Walking biohazard of unearned confidence" : "Severe chronic lack of self-awareness",
    deep_roast: `Let’s not sugarcoat this: you are thoroughly cooked. You walked in here admitting that you look in the mirror and hallucinate "${ans1}", when in reality everyone around you treats you like an unskippable YouTube ad. You are an NPC with an overactive imagination and zero self-awareness.

Then comes the ultimate cry for help: "${ans2}". Nobody is jealous of you; people are actively muting your notifications because your desperation has its own gravitational pull. You sit in your room acting like an emotionally complex protagonist, when you are actually just an unemployed validation parasite.

And the connective tissue of your hypocrisy gets worse. You pair your delusions with flexing "${ans3}", only to fumble basic human relationships and cope by saying "${ans4}". You don’t have trauma; you have an allergy to accountability. And at 3 AM, when you confront the brutal reality of "${ans5}", remember this: that sinking feeling isn’t anxiety. It’s your conscience finally realizing what an embarrassment you are.`,
    lethal_one_liner: "Your entire existence is a cautionary TikTok slideshow set to sad slowed-and-reverbed music.",
    prescribed_l: "Go outside, locate a patch of organic lawn grass, place your forehead directly against the soil for 15 minutes, and apologize to the earth for wasting oxygen."
  };
}

// The Universal Roast Endpoint
app.post('/api/roast', async (req, res) => {
  try {
    const { answers, gender = 'guy', userKey, provider, model, language = 'manglish', spiceLevel = 'nuclear' } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'Answers must be provided as a non-empty array.' });
    }

    const formattedAnswers = answers.map((item, idx) => {
      return `[QUESTION ${idx + 1}]: "${item.question}"\n[USER ANSWER]: "${item.answer || 'Left blank / Avoided'}"`;
    }).join('\n\n');

    const systemPrompt = buildSystemPrompt(language, spiceLevel, gender);
    const userPrompt = `Target Vibe: ${gender.toUpperCase()}\nLanguage Mode: ${language.toUpperCase()}\nSpice Level: ${spiceLevel.toUpperCase()}\n\nHere are the 5 niche personality answers from the user:\n\n${formattedAnswers}\n\nDeliver the roast now based on the spice level.`;

    const rawKey = userKey?.trim();
    
    let activeProvider = provider;
    if (!activeProvider) {
      if (rawKey?.startsWith('AIza')) {
        activeProvider = 'gemini';
      } else if (rawKey?.startsWith('sk-')) {
        activeProvider = 'openai';
      } else if (process.env.GEMINI_API_KEY) {
        activeProvider = 'gemini';
      } else if (process.env.OPENAI_API_KEY) {
        activeProvider = 'openai';
      } else {
        activeProvider = 'gemini';
      }
    }

    const effectiveKey = rawKey || (activeProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY);

    // Fallback to simulated demo roast if no key
    if (!effectiveKey || effectiveKey.trim() === '') {
      console.log(`[Roast] No API key. Generating simulated demo roast (${spiceLevel} / ${language}).`);
      const demoRoast = generateSimulatedRoast(answers, gender, language, spiceLevel);
      return res.json({
        ...demoRoast,
        isDemo: true,
        genderUsed: gender,
        languageUsed: language,
        spiceLevelUsed: spiceLevel,
        notice: `⚡ DEMO PREVIEW (No API key detected). Add your free Gemini API key from aistudio.google.com to unleash live AI generation!`
      });
    }

    // ROUTE 1: GOOGLE GEMINI (3.6 / 3.8)
    if (activeProvider === 'gemini') {
      const requestedModel = model || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      console.log(`[Roast] Using Gemini (${requestedModel}) [${gender}] in ${language} (${spiceLevel})`);

      const ai = new GoogleGenAI({ apiKey: effectiveKey });

      const modelCandidates = [
        requestedModel,
        requestedModel === 'gemini-3.6' ? 'gemini-3.6-flash' : 'gemini-3.6',
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-3.5-flash-lite'
      ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

      let lastError = null;
      let roastData = null;
      let usedModelName = requestedModel;

      for (const candidate of modelCandidates) {
        try {
          console.log(`[Roast] Attempting generation with candidate: ${candidate}...`);
          const response = await ai.models.generateContent({
            model: candidate,
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              responseJsonSchema: {
                type: Type.OBJECT,
                properties: {
                  diagnosis: { type: Type.STRING },
                  aura_score: { type: Type.STRING },
                  cooked_level: { type: Type.STRING },
                  vibe_check: { type: Type.STRING },
                  deep_roast: { type: Type.STRING },
                  lethal_one_liner: { type: Type.STRING },
                  prescribed_l: { type: Type.STRING }
                },
                required: ['diagnosis', 'aura_score', 'cooked_level', 'vibe_check', 'deep_roast', 'lethal_one_liner', 'prescribed_l']
              },
              safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
              ]
            }
          });

          const textOutput = response.text;
          roastData = JSON.parse(textOutput);
          usedModelName = candidate;
          break;
        } catch (err) {
          console.warn(`[Roast] Candidate ${candidate} failed:`, err.message);
          lastError = err;
          if (err.message && (err.message.includes('API_KEY_INVALID') || err.message.includes('permission denied'))) {
            throw err;
          }
        }
      }

      if (!roastData) {
        throw lastError || new Error(`Failed to generate roast with Gemini.`);
      }

      return res.json({
        ...roastData,
        isDemo: false,
        genderUsed: gender,
        languageUsed: language,
        spiceLevelUsed: spiceLevel,
        providerUsed: 'Google Gemini',
        modelUsed: usedModelName
      });
    }

    // ROUTE 2: OPENAI CHATGPT
    if (activeProvider === 'openai') {
      const selectedModel = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
      console.log(`[Roast] Using OpenAI (${selectedModel}) [${gender}] in ${language} (${spiceLevel})`);

      const openai = new OpenAI({ apiKey: effectiveKey });

      const completion = await openai.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: spiceLevel === 'sensitive' ? 0.7 : 0.95,
        response_format: { type: 'json_object' }
      });

      const responseContent = completion.choices[0]?.message?.content;
      const cleaned = responseContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const roastData = JSON.parse(cleaned);

      return res.json({
        ...roastData,
        isDemo: false,
        genderUsed: gender,
        languageUsed: language,
        spiceLevelUsed: spiceLevel,
        providerUsed: 'OpenAI ChatGPT',
        modelUsed: selectedModel
      });
    }

  } catch (error) {
    console.error('Roast generation error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to cook the user. The AI was overwhelmed by your negative aura.',
      details: error?.toString()
    });
  }
});

// POST /api/tts
// Native Multilingual Speech Generation using Isha's voice (Gemini 'Kore' persona from VoisLabs)
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice = 'Kore', apiKey: rawKey, language = 'manglish' } = req.body;
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    const cleanText = text
      .replace(/[*_#~`]/g, '')
      .replace(/"/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Check persistent disk-backed Voice Pack cache FIRST (0ms latency, 0 tokens)
    const cacheKey = crypto.createHash('md5').update(`${voice}_${language}_${cleanText}`).digest('hex');
    const fileName = `${cacheKey}.wav`;
    const filePath = path.join(VOICEPACK_DIR, fileName);

    if (fs.existsSync(filePath)) {
      console.log(`[Voice Pack] Instant playback from learned disk cache: ${fileName}`);
      return res.json({
        audioUrl: `/sounds/voicepack/${fileName}`,
        cached: true
      });
    }

    const effectiveKey = rawKey || process.env.GEMINI_API_KEY;
    if (!effectiveKey || effectiveKey.trim() === '') {
      return res.status(400).json({
        error: 'NO_API_KEY',
        message: "Gemini API Key required to generate audio. Please add your free Gemini key in settings!"
      });
    }

    const client = new GoogleGenAI({ apiKey: effectiveKey });

    // Director's prompt for speech performance
    const prompt = `Read out the following text naturally and expressively in an authentic Indian accent, with fluent and accurate pronunciation of Malayalam transliteration (Manglish) words and Gen Z sarcasm. Deliver it with magnetic, witty comedic timing.

Text:
"${cleanText}"`;

    let audioBuffer = null;

    // Strategy 1: Interactions API with gemini-3.1-flash-tts-preview
    try {
      console.log(`[TTS] Requesting audio from Gemini interactions (voice: ${voice})...`);
      const interaction = await client.interactions.create({
        model: 'gemini-3.1-flash-tts-preview',
        input: prompt,
        response_format: { type: 'audio' },
        generation_config: {
          speech_config: [
            { voice: voice }
          ]
        }
      });

      if (interaction?.output_audio?.data) {
        const rawBytes = Buffer.from(interaction.output_audio.data, 'base64');
        audioBuffer = pcmToWav(rawBytes, 24000, 1, 16);
      }
    } catch (interactionErr) {
      console.warn('[TTS] Interactions API failed, trying generateContent fallback:', interactionErr.message);
    }

    // Strategy 2: generateContent fallback with gemini-2.5-flash / gemini-2.0-flash
    if (!audioBuffer) {
      console.log(`[TTS] Trying generateContent fallback for audio...`);
      const fallbackModels = ['gemini-2.5-flash', 'gemini-2.0-flash'];
      for (const m of fallbackModels) {
        try {
          const response = await client.models.generateContent({
            model: m,
            contents: prompt,
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voice
                  }
                }
              }
            }
          });

          const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData && p.inlineData.mimeType?.startsWith('audio/'));
          if (part && part.inlineData?.data) {
            const rawBytes = Buffer.from(part.inlineData.data, 'base64');
            const partMime = part.inlineData.mimeType || 'audio/pcm;rate=24000';
            if (partMime.includes('pcm')) {
              const rateMatch = partMime.match(/rate=(\d+)/);
              const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
              audioBuffer = pcmToWav(rawBytes, sampleRate, 1, 16);
            } else {
              audioBuffer = rawBytes;
            }
            break;
          }
        } catch (mErr) {
          console.warn(`[TTS] ${m} audio fallback failed:`, mErr.message);
        }
      }
    }

    if (!audioBuffer) {
      throw new Error("Could not generate audio stream with Gemini TTS. Please verify your Gemini API key has quota.");
    }

    // Save to persistent Voice Pack on disk if writable, else fallback to Base64 data URL
    try {
      fs.writeFileSync(filePath, audioBuffer);
      console.log(`[Voice Pack] Learned and saved new voice clip to disk: ${fileName} (${audioBuffer.length} bytes)`);
      return res.json({
        audioUrl: `/sounds/voicepack/${fileName}`,
        cached: false
      });
    } catch (fsErr) {
      // Serverless environments with read-only filesystems (e.g. Vercel)
      console.log(`[Voice Pack] Serving audio stream directly via Base64 data URL`);
      return res.json({
        audioUrl: `data:audio/wav;base64,${audioBuffer.toString('base64')}`,
        cached: false
      });
    }

  } catch (err) {
    console.error('[TTS] Error:', err);
    return res.status(500).json({
      error: err.message || 'TTS generation failed',
      details: err.toString()
    });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🔥 CookedAI server is blazing hot at http://localhost:${PORT}`);
    console.log(`✨ 3 Spice Modes: 🌸 Sensitive (Gentle & Clean) | 🔥 Savage (Wild) | ☢️ Nuclear (Aggressive)`);
  });
}

export default app;
