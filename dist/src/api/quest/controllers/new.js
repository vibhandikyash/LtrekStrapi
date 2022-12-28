"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ({ strapi }) => ({
    async index(ctx) {
        const { lat, lng, rad } = ctx.request.query;
        const lonQuery = `SELECT DISTINCT ON(quest_id)quest_id,longitude FROM
    quests_locations_links LEFT JOIN locations ON quests_locations_links.location_id
    = locations.id ORDER BY quest_id,quests_locations_links.id`;
        const latQuery = `SELECT DISTINCT ON(quest_id)quest_id,latitude FROM
    quests_locations_links LEFT JOIN locations ON quests_locations_links.location_id
    = locations.id ORDER BY quest_id,quests_locations_links.id`;
        const query = await strapi.db.connection.raw(`WITH lonQuery AS (${lonQuery}),latQuery AS (${latQuery}) SELECT * FROM quests t1 INNER JOIN ST_DistanceSphere(ST_MakePoint((SELECT longitude FROM lonQuery WHERE lonQuery.quest_id = t1.id),(SELECT latitude FROM latQuery WHERE latQuery.quest_id = t1.id)),ST_MakePoint(${lng},${lat})) AS distance ON ST_DistanceSphere(ST_MakePoint((SELECT longitude FROM lonQuery WHERE lonQuery.quest_id = t1.id),(SELECT latitude FROM latQuery WHERE latQuery.quest_id = t1.id)),
      ST_MakePoint(${lng},${lat})) <= ${rad} * 1000 ORDER BY distance`);
        const entries = await strapi.entityService.findMany("api::quest.quest", {
            populate: "locations",
        });
        let result = entries.filter((o1) => query.rows.some((o2) => o1.id === o2.id));
        const results = query.rows.map((item) => result.find((g) => g.id == item.id)
            ? { ...item, locations: result.find((g) => g.id == item.id).locations }
            : item);
        // const result1 = query.rows.map((item) => ({
        //   ...item,
        //   locations: result.find((g) => g.id == item.id).locations,
        // }));
        return {
            count: results.length,
            results: results,
        };
    },
});
