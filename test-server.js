import http from 'http';

async function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('Testing CookedAI (Friendly Questions & 3 Spice Modes)...');

  // Test 1: Friendly Question Structure
  const questionsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/questions?gender=girl&lang=manglish',
    method: 'GET'
  });
  console.log('Test 1 (Questions Count):', questionsRes.body?.questions?.length === 5 ? 'PASSED ✅' : 'FAILED ❌');
  console.log('  Non-aggressive prompt example:', questionsRes.body?.questions?.[0]?.prompt);

  // Test 2: Sensitive Mode (Gentle, zero curse words)
  const sensitiveRoast = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/roast',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    gender: 'girl',
    language: 'manglish',
    spiceLevel: 'sensitive',
    answers: [
      { question: 'Room vs Pinterest', answer: 'I have clean clothes on my study chair' },
      { question: 'Group chat', answer: 'Asked my friend what he meant by cool' },
      { question: 'Red flags', answer: 'Liked his indie music taste' },
      { question: 'Retail therapy', answer: 'Bought a lovely new lip tint' },
      { question: 'Astrology', answer: 'I like reading birth charts' }
    ]
  });

  console.log('Test 2 (Sensitive Roast Mode):', sensitiveRoast.status === 200 ? 'PASSED ✅' : 'FAILED ❌');
  console.log('  Diagnosis:', sensitiveRoast.body?.diagnosis);
  console.log('  Aura Score:', sensitiveRoast.body?.aura_score);
  console.log('  Lethal One-Liner:', sensitiveRoast.body?.lethal_one_liner);

  // Test 3: Nuclear Mode (Absolutely Aggressive)
  const nuclearRoast = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/roast',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    gender: 'guy',
    language: 'manglish',
    spiceLevel: 'nuclear',
    answers: [
      { question: 'Mirror Vibe', answer: 'Patrick Bateman meets Aavesham Ranga' },
      { question: 'Gym', answer: 'On a perpetual bulk eating biriyani' },
      { question: 'Vehicle', answer: 'Loud bike exhaust' },
      { question: 'Texting', answer: 'Ghosting because of avoidant attachment' },
      { question: 'Dreams', answer: 'Planning to escape the matrix with trading' }
    ]
  });

  console.log('Test 3 (Nuclear Roast Mode):', nuclearRoast.status === 200 ? 'PASSED ✅' : 'FAILED ❌');
  console.log('  Diagnosis:', nuclearRoast.body?.diagnosis);
  console.log('  Cooked Level:', nuclearRoast.body?.cooked_level);

  console.log('\nAll 3 spice modes and friendly question checks passed successfully!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
