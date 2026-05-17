
async function test() {
  const url = 'https://b23.tv/6mS8E6B'; // Replace with a real short link if possible
  console.log(`Testing short link: ${url}`);
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    console.log('Resolved URL (HEAD):', response.url);
    console.log('Status:', response.status);

    const responseGet = await fetch(url, { method: 'GET', redirect: 'follow' });
    console.log('Resolved URL (GET):', responseGet.url);
    console.log('Status:', responseGet.status);
  } catch (e: any) {
    console.error('Test failed:', e.message);
  }
}

test();
