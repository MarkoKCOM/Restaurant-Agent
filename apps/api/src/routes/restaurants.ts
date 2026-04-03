import type { FastifyInstance } from "fastify";

export async function restaurantRoutes(app: FastifyInstance) {
  // GET /:id — restaurant details
  app.get("/:id", async (request) => {
    const { id } = request.params as { id: string };
    // TODO: fetch restaurant with config
    return { restaurant: null, id };
  });

  // PATCH /:id — update restaurant settings
  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    // TODO: update restaurant details, hours, widget config
    return { message: "restaurant updated", id };
  });

  // GET /:id/dashboard — dashboard snapshot
  app.get("/:id/dashboard", async (request) => {
    const { id } = request.params as { id: string };
    // TODO: aggregate today's stats, upcoming reservations, occupancy
    return {
      restaurantId: id,
      today: { reservations: 0, covers: 0, cancellations: 0, noShows: 0 },
      upcoming: [],
    };
  });
}
