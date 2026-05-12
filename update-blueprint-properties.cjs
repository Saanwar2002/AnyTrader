const fs = require('fs');
const path = require('path');
const bp = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8'));

bp.entities.Property = {
  title: "Property",
  description: "A property asset managed under the homeowner/business platform.",
  type: "object",
  properties: {
    id: { type: "string" },
    ownerId: { type: "string" },
    usageType: { type: "string", enum: ["long_term_rental", "short_term_let", "agency_managed", "personal"] },
    address: {
      type: "object",
      properties: {
        line1: { type: "string" },
        line2: { type: "string" },
        city: { type: "string" },
        postcode: { type: "string" },
        country: { type: "string" }
      }
    },
    propertyType: { type: "string", enum: ["apartment", "house", "commercial", "warehouse", "other"] },
    status: { type: "string", enum: ["active", "archived"] },
    bedrooms: { type: "integer" },
    bathrooms: { type: "integer" },
    photos: { type: "array", items: { type: "string" } },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" }
  },
  required: ["id", "ownerId", "usageType", "address", "propertyType", "status", "createdAt"]
};

bp.firestore["/properties/{propertyId}"] = {
  schema: "Property",
  description: "Properties registered by landlords, Airbnb hosts, or estate agents"
};

fs.writeFileSync('firebase-blueprint.json', JSON.stringify(bp, null, 2));

console.log("Updated firebase-blueprint.json with Property entity");
