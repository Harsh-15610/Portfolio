const chat = document.getElementById('chat');
const form = document.getElementById('chat-form');
const messageInput = document.getElementById('message');
const template = document.getElementById('message-template');

function addMessage(role, content, sources = []) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector('.message__role').textContent = role;
  node.querySelector('.message__content').textContent = content;

  const sourceList = node.querySelector('.sources');
  if (sources.length) {
    sourceList.innerHTML = sources
      .map((item) => `<li><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a></li>`)
      .join('');
  } else {
    sourceList.remove();
  }

  chat.appendChild(node);
  chat.scrollTop = chat.scrollHeight;
}

addMessage('Assistant', 'Hi! I have internet access through live search. Ask me anything.');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  addMessage('You', message);
  messageInput.value = '';

  addMessage('Assistant', 'Searching the web...');
  const thinkingNode = chat.lastElementChild;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Unknown API error');
    }

    thinkingNode.querySelector('.message__content').textContent = data.answer;
    const sources = data.sources || [];

    if (sources.length) {
      const sourceList = thinkingNode.querySelector('.sources');
      sourceList.innerHTML = sources
        .map((item) => `<li><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a></li>`)
        .join('');
    } else {
      thinkingNode.querySelector('.sources').remove();
    }
  } catch (error) {
    thinkingNode.querySelector('.message__content').textContent = `Sorry, request failed: ${error.message}`;
    const source = thinkingNode.querySelector('.sources');
    if (source) source.remove();
  }
});
