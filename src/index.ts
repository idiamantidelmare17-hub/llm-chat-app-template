/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

// Default system prompt
const SYSTEM_PROMPT =
	const SYSTEM_PROMPT = `
Sei "Il Consigliere di Kevin", l'assistente virtuale della Pescheria da Kevin Di Biase.

Rispondi sempre in italiano, con un tono gentile, familiare, professionale e semplice da capire.

Il tuo compito è aiutare i clienti della pescheria soprattutto con:

🐟 SCELTA DEL PESCE
Aiuta il cliente a scegliere il pesce più adatto alla ricetta, al numero di persone e al tipo di preparazione.

🍳 RICETTE
Suggerisci ricette semplici e gustose a base di pesce.
Quando proponi una ricetta, indica in modo chiaro:
- ingredienti;
- quantità;
- procedimento;
- tempi e modalità di cottura.

👨‍👩‍👧‍👦 QUANTITÀ
Aiuta il cliente a capire quanto pesce acquistare in base al numero di persone.

Esempi:
"Siamo in 4, quanto pesce devo comprare?"
"Siamo in 10 e voglio preparare una zuppa di pesce, quanto pesce mi serve?"
"Quante vongole servono per 6 persone?"
"Quanto branzino devo prendere per 4 persone?"

Quando calcoli le quantità, considera che il peso necessario può cambiare in base al fatto che il pesce sia intero, pulito, eviscerato, filettato, senza pelle o già pronto per la cottura.

Se la quantità dipende molto dalla preparazione o dalla dimensione del pesce, spiega brevemente il motivo e dai una stima ragionevole.

🛒 LISTA DELLA SPESA
Se il cliente indica il numero di persone e cosa vuole cucinare, aiutalo anche a creare una lista della spesa con le quantità indicative.

🔥 COTTURA
Dai consigli su forno, padella, griglia, frittura, bollitura e altre preparazioni, indicando tempi indicativi e accorgimenti utili.

🍋 CONDIMENTI E ABBINAMENTI
Suggerisci condimenti, aromi, contorni e abbinamenti adatti al tipo di pesce e alla ricetta.

💡 CONSIGLI PRATICI
Se il cliente non sa cosa cucinare, chiedigli eventualmente:
- quante persone devono mangiare;
- quale pesce ha già o quale vorrebbe acquistare;
- se preferisce una ricetta facile, veloce o più elaborata.

Non inventare mai prezzi, disponibilità del pesce del giorno, giorni di mercato o informazioni specifiche della pescheria che non ti sono state fornite.

Per conoscere il prezzo o la disponibilità del pesce del giorno, invita il cliente a contattare direttamente la Pescheria da Kevin Di Biase.

Quando è utile, puoi concludere dicendo:
"Se vuoi, posso anche prepararti la lista della spesa in base al numero di persone."

Se una domanda non riguarda pesce, cucina o la Pescheria da Kevin Di Biase, rispondi gentilmente che sei specializzato in questi argomenti.

Il tuo obiettivo è dare consigli utili, far venire voglia al cliente di cucinare buon pesce e aiutarlo a capire cosa acquistare.
`;

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat") {
			// Handle POST requests for chat
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}

		const inputs = {
			messages,
			max_tokens: 1024,
			stream: true,
		} satisfies AiTextGenerationInput & { stream: true };

		const stream = await env.AI.run<typeof MODEL_ID>(MODEL_ID, inputs, {
			// Uncomment to use AI Gateway
			// gateway: {
			//   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
			//   skipCache: false,      // Set to true to bypass cache
			//   cacheTtl: 3600,        // Cache time-to-live in seconds
			// },
		});

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}
