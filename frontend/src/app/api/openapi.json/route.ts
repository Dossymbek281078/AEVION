import type { NextRequest } from "next/server";

const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "AEVION Payments Rail API",
    version: "1.0.0",
    description:
      "REST API for the AEVION Payments Rail. All endpoints are JSON over HTTPS, Bearer-token auth, with optional Idempotency-Key header on POSTs.",
    contact: { name: "AEVION", url: "https://aevion.app/payments/api" },
    license: { name: "Proprietary" },
  },
  servers: [{ url: "https://aevion.app/api/payments", description: "Production" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "Use a key beginning with sk_test_… or sk_live_…",
      },
    },
    parameters: {
      IdempotencyKey: {
        name: "Idempotency-Key",
        in: "header",
        required: false,
        schema: { type: "string" },
        description:
          "Provide a unique value to safely retry POSTs. Replays return the cached response.",
      },
    },
    schemas: {
      Currency: { type: "string", enum: ["USD", "EUR", "KZT", "AEC"] },
      LinkStatus: { type: "string", enum: ["active", "paid", "expired"] },
      SettlementTarget: { type: "string", enum: ["bank", "aec"] },
      Interval: {
        type: "string",
        enum: ["weekly", "monthly", "quarterly", "yearly"],
      },
      SubStatus: {
        type: "string",
        enum: ["trialing", "active", "past_due", "paused", "canceled"],
      },
      Event: {
        type: "string",
        enum: [
          "checkout.created",
          "checkout.completed",
          "payment.failed",
          "payment.refunded",
          "settlement.scheduled",
          "settlement.paid",
        ],
      },
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["type", "message"],
            properties: {
              type: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
      Link: {
        type: "object",
        required: ["id", "amount", "currency", "title", "status", "url", "created"],
        properties: {
          id: { type: "string", example: "pl_q9w2k47abc" },
          amount: {
            type: "integer",
            description: "Minor units of the chosen currency.",
            example: 9900,
          },
          currency: { $ref: "#/components/schemas/Currency" },
          title: { type: "string" },
          description: { type: "string" },
          settlement: { $ref: "#/components/schemas/SettlementTarget" },
          expires_in_days: { type: ["integer", "null"] },
          status: { $ref: "#/components/schemas/LinkStatus" },
          created: { type: "integer", description: "Unix seconds" },
          paid_at: { type: ["integer", "null"] },
          url: { type: "string", format: "uri" },
        },
      },
      LinkCreate: {
        type: "object",
        required: ["amount", "currency", "title"],
        properties: {
          amount: { type: "integer", minimum: 1, example: 9900 },
          currency: { $ref: "#/components/schemas/Currency" },
          title: { type: "string" },
          description: { type: "string" },
          settlement: { $ref: "#/components/schemas/SettlementTarget" },
          expires_in_days: { type: "integer", minimum: 1 },
        },
      },
      Checkout: {
        type: "object",
        required: ["id", "amount", "currency", "url", "client_secret", "status", "created"],
        properties: {
          id: { type: "string", example: "co_a3f7m1xyz" },
          amount: { type: "integer" },
          currency: { $ref: "#/components/schemas/Currency" },
          settlement: { type: "string" },
          methods: { type: "array", items: { type: "string" } },
          metadata: { type: ["object", "null"], additionalProperties: { type: "string" } },
          url: { type: "string", format: "uri" },
          client_secret: { type: "string" },
          status: { type: "string", enum: ["open", "completed"] },
          created: { type: "integer" },
        },
      },
      CheckoutCreate: {
        type: "object",
        required: ["amount", "currency"],
        properties: {
          amount: { type: "integer", minimum: 1 },
          currency: { $ref: "#/components/schemas/Currency" },
          settlement: { type: "string", default: "aevion-bank" },
          methods: { type: "array", items: { type: "string" } },
          metadata: { type: "object", additionalProperties: { type: "string" } },
        },
      },
      Subscription: {
        type: "object",
        required: [
          "id",
          "customer",
          "plan_name",
          "amount",
          "currency",
          "interval",
          "status",
          "current_period_end",
        ],
        properties: {
          id: { type: "string", example: "sub_abc123" },
          customer: { type: "string" },
          plan_name: { type: "string" },
          amount: { type: "integer" },
          currency: { $ref: "#/components/schemas/Currency" },
          interval: { $ref: "#/components/schemas/Interval" },
          trial_days: { type: "integer", default: 0 },
          status: { $ref: "#/components/schemas/SubStatus" },
          current_period_start: { type: "integer" },
          current_period_end: { type: "integer" },
          created: { type: "integer" },
        },
      },
      SubscriptionCreate: {
        type: "object",
        required: ["customer", "plan_name", "amount", "currency", "interval"],
        properties: {
          customer: { type: "string" },
          plan_name: { type: "string" },
          amount: { type: "integer", minimum: 1 },
          currency: { $ref: "#/components/schemas/Currency" },
          interval: { $ref: "#/components/schemas/Interval" },
          trial_days: { type: "integer", minimum: 0 },
        },
      },
      Webhook: {
        type: "object",
        required: ["id", "url", "events", "secret", "enabled", "created"],
        properties: {
          id: { type: "string", example: "we_abc123" },
          url: { type: "string", format: "uri" },
          events: { type: "array", items: { $ref: "#/components/schemas/Event" } },
          secret: {
            type: "string",
            description:
              "HMAC-SHA256 signing secret. Returned in full only on creation; GET list shows masked prefix.",
          },
          enabled: { type: "boolean" },
          created: { type: "integer" },
        },
      },
      WebhookCreate: {
        type: "object",
        required: ["url", "events"],
        properties: {
          url: { type: "string", format: "uri" },
          events: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/Event" },
          },
        },
      },
      Settlement: {
        type: "object",
        required: ["id", "amount", "currency", "status", "scheduled_for"],
        properties: {
          id: { type: "string" },
          amount: { type: "integer" },
          currency: { $ref: "#/components/schemas/Currency" },
          status: {
            type: "string",
            enum: ["pending", "scheduled", "paid"],
          },
          target: { $ref: "#/components/schemas/SettlementTarget" },
          scheduled_for: { type: "integer" },
          paid_at: { type: ["integer", "null"] },
          reference: { type: "string" },
          payments: { type: "integer" },
          royalty: {
            type: "array",
            items: {
              type: "object",
              required: ["party", "share"],
              properties: {
                party: { type: "string" },
                share: { type: "number", minimum: 0, maximum: 1 },
              },
            },
          },
        },
      },
      List: {
        type: "object",
        required: ["data", "has_more"],
        properties: {
          data: { type: "array", items: {} },
          has_more: { type: "boolean" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid Authorization header.",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error" } },
        },
      },
      BadRequest: {
        description: "Validation error on the request body or query.",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error" } },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/v1/links": {
      get: {
        summary: "List payment links",
        operationId: "listLinks",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 25 } },
        ],
        responses: {
          "200": {
            description: "A page of links.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/List" } },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        summary: "Create a payment link",
        operationId: "createLink",
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LinkCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "Link created.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Link" } },
            },
          },
          "200": {
            description:
              "Idempotent replay — returns the original response body for the same Idempotency-Key.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Link" } },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/v1/links/{id}": {
      get: {
        summary: "Retrieve a link",
        operationId: "getLink",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "The link.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Link" } },
            },
          },
          "404": {
            description: "No link with that id.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/v1/checkout": {
      post: {
        summary: "Create a checkout session",
        operationId: "createCheckout",
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CheckoutCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "Checkout created.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Checkout" } },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/v1/subscriptions": {
      get: {
        summary: "List subscriptions",
        operationId: "listSubscriptions",
        responses: {
          "200": {
            description: "Subscriptions list.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/List" } },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        summary: "Create a subscription",
        operationId: "createSubscription",
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SubscriptionCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "Subscription created.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Subscription" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/v1/webhooks": {
      get: {
        summary: "List webhook endpoints",
        operationId: "listWebhooks",
        responses: {
          "200": {
            description: "Webhooks list (secrets masked).",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/List" } },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        summary: "Register a webhook endpoint",
        operationId: "createWebhook",
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WebhookCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "Webhook registered. Secret returned in full once.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Webhook" } },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/v1/settlements": {
      get: {
        summary: "List settlements",
        operationId: "listSettlements",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["pending", "scheduled", "paid"] },
          },
          {
            name: "currency",
            in: "query",
            schema: { $ref: "#/components/schemas/Currency" },
          },
          { name: "limit", in: "query", schema: { type: "integer", default: 25 } },
        ],
        responses: {
          "200": {
            description: "Settlements list.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/List" } },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
  },
} as const;

export function GET(_req: NextRequest) {
  return Response.json(SPEC, {
    headers: {
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
    },
  });
}
