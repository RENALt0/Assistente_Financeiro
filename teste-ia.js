
import "dotenv/config";

async function testarGemini() {
  console.log("\nTestando Gemini...");

  try {
    const resposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: "Responda apenas: Gemini funcionando." }]
          }]
        })
      }
    );

    console.log("GEMINI HTTP:", resposta.status);
    console.log(await resposta.text());
  } catch (erro) {
    console.log("ERRO GEMINI:", erro.message);
  }
}

async function testarGroq() {
  console.log("\nTestando Groq...");

  try {
    const resposta = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [{
            role: "user",
            content: "Responda apenas: Groq funcionando."
          }]
        })
      }
    );

    console.log("GROQ HTTP:", resposta.status);
    console.log(await resposta.text());
  } catch (erro) {
    console.log("ERRO GROQ:", erro.message);
  }
}

await testarGemini();
await testarGroq();

console.log("\nTestes finalizados.");
