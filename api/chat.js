const BOT_ID = '7660924167990198315';
const API_TOKEN = 'sat_mjPtWRWDBO83gh1kE6SLNlWZqUjGDJp7Rc2rQiYxkp71PfOPKtZvUY0Nqrw3EHzX';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, conversation_id } = req.body;
    if (!text) return res.status(200).json({ error: '缺少问题内容', reply: '' });

    const chatBody = {
      bot_id: BOT_ID,
      user_id: 'web_' + Math.random().toString(36).substr(2, 9),
      stream: false,
      auto_save_history: true,
      additional_messages: [{ role: 'user', content: text, content_type: 'text' }]
    };
    if (conversation_id) chatBody.conversation_id = conversation_id;

    const chatRes = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + API_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(chatBody)
    });
    const chatResult = await chatRes.json();
    if (chatResult.code !== 0) return res.status(200).json({ error: 'API错误: ' + (chatResult.msg || '未知错误'), reply: '' });

    const chatId = chatResult.data?.id;
    const convId = chatResult.data?.conversation_id;
    if (!chatId) return res.status(200).json({ error: '未返回对话ID', reply: '' });

    let status = chatResult.data?.status;
    let attempts = 0;
    while (status !== 'completed' && status !== 'failed' && attempts < 20) {
      await sleep(1000);
      attempts++;
      const statusRes = await fetch(`https://api.coze.cn/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${convId || conversation_id}`, {
        headers: { 'Authorization': 'Bearer ' + API_TOKEN }
      });
      const statusData = await statusRes.json();
      status = statusData.data?.status;
    }
    if (status === 'failed') return res.status(200).json({ error: '对话处理失败', reply: '' });

    const msgRes = await fetch(`https://api.coze.cn/v3/chat/message/list?chat_id=${chatId}&conversation_id=${convId || conversation_id}`, {
      headers: { 'Authorization': 'Bearer ' + API_TOKEN }
    });
    const msgData = await msgRes.json();

    let reply = '抱歉，未能获取到回复。';
    if (msgData.data && msgData.data.length > 0) {
      const answers = msgData.data.filter(m => m.role === 'assistant' && m.type === 'answer');
      if (answers.length > 0) reply = answers[answers.length - 1].content;
    }
    res.status(200).json({ reply, conversation_id: convId || conversation_id });
  } catch (e) {
    res.status(200).json({ error: e.message, reply: '' });
  }
}
