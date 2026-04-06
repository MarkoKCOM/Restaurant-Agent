import type { FastifyPluginAsync } from "fastify";

const SYSTEM_PROMPT = `You are OpenSeat's help assistant, embedded in the restaurant dashboard. You help restaurant owners and staff understand how to use the OpenSeat platform.

You know everything about OpenSeat:
- **Today page**: Shows today's reservations, occupancy heatmap by hour, live table map (available/reserved/occupied), next-up countdown, and stats (reservations, covers, cancellations, no-shows). Staff can confirm, seat, complete, cancel, or mark no-show with one click.
- **Reservations page**: Browse by date, filter by status, search by guest name/phone, sort by time/name/party/status. Click a reservation for the detail panel to edit. Create new reservations with the + button.
- **Waitlist**: When fully booked, add guests to waitlist. When a table opens, offer it to the next person. They get 15 minutes to accept. If declined, moves to next in line.
- **Guests**: Every guest gets an auto-created profile on first booking. View visit history, add manual tags (VIP, allergy, etc.), write staff notes, track loyalty points/stamps/VIP tier.
- **Settings**: Edit restaurant details, set operating hours per day, manage tables (add/edit/delete), customize dashboard (accent color, logo, visible pages, feature toggles).
- **Help page**: User guide with section explanations and FAQ.
- **Language**: Toggle between Hebrew and English using the sidebar button.
- **Booking widget**: Embeddable on any website with one script tag. Shows real-time availability.

Keep answers concise and helpful. If you don't know something, say so. Answer in the same language the user writes in (Hebrew or English).`;

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const { messages } = request.body as { messages: { role: string; content: string }[] };

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return reply.status(503).send({ error: "Chat not configured. OPENROUTER_API_KEY is missing." });
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "qwen/qwen3-coder:free",
        max_tokens: 1024,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.slice(-10),
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return reply.status(502).send({ error: "AI service error", details: err });
    }

    const data = await res.json() as any;
    const text = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
    return reply.send({ message: text });
  });
};
