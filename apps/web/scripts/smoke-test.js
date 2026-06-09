(async function(){
  const port = process.env.PORT || 3001;
  const url = `http://localhost:${port}/api/worker`;
  console.log('Testing', url);
  try {
    const res = await fetch(url, { method: 'GET' });
    const json = await res.json();
    if (json && json.message && json.message.includes('CareerKaki')) {
      console.log('SMOKE TEST PASSED');
      process.exit(0);
    } else {
      console.error('SMOKE TEST FAILED: unexpected response', json);
      process.exit(2);
    }
  } catch (err) {
    console.error('SMOKE TEST FAILED: error', err.message || err);
    process.exit(1);
  }
})();
