export default async function decorate(block) {
  try {
    const response = await fetch('/tools/tools-query-index.json');

    block.innerHTML = `
      <h2>Status: ${response.status}</h2>
    `;
  } catch (e) {
    block.innerHTML = `
      <h2>Error</h2>
      <pre>${e.message}</pre>
    `;
  }
}