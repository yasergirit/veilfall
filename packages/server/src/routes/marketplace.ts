import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { mockDb } from '../db/mock-db.js';
import { z } from 'zod';

const createOfferSchema = z.object({
  settlementId: z.string().uuid(),
  offerResource: z.string().min(1),
  offerAmount: z.number().int().positive(),
  requestResource: z.string().min(1),
  requestAmount: z.number().int().positive(),
});

const acceptOfferSchema = z.object({
  settlementId: z.string().uuid(),
});

export async function marketplaceRoutes(app: FastifyInstance) {
  // Create a trade offer (escrow: resources deducted immediately)
  app.post('/offer', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const body = createOfferSchema.parse(request.body);

    const settlement = mockDb.getSettlement(body.settlementId);
    if (!settlement || settlement.playerId !== player.id) {
      return reply.status(404).send({ error: 'Settlement not found' });
    }

    // Validate marketplace building exists
    const hasMarketplace = settlement.buildings.some((b) => b.type === 'marketplace');
    if (!hasMarketplace) {
      return reply.status(400).send({ error: 'Settlement requires a marketplace building' });
    }

    // Cannot trade same resource for itself
    if (body.offerResource === body.requestResource) {
      return reply.status(400).send({ error: 'Cannot trade a resource for itself' });
    }

    // Check sufficient resources for escrow
    if ((settlement.resources[body.offerResource] ?? 0) < body.offerAmount) {
      return reply.status(400).send({ error: `Not enough ${body.offerResource}` });
    }

    // Deduct escrowed resources
    settlement.resources[body.offerResource] -= body.offerAmount;
    mockDb.updateSettlement(body.settlementId, { resources: settlement.resources });

    const offer = mockDb.createTradeOffer({
      id: crypto.randomUUID(),
      sellerId: player.id,
      settlementId: body.settlementId,
      offerResource: body.offerResource,
      offerAmount: body.offerAmount,
      requestResource: body.requestResource,
      requestAmount: body.requestAmount,
      status: 'open',
      createdAt: Date.now(),
    });

    return { message: 'Trade offer created', offer, resources: settlement.resources };
  });

  // Get open trade offers, optionally filtered by resource
  app.get('/offers', { preHandler: requireAuth }, async (request) => {
    const { resource } = request.query as { resource?: string };
    const offers = mockDb.getOpenTradeOffers(resource);
    return { offers };
  });

  // Accept a trade offer
  app.post('/accept/:offerId', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { offerId } = request.params as { offerId: string };
    const body = acceptOfferSchema.parse(request.body);

    const offer = mockDb.getTradeOffer(offerId);
    if (!offer || offer.status !== 'open') {
      return reply.status(404).send({ error: 'Trade offer not found or no longer open' });
    }

    // Cannot accept own offer
    if (offer.sellerId === player.id) {
      return reply.status(400).send({ error: 'Cannot accept your own trade offer' });
    }

    const buyerSettlement = mockDb.getSettlement(body.settlementId);
    if (!buyerSettlement || buyerSettlement.playerId !== player.id) {
      return reply.status(404).send({ error: 'Settlement not found' });
    }

    // Validate buyer has marketplace
    const hasMarketplace = buyerSettlement.buildings.some((b) => b.type === 'marketplace');
    if (!hasMarketplace) {
      return reply.status(400).send({ error: 'Your settlement requires a marketplace building' });
    }

    // Validate buyer has requested resources
    if ((buyerSettlement.resources[offer.requestResource] ?? 0) < offer.requestAmount) {
      return reply.status(400).send({ error: `Not enough ${offer.requestResource}` });
    }

    // Deduct requested resources from buyer
    buyerSettlement.resources[offer.requestResource] -= offer.requestAmount;
    // Give buyer the offered resources
    buyerSettlement.resources[offer.offerResource] = (buyerSettlement.resources[offer.offerResource] ?? 0) + offer.offerAmount;
    mockDb.updateSettlement(buyerSettlement.id, { resources: buyerSettlement.resources });

    // Give seller the requested resources
    const sellerSettlement = mockDb.getSettlement(offer.settlementId);
    if (sellerSettlement) {
      sellerSettlement.resources[offer.requestResource] = (sellerSettlement.resources[offer.requestResource] ?? 0) + offer.requestAmount;
      mockDb.updateSettlement(sellerSettlement.id, { resources: sellerSettlement.resources });
    }

    // Mark offer as completed
    mockDb.updateTradeOffer(offerId, { status: 'completed', completedBy: player.id });

    return { message: 'Trade completed', buyerResources: buyerSettlement.resources };
  });

  // Cancel own trade offer, return escrowed resources
  app.post('/cancel/:offerId', { preHandler: requireAuth }, async (request, reply) => {
    const player = request.user;
    const { offerId } = request.params as { offerId: string };

    const offer = mockDb.getTradeOffer(offerId);
    if (!offer || offer.status !== 'open') {
      return reply.status(404).send({ error: 'Trade offer not found or no longer open' });
    }

    if (offer.sellerId !== player.id) {
      return reply.status(403).send({ error: 'You can only cancel your own offers' });
    }

    // Return escrowed resources to seller settlement
    const settlement = mockDb.getSettlement(offer.settlementId);
    if (settlement) {
      settlement.resources[offer.offerResource] = (settlement.resources[offer.offerResource] ?? 0) + offer.offerAmount;
      mockDb.updateSettlement(settlement.id, { resources: settlement.resources });
    }

    mockDb.updateTradeOffer(offerId, { status: 'cancelled' });

    return { message: 'Trade offer cancelled', resources: settlement?.resources };
  });

  // Player's trade history (last 50)
  app.get('/history', { preHandler: requireAuth }, async (request) => {
    const player = request.user;
    const history = mockDb.getTradeOffersByPlayer(player.id, 50);
    return { history };
  });
}
